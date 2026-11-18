// Read Rerun's own TimePanelBlueprint; never duplicate its loop selection state.
export function loopFromBlueprint(blueprint,metadata,frameTime,indexAtTime){
  const panel=blueprint?.['/time_panel']?.TimePanelBlueprint||{};
  const mode=String(panel.loop_mode||'All').toLowerCase();const timeline=panel.timeline||'Clip';
  let start=0,end=metadata.frames-1;
  if(mode==='selection'&&panel.time_selection){
    const min=Number(panel.time_selection.min),max=Number(panel.time_selection.max);
    if(Number.isFinite(min)&&Number.isFinite(max)&&min<=max){
      if(timeline==='Frame'){start=Math.ceil(min);end=Math.floor(max);}
      else{start=indexAtTime(min/1e9);if(frameTime(start)<min/1e9-1e-7)start++;end=indexAtTime(max/1e9);}
      start=Math.max(0,Math.min(metadata.frames-1,start));end=Math.max(start,Math.min(metadata.frames-1,end));
    }
  }
  const speed=Number(panel.playback_speed??1),fps=Number(panel.fps??metadata.fps);
  return {mode,start,end,timeline,speed:Number.isFinite(speed)&&speed!==0?speed:1,fps:Number.isFinite(fps)&&fps>0?fps:metadata.fps};
}
export function nextInLoop(index,loop){
  const direction=loop.speed<0?-1:1;
  if(index<loop.start||index>loop.end)return direction>0?loop.start:loop.end;
  if(direction>0&&index>=loop.end)return loop.mode==='off'?null:loop.start;
  if(direction<0&&index<=loop.start)return loop.mode==='off'?null:loop.end;
  return index+direction;
}
