"""Create a local Rerun recording from an okapi source and optional matte."""
import argparse
from fractions import Fraction
from pathlib import Path
from tempfile import TemporaryDirectory

import av
import numpy as np
import rerun as rr
import rerun.blueprint as blueprint


def browser_video(path, temporary, fps, width, height):
    with av.open(str(path)) as source:
        stream = source.streams.video[0]
        if path.suffix.lower() == ".mp4" and stream.codec_context.name == "h264" and stream.format.name == "yuv420p":
            return path

        with av.open(str(temporary), "w", options={"movflags": "+faststart"}) as destination:
            encoder = destination.add_stream("libx264", rate=fps, options={"preset": "fast", "crf": "17"})
            encoder.width = width
            encoder.height = height
            encoder.pix_fmt = "yuv420p"
            encoder.codec_context.thread_count = 2
            for index, frame in enumerate(source.decode(stream)):
                frame = frame.reformat(width=width, height=height, format="yuv420p")
                frame.pts = index
                frame.time_base = 1 / fps
                destination.mux(encoder.encode(frame))
            destination.mux(encoder.encode())
    return temporary


def record(args):
    fps = Fraction(args.fps).limit_denominator(100_000)
    videos = [(args.source_label, args.source)]
    if args.matte:
        videos.append((args.label, args.matte))
    views = [blueprint.Spatial2DView(name=name, origin=f"/{entity}")
             for entity, (name, _) in enumerate(videos)]
    layout = blueprint.Blueprint(
        blueprint.Horizontal(*views),
        blueprint.BlueprintPanel(state="hidden"),
        blueprint.SelectionPanel(state="hidden"),
        blueprint.TimePanel(state="expanded", timeline="Clip", fps=float(fps), play_state="paused"),
    )

    with TemporaryDirectory(dir=args.output.parent) as temporary:
        recording = rr.RecordingStream("okapi")
        recording.save(args.output, default_blueprint=layout)
        try:
            for entity, (_, path) in enumerate(videos):
                compatible = browser_video(path, Path(temporary) / f"{entity}.mp4", fps, args.width, args.height)
                asset = rr.AssetVideo(path=compatible)
                timestamps = asset.read_frame_timestamps_nanos()
                if len(timestamps) != args.frames:
                    raise ValueError(f"Expected {args.frames} frames in {path.name}, found {len(timestamps)}")
                frames = np.arange(len(timestamps), dtype=np.int64)
                recording.log(str(entity), asset, static=True)
                recording.send_columns(
                    str(entity),
                    indexes=[rr.TimeColumn("Clip", duration=frames / float(fps)),
                             rr.TimeColumn("Frame", sequence=frames)],
                    columns=rr.VideoFrameReference.columns_nanos(timestamps),
                )
            recording.flush()
        finally:
            recording.disconnect()


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("output", type=Path)
    parser.add_argument("source", type=Path)
    parser.add_argument("fps", type=float)
    parser.add_argument("width", type=int)
    parser.add_argument("height", type=int)
    parser.add_argument("frames", type=int)
    parser.add_argument("--matte", type=Path)
    parser.add_argument("--label", default="Alpha Matte")
    parser.add_argument("--source-label", default="Source")
    record(parser.parse_args())
