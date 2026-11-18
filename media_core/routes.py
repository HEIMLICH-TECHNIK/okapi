"""Precision media HTTP adapter; CPU work is bounded and cancellable."""
import asyncio
from collections import OrderedDict
import json
from pathlib import Path
import shutil
import threading
import queue
import time
from uuid import uuid4

from aiohttp import web
import numpy as np

from . import image_io as io
from . import pipeline as p
from . import projects
from . import cache_settings
from . import color as cm
from .video import FrameStore
from .bands import BandEngine
from .stream import preview_packets, packet

routes=web.RouteTableDef()
FRAME_BUDGET=64*1024*1024


def api(request):
    return request.app['media_api']


def load(request):
    return api(request).get_job(request)


def native(job):
    return job.get('precision') is not None


@routes.post('/api/upload-sequence')
async def upload_sequence(request):
    module=api(request)
    if request.content_type!='multipart/form-data':
        raise web.HTTPBadRequest(text='Choose a numbered image sequence.')
    job_id=uuid4().hex
    directory=module.INPUT/job_id
    directory.mkdir()
    filenames=[]
    try:
        reader=await request.multipart()
        while part:=await reader.next():
            filename=Path(part.filename or '').name
            if part.name!='frame' or Path(filename).suffix.lower() not in p.IMAGES or filename in filenames:
                raise ValueError('Use unique numbered image files from one sequence.')
            if len(filenames)>=10000:raise ValueError('A sequence upload is limited to 10000 frames.')
            with (directory/filename).open('xb') as output:
                while chunk:=await part.read_chunk(256*1024):
                    output.write(chunk)
            filenames.append(filename)
        if not filenames:raise ValueError('No sequence frames were uploaded.')
        async with request.app['prepare_slots']:
            metadata=await asyncio.to_thread(p.inspect_sequence,directory,filenames,request.query.get('fps','24'))
        media={k:metadata[k] for k in ('width','height','frames','fps')}
        job={'filename':job_id,'source':job_id,'name':metadata['files'][0],
             'media':media,'original':None,'segments':[],'precision':metadata,
             'color':{'config':cm.default_id(),'input_space':metadata['input_space'],'working_space':cm.info()['working_default'],'alpha_mode':metadata['alpha_mode']}}
        module.save_job(job_id,job)
        return web.json_response({'id':job_id,**media,'original':None,'total_segments':1,'precision':metadata},status=201)
    except BaseException as exc:
        shutil.rmtree(directory,ignore_errors=True)
        if isinstance(exc,ValueError):raise web.HTTPBadRequest(text=str(exc)) from exc
        raise


def media_root(request, job_id):
    return api(request).JOBS / 'media' / job_id


def color_of(job,module):
    return projects.resolve(job,module.JOBS)


async def body(request):
    try:
        value=await request.json()
    except (ValueError,UnicodeError) as exc:
        raise web.HTTPBadRequest(text='Invalid media settings.') from exc
    if not isinstance(value,dict): raise web.HTTPBadRequest(text='Media settings must be an object.')
    return value


@routes.get('/api/media/capabilities')
async def capabilities(request):
    return web.json_response(p.capabilities(request.query.get('config')))


@routes.get(r'/api/jobs/{job:[0-9a-f]{32}}/precision')
async def info(request):
    _,job=load(request)
    project=projects.load(job,api(request).JOBS) if native(job) else None
    return web.json_response({'enabled':native(job),'metadata':job.get('precision'),
                             'project':project,'read':job.get('read',{}),
                             'color':{**job.get('read',{}),**project['color']} if project else {},'render':job.get('precision_render'),
                             'export':job.get('precision_export')})


