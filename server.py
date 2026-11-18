import asyncio
import json
import logging
from fractions import Fraction
from itertools import chain, islice
import os
import re
import shutil
from pathlib import Path
from tempfile import TemporaryDirectory
from urllib.parse import urlsplit
from uuid import uuid4

import av
from aiohttp import ClientError, ClientSession, ClientTimeout, WSMsgType, web

from workflow import CUSTOM_NODES, MODELS, OUTPUT, VIDEO_OPERATIONS, make_prompt

ROOT = Path(__file__).resolve().parent
COMFY_DATA = Path.home() / "services/comfyui/data"
INPUT = COMFY_DATA / "input/okapi"
OUTPUT_DIR = COMFY_DATA / "output/okapi"
JOBS = ROOT / "jobs"
ENGINE = os.environ.get("OKAPI_ENGINE", "http://127.0.0.1:8188")
SEGMENT_FRAMES = 121
MAX_UPLOAD = 250 * 1024 * 1024
VIDEO_SUFFIXES = {".mp4", ".mov", ".m4v", ".webm", ".mkv"}
routes = web.RouteTableDef()


@web.middleware
async def handle_errors(request, handler):
    if request.method == "POST":
        origin = request.headers.get("Origin")
        if request.headers.get("Sec-Fetch-Site") == "cross-site" or (origin and urlsplit(origin).netloc != request.host):
            return web.json_response({"error": "Cross-site request blocked."}, status=403)
    try:
        return await handler(request)
    except (ClientError, TimeoutError):
        return web.json_response({"error": "ComfyUI is temporarily unreachable."}, status=503)
    except web.HTTPException as exc:
        if request.path.startswith("/api/"):
            return web.json_response({"error": exc.text or exc.reason}, status=exc.status)
        raise


async def engine(app, path, payload=None):
    session = app["engine"]
    async with session.request("GET" if payload is None else "POST", ENGINE + path, json=payload) as response:
        data = await response.json()
        return response.status, data


async def readiness(request):
    paths = [f"/api/models/{folder}" for folder in MODELS]
    paths.extend(f"/object_info/{node}" for node in CUSTOM_NODES)
    results = await asyncio.gather(*(engine(request.app, path) for path in paths))
    missing = []
    for names, (status, installed) in zip(MODELS.values(), results[:len(MODELS)]):
        missing.extend(name.rsplit("/", 1)[-1] for name in names if status != 200 or name not in installed)
    for node, (status, installed) in zip(CUSTOM_NODES, results[len(MODELS):]):
        if status != 200 or node not in installed:
            missing.append(node)
    return missing


@routes.get("/api/status")
async def status(request):
    missing = await readiness(request)
    return web.json_response({"ready": not missing, "missing": missing})


def model_choices(node_info):
    choices = {}
    for fields in node_info.get("input", {}).values():
        for name, config in fields.items():
            if not re.fullmatch(r"(?:ckpt|checkpoint|unet|model|diffusion_model|vae|clip|lora|control_net|upscale_model|style_model|text_encoder|vision_model)_name\d*", name):
                continue
            if not isinstance(config, list) or not config:
                continue
            values = config[0]
            if values == "COMBO" and len(config) > 1 and isinstance(config[1], dict):
                values = config[1].get("options")
            if isinstance(values, list) and all(isinstance(value, str) for value in values):
                choices[name] = values
    return choices


@routes.post("/api/workflow-diagnostics")
async def workflow_diagnostics(request):
    try:
        classes = await request.json()
    except (ValueError, UnicodeError) as exc:
        raise web.HTTPBadRequest(text="The node type list could not be read.") from exc
    if not isinstance(classes, list) or len(classes) > 5000 or any(
        not isinstance(name, str) or len(name) > 200 for name in classes
    ):
        raise web.HTTPBadRequest(text="The node type list was invalid.")
    status, catalog = await engine(request.app, "/object_info")
    if status != 200 or not isinstance(catalog, dict) or not catalog:
        raise web.HTTPServiceUnavailable(text="ComfyUI did not return its node and model inventory.")
    return web.json_response({
        name: model_choices(catalog[name]) if name in catalog else None
        for name in dict.fromkeys(classes)
    })


