import asyncio
from fractions import Fraction
import hashlib
import json
import io as bytes_io
from pathlib import Path
import tempfile
import threading
import unittest
import zipfile
import struct

import av
import numpy as np
import PyOpenColorIO as ocio
from aiohttp import FormData
from aiohttp.test_utils import TestClient, TestServer

from media_core import pipeline as p, image_io as io
from media_core.bands import BandEngine
from media_core.stream import preview_packets
import server


class PrecisionTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory()
        self.root=Path(self.temp.name)
        self.cfg=p.config_path(self.root/'color')
        self.values={k:np.resize(np.array([-.25,0,.18,4],np.float32),(16,16)) for k in p.RGB}
    def tearDown(self): self.temp.cleanup()
    def write(self, name='source.exr', values=None, **kwargs):
        target=self.root/name
        io.write_image(target,values or self.values,working_space='ACEScg',output_space='ACEScg',color_config=self.cfg,**kwargs)
        return target
    def test_float_exr_preserves_hdr_alpha_and_data_bits(self):
        v=dict(self.values, **{'rgba.alpha':np.resize(np.array([0,.5,1,-.25],np.float32),(16,16)), 'depth.Z':np.full((16,16),10000,np.float32)})
        path=self.write(values=v)
        actual=io.read_image(path,input_space='raw',working_space='raw')
        for k in v:np.testing.assert_array_equal(actual[k].view('u4'),v[k].view('u4'))
        self.assertEqual(p.inspect(path)['input_space'],'ACEScg')
    def test_identity_color_is_bit_exact_for_premultiplied_data(self):
        v=dict(self.values, **{'rgba.alpha':np.full((16,16),.3,np.float32)})
        actual=p.convert(v,'ACEScg','ACEScg')
        for k in v:np.testing.assert_array_equal(actual[k].view('u4'),v[k].view('u4'))
    def test_half_exr_and_uint16_png(self):
        path=self.write(bit_depth='half')
        actual=io.read_image(path,input_space='raw',working_space='raw')
        for k in self.values:np.testing.assert_array_equal(actual[k],self.values[k].astype('f2').astype('f4'))
        values={k:np.linspace(0,1,256,dtype='f4').reshape(16,16) for k in p.RGB}
        path=self.root/'16.png'
        io.write_image(path,values,working_space='sRGB',output_space='sRGB',bit_depth='uint16')
        self.assertIn('uint16',io.image_info(path)['dtype'])
        with self.assertRaisesRegex(ValueError,'PNG cannot store float'):
            io.write_image(path,values,bit_depth='float')
    def test_untagged_exr_requires_explicit_input(self):
        meta={'kind':'image','input_space':None}
        with self.assertRaisesRegex(ValueError,'explicit input space'):p.settings({},meta)
    def test_display_matches_ocio_without_clipping_working_pixels(self):
        before={k:v.copy() for k,v in self.values.items()}
        actual=p.display_pixels(self.values,'ACEScg')
        expected=np.stack([self.values[k] for k in p.RGB],axis=-1)
        t=ocio.DisplayViewTransform(src='ACEScg',display='sRGB - Display',view='ACES 1.0 - SDR Video')
        p.config().getProcessor(t).getDefaultCPUProcessor().applyRGB(expected)
        np.testing.assert_array_equal(actual[...,:3],expected[::-1])
        for k in before:np.testing.assert_array_equal(before[k],self.values[k])
    def test_hdr_display_retains_extended_range(self):
        values={k:np.full((16,16),100,np.float32) for k in p.RGB}
        pixels=p.display_pixels(values,'ACEScg',mode='hdr')
        self.assertGreater(float(pixels[...,:3].max()),1)
        self.assertEqual(pixels.dtype,np.dtype('<f4'))
    def test_data_and_auxiliary_channels_avoid_color_transform(self):
        values=dict(self.values, **{'depth.Z':np.full((16,16),1234,np.float32)})
        actual=p.convert(values,'ACEScg','Linear Rec.709 (sRGB)')
        np.testing.assert_array_equal(actual['depth.Z'],values['depth.Z'])
        raw=p.settings({'input_space':'Raw','working_space':'Raw','alpha_mode':'data'},{'kind':'image'})
        self.assertEqual(raw['working_space'],'Raw')
    def test_mirror_flips_auxiliary_channels_and_blur_processes_alpha(self):
        values=dict(self.values, **{'rgba.alpha':np.eye(16,dtype='f4'),'depth.Z':np.arange(256,dtype='f4').reshape(16,16)})
        result=p.operations(values,{'operations':['flip']})
        for k in values:np.testing.assert_array_equal(result[k],values[k][:,::-1])
        blurred=p.operations(values,{'operations':['blur']})
        self.assertFalse(np.array_equal(blurred[p.ALPHA],values[p.ALPHA]))
        np.testing.assert_array_equal(blurred['depth.Z'],values['depth.Z'])
    def test_ffv1_float_video_roundtrip_preserves_negative_and_hdr_bits(self):
        paths=[self.write(f'{i}.exr',{k:v+i for k,v in self.values.items()}) for i in range(2)]
        target=self.root/'float.mkv'
        meta={'width':16,'height':16,'fps_rational':'24000/1001'}
        p.export_video(paths,target,meta,'ACEScg',codec='ffv1')
        info=p.inspect(target)
        self.assertEqual(info['frames'],2)
        self.assertEqual(info['input_space'],'ACEScg')
        color=p.settings({},info)
        frames=list(p.iter_source(target,info,color,self.root))
        for i,frame in enumerate(frames):
            for k,v in self.values.items():np.testing.assert_array_equal(frame[k].view('u4'),(v+i).view('u4'))

    def test_seek_first_native_scanline_cache_is_exact_color_independent_and_transactional(self):
        from media_core.viewer_cache import ViewerCache,rgba_float
        from media_core.video import FrameStore
        values=dict(self.values,**{'rgba.alpha':np.full((16,16),.5,np.float32)})
        path=self.write(values=values);meta=p.inspect(path);store=FrameStore()
        cache=ViewerCache(self.root/'viewer-cache');event=threading.Event()
        records=list(cache.bands(path,meta,0,2,store,event,band_height=1))
        header=records[0][1]
        self.assertEqual(header['encoding'],'rgba32float')
        self.assertEqual((header['width'],header['height']),(8,8))
        self.assertEqual([h['y'] for kind,h,_ in records if kind=='band'],list(range(8)))
        packed=np.concatenate([block for kind,_,block in records if kind=='band'])
        for i,name in enumerate((*p.RGB,p.ALPHA)):
            np.testing.assert_array_equal(packed[...,i].view('u4'),values[name][::-1][::2,::2].view('u4'))
        key=cache.key(path,meta,2)
        self.assertEqual(cache.state(key,1)['ready'],[[0,0]])
        again=list(cache.bands(path,meta,0,2,store,event))
        self.assertTrue(again[0][1]['cached'])
        np.testing.assert_array_equal(again[1][2],packed)
        # A cancelled request publishes neither a completed range nor a partial file.
        other=cache.bands(path,meta,0,4,store,event,band_height=1)
        next(other);next(other);event.set()
        with self.assertRaises(InterruptedError):next(other)
        self.assertEqual(cache.state(cache.key(path,meta,4),1)['ready'],[])
        self.assertFalse(list(cache.root.glob('*/.*.bin')))
        store.close()

    def test_native_half_and_uint16_cache_keep_storage_precision(self):
        from media_core.viewer_cache import ViewerCache
        from media_core.video import FrameStore
        store=FrameStore();cache=ViewerCache(self.root/'native-cache')
        for suffix,depth,encoding in [('exr','half','rgba16float'),('png','uint16','rgba16uint')]:
            values={k:np.linspace(0,1,256,dtype='f4').reshape(16,16) for k in p.RGB}
            path=self.root/('native.'+suffix)
            io.write_image(path,values,working_space='ACEScg',output_space='ACEScg',color_config=self.cfg,bit_depth=depth)
            records=list(cache.bands(path,p.inspect(path),0,1,store,threading.Event()))
            self.assertEqual(records[0][1]['encoding'],encoding)
            packed=np.concatenate([v for kind,_,v in records if kind=='band'])
            expected=values[p.RGB[0]][::-1].astype('<f2') if depth=='half' else np.rint(values[p.RGB[0]][::-1]*65535).astype('<u2')
            np.testing.assert_array_equal(packed[...,0],expected)
        store.close()

    def test_presentation_raw_cache_is_exact_reusable_and_byte_bounded(self):
        from media_core.playback_cache import RawCache
        from media_core.playback import cached_frames,display_bands
        from unittest.mock import patch
        source=self.write();metadata=p.inspect(source)
        cache=RawCache(self.root/'raw-cache',budget=12000)
        first=list(cached_frames(source,metadata,16,16,cache))
        with patch('media_core.playback.source_frames',side_effect=AssertionError('decoded again')):
            second=list(cached_frames(source,metadata,16,16,cache))
        for name in first[0]:np.testing.assert_array_equal(first[0][name].view('u4'),second[0][name].view('u4'))
        self.assertEqual(cache.hits,1)
        color=p.settings({'input_space':'ACEScg'},metadata)
        for exposure in (0,1):
            bands=display_bands(second[0],color,display='sRGB - Display',view='ACES 1.0 - SDR Video',
                exposure=exposure,channel='rgba',cancel=threading.Event())
            full=p.display_pixels(p.convert(second[0],'ACEScg',color['working_space']),color['working_space'],
                display='sRGB - Display',view='ACES 1.0 - SDR Video',exposure=exposure)
            np.testing.assert_array_equal(bands,full)
        for i in range(8):cache.put('another',i,first[0])
        self.assertLessEqual(cache.bytes,cache.budget)
        self.assertLessEqual(sum(v.stat().st_size for v in cache.root.glob('*/*.npz')),cache.budget)

    def test_rerun_timeline_is_small_and_keeps_exact_pts(self):
        from media_core.timeline import record
        target=self.root/'timeline.rrd'
        record(target,{'frames':3,'fps':24,'time_base':'1/1000','timestamps':[100,140,205]},'clock-test')
        self.assertTrue(target.is_file())
        self.assertGreater(target.stat().st_size,100)
        self.assertLess(target.stat().st_size,100000)
        self.assertFalse(list(self.root.glob('.*.rrd')))

    def test_native_playback_cache_preserves_master_and_frame_count(self):
        from media_core import playback
        values={k:np.linspace(0,.8,256,dtype='f4').reshape(16,16) for k in p.RGB}
        source=self.write(values=values)
        before=hashlib.sha256(source.read_bytes()).hexdigest()
        metadata=p.inspect(source)
        color=p.settings({'input_space':'ACEScg'},metadata)
        result=playback.build(source,metadata,color,self.root/'cache.mp4',
            display='sRGB - Display',view='ACES 1.0 - SDR Video',encoder='libx264')
        self.assertEqual(result['frames'],1)
        self.assertEqual(result['presentation_bits'],8)
        self.assertEqual(hashlib.sha256(source.read_bytes()).hexdigest(),before)
        with av.open(str(self.root/'cache.mp4')) as container:
            frames=list(container.decode(video=0))
            self.assertEqual(len(frames),1)
            self.assertEqual((frames[0].width,frames[0].height),(16,16))
        event=threading.Event();event.set()
        with self.assertRaises(InterruptedError):
            playback.build(source,metadata,color,self.root/'cancelled.mp4',
                display='sRGB - Display',view='ACES 1.0 - SDR Video',encoder='libx264',cancel=event)
        self.assertFalse((self.root/'cancelled.mp4').exists())

    def test_half_float_video_decoder_does_not_clip_to_one(self):
        frame=av.VideoFrame(16,16,'gbrpf16le')
        expected=np.resize(np.array([-.25,0,.18,4],dtype='<f2'),(16,16))
        for plane in frame.planes:
            rows=np.zeros((16,plane.line_size//2),dtype='<f2');rows[:,:16]=expected[::-1];plane.update(rows.tobytes())
        actual=p.video_channels(frame)
        for k in p.RGB:np.testing.assert_array_equal(actual[k],expected.astype('f4'))

    def test_half_float_video_export_roundtrip(self):
        path=self.write();target=self.root/'half.mkv'
        result=p.export_video([path],target,{'width':16,'height':16,'fps_rational':'24'},'ACEScg',codec='ffv1',storage='half')
        meta=p.inspect(target)
        self.assertEqual(result['rgb_bits'],16)
        actual=next(p.iter_source(target,meta,p.settings({},meta),self.root))
        for k,v in self.values.items():np.testing.assert_array_equal(actual[k],v.astype('f2').astype('f4'))
    def test_prores_profiles_and_color_tags(self):
        path=self.write()
        for transform,trc in [('sdr',1),('pq',16),('hlg',18)]:
            target=self.root/f'{transform}.mov'
            result=p.export_video([path],target,{'width':16,'height':16,'fps_rational':'24000/1001'},'ACEScg',transform=transform)
            info=p.inspect(target)
            self.assertEqual(info['source']['transfer'],trc)
            self.assertEqual(info['source']['primaries'],1 if transform=='sdr' else 9)
            self.assertEqual(info['fps_rational'],'24000/1001')
            self.assertEqual(result['rgb_bits'],10)
    def test_prores_422_cannot_silently_drop_alpha(self):
        path=self.write(values=dict(self.values,**{p.ALPHA:np.full((16,16),.5,np.float32)}))
        with self.assertRaisesRegex(ValueError,'cannot preserve transparency'):
            p.export_video([path],self.root/'alpha.mov',{'width':16,'height':16,'fps_rational':'24'},'ACEScg',profile='422hq')
        self.assertFalse((self.root/'alpha.mov').exists())
    def test_cancelled_render_never_reports_completion(self):
        path=self.write();meta=p.inspect(path);cancel=threading.Event();cancel.set()
        with self.assertRaises(InterruptedError):
            p.render_frames(path,meta,p.settings({},meta),{'operations':[]},self.root/'render',self.root/'color',cancel,lambda _:None)

    def test_sequence_numbers_and_pixels_are_independent_of_upload_order(self):
        names=[]
        for i in (1002,1001):
            name=f'plate.{i}.exr';self.write(name,{k:np.full((16,16),i,np.float32) for k in p.RGB});names.append(name)
        meta=p.inspect_sequence(self.root,names,'24000/1001')
        self.assertEqual(meta['first_frame'],1001)
        color=p.settings({},meta)
        actual=p.source_frame(self.root,meta,color,1,self.root)
        self.assertEqual(float(actual[p.RGB[0]][0,0]),1002)
        with self.assertRaisesRegex(ValueError,'consecutive'):
            p.inspect_sequence(self.root,['plate.1001.exr','plate.1003.exr'])

    def test_render_preserves_negative_data_window_and_nonzero_full_origin(self):
        source=self.write(origin=(-2,-3),full_size=(10,9),full_origin=(100,200))
        meta=p.inspect(source);output=self.root/'render'
        p.render_frames(source,meta,p.settings({},meta),{'operations':[]},output,self.root/'color',threading.Event(),lambda _:None)
        result=io.image_info(output/'00000000.exr')
        original=io.image_info(source)
        for k in ('data_window','full_window','native_full_origin'):self.assertEqual(result[k],original[k])
        actual=io.read_image(output/'00000000.exr',input_space='raw',working_space='raw',roi=result['bbox'])
        for k in self.values:np.testing.assert_array_equal(actual[k].view('u4'),self.values[k].view('u4'))

    def test_top_down_bands_match_full_frame_with_accumulated_blur_halos(self):
        rng=np.random.default_rng(8)
        raw={k:rng.uniform(-.1,4,(137,29)).astype('f4') for k in p.RGB}
        raw[p.ALPHA]=rng.uniform(0,1,(137,29)).astype('f4')
        color=p.settings({'input_space':'ACEScg','working_space':'ACEScg'},{'kind':'image'})
        spec={'operations':['blur','flip','blur'],'parameters':[{'blur_radius':2},{},{'blur_radius':4}]}
        engine=BandEngine(raw,color,spec)
        bands=list(engine.evaluate_progressive(band_height=32))
        self.assertEqual([137-b['rect'][3] for b in bands],[0,32,64,96,128])
        reference=p.operations(p.convert(raw,'ACEScg','ACEScg'),spec)
        for name in raw:
            actual=np.concatenate([b['channels'][name][::-1] for b in bands],axis=0)[::-1]
            np.testing.assert_allclose(actual,reference[name],atol=2e-6,rtol=2e-6)

    def test_float_stream_packets_cover_rows_once_and_keep_hdr_values(self):
        raw={k:np.full((137,29),4,np.float32) for k in p.RGB}
        color=p.settings({'input_space':'Raw','working_space':'Raw','alpha_mode':'data'},{'kind':'image'})
        headers=[];pixels=[]
        for record in preview_packets(BandEngine(raw,color),0,band_height=64):
            size=struct.unpack('>I',record[:4])[0]
            header=json.loads(record[4:4+size]);headers.append(header)
            if header['kind']=='band':pixels.append(np.frombuffer(record[4+size:],'<f4').reshape(header['height'],29,4))
        self.assertEqual([h['y'] for h in headers if h['kind']=='band'],[0,64,128])
        actual=np.concatenate(pixels)
        np.testing.assert_array_equal(actual[...,:3],4)
        self.assertEqual(headers[-1]['kind'],'done')


class PrecisionAPITests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.temp=tempfile.TemporaryDirectory();self.root=Path(self.temp.name)
        self.previous=server.INPUT,server.JOBS,server.OUTPUT_DIR
        server.INPUT=self.root/'input';server.JOBS=self.root/'jobs';server.OUTPUT_DIR=self.root/'output'
        self.client=TestClient(TestServer(server.make_app()))
        await self.client.start_server()
    async def asyncTearDown(self):
        await self.client.close()
        server.INPUT,server.JOBS,server.OUTPUT_DIR=self.previous
        self.temp.cleanup()
    def source(self):
        path=self.root/'source.exr';values={k:np.full((16,16),4,np.float32) for k in p.RGB}
        io.write_image(path,values,working_space='ACEScg',output_space='ACEScg',color_config=p.config_path(self.root/'cfg'))
        return path
    async def upload(self,path):
        form=FormData();form.add_field('video',path.read_bytes(),filename=path.name,content_type='application/octet-stream')
        response=await self.client.post('/api/upload',data=form)
        self.assertEqual(response.status,201,await response.text())
        return (await response.json())['id']
    async def wait(self,job,key):
        for _ in range(200):
            response=await self.client.get(f'/api/jobs/{job}/precision');state=await response.json()
            if state.get(key,{}).get('state') in ('complete','failed'):return state[key]
            await asyncio.sleep(.01)
        self.fail('Media job did not finish')
    async def test_native_preview_stream_separates_gpu_color_from_cached_pixels(self):
        job=await self.upload(self.source())
        response=await self.client.get(f'/api/jobs/{job}/preview-frame?frame=0&ratio=4')
        self.assertEqual(response.status,200)
        data=await response.read();records=[]
        while data:
            length=struct.unpack('>I',data[:4])[0];header=json.loads(data[4:4+length]);data=data[4+length:]
            pixels=data[:header['bytes']];data=data[header['bytes']:];records.append((header,pixels))
        self.assertEqual([r[0]['kind'] for r in records],['start','band','done'])
        self.assertEqual(records[0][0]['encoding'],'rgba32float')
        self.assertTrue(records[-1][0]['committed'])
        self.assertEqual(records[0][0]['width'],4)
        np.testing.assert_array_equal(np.frombuffer(records[1][1],'<f4').reshape(4,4,4)[...,:3],4)
        before=await(await self.client.get(f'/api/jobs/{job}/preview-state?ratio=4')).json()
        transform=await self.client.get(f'/api/jobs/{job}/preview-color?encoding=rgba32float&display=sRGB+-+Display&view=ACES+1.0+-+SDR+Video&ratio=4')
        self.assertEqual(transform.status,200,await transform.text() if transform.status!=200 else '')
        self.assertIn('ocioView',(await transform.json())['glsl'])
        after=await(await self.client.get(f'/api/jobs/{job}/preview-state?ratio=4')).json()
        self.assertEqual(before,after)
        self.assertEqual(after['ready'],[[0,0]])
        rejected=await self.client.get(f'/api/jobs/{job}/preview-frame?ratio=3')
        self.assertEqual(rejected.status,400)

    async def test_preview_quality_and_folder_persist_and_control_actual_cache(self):
        from media_core import cache_settings
        source=self.source();digest=hashlib.sha256(source.read_bytes()).hexdigest()
        job=await self.upload(source)
        folder=(self.root/'custom-cache').resolve()
        value={'directory':str(folder),'resolution':'half','quality':'draft','codec':'h264'}
        response=await self.client.post('/api/media/cache-settings',json=value)
        self.assertEqual(response.status,200,await response.text())
        self.assertEqual(cache_settings.load(server.JOBS),value)
        response=await self.client.get(f'/api/jobs/{job}/playback')
        self.assertEqual(response.status,200,await response.text())
        for _ in range(400):
            state=await(await self.client.get(f'/api/jobs/{job}/playback')).json()
            if state['state'] in ('complete','failed'):break
            await asyncio.sleep(.01)
        self.assertEqual(state['state'],'complete',state)
        self.assertEqual((state['result']['width'],state['result']['height']),(8,8))
        self.assertEqual(state['result']['quality'],'draft')
        files=list((folder/'media'/job/'playback').glob('*.mp4'))
        self.assertEqual(len(files),1)
        self.assertTrue(list((folder/'presentation-raw-cache').glob('*/*.npz')))
        with av.open(str(files[0])) as container:
            self.assertEqual((container.streams.video[0].width,container.streams.video[0].height),(8,8))
        # Production and dev expose the same route with different prefixes.
        response=await self.client.get('/api/'+state['url'].split('/api/')[1])
        self.assertEqual(response.status,200);self.assertEqual(await response.read(),files[0].read_bytes())
        self.assertEqual(hashlib.sha256(source.read_bytes()).hexdigest(),digest)
        rejected=await self.client.post('/api/media/cache-settings',json={'directory':'relative/path'})
        self.assertEqual(rejected.status,400)
        self.assertEqual(cache_settings.load(server.JOBS),value)
        blocked=self.root/'not-a-folder';blocked.write_text('keep')
        rejected=await self.client.post('/api/media/cache-settings',json={'directory':str(blocked)})
        self.assertEqual(rejected.status,400)
        self.assertEqual(blocked.read_text(),'keep')
        self.assertEqual(cache_settings.load(server.JOBS),value)

    async def test_new_color_cache_supersedes_old_request_and_ignores_stale_revision(self):
        from unittest.mock import patch
        job=await self.upload(self.source());started=threading.Event()
        def build(source,metadata,color,target,**options):
            if options['exposure']==0:
                started.set()
                if not options['cancel'].wait(5):raise AssertionError('Stale color cache was not cancelled.')
                raise InterruptedError('superseded')
            target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(b'cache')
            return {'bytes':5,'frames':metadata['frames']}
        base=f'/api/jobs/{job}/playback?display=sRGB+-+Display&view=ACES+1.0+-+SDR+Video&client=test-viewer'
        with patch('media_core.playback.build',side_effect=build):
            first=await self.client.get(base+'&revision=1&exposure=0');self.assertEqual(first.status,200)
            for _ in range(100):
                if started.is_set():break
                await asyncio.sleep(.005)
            self.assertTrue(started.is_set())
            await self.client.get(base+'&revision=2&exposure=1')
            stale=await self.client.get(base+'&revision=1&exposure=0')
            self.assertEqual((await stale.json())['state'],'cancelled')
            for _ in range(100):
                latest=await(await self.client.get(base+'&revision=2&exposure=1')).json()
                if latest['state']=='complete':break
                await asyncio.sleep(.005)
            self.assertEqual(latest['state'],'complete',latest)
            self.assertEqual(len(self.client.server.app['media_playback_records']),2)

    async def test_upload_render_export_and_source_hash_preserved(self):
        path=self.source();digest=hashlib.sha256(path.read_bytes()).hexdigest();job=await self.upload(path)
        response=await self.client.get(f'/api/jobs/{job}/frame?frame=0&mode=hdr')
        self.assertEqual(response.status,200,await response.text() if response.status!=200 else '')
        self.assertEqual(len(await response.read()),16*16*16)
        response=await self.client.post(f'/api/jobs/{job}',json={'operations':['invert']})
        self.assertEqual(response.status,200,await response.text())
        state=await self.wait(job,'render');self.assertEqual(state['state'],'complete',state)
        response=await self.client.get(f'/api/jobs/{job}/frame?output=1&x=0&y=0')
        self.assertEqual((await response.json())['values']['rgba.red'],-3)
        response=await self.client.post(f'/api/jobs/{job}/export',json={'format':'exr-half'})
        self.assertEqual(response.status,202,await response.text())
        state=await self.wait(job,'export');self.assertEqual(state['state'],'complete',state)
        response=await self.client.get(f'/api/jobs/{job}/export')
        with zipfile.ZipFile(bytes_io.BytesIO(await response.read())) as z:self.assertEqual(z.namelist(),['00000000.exr','manifest.json'])
        original=await self.client.get(f'/api/jobs/{job}/source')
        self.assertEqual(hashlib.sha256(await original.read()).hexdigest(),digest)
    async def test_frame_cache_key_includes_video_frame(self):
        paths=[]
        for i in range(2):
            path=self.root/f'{i}.exr';io.write_image(path,{k:np.full((16,16),.1+i,np.float32) for k in p.RGB},working_space='ACEScg',output_space='ACEScg',color_config=p.config_path(self.root/'cfg'));paths.append(path)
        video=self.root/'video.mkv';p.export_video(paths,video,{'width':16,'height':16,'fps_rational':'24'},'ACEScg',codec='ffv1')
        job=await self.upload(video)
        a=await self.client.get(f'/api/jobs/{job}/frame?frame=0');b=await self.client.get(f'/api/jobs/{job}/frame?frame=1')
        self.assertEqual(a.status,200);self.assertEqual(b.status,200)
        self.assertNotEqual(await a.read(),await b.read())
    async def test_model_precision_boundary_rejected_before_comfy_submission(self):
        job=await self.upload(self.source())
        response=await self.client.post(f'/api/jobs/{job}',json={'operations':['alpha_gen']})
        self.assertEqual(response.status,422)
        self.assertIn('cannot preserve float',(await response.json())['error'])
    async def test_bad_color_and_out_of_range_frame_fail_explicitly(self):
        job=await self.upload(self.source())
        response=await self.client.post(f'/api/jobs/{job}/color',json={'input_space':'made up'})
        self.assertEqual(response.status,400)
        response=await self.client.get(f'/api/jobs/{job}/frame?frame=12')
        self.assertEqual(response.status,400)

    async def test_sequence_upload_and_export_keep_original_frame_numbers(self):
        source=self.source();form=FormData()
        for number in (1002,1001):
            form.add_field('frame',source.read_bytes(),filename=f'plate.{number}.exr',content_type='application/octet-stream')
        response=await self.client.post('/api/upload-sequence?fps=24000/1001',data=form)
        self.assertEqual(response.status,201,await response.text())
        job=(await response.json())['id']
        response=await self.client.post(f'/api/jobs/{job}',json={'operations':[]})
        self.assertEqual(response.status,200)
        self.assertEqual((await self.wait(job,'render'))['state'],'complete')
        await self.client.post(f'/api/jobs/{job}/export',json={'format':'exr-half'})
        self.assertEqual((await self.wait(job,'export'))['state'],'complete')
        response=await self.client.get(f'/api/jobs/{job}/export')
        with zipfile.ZipFile(bytes_io.BytesIO(await response.read())) as z:
            self.assertEqual(z.namelist(),['00001001.exr','00001002.exr','manifest.json'])

    async def test_color_change_blocks_stale_output(self):
        job=await self.upload(self.source())
        await self.client.post(f'/api/jobs/{job}',json={'operations':[]})
        await self.wait(job,'render')
        response=await self.client.post(f'/api/jobs/{job}/color',json={'input_space':'Linear Rec.709 (sRGB)','working_space':'ACEScg'})
        self.assertEqual(response.status,200)
        response=await self.client.get(f'/api/jobs/{job}')
        self.assertEqual((await response.json())['state'],'uploaded')
        response=await self.client.get(f'/api/jobs/{job}/frame?output=1')
        self.assertEqual(response.status,400)
        response=await self.client.post(f'/api/jobs/{job}/export',json={'format':'exr-float'})
        self.assertEqual(response.status,400)

    async def test_cpu_progress_websocket_does_not_require_comfyui(self):
        job=await self.upload(self.source())
        socket=await self.client.ws_connect(f'/api/jobs/{job}/events')
        message=await socket.receive_json()
        self.assertEqual(message['type'],'okapi_progress')
        self.assertEqual(message['data']['job_id'],job)
        await socket.close()

    async def test_project_working_space_and_read_input_have_separate_scopes(self):
        job=await self.upload(self.source())
        response=await self.client.post(f'/api/jobs/{job}/color',json={'input_space':'ACEScg','working_space':'ACEScct'})
        self.assertEqual(response.status,400)
        response=await self.client.post(f'/api/jobs/{job}/project',json={'working_space':'ACEScct'})
        self.assertEqual(response.status,200)
        response=await self.client.get(f'/api/jobs/{job}/precision')
        state=await response.json()
        self.assertEqual(state['project']['color']['working_space'],'ACEScct')
        self.assertEqual(state['read']['input_space'],'ACEScg')
        self.assertNotIn('working_space',state['read'])

    async def test_float_band_stream_http_produces_start_band_done(self):
        job=await self.upload(self.source())
        response=await self.client.get(f'/api/jobs/{job}/frame-stream')
        self.assertEqual(response.status,200,await response.text() if response.status!=200 else '')
        data=await response.read();kinds=[]
        while data:
            size=struct.unpack('>I',data[:4])[0];header=json.loads(data[4:4+size]);kinds.append(header['kind'])
            data=data[4+size+header['bytes']:]
        self.assertEqual(kinds,['start','band','done'])

    async def test_single_upload_larger_than_previous_250_mib_limit(self):
        source=self.source()
        with source.open('r+b') as file:file.truncate(251*1024*1024)
        form=FormData()
        with source.open('rb') as file:
            form.add_field('video',file,filename='large.exr',content_type='application/octet-stream')
            response=await self.client.post('/api/upload',data=form)
            self.assertEqual(response.status,201,await response.text())
            job=(await response.json())['id']
        saved=server.INPUT/json.loads(server.job_file(job).read_text())['source']
        self.assertEqual(saved.stat().st_size,source.stat().st_size)

    async def test_sequence_aggregate_larger_than_previous_250_mib_limit(self):
        source=self.source()
        with source.open('r+b') as file:file.truncate(126*1024*1024)
        form=FormData()
        with source.open('rb') as first, source.open('rb') as second:
            form.add_field('frame',first,filename='plate.1001.exr',content_type='application/octet-stream')
            form.add_field('frame',second,filename='plate.1002.exr',content_type='application/octet-stream')
            response=await self.client.post('/api/upload-sequence',data=form)
            self.assertEqual(response.status,201,await response.text())
            result=await response.json()
            self.assertEqual(result['frames'],2)


if __name__=='__main__':unittest.main()