@routes.post(r'/api/jobs/{job:[0-9a-f]{32}}/color')
async def color(request):
    job_id,job=load(request)
    if not native(job): raise web.HTTPConflict(text='This is a legacy video job; upload the original to use float IO.')
    if job_id in request.app['media_tasks']: raise web.HTTPConflict(text='Wait for or cancel the current media job.')
    try:
        data=await body(request)
        project=projects.load(job,api(request).JOBS)
        if data.get('working_space',project['color']['working_space'])!=project['color']['working_space']:
            raise ValueError('Working Space belongs to Project Settings. Set input interpretation on the Read node.')
        value=p.settings({**job['read'],**data,**project['color']},job['precision'])
    except ValueError as exc: raise web.HTTPBadRequest(text=str(exc)) from exc
    # Color settings belong to the source. Completed output retains its own snapshot.
    job['color']=value
    job['read']={k:value[k] for k in ('input_space','alpha_mode')}
    job.pop('settings',None)
    api(request).save_job(job_id,job)
    return web.json_response(value)


@routes.get(r'/api/jobs/{job:[0-9a-f]{32}}/project')
async def project_info(request):
    _,job=load(request)
    if not native(job):raise web.HTTPConflict(text='Open a precision media project first.')
    return web.json_response(projects.load(job,api(request).JOBS))


@routes.post(r'/api/jobs/{job:[0-9a-f]{32}}/project')
async def project_update(request):
    _,job=load(request)
    if not native(job):raise web.HTTPConflict(text='Open a precision media project first.')
    module=api(request)
    for active_id in request.app['media_tasks']:
        active=json.loads(module.job_file(active_id).read_text())
        if active.get('project_id')==job.get('project_id'):
            raise web.HTTPConflict(text='Wait for or cancel this project’s media jobs before changing Working Space.')
    try:
        value=projects.update(job,module.JOBS,await body(request))
        return web.json_response(value)
    except ValueError as exc:raise web.HTTPBadRequest(text=str(exc)) from exc


def render_source(request, job_id, job, output):
    if output:
        result=job.get('precision_render',{})
        if result.get('state')!='complete': raise ValueError('Float output is not ready.')
        if result.get('color')!=color_of(job,api(request)): raise ValueError('Source color settings changed. Render again before viewing/exporting output.')
        return media_root(request,job_id)/result['directory'],result['color']
    return None,color_of(job,api(request))


@routes.get(r'/api/jobs/{job:[0-9a-f]{32}}/frame')
async def frame(request):
    job_id,job=load(request)
    if not native(job): raise web.HTTPNotFound(text='No precision source.')
    try:
        index=int(request.query.get('frame','0'))
        if not 0<=index<job['precision']['frames']: raise ValueError('Frame is outside the source range.')
        output=request.query.get('output')=='1'
        directory,color=render_source(request,job_id,job,output)
        mode=request.query.get('mode','sdr')
        if mode not in ('sdr','hdr'): raise ValueError('Display must be SDR or HDR.')
        channel=request.query.get('channel','rgba')
        display=request.query.get('display')
        view=request.query.get('view')
        exposure=float(request.query.get('exposure','0'))
        if not np.isfinite(exposure) or not -30<=exposure<=30: raise ValueError('Invalid exposure.')
        source=(directory/f'{index:08d}.exr') if directory else api(request).INPUT/job['source']
        if 'x' in request.query:
            header={'width':job['precision']['width'],'height':job['precision']['height']}
            x,y=int(request.query['x']),int(request.query.get('y','0'))
            if not (0<=x<header['width'] and 0<=y<header['height']): raise ValueError('Pixel is outside the image.')
            # Probe source/working values, never the display-transformed cache.
            async with request.app['media_slots']:
                def probe():
                    if directory:
                        return io.read_image(source,input_space='raw',working_space='raw',roi=(x,header['height']-1-y,x+1,header['height']-y))
                    raw=p.raw_source_frame(source,job['precision'],index,decoders=request.app['media_decoders'])
                    cell={k:v[header['height']-1-y:header['height']-y,x:x+1] for k,v in raw.items()}
                    return p.convert(cell,color['input_space'],color['working_space'],color['alpha_mode'],color.get('config'))
                values=await asyncio.to_thread(probe)
            return web.json_response({'x':x,'y':y,'space':color['working_space'],
                'values':{k:float(v[0,0]) if np.isfinite(v[0,0]) else str(v[0,0]) for k,v in values.items()}})
        identity_source=(source/job['precision']['files'][index]) if directory is None and job['precision']['kind']=='sequence' else source
        stamp=identity_source.stat()
        key=(str(identity_source),stamp.st_size,stamp.st_mtime_ns,index,json.dumps(color,sort_keys=True),mode,channel,exposure,display,view)
        cache=request.app['media_frame_cache']
        record=cache.get(key)
        if record:
            cache.move_to_end(key)
        else:
            async with request.app['media_slots']:
                def prepare():
                    values=io.read_image(source,input_space='raw',working_space='raw') if directory else p.source_frame(source,job['precision'],color,index,api(request).JOBS/'color',decoders=request.app['media_decoders'])
                    pixels=p.display_pixels(values,color['working_space'],mode=mode,channel=channel,exposure=exposure,
                        display=display,view=view,config_name=color.get('config'))
                    return pixels, sorted(values)
                pixels,channels=await asyncio.to_thread(prepare)
                header={'width':pixels.shape[1],'height':pixels.shape[0],'frame':index,'encoding':'rgba32float',
                        'display_space':'srgb' if mode=='sdr' else 'display-p3','mode':mode,
                        'channels':channels,'working_space':color['working_space']}
                record=(pixels.tobytes(),header)
                size=len(record[0])
                if size<=FRAME_BUDGET:
                    while cache and sum(len(v[0]) for v in cache.values())+size>FRAME_BUDGET:
                        cache.popitem(last=False)
                    cache[key]=record
        payload,header=record
        return web.Response(body=payload,content_type='application/octet-stream',headers={
            'X-Okapi-Frame':json.dumps(header,separators=(',',':')),'Cache-Control':'no-store'})
    except (ValueError,FileNotFoundError) as exc:
        raise web.HTTPBadRequest(text=str(exc)) from exc


