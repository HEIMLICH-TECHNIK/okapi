import {consume} from './frame-stream.js';
import {GPUColor} from './gpu-color.js';
import {loopFromBlueprint,nextInLoop} from './viewer-loop.js';
async function json(url){const response=await fetch(url);const value=await response.json();if(!response.ok)throw new Error(value.error||`HTTP ${response.status}`);return value;}
function choice(label,values,selected){const root=document.createElement('label');root.textContent=label?label+' ':'';const input=document.createElement('select');for(const [value,text] of values)input.add(new Option(text,value));input.value=selected;input.setAttribute('aria-label',label);root.append(input);return {root,input};}
function button(text,action){const node=document.createElement('button');node.type='button';node.textContent=text;node.onclick=action;return node;}
const nextPaint=()=>new Promise(resolve=>requestAnimationFrame(resolve));
const sleep=milliseconds=>new Promise(resolve=>setTimeout(resolve,milliseconds));
const RAM_BUDGET=1024**3;
export class PrecisionViewer {
  static async open(root,job,mode,state,changed,initial){
    const caps=await json('/okapi/api/media/capabilities?'+new URLSearchParams({config:state.project.color.config}));
    const viewer=new PrecisionViewer(root,job,mode,state,caps,changed);
    if(initial){viewer.initial=initial;viewer.index=Math.max(0,Math.min(state.metadata.frames-1,Math.floor(initial.timeline==='Frame'?initial.time:viewer.indexAtTime(initial.type==='video'?initial.time:initial.time/1e9))));}
    try{await viewer.setup();return viewer;}catch(error){viewer.stop();throw error;}
  }
  constructor(root,job,mode,state,caps,changed){
    Object.assign(this,{root,job,mode,state,caps,changed,precision:true,index:0,playing:false,ready:false,zoom:1,pan:[0,0],generation:0,playToken:0,ratio:1,presentedFrames:0,frameTimes:[],frames:new Map(),frameBytes:0,controller:new AbortController()});
    this.loop={mode:'all',start:0,end:state.metadata.frames-1,speed:1,fps:state.metadata.fps,timeline:'Clip'};
    this.api=`/okapi/api/jobs/${job}`;this.output=['output','matte-video'].includes(mode);this.compare=mode==='compare';
  }
  async setup(){
    this.root.classList.add('precision-viewer');
    this.toolbar=document.createElement('div');this.toolbar.className='precision-controls precision-toolbar';
    const name=document.createElement('span');name.className='precision-view-title';name.textContent=this.compare?'A / B':this.output?'Output':'Source';
    this.channel=choice('Viewer channel',[['rgba','rgba']],'rgba');this.channel.root.firstChild.textContent='';
    this.resolution=choice('Resolution',[1,2,4,8,64].map(n=>[String(n),`1:${n}`]),localStorage.getItem('okapiViewerRatio')||'1');
    this.ratio=Number(this.resolution.input.value)||1;
    this.display=this.viewerProcess();this.exposure=document.createElement('input');this.exposure.type='number';this.exposure.step='.25';this.exposure.min='-30';this.exposure.max='30';this.exposure.value='0';this.exposure.setAttribute('aria-label','Viewer exposure');
    const spacer=document.createElement('span');spacer.className='precision-spacer';
    this.toolbar.append(name,this.channel.root,this.resolution.root,spacer,this.display.root,'EV',this.exposure,button('Fit',()=>this.fit()));
    if(this.compare){this.ab=choice('A/B',[['source','A'],['output','B'],['wipe','Wipe']],'wipe');this.toolbar.append(this.ab.root);}
    this.viewport=document.createElement('div');this.viewport.className='precision-viewport';this.image=document.createElement('div');this.image.className='precision-image';
    this.frontier=document.createElement('div');this.frontier.className='precision-render-frontier';this.frontier.hidden=true;
    this.aspect=document.createElement('span');this.aspect.className='precision-aspect';this.aspect.textContent='1.0';
    this.formatLabel=document.createElement('span');this.formatLabel.className='precision-format-label';
    this.layers=[];
    for(const output of this.compare?[false,true]:[this.output]){
      const canvas=document.createElement('canvas');canvas.setAttribute('aria-label',output?'Output float frame':'Source float frame');this.image.append(canvas);
      this.layers.push({output,canvas,header:null,scope:null,rows:0,programKey:'',colorQueue:Promise.resolve()});
    }
    this.image.append(this.frontier,this.aspect,this.formatLabel);this.viewport.append(this.image);
    this.info=document.createElement('div');this.info.className='precision-info';this.status=document.createElement('output');this.status.className='precision-status';this.probe=document.createElement('output');this.probe.className='precision-probe';this.probe.textContent='x=— y=—';this.info.append(this.status,this.probe);
    this.cacheTrack=document.createElement('div');this.cacheTrack.className='precision-cache-track';
    this.cacheCanvas=document.createElement('canvas');this.cacheCanvas.setAttribute('aria-label','Playback cache progress');
    this.cacheSeek=document.createElement('input');this.cacheSeek.type='range';this.cacheSeek.min='0';this.cacheSeek.max=String(this.state.metadata.frames-1);this.cacheSeek.step='1';this.cacheSeek.value='0';this.cacheSeek.setAttribute('aria-label','Seek cached frames');
    this.cacheCaption=document.createElement('output');this.cacheCaption.className='precision-cache-caption';this.cacheTrack.append(this.cacheCanvas,this.cacheSeek,this.cacheCaption);
    this.timeline=document.createElement('div');this.timeline.className='precision-rerun-timeline';
    this.root.replaceChildren(this.toolbar,this.viewport,this.info,this.cacheTrack,this.timeline);
    this.channel.input.onchange=()=>this.channelChanged();
    this.exposure.oninput=()=>this.renderColors();
    this.display.input.onchange=()=>{localStorage.setItem('okapiViewerProcess:'+this.state.project.id,this.display.input.value);this.changeView().catch(error=>this.fail(error));};
    this.resolution.input.onchange=async()=>{
      this.ratio=Number(this.resolution.input.value);localStorage.setItem('okapiViewerRatio',String(this.ratio));
      this.controller.abort();this.generation++;await this.refreshScopes();if(!this.playing)this.draw().catch(error=>this.fail(error));
    };
    if(this.ab)this.ab.input.onchange=async()=>{this.controller.abort();this.generation++;this.selectLayers();await this.refreshScopes();if(!this.playing)this.draw().catch(error=>this.fail(error));};
    this.cacheSeek.oninput=()=>this.setTime({sequence:Number(this.cacheSeek.value)});
    this.viewport.addEventListener('wheel',event=>{event.preventDefault();event.stopPropagation();if(event.ctrlKey||event.metaKey)this.zoom=Math.max(.05,Math.min(64,this.zoom*Math.exp(-event.deltaY*.005)));else{this.pan[0]-=event.deltaX;this.pan[1]-=event.deltaY;}this.position();},{passive:false});
    this.viewport.addEventListener('pointermove',event=>this.inspect(event));
    this.resize=new ResizeObserver(()=>{this.position();this.paintCache();});this.resize.observe(this.viewport);this.resize.observe(this.root);this.resize.observe(this.cacheTrack);
    for(const layer of this.layers){
      try{layer.gpu=await GPUColor.open(layer.canvas);layer.gpu.device.lost.then(()=>{if(!this.stopped)this.fail(new Error('GPU context lost. Reload the viewer to resume.'));});}
      catch{layer.context=layer.canvas.getContext('2d',{colorSpace:'srgb'});}
    }
    this.ready=true;this.selectLayers();await this.refreshScopes();
    try{await this.draw();}catch(error){if(error.name!=='AbortError')throw error;}await this.openTimeline();this.poll=setInterval(()=>this.pollState(),1000);
  }
  viewerProcess(){
    const values=Object.entries(this.caps.displays).flatMap(([d,views])=>views.map(v=>[`${d}|${v}`,Object.keys(this.caps.displays).length===1?v:`${d} / ${v}`]));
    const saved=localStorage.getItem('okapiViewerProcess:'+this.state.project.id),fallback=`${this.caps.default_display}|${this.caps.default_view}`;
    return choice('Viewer Process',values,values.some(([key])=>key===saved)?saved:fallback);
  }
  activeLayers(){if(!this.compare||this.ab.input.value==='wipe')return this.layers;return [this.layers[this.ab.input.value==='output'?1:0]];}
  selectLayers(){for(const layer of this.layers){layer.canvas.hidden=!this.activeLayers().includes(layer);layer.canvas.style.clipPath=this.compare&&this.ab.input.value==='wipe'&&layer.output?'inset(0 0 0 50%)':'';}}
  plane(){return ['rgba','rgba.red','rgba.green','rgba.blue','rgba.alpha'].includes(this.channel.input.value)?'rgba':this.channel.input.value;}
  parameters(layer){return new URLSearchParams({ratio:String(this.ratio),plane:this.plane(),output:layer.output?'1':'0'});}
  async refreshScopes(){await Promise.all(this.activeLayers().map(async layer=>{const parameters=this.parameters(layer).toString(),state=await json(this.api+'/preview-state?'+parameters);if(parameters!==this.parameters(layer).toString())return;layer.scope=state.key;layer.cache=state;}));this.paintCache();}
  channelChanged(){if(this.currentPlane!==undefined&&this.currentPlane!==this.plane()){this.controller.abort();this.generation++;this.refreshScopes().then(()=>{if(!this.playing)this.draw().catch(error=>this.fail(error));});}else this.renderColors();}
  async changeView(){await Promise.all(this.activeLayers().map(layer=>layer.header?this.ensureTransform(layer,layer.header):null));this.renderColors();}
  async refreshColor(){
    this.state=await json(this.api+'/precision');this.caps=await json('/okapi/api/media/capabilities?'+new URLSearchParams({config:this.state.project.color.config}));
    const choice=this.viewerProcess(),value=choice.input.value;this.display.input.replaceChildren(...Array.from(choice.input.options));this.display.input.value=value;
    for(const layer of this.layers)layer.programKey='';await this.changeView();this.updateInfo();
  }
  async ensureTransform(layer,header){
    if(!layer.gpu)return;
    const [display,view]=this.display.input.value.split('|');const hdr=/PQ|HLG|ST2084|HDR/i.test(display)&&matchMedia('(dynamic-range: high)').matches;
    const key=JSON.stringify([header.encoding,display,view,hdr,this.state.color,header.plane]);layer.requestedProgram=key;
    layer.colorQueue=layer.colorQueue.catch(()=>{}).then(async()=>{
      if(layer.requestedProgram!==key||layer.programKey===key)return;
      const params=this.parameters(layer);params.set('encoding',header.encoding);params.set('display',display);params.set('view',view);params.set('mode',hdr?'hdr':'sdr');
      const program=await json(this.api+'/preview-color?'+params);
      if(layer.requestedProgram!==key||this.stopped)return;
      layer.gpu.configure({hdr,p3:hdr||/P3/.test(display)});await layer.gpu.transform(program);layer.programKey=key;this.renderLayer(layer);
    });
    await layer.colorQueue;
  }
  renderLayer(layer){if(layer.gpu&&layer.header)layer.gpu.draw(Number(this.exposure.value)||0,['rgba','rgba.red','rgba.green','rgba.blue','rgba.alpha'].indexOf(this.channel.input.value)>0?['rgba.red','rgba.green','rgba.blue','rgba.alpha'].indexOf(this.channel.input.value)+1:0);}
  renderColors(){if(this.activeLayers().every(layer=>layer.gpu)){for(const layer of this.activeLayers())this.renderLayer(layer);}else if(!this.playing)this.draw().catch(error=>this.fail(error));}
  async draw(){
    if(this.stopped)return;this.controller.abort();this.controller=new AbortController();const generation=++this.generation;
    this.currentPlane=this.plane();this.updateClock();this.frontier.hidden=false;for(const layer of this.activeLayers())layer.rows=0;
    this.drawing=true;
    try{await Promise.all(this.activeLayers().map(layer=>this.drawLayer(layer,generation)));}
    finally{if(generation===this.generation)this.drawing=false;}
    if(generation===this.generation){this.frontier.hidden=true;this.presentedFrames++;if(this.playing){this.frameTimes.push(performance.now());if(this.frameTimes.length>30)this.frameTimes.shift();}this.updateInfo();this.paintCache();}
  }
  async drawLayer(layer,generation){
    const index=this.index,ratio=this.ratio,key=`${layer.scope}:${index}`;const cached=layer.gpu&&this.frames.get(key);
    if(cached){this.frames.delete(key);this.frames.set(key,cached);layer.header=cached.header;layer.gpu.begin(cached.header);await this.ensureTransform(layer,cached.header);
      if(generation!==this.generation)throw new DOMException('Superseded frame','AbortError');
      layer.gpu.upload({y:0,width:cached.header.width,height:cached.header.height,bytes_per_pixel:cached.header.bytes_per_pixel},cached.bytes);this.renderLayer(layer);layer.rows=cached.header.height;this.header=cached.header;this.position();this.paintCache();return;}
    const params=this.parameters(layer);params.set('frame',String(index));
    if(!layer.gpu){const [display,view]=this.display.input.value.split('|');params.set('cpu','1');params.set('display',display);params.set('view',view);params.set('exposure',this.exposure.value);params.set('channel',this.channel.input.value);}
    const response=await fetch(this.api+'/preview-frame?'+params,{signal:this.controller.signal});if(!response.ok)throw new Error((await response.json()).error||'Frame unavailable');
    let bytes,header,lastPaint=performance.now();
    await consume(response,{
      isCurrent:()=>!this.stopped&&generation===this.generation,
      onStart:async value=>{
        header=value;layer.header=header;this.header=header;layer.scope=header.key;this.setChannels(header.channels);this.position();
        if(layer.gpu){layer.gpu.begin(header);bytes=new Uint8Array(header.width*header.height*header.bytes_per_pixel);await this.ensureTransform(layer,header);}
        else{layer.canvas.width=header.width;layer.canvas.height=header.height;}
      },
      onBand:async(band,payload)=>{
        if(layer.gpu){bytes.set(payload,band.y*band.width*header.bytes_per_pixel);layer.gpu.upload(band,payload);this.renderLayer(layer);}
        else{const pixels=new Float32Array(payload.buffer,payload.byteOffset,payload.byteLength/4);const rgba=new Uint8ClampedArray(pixels.length);for(let i=0;i<rgba.length;i++)rgba[i]=Math.round(Math.min(1,Math.max(0,pixels[i]))*255);layer.context.putImageData(new ImageData(rgba,band.width,band.height),0,band.y);}
        layer.rows=band.completed_rows;const completed=Math.min(...this.activeLayers().map(l=>l.header?l.rows/l.header.height:0));
        this.frontier.hidden=!!header.cached;this.frontier.style.top=`${completed*100}%`;this.updateInfo(`frame ${index} · ${band.completed_rows}/${band.total_rows} rows`);this.paintCache();
        if(this.rerun&&this.playing)this.syncTimeline().catch(()=>{});
        if(performance.now()-lastPaint>16){await nextPaint();lastPaint=performance.now();}
      },
      onDone:value=>{
        if(value.committed&&bytes&&bytes.byteLength<=RAM_BUDGET){
          const memoryKey=`${header.key}:${index}`;if(!this.frames.has(memoryKey)){while(this.frames.size&&this.frameBytes+bytes.byteLength>RAM_BUDGET){const first=this.frames.keys().next().value;this.frameBytes-=this.frames.get(first).bytes.byteLength;this.frames.delete(first);}this.frames.set(memoryKey,{header,bytes});this.frameBytes+=bytes.byteLength;}
        }
        if(layer.cache){layer.cache.ready=this.mergeRanges(layer.cache.ready,index);delete layer.cache.loading[String(index)];}
        this.paintCache();
      }
    });
  }
  mergeRanges(ranges,index){const values=[...ranges.map(v=>[...v]),[index,index]].sort((a,b)=>a[0]-b[0]),result=[];for(const range of values){const last=result.at(-1);if(last&&range[0]<=last[1]+1)last[1]=Math.max(last[1],range[1]);else result.push(range);}return result;}
  setChannels(channels){const options=[...new Set(['rgba',...[...this.channel.input.options].map(o=>o.value),...channels])];const current=this.channel.input.value;this.channel.input.replaceChildren(...options.map(value=>new Option(value,value)));this.channel.input.value=current;}
  updateInfo(progress){
    const h=this.header,m=this.state.metadata;if(!h){this.status.textContent=progress||'Preparing float frame…';return;}
    const bbox=h.bbox||[0,0,m.width,m.height],format=`${m.width}×${m.height}`;
    this.formatLabel.textContent=format;this.status.textContent=`${format}  bbox: ${bbox.join(' ')}  channels: ${h.channels.map(v=>v.replace('rgba.','')).join(' ')}  ${h.source_bits}bit  1:${this.ratio}`;
    this.status.title=progress||`${this.state.project.color.working_space} · ${this.playing?'playing':'paused'} · native precision cache`;
  }
  position(){
    const collapsed=this.root.getBoundingClientRect().height<350,timelineHeight=collapsed?(this.root.clientWidth<650?90:55):180;
    if(this.timelineHeight!==timelineHeight){this.timelineHeight=timelineHeight;this.timeline.style.flexBasis=timelineHeight+'px';}
    if(this.rerun?.ready&&this.timelineCollapsed!==collapsed){this.timelineCollapsed=collapsed;this.rerun.overridePanelState('time',collapsed?'collapsed':null);}
    if(!this.header)return;const b=this.viewport.getBoundingClientRect(),m=this.state.metadata;
    const scale=Math.min(Math.max(1,b.width-40)/m.width,Math.max(1,b.height-42)/m.height)*this.zoom;
    this.image.style.width=`${m.width*scale}px`;this.image.style.height=`${m.height*scale}px`;this.image.style.transform=`translate(calc(-50% + ${this.pan[0]}px),calc(-50% + ${this.pan[1]}px))`;
  }
  fit(){this.zoom=1;this.pan=[0,0];this.position();}
  inspect(event){if(!this.header)return;const r=this.image.getBoundingClientRect(),m=this.state.metadata;const x=Math.floor((event.clientX-r.left)/r.width*m.width),y=Math.floor((1-(event.clientY-r.top)/r.height)*m.height);this.probe.textContent=`x=${x} y=${y}`;}
  cacheSummary(){
    const layers=this.activeLayers(),ready=[],ramReady=[],diskReady=[];
    for(let i=0;i<this.state.metadata.frames;i++){
      const ram=layers.every(l=>this.frames.has(`${l.scope}:${i}`)),disk=layers.every(l=>l.cache?.ready.some(([a,b])=>a<=i&&i<=b));
      if(ram)ramReady.push(i);if(disk)diskReady.push(i);if(ram||disk)ready.push(i);
    }
    return {frames:this.state.metadata.frames,ready,ramReady,diskReady,loop:this.loop,index:this.index,rows:Math.min(...layers.map(l=>l.header?l.rows/l.header.height:0))};
  }
  paintCache(){
    if(!this.cacheCanvas)return;const summary=this.cacheSummary(),width=Math.max(1,this.cacheTrack.clientWidth),height=12,dpr=devicePixelRatio||1;
    if(this.cacheCanvas.width!==Math.round(width*dpr)||this.cacheCanvas.height!==Math.round(height*dpr)){this.cacheCanvas.width=Math.round(width*dpr);this.cacheCanvas.height=Math.round(height*dpr);}
    const c=this.cacheCanvas.getContext('2d');c.setTransform(dpr,0,0,dpr,0,0);c.fillStyle='#171717';c.fillRect(0,0,width,height);
    const cell=width/summary.frames;
    if(this.loop.mode==='selection'){c.fillStyle='#353028';c.fillRect(this.loop.start*cell,0,(this.loop.end-this.loop.start+1)*cell,height);c.fillStyle='#f1b468';c.fillRect(this.loop.start*cell,0,1,height);c.fillRect((this.loop.end+1)*cell-1,0,1,height);}for(const index of summary.ready){c.fillStyle=summary.ramReady.includes(index)?'#dc933c':'#805b32';c.fillRect(index*cell,5,Math.max(1,cell),4);}
    c.fillStyle='#f4c47d';if(!summary.ready.includes(this.index))c.fillRect(this.index*cell,5,Math.max(1,cell*summary.rows),4);
    c.fillStyle='#eee';c.fillRect(this.index*cell,0,1,height);
    this.cacheSeek.value=String(this.index);this.cacheSeek.setAttribute('aria-valuetext',`Frame ${this.index}, ${summary.ready.length}/${summary.frames} cached`);
    const fps=this.frameTimes.length>2?1000*(this.frameTimes.length-1)/(this.frameTimes.at(-1)-this.frameTimes[0]):0;this.cacheCaption.textContent=`${summary.ramReady.length}/${summary.frames} RAM · ${summary.diskReady.length} disk${this.playing&&fps?' · '+fps.toFixed(1)+' fps':''}`;this.cacheTrack.title=`Native precision · ${summary.ramReady.length} RAM · ${summary.diskReady.length} disk · current frame ${Math.round(summary.rows*100)}% rows`;
    this.changed('viewer_cache',JSON.stringify(summary));
  }
  frameTime(index){const m=this.state.metadata,p=m.timestamps;if(p?.length===m.frames&&p.every(v=>v!==null)){const [a,b]=m.time_base.split('/').map(Number);return(p[index]-p[0])*a/(b||1);}return index/m.fps;}
  indexAtTime(seconds){let low=0,high=this.state.metadata.frames-1;while(low<high){const mid=Math.ceil((low+high)/2);if(this.frameTime(mid)<=seconds+1e-5)low=mid;else high=mid-1;}return low;}
  updateClock(){this.cacheSeek.value=String(this.index);this.changed('viewer_clock',String(this.index));this.paintCache();}
  async setTime({sequence,durationNanos,timeline,fromRerun=false}){
    if(timeline)this.clockTimeline=timeline;const index=Math.max(0,Math.min(this.state.metadata.frames-1,Math.floor(sequence??this.indexAtTime(durationNanos/1e9))));
    if(index===this.index&&!fromRerun)return;this.index=index;this.controller.abort();this.generation++;this.updateClock();
    if(!fromRerun)await this.syncTimeline();if(!this.playing)try{await this.draw();}catch(error){this.fail(error);}
  }
  async set_playing(_,value){
    if(value===this.playing)return;
    if(value){if(this.timelineReady)await Promise.race([this.timelineReady,sleep(3000)]);if(this.stopped)return;await this.readLoopControls();if(this.index<this.loop.start||this.index>this.loop.end)this.index=this.loop.speed<0?this.loop.end:this.loop.start;}
    this.playing=value;this.frameTimes=[];const token=++this.playToken;if(value){this.controller.abort();this.generation++;}
    await this.syncTimeline(value?'playing':'paused');
    if(!value){if(!this.drawing)this.frontier.hidden=true;this.updateInfo();this.paintCache();return;}
    let deadline=performance.now();
    while(this.playing&&!this.stopped&&token===this.playToken){
      if(this.timelineEditing){deadline=performance.now();await sleep(16);continue;}
      const frame=this.index;this.updateClock();
      try{await this.draw();}catch(error){if(error.name==='AbortError'){deadline=performance.now();continue;}this.fail(error);this.playing=false;await this.syncTimeline('paused');break;}
      if(!this.playing||token!==this.playToken||this.index!==frame)continue;
      const next=nextInLoop(frame,this.loop);
      if(next===null){this.playing=false;this.frontier.hidden=true;this.updateInfo();await this.syncTimeline('paused');break;}
      const direction=this.loop.speed<0?-1:1;
      const delta=direction>0&&frame<this.state.metadata.frames-1?this.frameTime(frame+1)-this.frameTime(frame):direction<0&&frame>0?this.frameTime(frame)-this.frameTime(frame-1):1/this.state.metadata.fps;
      const duration=(this.loop.timeline==='Frame'?1000/this.loop.fps:Math.max(1,delta*1000))/Math.abs(this.loop.speed);
      deadline+=duration;
      if(performance.now()>deadline+duration)deadline=performance.now();
      await sleep(Math.max(0,deadline-performance.now()));
      if(this.playing&&token===this.playToken&&this.index===frame){this.index=next;this.updateClock();this.syncTimeline('playing').catch(error=>this.fail(error));}
    }
  }
  async openTimeline(){
    const {WebViewer}=await import('/okapi/assets/rerun-0.43.2/index.js');if(this.stopped)return;this.rerun=new WebViewer();this.timelineRestored=false;this.timelineReady=new Promise(resolve=>{this.resolveTimelineReady=resolve;});
    this.timeline.addEventListener('pointerdown',event=>{this.timelineEditing=true;const rect=this.timeline.getBoundingClientRect();this.timelineInteracting=event.clientY-rect.top>(rect.width<650?85:60);});
    window.addEventListener('pointerup',this.pointerUp=event=>{if(this.timelineEditing||this.timeline.contains(event.target)){this.readLoopControls().catch(error=>this.fail(error)).finally(()=>{this.timelineEditing=false;this.syncTimeline().catch(error=>this.fail(error));});}setTimeout(()=>{this.timelineInteracting=false;},150);});
    this.timeline.addEventListener('keyup',()=>this.readLoopControls().catch(error=>this.fail(error)));
    this.rerun.on('timeline_change',()=>{const id=this.rerun.get_active_recording_id();if(id)this.clockTimeline=this.rerun.get_active_timeline(id);this.readLoopControls().catch(error=>this.fail(error));});
    this.rerun.on('recording_open',async()=>{try{await nextPaint();await this.readLoopControls();await this.syncTimeline(this.playing?'playing':'paused');this.timelineRestored=true;this.resolveTimelineReady?.();}catch(error){this.fail(error);}});
    this.rerun.on('time_update',({time})=>{if(this.stopped||this.timelineSync||!this.timelineRestored)return;const id=this.rerun.get_active_recording_id();if(!id)return;const timeline=this.rerun.get_active_timeline(id),index=timeline==='Frame'?Number(time):this.indexAtTime(Number(time)/1e9);this.clockTimeline=timeline;if((!this.playing||this.timelineInteracting)&&index!==this.index)this.setTime({sequence:index,fromRerun:true});});
    this.rerun.on('play',()=>{if(!this.timelineSync)this.set_playing(this.job,true);});this.rerun.on('pause',()=>{if(!this.timelineSync)this.set_playing(this.job,false);});
    await this.rerun.start(new URL(this.api+'/timeline.rrd',location.origin).href,this.timeline,{theme:'dark',hideWelcomeScreen:true,renderBackend:'webgl',checkForUpdatesOnStartup:false,width:'100%',height:'100%'});
    if(this.stopped){this.rerun.stop();return;}this.rerun.overridePanelState('top','hidden');this.rerun.overridePanelState('blueprint','hidden');this.rerun.overridePanelState('selection','hidden');
  }
  async syncTimeline(playState){
    if(this.timelineSync||this.timelineEditing){this.timelineDirty=true;return;}
    if(!this.rerun?.ready||!this.rerun.get_active_recording_id())return;
    this.timelineSync=true;
    try{await this.rerun.setTime({timeline:this.clockTimeline||'Clip',...(this.clockTimeline==='Frame'?{sequence:this.index}:{durationNanos:Math.round(this.frameTime(this.index)*1e9)}),playState:playState||(this.playing?'playing':'paused')});}
    finally{this.timelineSync=false;if(this.timelineDirty&&!this.stopped){this.timelineDirty=false;queueMicrotask(()=>this.syncTimeline().catch(error=>this.fail(error)));}}
  }
  async readLoopControls(){
    if(this.readingLoop||!this.rerun?.ready||!this.rerun.get_active_recording_id())return;
    this.readingLoop=true;
    try{
      const snapshot=await this.rerun.getBlueprint();
      this.loop=loopFromBlueprint(snapshot.blueprint,this.state.metadata,i=>this.frameTime(i),t=>this.indexAtTime(t));
      this.clockTimeline=this.loop.timeline;
      if(this.playing&&(this.index<this.loop.start||this.index>this.loop.end)){this.index=this.loop.speed<0?this.loop.end:this.loop.start;this.controller.abort();this.generation++;this.updateClock();}
      this.paintCache();
    }finally{this.readingLoop=false;}
  }
  async pollState(){if(this.stopped||this.polling)return;this.polling=true;try{await this.refreshScopes();await this.readLoopControls();}catch(error){this.fail(error);}finally{this.polling=false;}}
  fail(error){if(error.name==='AbortError'||this.stopped)return;this.status.textContent=error.message;}
  get_active_recording_id(){return this.job;}get_active_timeline(){return this.clockTimeline||'Clip';}
  get_time_range(_,timeline){return {min:0,max:timeline==='Frame'?this.state.metadata.frames-1:this.frameTime(this.state.metadata.frames-1)*1e9};}
  get_current_time(){return this.clockTimeline==='Frame'?this.index:Math.round(this.frameTime(this.index)*1e9);}get_playing(){return this.playing;}
  overridePanelState(panel,state){if(panel==='time'){this.timeline.hidden=state==='hidden';this.rerun?.overridePanelState('time',state==='hidden'?'hidden':this.timelineCollapsed?'collapsed':state);}}
  overridePanelStateTime(){}
  stop(){this.stopped=true;this.resolveTimelineReady?.();this.playing=false;this.playToken++;this.controller.abort();this.rerun?.stop();for(const layer of this.layers||[])layer.gpu?.stop();this.frames.clear();clearInterval(this.poll);this.resize?.disconnect();window.removeEventListener('pointerup',this.pointerUp);this.root.classList.remove('precision-viewer');}
}