def processing_dimensions(width, height):
    scale = min(1, 1920 / width, 1088 / height)
    return max(2, int(width * scale + 1e-8) // 2 * 2), max(2, int(height * scale + 1e-8) // 2 * 2)


def read_frames(container, stream):
    for frame in container.decode(stream):
        if (frame.width, frame.height) != (stream.width, stream.height):
            raise ValueError("The video changes dimensions mid-clip.")
        yield frame


def write_video(path, frames, width, height, fps):
    with av.open(str(path), mode="w", options={"movflags": "+faststart"}) as output:
        encoder = output.add_stream("libx264", rate=fps, options={"preset": "fast", "crf": "16"})
        encoder.width = width
        encoder.height = height
        encoder.pix_fmt = "yuv420p"
        encoder.codec_context.thread_count = 2
        count = 0
        for count, frame in enumerate(frames, start=1):
            frame = frame.reformat(width=width, height=height, format="yuv420p", interpolation="LANCZOS")
            frame.pts = count - 1
            frame.time_base = 1 / fps
            output.mux(encoder.encode(frame))
        output.mux(encoder.encode())
    return count


def prepare_video(path, segment_dir):
    try:
        with av.open(str(path)) as container:
            if not container.streams.video:
                raise ValueError("The selected file has no video stream.")
            stream = container.streams.video[0]
            fps = stream.average_rate
            if not fps or not 1 <= fps <= 120:
                raise ValueError("Use a video between 1 and 120 fps.")
            source_width, source_height = stream.width, stream.height
            if not source_width or not source_height:
                raise ValueError("The video has no valid dimensions.")
            width, height = processing_dimensions(source_width, source_height)
            resized = (width, height) != (source_width, source_height)
            frames = read_frames(container, stream)
            # Count small clips without retaining decoded frames in memory.
            count = sum(1 for _ in islice(frames, SEGMENT_FRAMES + 1))
            if count < 9:
                raise ValueError("Use a clip with at least 9 frames.")
        segments = []
        if resized or count > SEGMENT_FRAMES:
            segment_dir.mkdir()
            with av.open(str(path)) as container:
                frames = read_frames(container, container.streams.video[0])
                while (first := next(frames, None)) is not None:
                    segment = segment_dir / f"{len(segments) + 1:04d}.mp4"
                    length = write_video(segment, chain((first,), islice(frames, SEGMENT_FRAMES - 1)),
                                         width, height, fps)
                    segments.append({"filename": segment.relative_to(INPUT).as_posix(), "frames": length})
            count = sum(segment["frames"] for segment in segments)
        media = {"width": width, "height": height, "frames": count, "fps": float(fps)}
        original = {"width": source_width, "height": source_height} if resized else None
        return media, original, segments
    except av.FFmpegError as exc:
        raise ValueError("The video could not be decoded or prepared.") from exc


def job_file(job_id):
    return JOBS / f"{job_id}.json"


def save_job(job_id, value):
    path = job_file(job_id)
    temporary = path.with_suffix(".tmp")
    temporary.write_text(json.dumps(value), encoding="utf-8")
    temporary.replace(path)


def get_job(request):
    job_id = request.match_info["job"]
    try:
        return job_id, json.loads(job_file(job_id).read_text(encoding="utf-8"))
    except FileNotFoundError as exc:
        raise web.HTTPNotFound(text="Job not found.") from exc


@routes.post("/api/upload")
async def upload(request):
    if request.content_length and request.content_length > MAX_UPLOAD + 65536:
        raise web.HTTPRequestEntityTooLarge(max_size=MAX_UPLOAD, actual_size=request.content_length)
    if request.content_type != "multipart/form-data":
        raise web.HTTPBadRequest(text="Choose a video to upload.")
    part = await (await request.multipart()).next()
    if not part or part.name != "video" or not part.filename:
        raise web.HTTPBadRequest(text="Choose a video first.")
    extension = Path(part.filename).suffix.lower()
    if extension not in VIDEO_SUFFIXES:
        raise web.HTTPBadRequest(text="Choose an MP4, MOV, M4V, WebM or MKV file.")
    job_id = uuid4().hex
    filename = job_id + extension
    destination = INPUT / filename
    segment_dir = INPUT / job_id
    size = 0
    try:
        with destination.open("xb") as output:
            while chunk := await part.read_chunk(256 * 1024):
                size += len(chunk)
                if size > MAX_UPLOAD:
                    raise web.HTTPRequestEntityTooLarge(max_size=MAX_UPLOAD, actual_size=size)
                output.write(chunk)
        async with request.app["prepare_slots"]:
            metadata, original, segments = await asyncio.to_thread(prepare_video, destination, segment_dir)
        job = {"filename": segments[0]["filename"] if segments else filename,
               "source": filename, "name": Path(part.filename).name, "media": metadata,
               "original": original, "segments": segments}
        save_job(job_id, job)
    except BaseException as exc:
        destination.unlink(missing_ok=True)
        shutil.rmtree(segment_dir, ignore_errors=True)
        if isinstance(exc, ValueError):
            raise web.HTTPBadRequest(text=str(exc)) from exc
        raise
    return web.json_response({"id": job_id, **metadata, "original": original, "total_segments": len(segments) or 1}, status=201)


async def queue_prompt(app, graph, job_id, prompt_id):
    try:
        code, result = await engine(app, "/prompt", {"prompt": graph, "client_id": job_id, "prompt_id": prompt_id})
    except (ClientError, TimeoutError):
        code, _ = await engine(app, f"/api/jobs/{prompt_id}")
        if code != 200:
            raise web.HTTPServiceUnavailable(text="ComfyUI could not confirm submission. Try again.")
        result = {"prompt_id": prompt_id}
    if code >= 400:
        errors = [err.get("details") or err.get("message", "")
                  for node in result.get("node_errors", {}).values()
                  for err in node.get("errors", [])]
        message = "; ".join(dict.fromkeys(errors)) or result.get("error", {}).get("message", "ComfyUI rejected the workflow.")
        raise web.HTTPUnprocessableEntity(text=message)
    return result["prompt_id"]


async def render_settings(request):
    if not request.can_read_body:
        return {"operations": ["alpha_gen"]}
    try:
        data = await request.json()
    except (ValueError, UnicodeError) as exc:
        raise web.HTTPBadRequest(text="The workflow could not be read.") from exc
    if not isinstance(data, dict):
        raise web.HTTPBadRequest(text="The workflow could not be read.")
    operations = data.get("operations")
    if (not isinstance(operations, list) or len(operations) > 32
            or any(not isinstance(name, str) or name not in VIDEO_OPERATIONS for name in operations)):
        raise web.HTTPBadRequest(text="Connect a supported video workflow before running.")
    def validate_parameters(values):
        if not isinstance(values, dict):
            raise web.HTTPBadRequest(text="The workflow parameters could not be read.")
        seed = values.get("seed")
        if seed is not None and (type(seed) is not int or not 0 <= seed <= 4294967295):
            raise web.HTTPBadRequest(text="Seed must be between 0 and 4294967295.")
        radius = values.get("blur_radius", 3)
        if type(radius) is not int or not 1 <= radius <= 31:
            raise web.HTTPBadRequest(text="Blur radius must be between 1 and 31.")
        return {"seed": seed, "blur_radius": radius}

    settings = {"operations": operations, **validate_parameters(data)}
    parameters = data.get("parameters")
    if parameters is not None:
        if not isinstance(parameters, list) or len(parameters) != len(operations):
            raise web.HTTPBadRequest(text="Provide parameters for each operation.")
        settings["parameters"] = [validate_parameters(values) for values in parameters]
    return settings


@routes.post(r"/api/jobs/{job:[0-9a-f]{32}}/versions")
async def new_version(request):
    _, previous = get_job(request)
    # The source and prepared segments are immutable and can be shared.
    version = {key: previous[key] for key in ("filename", "source", "name", "media", "original", "segments")
               if key in previous}
    job_id = uuid4().hex
    save_job(job_id, version)
    return web.json_response({"id": job_id}, status=201)


@routes.post(r"/api/jobs/{job:[0-9a-f]{32}}")
async def submit(request):
    async with request.app["submit_lock"]:
        job_id, job = get_job(request)
        if job.get("prompt") or job.get("batch"):
            return web.json_response({"prompt": job.get("prompt")})
        settings = await render_settings(request)
        if "alpha_gen" in settings["operations"] and await readiness(request):
            raise web.HTTPServiceUnavailable(text="LTX model setup is incomplete. Your upload was saved.")
        job["settings"] = settings
        if len(job.get("segments", [])) > 1:
            job["batch"] = {"state": "queued", "index": 0}
            save_job(job_id, job)
            start_batch(request.app, job_id, job)
            return web.json_response({"prompt": None})
        graph = make_prompt(job_id, job["filename"], **job["media"], **settings)
        job["prompt"] = await queue_prompt(request.app, graph, job_id, str(uuid4()))
        save_job(job_id, job)
        return web.json_response({"prompt": job["prompt"]})


def result_file(job_id):
    return next(iter(sorted((OUTPUT_DIR / job_id).glob("matte_*.mp4"))), None)


def join_mattes(job_id, media, segments):
    def frames():
        for index, segment in enumerate(segments, start=1):
            path = result_file(f"{job_id}/part-{index:04d}")
            if not path:
                raise RuntimeError(f"Matte for segment {index} is missing.")
            with av.open(str(path)) as container:
                count = 0
                for count, frame in enumerate(container.decode(video=0), start=1):
                    yield frame
                if count != segment["frames"]:
                    raise RuntimeError(f"Matte for segment {index} has {count} frames, expected {segment['frames']}.")

    destination = OUTPUT_DIR / job_id / "matte_joined.mp4"
    temporary = destination.with_name("joining.mp4")
    try:
        count = write_video(temporary, frames(), media["width"], media["height"],
                            Fraction(media["fps"]).limit_denominator(100000))
        if count != media["frames"]:
            raise RuntimeError("The joined matte has an unexpected frame count.")
        temporary.replace(destination)
    finally:
        temporary.unlink(missing_ok=True)


async def execute_batch(app, job_id, job):
    batch = job["batch"]
    segments = job["segments"]
    try:
        for index in range(batch["index"], len(segments)):
            segment = segments[index]
            output_id = f"{job_id}/part-{index + 1:04d}"
            if result_file(output_id) and not job.get("prompt"):
                batch["index"] = index + 1
                save_job(job_id, job)
                continue
            if not job.get("prompt"):
                job["prompt"] = str(uuid4())
                batch["state"] = "queued"
                save_job(job_id, job)
            prompt_id = job["prompt"]
            needs_submit = True
            while True:
                try:
                    code, info = await engine(app, f"/api/jobs/{prompt_id}")
                    if code == 404 and needs_submit:
                        media = {**job["media"], "frames": segment["frames"]}
                        graph = make_prompt(output_id, segment["filename"], **media, **job.get("settings", {}))
                        await queue_prompt(app, graph, job_id, prompt_id)
                        needs_submit = False
                    elif code == 200:
                        needs_submit = False
                        state = info["status"]
                        if state == "completed":
                            if not result_file(output_id):
                                raise RuntimeError("ComfyUI did not return a matte.")
                            break
                        if state in ("failed", "cancelled"):
                            error = info.get("execution_error") or {}
                            raise RuntimeError(error.get("exception_message") or f"ComfyUI job {state}.")
                        next_state = "running" if state == "in_progress" else "queued"
                        if batch["state"] != next_state:
                            batch["state"] = next_state
                            save_job(job_id, job)
                    elif code == 404:
                        if result_file(output_id):
                            break
                        raise RuntimeError("Segment disappeared from the ComfyUI queue.")
                    else:
                        raise RuntimeError(f"ComfyUI returned HTTP {code}.")
                except (ClientError, TimeoutError):
                    pass
                await asyncio.sleep(1)
            batch["index"] = index + 1
            job["prompt"] = None
            save_job(job_id, job)
        batch["state"] = "joining"
        save_job(job_id, job)
        await asyncio.to_thread(join_mattes, job_id, job["media"], segments)
        batch["state"] = "complete"
    except Exception as error:
        logging.exception("Alpha Gen batch %s failed", job_id)
        batch.update(state="failed", error=str(error))
    save_job(job_id, job)


def start_batch(app, job_id, job):
    tasks = app["batch_tasks"]
    tasks[job_id] = asyncio.create_task(execute_batch(app, job_id, job))
    tasks[job_id].add_done_callback(lambda task: tasks.pop(job_id, None))


@routes.get(r"/api/jobs/{job:[0-9a-f]{32}}")
async def job_status(request):
    job_id, job = get_job(request)
    prompt = job.get("prompt")
    response = {"state": "uploaded", "name": job["name"], "media": job["media"], "original": job.get("original"), "prompt": prompt}
    batch = job.get("batch")
    response["total_segments"] = len(job.get("segments", [])) or 1
    response["settings"] = job.get("settings")
    if batch:
        response.update(state=batch["state"], segment=min(batch["index"] + 1, len(job["segments"])))
        if batch.get("error"):
            response["error"] = batch["error"]
        return web.json_response(response)
    if prompt:
        _, history = await engine(request.app, f"/history/{prompt}")
        record = history.get(prompt)
        if record:
            entry = record.get("status", {})
            if entry.get("status_str") == "success" and record.get("outputs", {}).get(OUTPUT) and result_file(job_id):
                response["state"] = "complete"
            else:
                errors = [event for kind, event in entry.get("messages", []) if kind == "execution_error"]
                response.update(state="failed", error=errors[-1].get("exception_message", "Render failed.") if errors else "ComfyUI did not return a matte.")
        else:
            _, queue = await engine(request.app, "/queue")
            if any(item[1] == prompt for item in queue.get("queue_running", [])):
                response["state"] = "running"
            elif any(item[1] == prompt for item in queue.get("queue_pending", [])):
                response["state"] = "queued"
            elif result_file(job_id):
                response["state"] = "complete"
            else:
                response.update(state="failed", error="Job is no longer in the ComfyUI queue.")
    return web.json_response(response)


@routes.get(r"/api/jobs/{job:[0-9a-f]{32}}/{kind:source|matte|download}")
async def media(request):
    job_id, job = get_job(request)
    kind = request.match_info["kind"]
    if kind != "source":
        batch = job.get("batch")
        if (batch and batch["state"] != "complete") or (not batch and not job.get("prompt")):
            raise web.HTTPNotFound()
    path = INPUT / job.get("source", job["filename"]) if kind == "source" else result_file(job_id)
    if not path or not path.is_file():
        raise web.HTTPNotFound()
    headers = {"Content-Type": "video/mp4"} if kind != "source" else {}
    if kind == "download":
        stem = re.sub(r"[^A-Za-z0-9_.-]", "_", Path(job["name"]).stem)[:80] or "okapi"
        operations = job.get("settings", {}).get("operations", ["alpha_gen"])
        suffix = "alpha" if "alpha_gen" in operations else "render"
        headers["Content-Disposition"] = f'attachment; filename="{stem}_{suffix}.mp4"'
    return web.FileResponse(path, headers=headers)


def write_review_audio(source, destination):
    with av.open(str(source)) as container:
        if not container.streams.audio:
            return False
        video = container.streams.video[0]
        start = (video.start_time or 0) * video.time_base
        stream = container.streams.audio[0]
        with av.open(str(destination), "w", options={"movflags": "+faststart"}) as output:
            encoder = output.add_stream("aac", rate=48000)
            encoder.layout = "stereo"
            encoder.bit_rate = 160000
            resampler = av.AudioResampler(
                format="fltp", layout="stereo", rate=48000,
                options={"async": "1", "first_pts": "0"}, threads=1,
            )
            for frame in container.decode(stream):
                if frame.pts is not None and frame.time_base:
                    frame.pts -= round(start / frame.time_base)
                for samples in resampler.resample(frame):
                    output.mux(encoder.encode(samples))
            for samples in resampler.resample(None):
                output.mux(encoder.encode(samples))
            output.mux(encoder.encode())
    return destination.is_file()


def prepare_review_audio(source, path, silent):
    with TemporaryDirectory(dir=path.parent) as scratch:
        temporary = Path(scratch) / path.name
        if write_review_audio(source, temporary):
            temporary.replace(path)
        else:
            silent.touch()


@routes.get(r"/api/jobs/{job:[0-9a-f]{32}}/audio.m4a")
async def review_audio(request):
    job_id, job = get_job(request)
    directory = ROOT / "reviews" / job_id
    directory.mkdir(parents=True, exist_ok=True)
    path = directory / "source-audio.m4a"
    silent = directory / "source-has-no-audio"
    async with request.app["audio_lock"]:
        if silent.exists():
            raise web.HTTPNotFound()
        if not path.exists():
            source = INPUT / job.get("source", job["filename"])
            try:
                await asyncio.to_thread(prepare_review_audio, source, path, silent)
            except av.FFmpegError as exc:
                raise web.HTTPUnprocessableEntity(text="Could not prepare the source audio.") from exc
            if not path.exists():
                raise web.HTTPNotFound()
    return web.FileResponse(path, headers={"Content-Type": "audio/mp4",
                                           "Cache-Control": "private, max-age=3600"})


@routes.get(r"/api/jobs/{job:[0-9a-f]{32}}/events")
async def job_events(request):
    job_id, _ = get_job(request)
    origin = request.headers.get("Origin")
    if origin and urlsplit(origin).netloc != request.host:
        raise web.HTTPForbidden(text="Cross-site request blocked.")
    async with request.app["engine"].ws_connect(ENGINE + "/ws", params={"clientId": job_id}) as upstream:
        socket = web.WebSocketResponse(heartbeat=25)
        await socket.prepare(request)

        async def relay():
            async for message in upstream:
                if message.type == WSMsgType.TEXT:
                    await socket.send_str(message.data)

        async def drain():
            async for _ in socket:
                pass

        tasks = [asyncio.create_task(relay()), asyncio.create_task(drain())]
        try:
            await asyncio.wait(tasks, return_when=asyncio.FIRST_COMPLETED)
        finally:
            for task in tasks:
                task.cancel()
            await asyncio.gather(*tasks, return_exceptions=True)
            await socket.close()
    return socket


@routes.get(r"/review/{job:[0-9a-f]{32}}")
async def review(request):
    get_job(request)
    return web.FileResponse(ROOT / "static/review.html", headers={"Cache-Control": "no-cache"})


@routes.get(r"/api/jobs/{job:[0-9a-f]{32}}/review.rrd")
async def review_recording(request):
    job_id, job = get_job(request)
    batch = job.get("batch")
    matte = result_file(job_id) if not batch or batch["state"] == "complete" else None
    mode = request.query.get("mode", "source")
    if mode not in ("source", "compare", "output"):
        raise web.HTTPBadRequest(text="Unknown Viewer mode.")
    if mode != "source" and not matte:
        raise web.HTTPNotFound(text="The output is not ready yet.")
    directory = ROOT / "reviews" / job_id
    directory.mkdir(parents=True, exist_ok=True)
    suffix = "-v2" if request.query.get("schema") == "2" else ""
    path = directory / f"{mode}{suffix}.rrd"
    async with request.app["review_lock"]:
        if not path.exists():
            source = matte if mode == "output" else INPUT / job.get("source", job["filename"])
            media = job["media"]
            temporary = path.with_name(path.stem + ".tmp.rrd")
            args = [str(ROOT / ".rerun/bin/python"), str(ROOT / "rerun_recording.py"),
                    str(temporary), str(source), str(media["fps"]), str(media["width"]),
                    str(media["height"]), str(media["frames"])]
            if mode == "output":
                args.extend(["--source-label", "Node Output"])
            elif mode == "compare":
                operations = job.get("settings", {}).get("operations", ["alpha_gen"])
                args.extend(["--matte", str(matte), "--label",
                             "Alpha Matte" if "alpha_gen" in operations else "Output"])
            process = await asyncio.create_subprocess_exec(*args, stderr=asyncio.subprocess.PIPE)
            try:
                _, stderr = await asyncio.wait_for(process.communicate(), timeout=600)
                if process.returncode or not temporary.is_file():
                    logging.error("Rerun recording failed for %s: %s", job_id, stderr.decode(errors="replace"))
                    raise web.HTTPUnprocessableEntity(text="Could not prepare a Rerun recording for this clip.")
                temporary.replace(path)
            except (asyncio.CancelledError, TimeoutError):
                if process.returncode is None:
                    process.kill()
                    await process.wait()
                raise
            finally:
                temporary.unlink(missing_ok=True)
    return web.FileResponse(path, headers={"Content-Type": "application/octet-stream",
                                           "Cache-Control": "private, max-age=3600"})


@routes.get("/")
@routes.get("/okapi")
async def index(request):
    return web.FileResponse(ROOT / "static/index.html", headers={"Cache-Control": "no-cache"})


async def session_context(app):
    async with ClientSession(timeout=ClientTimeout(total=10)) as app["engine"]:
        for path in JOBS.glob("*.json"):
            job = json.loads(path.read_text(encoding="utf-8"))
            if job.get("batch", {}).get("state") in ("queued", "running", "joining"):
                start_batch(app, path.stem, job)
        yield
        tasks = list(app["batch_tasks"].values())
        for task in tasks:
            task.cancel()
        await asyncio.gather(*tasks, return_exceptions=True)


def make_app():
    for directory in (INPUT, JOBS):
        directory.mkdir(parents=True, exist_ok=True)
    app = web.Application(middlewares=[handle_errors], client_max_size=MAX_UPLOAD + 65536)
    app["batch_tasks"] = {}
    app["submit_lock"] = asyncio.Lock()
    app["prepare_slots"] = asyncio.Semaphore(2)
    app["review_lock"] = asyncio.Lock()
    app["audio_lock"] = asyncio.Lock()
    app.cleanup_ctx.append(session_context)
    app.add_routes(routes)
    app.router.add_static("/assets", ROOT / "static/assets")
    return app


if __name__ == "__main__":
    web.run_app(make_app(), host="127.0.0.1", port=int(os.environ.get("OKAPI_PORT", "18769")), access_log=None)