@routes.get(r'/api/jobs/{job:[0-9a-f]{32}}/frame-stream')
async def frame_stream(request):
    job_id,job=load(request)
    if not native(job):raise web.HTTPNotFound()
    try:
        index=int(request.query.get('frame','0'))
        if not 0<=index<job['precision']['frames']:raise ValueError('Frame is outside the source range.')
        directory,color=render_source(request,job_id,job,request.query.get('output')=='1')
        source=directory/f'{index:08d}.exr' if directory else api(request).INPUT/job['source']
        options={'display':request.query.get('display'),'view':request.query.get('view'),
                 'mode':request.query.get('mode','sdr'),'channel':request.query.get('channel','rgba'),
                 'exposure':float(request.query.get('exposure','0'))}
        if not np.isfinite(options['exposure']) or not -30<=options['exposure']<=30:raise ValueError('Invalid Viewer exposure.')
        if options['mode'] not in ('sdr','hdr'):raise ValueError('Invalid Viewer presentation mode.')
        # Compile/validate before sending HTTP 200, so invalid Viewer choices
        # remain actionable API errors rather than half-open image streams.
        cfg=cm.config(color.get('config'))
        display=options['display'] or cfg.getDefaultDisplay()
        view=options['view'] or cfg.getDefaultView(display)
        cm.view_transform(color['working_space'],display,view,color.get('config'))
    except ValueError as exc:raise web.HTTPBadRequest(text=str(exc)) from exc
    cancelled=threading.Event();messages=queue.Queue(maxsize=2)
    def put(value):
        while not cancelled.is_set():
            try:messages.put(value,timeout=.1);return
            except queue.Full:pass
    def produce():
        iterator=None
        try:
            if directory:
                raw=io.read_image(source,input_space='raw',working_space='raw')
                interpreted=dict(color,input_space=color['working_space'],alpha_mode='premultiplied')
            else:
                raw=p.raw_source_frame(source,job['precision'],index,decoders=request.app['media_decoders'])
                interpreted=color
            engine=BandEngine(raw,interpreted)
            iterator=preview_packets(engine,index,cancel_event=cancelled,**options)
            for record in iterator:put(record)
        except Exception as exc:put(packet({'kind':'error','error':str(exc)}))
        finally:
            if iterator is not None:iterator.close()
            if cancelled.is_set():
                try:messages.put_nowait(None)
                except queue.Full:pass
            else:put(None)
    response=web.StreamResponse(headers={'Content-Type':'application/x-okapi-frame','Cache-Control':'no-store'})
    async with request.app['media_slots']:
        await response.prepare(request)
        producer=asyncio.create_task(asyncio.to_thread(produce))
        try:
            while True:
                try:record=await asyncio.to_thread(messages.get,True,.5)
                except queue.Empty:
                    if producer.done():break
                    continue
                if record is None:break
                await response.write(record)
            await response.write_eof()
        except (ConnectionError,asyncio.CancelledError):
            cancelled.set()
        finally:
            cancelled.set()
            await producer
    return response


