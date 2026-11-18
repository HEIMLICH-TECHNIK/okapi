// Native-precision source textures plus an independent OCIO display shader.
export class GPUColor {
  static async open(canvas){
    if(!navigator.gpu)throw new Error('WebGPU unavailable');
    const adapter=await navigator.gpu.requestAdapter();if(!adapter)throw new Error('WebGPU unavailable');
    const device=await adapter.requestDevice();return new GPUColor(canvas,device);
  }
  constructor(canvas,device){this.canvas=canvas;this.device=device;this.context=canvas.getContext('webgpu');this.uniform=device.createBuffer({size:48,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});this.luts=[];}
  configure({hdr=false,p3=false}={}){this.context.configure({device:this.device,format:'rgba16float',alphaMode:'opaque',colorSpace:hdr||p3?'display-p3':'srgb',toneMapping:{mode:hdr?'extended':'standard'}});}
  begin(header){
    const changed=!this.header||this.header.width!==header.width||this.header.height!==header.height||this.header.encoding!==header.encoding;
    this.header=header;
    if(changed){this.texture?.destroy();this.canvas.width=header.width;this.canvas.height=header.height;
      this.texture=this.device.createTexture({size:[header.width,header.height],format:header.encoding,usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST});this.group=null;}
  }
  async transform(program){
    const build=document.querySelector('meta[name="okapi-build"]').content;
    const {ocio_shader_to_wgsl}=await import(`/okapi/assets/${build}/okapi.js`);
    const shader=ocio_shader_to_wgsl(program.glsl),device=this.device;
    for(const texture of this.luts)texture.destroy();this.luts=[];
    const entries=[{binding:0,visibility:GPUShaderStage.FRAGMENT,texture:{sampleType:program.encoding==='rgba16uint'?'uint':'unfilterable-float'}},
      {binding:1,visibility:GPUShaderStage.FRAGMENT,buffer:{type:'uniform'}}];
    for(const item of program.textures){
      entries.push({binding:item.binding,visibility:GPUShaderStage.FRAGMENT,texture:{sampleType:'unfilterable-float',viewDimension:item.dimension===3?'3d':'2d'}});
      const texture=device.createTexture({size:item.size,dimension:item.dimension===3?'3d':'2d',format:'rgba32float',usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST});
      const binary=Uint8Array.from(atob(item.data),c=>c.charCodeAt(0));
      device.queue.writeTexture({texture},binary,{bytesPerRow:item.size[0]*16,rowsPerImage:item.size[1]},item.size);this.luts.push(texture);
    }
    this.layout=device.createBindGroupLayout({entries});
    const vertex=device.createShaderModule({code:'@vertex fn vs(@builtin(vertex_index) i:u32)->@builtin(position) vec4f {var p=array<vec2f,3>(vec2f(-1,-1),vec2f(3,-1),vec2f(-1,3));return vec4f(p[i],0,1);}'});
    const fragment=device.createShaderModule({code:shader});
    const diagnostics=await fragment.getCompilationInfo();const errors=diagnostics.messages.filter(m=>m.type==='error');
    if(errors.length)throw new Error(errors.map(m=>m.message).join('\n'));
    this.pipeline=await device.createRenderPipelineAsync({layout:device.createPipelineLayout({bindGroupLayouts:[this.layout]}),
      vertex:{module:vertex,entryPoint:'vs'},fragment:{module:fragment,entryPoint:'main',targets:[{format:'rgba16float'}]}});
    this.group=null;
  }
  upload(band,bytes){this.device.queue.writeTexture({texture:this.texture,origin:[0,band.y]},bytes,{bytesPerRow:band.width*(band.bytes_per_pixel||this.header.bytes_per_pixel)},[band.width,band.height]);}
  draw(exposure=0,channel=0,target){
    if(!this.pipeline||!this.texture)return;
    const h=this.header,parameters=new Float32Array([exposure,channel,h.decode||0,0,...h.code_range,...h.matrix]);
    this.device.queue.writeBuffer(this.uniform,0,parameters);
    if(!this.group)this.group=this.device.createBindGroup({layout:this.layout,entries:[{binding:0,resource:this.texture.createView()},
      {binding:1,resource:{buffer:this.uniform}},...this.luts.map((texture,index)=>({binding:index+2,resource:texture.createView()}))]});
    const commands=this.device.createCommandEncoder();const pass=commands.beginRenderPass({colorAttachments:[{view:target||this.context.getCurrentTexture().createView(),loadOp:'clear',storeOp:'store',clearValue:[0,0,0,1]}]});
    pass.setPipeline(this.pipeline);pass.setBindGroup(0,this.group);pass.draw(3);pass.end();this.device.queue.submit([commands.finish()]);
  }
  stop(){this.texture?.destroy();for(const texture of this.luts)texture.destroy();this.uniform.destroy();this.device.destroy();}
}
