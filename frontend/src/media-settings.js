// Project, Read and Write properties are edited outside the Viewer surface.
async function request(url,value) {
  const response=await fetch(url,value===undefined?{}:{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(value)});
  const result=await response.json();if(!response.ok)throw new Error(result.error||'Could not save properties.');return result;
}
function choice(form,title,values,value) {
  const label=document.createElement('label');label.textContent=title;
  const select=document.createElement('select');select.setAttribute('aria-label',title);
  for(const item of values){const [key,text]=Array.isArray(item)?item:[item,item];select.add(new Option(text,key));}
  select.value=value||'';label.append(select);form.append(label);return select;
}
export async function openMediaProperties(job,kind,onChange=()=>{}) {
  if(!job)throw new Error('Choose a source before editing project color settings.');
  const api=`/okapi/api/jobs/${job}`;
  const state=await request(api+'/precision');
  if(!state.enabled)throw new Error('This legacy job does not have precision media properties.');
  let caps=await request('/okapi/api/media/capabilities?'+new URLSearchParams({config:state.project.color.config}));
  document.querySelector('#okapi-media-properties')?.remove();
  const dialog=document.createElement('dialog');dialog.id='okapi-media-properties';dialog.className='media-properties';
  const title=document.createElement('h2');title.textContent=kind==='project'?'Project Settings · Color':kind==='read'?'Read · Color':'Write · Output';
  const form=document.createElement('form');form.method='dialog';
  const message=document.createElement('p');message.className='media-properties-message';message.setAttribute('role','status');
  const actions=document.createElement('div');actions.className='media-properties-actions';
  const close=document.createElement('button');close.textContent='Close';close.type='button';close.onclick=()=>dialog.close();
  const apply=document.createElement('button');apply.textContent=kind==='write'?'Export':'Apply';apply.type='submit';
  actions.append(close,apply);dialog.append(title,form,message,actions);document.body.append(dialog);
  if(kind==='project') {
    const config=choice(form,'OCIO config',caps.configs.map(c=>[c.id,c.label]),state.project.color.config);
    const working=choice(form,'Working Space',[],state.project.color.working_space);
    const fillWorking=()=>{
      const values=[...Object.entries(caps.roles).map(([role,space])=>[role,`${role} (${space})`]),...caps.spaces.map(s=>[s,s])];
      working.replaceChildren(...values.map(([value,label])=>new Option(label,value)));
      working.value=state.project.color.working_space;
      if(!working.value)working.value=caps.working_default;
    };fillWorking();
    config.onchange=async()=>{try{caps=await request('/okapi/api/media/capabilities?'+new URLSearchParams({config:config.value}));fillWorking();}catch(e){message.textContent=e.message;}};
    form.onsubmit=async e=>{e.preventDefault();try{await request(api+'/project',{config:config.value,working_space:working.value});onChange();dialog.close();}catch(e){message.textContent=e.message;}};
  } else if(kind==='read') {
    const input=choice(form,'Input Color Space',[['','Choose input space…'],...caps.spaces],state.read.input_space);
    const alpha=choice(form,'Alpha association',['premultiplied','straight','data'],state.read.alpha_mode);
    message.textContent='Input → project Working Space. Data passes use the config’s raw/data space.';
    form.onsubmit=async e=>{e.preventDefault();try{await request(api+'/color',{input_space:input.value,alpha_mode:alpha.value});onChange();dialog.close();}catch(e){message.textContent=e.message;}};
  } else {
    const format=choice(form,'File type',[['exr-float','OpenEXR · 32bit float'],['exr-half','OpenEXR · 16bit half'],['prores','ProRes · 10bit RGB'],['ffv1','FFV1 v4 · float32 RGB'],['ffv1-half','FFV1 v4 · half16 RGB']],'exr-float');
    const profile=choice(form,'ProRes profile',Object.keys(caps.prores_profiles),'4444xq');
    const transform=choice(form,'Output transform',[['sdr','Rec.709 SDR'],['pq','Rec.2100 PQ'],['hlg','Rec.2100 HLG']],'sdr');
    const download=document.createElement('a');download.textContent='Download';download.href=api+'/export';download.hidden=true;actions.prepend(download);
    let poll;
    form.onsubmit=async e=>{e.preventDefault();try{
      await request(api+'/export',{format:format.value,profile:profile.value,transform:transform.value});apply.disabled=true;download.hidden=true;message.textContent='Exporting…';
      clearInterval(poll);poll=setInterval(async()=>{try{const s=await request(api+'/precision');const r=s.export;
        if(r?.state==='complete'){message.textContent='Output ready';download.hidden=false;apply.disabled=false;clearInterval(poll);}
        if(r?.state==='failed'){message.textContent=r.error;apply.disabled=false;clearInterval(poll);}
      }catch(e){message.textContent=e.message;}},700);
    }catch(e){message.textContent=e.message;}};
    dialog.addEventListener('close',()=>clearInterval(poll),{once:true});
  }
  apply.onclick=()=>form.requestSubmit();
  dialog.addEventListener('close',()=>dialog.remove(),{once:true});dialog.showModal();
}