def start_render(app, job_id, job, spec):
    color=color_of(job,app['media_api'])
    if 'alpha_gen' in spec['operations']:
        raise ValueError('Alpha Gen cannot preserve float media yet. Use Blur, Mirror, Invert or a direct Read → Write connection.')
    cancel=threading.Event()
    token=uuid4().hex
    job['settings']=spec
    job['precision_render']={'state':'queued','index':0,'directory':token,'color':color,
                             'settings':spec,'source_metadata':job['precision']}
    module=app['media_api']
    module.save_job(job_id,job)
    async def run():
        loop=asyncio.get_running_loop()
        try:
            async with app['media_slots']:
                job['precision_render']['state']='running'
                module.save_job(job_id,job)
                def update(count):
                    def save():
                        job['precision_render']['index']=count
                        module.save_job(job_id,job)
                    loop.call_soon_threadsafe(save)
                result=await asyncio.to_thread(p.render_frames,module.INPUT/job['source'],job['precision'],color,spec,
                    module.JOBS/'media'/job_id/token,module.JOBS/'color',cancel,update)
                if cancel.is_set(): raise InterruptedError('Render cancelled.')
                job['precision_render'].update(state='complete',result=result)
        except Exception as exc:
            job['precision_render'].update(state='failed',error=str(exc))
        finally:
            module.save_job(job_id,job)
            app['media_tasks'].pop(job_id,None)
    app['media_tasks'][job_id]=(asyncio.create_task(run()),cancel)


@routes.post(r'/api/jobs/{job:[0-9a-f]{32}}/export')
async def export(request):
    job_id,job=load(request)
    if job_id in request.app['media_tasks']: raise web.HTTPConflict(text='A media job is already running.')
    try:
        directory,color=render_source(request,job_id,job,True)
        data=await body(request)
        kind=data.get('format','exr-float')
        if kind not in ('exr-float','exr-half','prores','ffv1','ffv1-half'): raise ValueError('Unsupported output format.')
        profile=data.get('profile','4444xq')
        transform=data.get('transform','sdr')
        if profile not in ('422hq','4444','4444xq') or transform not in ('sdr','pq','hlg'):
            raise ValueError('Invalid output profile or color transform.')
    except ValueError as exc: raise web.HTTPBadRequest(text=str(exc)) from exc
    token=uuid4().hex
    root=media_root(request,job_id)
    extension='.zip' if kind.startswith('exr') else '.mov' if kind=='prores' else '.mkv'
    filename=f'export-{token}{extension}'
    job['precision_export']={'state':'queued','file':filename,'format':kind,'profile':profile,'transform':transform}
    module=api(request)
    cancel=threading.Event()
    module.save_job(job_id,job)
    def work():
        paths=[directory/f'{i:08d}.exr' for i in range(job['precision']['frames'])]
        if kind.startswith('exr'):
            staging=root/f'half-{token}'
            try:
                if kind=='exr-half':
                    staging.mkdir()
                    for source in paths:
                        if cancel.is_set(): raise InterruptedError('Export cancelled.')
                        header=io.image_info(source)
                        values=io.read_image(source,input_space='raw',working_space='raw',roi=header['bbox'])
                        if any(np.any(np.isfinite(v)&(np.abs(v)>65504)) for v in values.values()):
                            raise ValueError('Values exceed half float range; choose 32bit float EXR.')
                        io.write_image(staging/source.name,values,working_space=color['working_space'],
                            output_space=color['working_space'],color_config=p.config_path(module.JOBS/'color',color.get('config')),bit_depth='half',
                            origin=tuple(header['bbox'][:2]),full_size=(header['width'],header['height']),
                            full_origin=tuple(header['native_full_origin']))
                    paths=list(sorted(staging.glob('*.exr')))
                if cancel.is_set(): raise InterruptedError('Export cancelled.')
                p.export_image_frames(paths,root/filename,metadata={
                    'source':job['precision'],'color':color,'render':job['precision_render'],
                    'storage':'half' if kind=='exr-half' else 'float'},cancel=cancel)
                return {'storage':'half' if kind=='exr-half' else 'float','frames':len(paths),
                        'working_space':color['working_space']}
            finally:
                shutil.rmtree(staging,ignore_errors=True)
        return p.export_video(paths,root/filename,job['precision'],color['working_space'],
            codec='ffv1' if kind=='ffv1-half' else kind,profile=profile,transform=transform,
            storage='half' if kind=='ffv1-half' else 'float',cancel=cancel,config_name=color.get('config'))
    async def run():
        try:
            async with request.app['media_slots']:
                job['precision_export']['state']='running'
                result=await asyncio.to_thread(work)
                if cancel.is_set(): raise InterruptedError('Export cancelled.')
                job['precision_export'].update(state='complete',result=result)
        except Exception as exc:
            (root/filename).unlink(missing_ok=True)
            job['precision_export'].update(state='failed',error=str(exc))
        finally:
            module.save_job(job_id,job)
            request.app['media_tasks'].pop(job_id,None)
    request.app['media_tasks'][job_id]=(asyncio.create_task(run()),cancel)
    return web.json_response(job['precision_export'],status=202)


@routes.get(r'/api/jobs/{job:[0-9a-f]{32}}/export')
async def download(request):
    job_id,job=load(request)
    export=job.get('precision_export',{})
    if export.get('state')!='complete': raise web.HTTPNotFound(text='Export is not ready.')
    return web.FileResponse(media_root(request,job_id)/export['file'],headers={
        'Content-Disposition':f'attachment; filename="okapi-{job_id[:8]}{Path(export["file"]).suffix}"'})


@routes.post(r'/api/jobs/{job:[0-9a-f]{32}}/cancel-media')
async def cancel(request):
    job_id,_=load(request)
    task=request.app['media_tasks'].get(job_id)
    if task: task[1].set()
    return web.json_response({'cancelling':task is not None})


def install(app,module):
    app['media_api']=module
    app['media_tasks']={}
    app['media_slots']=asyncio.Semaphore(2)
    app['media_frame_cache']=OrderedDict()
    app['media_decoders']=FrameStore()
    app['media_playback_records']={}
    app['media_playback_tasks']={}
    app['media_playback_clients']={}
    from .playback_cache import RawCache
    app['media_cache_settings']=cache_settings.load(module.JOBS)
    app['media_cache_settings_lock']=asyncio.Lock()
    try:app['media_playback_raw']=RawCache(Path(app['media_cache_settings']['directory'])/'presentation-raw-cache')
    except OSError:app['media_playback_raw']=None
    from .viewer_cache import ViewerCache
    app['viewer_cache']=ViewerCache(Path(app['media_cache_settings']['directory'])/'viewer-cache-v3')
    app['media_playback_slots']=asyncio.Semaphore(1)
    app.add_routes(routes)


@routes.get(r'/api/jobs/{job:[0-9a-f]{32}}/playback')
async def playback_state(request):
    async with request.app['media_cache_settings_lock']:
        return await _playback_state(request)


async def _playback_state(request):
    from . import playback
    import hashlib
    job_id,job=load(request)
    if not native(job):raise web.HTTPNotFound()
    preferences=request.app['media_cache_settings']
    quality=preferences['quality']
    try:
        directory,color=render_source(request,job_id,job,request.query.get('output')=='1')
        cfg=cm.config(color.get('config'))
        display=request.query.get('display') or cfg.getDefaultDisplay()
        view=request.query.get('view') or cfg.getDefaultView(display)
        cm.view_transform(color['working_space'],display,view,color.get('config'))
        exposure=float(request.query.get('exposure','0'))
        maximum=cache_settings.maximum(preferences,job['precision'])
        codec=request.query.get('codec',preferences['codec'] if preferences['codec']!='auto' else 'h264')
        channel=request.query.get('channel','rgba')
        hdr=request.query.get('hdr')=='1'
        comparison=None
        if request.query.get('compare')=='1':comparison,_=render_source(request,job_id,job,True)
        if not np.isfinite(exposure) or not -30<=exposure<=30 or not 2<=maximum<=8192 or codec not in ('h264','hevc'):
            raise ValueError('Invalid playback cache settings.')
    except ValueError as exc:raise web.HTTPBadRequest(text=str(exc)) from exc
    metadata=dict(job['precision'])
    source=directory if directory else api(request).INPUT/job['source']
    source_stamp=source.stat()
    key=hashlib.sha256(json.dumps(['playback-v2',str(source),source_stamp.st_mtime_ns,color,display,view,exposure,maximum,codec,channel,hdr,str(comparison),quality,preferences['directory']],sort_keys=True).encode()).hexdigest()
    identity=job_id+':'+key
    root=cache_settings.playback_root(preferences,job_id)
    target=root/f'{key}.mp4';marker=root/f'{key}.json'
    records=request.app['media_playback_records']
    client=request.query.get('client')
    if client:
        clients=request.app['media_playback_clients'];now=time.monotonic()
        try:revision=int(request.query.get('revision','0'))
        except ValueError:raise web.HTTPBadRequest(text='Invalid playback revision.')
        previous=clients.get(client)
        if previous and previous[2]>revision:return web.json_response({'state':'cancelled'})
        tracked={value[0] for value in clients.values()}
        clients[client]=(identity,now,revision)
        for owner,(_,stamp,_) in list(clients.items()):
            if now-stamp>15:clients.pop(owner,None)
        live={value[0] for value in clients.values()}
        for previous,(_,event) in list(request.app['media_playback_tasks'].items()):
            if previous in tracked and previous not in live:event.set()
    if records.get(identity,{}).get('state')=='cancelled':records.pop(identity,None)
    if identity not in records:
        if marker.exists() and target.exists():
            value=json.loads(marker.read_text())
            if value.get('bytes')==target.stat().st_size:
                records[identity]={'state':'complete','result':value}
        if identity not in records:
            value={'state':'queued','index':0,'frames':metadata['frames']}
            records[identity]=value;cancel=threading.Event()
            if directory:
                metadata.update(kind='sequence',files=[f'{i:08d}.exr' for i in range(metadata['frames'])])
                color=dict(color,input_space=color['working_space'],alpha_mode='premultiplied')
            async def run():
                loop=asyncio.get_running_loop()
                try:
                    async with request.app['media_playback_slots']:
                        if cancel.is_set():raise InterruptedError('Playback cache superseded.')
                        value['state']='running'
                        def update(count):loop.call_soon_threadsafe(value.update,{'index':count})
                        result=await asyncio.to_thread(playback.build,source,metadata,color,target,display=display,
                            view=view,exposure=exposure,maximum=maximum,codec=codec,cancel=cancel,progress=update,channel=channel,hdr=hdr,comparison=comparison,raw_cache=request.app['media_playback_raw'],quality=quality)
                        projects.write(marker,result)
                        value.update(state='complete',result=result)
                except InterruptedError as exc:value.update(state='cancelled',error=str(exc))
                except Exception as exc:value.update(state='failed',error=str(exc))
                finally:request.app['media_playback_tasks'].pop(identity,None)
            request.app['media_playback_tasks'][identity]=(asyncio.create_task(run()),cancel)
    state=dict(records[identity])
    state['settings']=cache_settings.public(preferences)
    if state['state']=='complete':state['url']=f'/okapi/api/jobs/{job_id}/playback/{key}'
    return web.json_response(state)


@routes.get(r'/api/jobs/{job:[0-9a-f]{32}}/playback/{key:[0-9a-f]{64}}')
async def playback_media(request):
    job_id,_=load(request)
    root=cache_settings.playback_root(request.app['media_cache_settings'],job_id);key=request.match_info['key']
    if not (root/f'{key}.json').is_file() or not (root/f'{key}.mp4').is_file():raise web.HTTPNotFound()
    return web.FileResponse(root/f'{key}.mp4',headers={'Content-Type':'video/mp4','Cache-Control':'private, max-age=3600'})


@routes.get(r'/api/jobs/{job:[0-9a-f]{32}}/timeline.rrd')
async def timeline_recording(request):
    job_id,job=load(request)
    if not native(job):raise web.HTTPNotFound()
    from . import timeline
    target=media_root(request,job_id)/'timeline-v1.rrd'
    if not target.exists():await asyncio.to_thread(timeline.record,target,job['precision'],job_id)
    return web.FileResponse(target,headers={'Content-Type':'application/octet-stream','Cache-Control':'private, max-age=3600'})


@routes.get('/api/media/cache-settings')
async def get_cache_settings(request):
    return web.json_response(cache_settings.public(request.app['media_cache_settings']))


@routes.post('/api/media/cache-settings')
async def set_cache_settings(request):
    try:
        data=await request.json()
        if not isinstance(data,dict):raise ValueError('Preview settings must be an object.')
        async with request.app['media_cache_settings_lock']:
            value=cache_settings.validate({**request.app['media_cache_settings'],**data})
            await asyncio.to_thread(cache_settings.check_directory,value)
            tasks=list(request.app['media_playback_tasks'].values())
            for _,cancel in tasks:cancel.set()
            await asyncio.gather(*(task for task,_ in tasks),return_exceptions=True)
            from .playback_cache import RawCache
            previous=request.app['media_cache_settings']
            raw=request.app['media_playback_raw']
            if value['directory']!=previous['directory'] or raw is None:
                raw=await asyncio.to_thread(RawCache,Path(value['directory'])/'presentation-raw-cache')
            await asyncio.to_thread(cache_settings.save,api(request).JOBS,value)
            request.app['media_cache_settings']=value
            request.app['media_playback_raw']=raw
            if value['directory']!=previous['directory']:
                from .viewer_cache import ViewerCache
                request.app['viewer_cache']=await asyncio.to_thread(ViewerCache,Path(value['directory'])/'viewer-cache-v3')
            request.app['media_playback_records'].clear()
            request.app['media_playback_clients'].clear()
        return web.json_response(cache_settings.public(value))
    except (ValueError,OSError) as exc:raise web.HTTPBadRequest(text=str(exc)) from exc


def viewer_source(request):
    job_id,job=load(request)
    if not native(job):raise ValueError('Open a precision source first.')
    ratio=int(request.query.get('ratio','1'));plane=request.query.get('plane','rgba')
    from .viewer_cache import RATIOS
    if ratio not in RATIOS:raise ValueError('Choose 1:1, 1:2, 1:4, 1:8 or 1:64.')
    directory,color=render_source(request,job_id,job,request.query.get('output')=='1')
    metadata=dict(job['precision']);source=directory or api(request).INPUT/job['source']
    if directory:
        metadata.update(kind='sequence',files=[f'{i:08d}.exr' for i in range(metadata['frames'])])
        color=dict(color,input_space=color['working_space'],alpha_mode='premultiplied')
    return job_id,job,source,metadata,color,ratio,plane


@routes.get(r'/api/jobs/{job:[0-9a-f]{32}}/preview-state')
async def preview_state(request):
    try:
        _,_,source,metadata,_,ratio,plane=viewer_source(request)
        cache=request.app['viewer_cache'];key=cache.key(source,metadata,ratio,plane)
        return web.json_response(cache.state(key,metadata['frames']))
    except (ValueError,OSError) as exc:raise web.HTTPBadRequest(text=str(exc)) from exc


@routes.get(r'/api/jobs/{job:[0-9a-f]{32}}/preview-color')
async def preview_color(request):
    from . import ocio_gpu
    try:
        _,_,_,_,color,_,plane=viewer_source(request)
        cfg=cm.config(color.get('config'));display=request.query.get('display') or cfg.getDefaultDisplay()
        view=request.query.get('view') or cfg.getDefaultView(display)
        result=await asyncio.to_thread(ocio_gpu.program,color,display,view,
            encoding=request.query.get('encoding','rgba32float'),mode=request.query.get('mode','sdr'),data=plane!='rgba')
        return web.json_response(result)
    except (ValueError,OSError,RuntimeError) as exc:raise web.HTTPBadRequest(text=str(exc)) from exc


@routes.get(r'/api/jobs/{job:[0-9a-f]{32}}/preview-frame')
async def preview_frame(request):
    from .viewer_cache import rgba_float
    try:
        _,_,source,metadata,color,ratio,plane=viewer_source(request)
        index=int(request.query.get('frame','0'))
        if not 0<=index<metadata['frames']:raise ValueError('Frame is outside the source range.')
        cpu=request.query.get('cpu')=='1'
        options={'display':request.query.get('display'),'view':request.query.get('view'),
            'mode':request.query.get('mode','sdr'),'channel':request.query.get('channel','rgba'),
            'exposure':float(request.query.get('exposure','0')),'config_name':color.get('config'),'checker':False}
        if not np.isfinite(options['exposure']) or not -30<=options['exposure']<=30:raise ValueError('Invalid exposure.')
    except (ValueError,OSError) as exc:raise web.HTTPBadRequest(text=str(exc)) from exc
    cancelled=threading.Event();messages=queue.Queue(maxsize=2)
    def put(value):
        while not cancelled.is_set():
            try:messages.put(value,timeout=.05);return
            except queue.Full:pass
    def work():
        iterator=None;header=None
        try:
            iterator=request.app['viewer_cache'].bands(source,metadata,index,ratio,request.app['media_decoders'],cancelled,plane)
            for kind,info,pixels in iterator:
                if kind=='start':
                    header=info
                    info={**info,'working_space':color['working_space'],'orientation':'top-left'}
                    if cpu:info.update(encoding='rgba32float',bytes_per_pixel=16)
                if cpu and kind=='band':
                    values=rgba_float(pixels,header)
                    if plane=='rgba':values=p.convert(values,color['input_space'],color['working_space'],color['alpha_mode'],color.get('config'))
                    pixels=p.display_pixels(values,color['working_space'] if plane=='rgba' else color['working_space'],
                        **{**options,'channel':'rgba.red' if plane!='rgba' else options['channel']})
                    info={**info,'encoding':'rgba32float','bytes_per_pixel':16}
                put(packet({'kind':kind,**info},pixels.tobytes() if pixels is not None else b''))
        except InterruptedError:pass
        except Exception as exc:put(packet({'kind':'error','error':str(exc)}))
        finally:
            if iterator is not None:iterator.close()
            if cancelled.is_set():
                try:messages.put_nowait(None)
                except queue.Full:pass
            else:put(None)
    response=web.StreamResponse(headers={'Content-Type':'application/x-okapi-frame','Cache-Control':'no-store'})
    async with request.app['media_slots']:
        await response.prepare(request);worker=asyncio.create_task(asyncio.to_thread(work))
        try:
            while True:
                record=await asyncio.to_thread(messages.get)
                if record is None:break
                await response.write(record)
            await response.write_eof()
        except (ConnectionError,asyncio.CancelledError):cancelled.set()
        finally:
            cancelled.set();await asyncio.shield(worker)
    return response
