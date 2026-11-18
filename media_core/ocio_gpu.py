"""OCIO-generated GPU display programs, independent of cached source pixels."""
import base64
import re
import numpy as np
import PyOpenColorIO as ocio
from . import color as cm


def stage(processor,name,start):
    desc=ocio.GpuShaderDesc.CreateShaderDesc();desc.setLanguage(ocio.GPU_LANGUAGE_GLSL_ES_3_0)
    desc.setFunctionName(name);desc.setResourcePrefix(name+'_');desc.setAllowTexture1D(False)
    processor.getDefaultGPUProcessor().extractGpuShaderInfo(desc)
    code=desc.getShaderText();textures=[]
    code=re.sub(r'\.(?:rgb|rgba)\.([rgbaxyzw]{1,4})',lambda m:'.'+m[1],code)
    if list(desc.getUniforms()):raise ValueError('Dynamic OCIO uniforms need an explicit GPU adapter.')
    for item,is3d in [(t,False) for t in desc.getTextures()]+[(t,True) for t in desc.get3DTextures()]:
        binding=start+len(textures);symbol=item.samplerName;dim=3 if is3d else 2
        size=[item.edgeLen]*3 if is3d else [item.width,item.height,1]
        values=np.asarray(item.getValues(),dtype='<f4').reshape(-1)
        cells=int(np.prod(size));channels=values.size//cells
        rgba=np.ones((cells,4),'<f4');rgba[:,:channels]=values.reshape(cells,channels)
        if channels==1:rgba[:,1:3]=rgba[:,:1]
        textures.append({'binding':binding,'size':size,'dimension':dim,'data':base64.b64encode(rgba.tobytes()).decode()})
        declaration=f'layout(set=0,binding={binding}) uniform texture{dim}D {symbol}_tex;'
        code=re.sub(r'\buniform sampler[23]D\s+'+re.escape(symbol)+r'\s*;',declaration,code)
        # Manual interpolation keeps LUTs float32 on baseline WebGPU devices,
        # including devices without float32-filterable texture support.
        vector=f'vec{dim}';integer=f'ivec{dim}';sizes=','.join(str(v) for v in size[:dim])
        helper=f'\nvec4 {symbol}_sample({vector} uv){{ {integer} dims={integer}({sizes}); {vector} p=uv*{vector}(dims)-0.5; {integer} lo={integer}(floor(p)); {vector} f=fract(p);'
        if item.interpolation==ocio.INTERP_NEAREST:
            helper+=f'return texelFetch({symbol}_tex,clamp({integer}(floor(p+0.5)),{integer}(0),dims-1),0);}}\n'
        else:
            terms=[]
            for z in range(2 if is3d else 1):
                for y in range(2):
                    for x in range(2):
                        offsets=','.join(map(str,([x,y,z] if is3d else [x,y])))
                        weight='*'.join(f'({"f."+axis if bit else "1.0-f."+axis})' for axis,bit in zip('xyz',[x,y,z][:dim]))
                        terms.append(f'texelFetch({symbol}_tex,clamp(lo+{integer}({offsets}),{integer}(0),dims-1),0)*{weight}')
            helper+='return '+'+'.join(terms)+';}\n'
        code=re.sub(r'\btexture\s*\(\s*'+re.escape(symbol)+r'\s*,',symbol+'_sample(',code)
        # Place helper after texture declarations and before first function.
        code=helper+code
    return code,textures


def program(color,display,view,*,encoding='rgba32float',mode='sdr',data=False):
    cfg=cm.config(color.get('config'));textures=[];code=''
    bypass=data or cfg.getColorSpace(color['input_space']).isData()
    for name,processor in [('ocioInput',cfg.getProcessor(color['input_space'],color['working_space'])),
        ('ocioView',cfg.getProcessor(ocio.DisplayViewTransform(src=color['working_space'],display=display,view=view)))]:
        shader,items=stage(processor,name,2+len(textures));code+=shader;textures+=items
    hdr=''
    if mode=='hdr' and not bypass:
        selected=cfg.getDisplayViewColorSpaceName(display,view)
        if selected=='<USE_DISPLAY_NAME>':selected=display
        target='ST2084-P3-D65 - Display'
        if cfg.getColorSpace(target) is None:raise ValueError('This OCIO config does not define HDR P3/PQ presentation.')
        shader,items=stage(cfg.getProcessor(selected,target),'ocioHDR',2+len(textures));code+=shader;textures+=items
        hdr='''rgb=ocioHDR(vec4(rgb,1.0)).rgb;
        vec3 power=pow(max(rgb,vec3(0)),vec3(1.0/(2523.0/32.0)));
        vec3 linear=pow(max(power-3424.0/4096.0,vec3(0))/max(2413.0/128.0-2392.0/128.0*power,vec3(1e-8)),vec3(1.0/(2610.0/16384.0)))*(10000.0/203.0);
        rgb=mix(1.055*pow(max(linear,vec3(0)),vec3(1.0/2.4))-0.055,12.92*linear,lessThanEqual(linear,vec3(0.0031308)));'''
    # All texture declarations must precede helper functions referencing them.
    declarations=re.findall(r'layout\(set=0,binding=\d+\) uniform texture[23]D \w+;',code)
    for declaration in declarations:code=code.replace(declaration,'')
    unsigned=encoding=='rgba16uint'
    source_type='utexture2D' if unsigned else 'texture2D'
    pixel='vec4(texelFetch(okapiImage,ivec2(gl_FragCoord.xy),0))'
    alpha_mode=color['alpha_mode'];unpremult=alpha_mode=='premultiplied';associate=alpha_mode!='data'
    source=f'''#version 450
    layout(set=0,binding=0) uniform {source_type} okapiImage;
    layout(set=0,binding=1,std140) uniform Controls {{vec4 controls;vec4 codeRange;vec4 matrixData;}};
    {''.join(declarations)}
    {code}
    layout(location=0) out vec4 fragment;
    void main(){{
        vec4 raw={pixel};
        if(controls.z>0.5){{
            if(controls.z>1.5){{
                float y=(raw.r-codeRange.x)/codeRange.y;
                float u=(raw.g-codeRange.z)/codeRange.w,v=(raw.b-codeRange.z)/codeRange.w;
                float kr=matrixData.x,kb=matrixData.y,kg=1.0-kr-kb;
                raw.rgb=vec3(y+(2.0-2.0*kr)*v,y-kb*(2.0-2.0*kb)/kg*u-kr*(2.0-2.0*kr)/kg*v,y+(2.0-2.0*kb)*u);
                raw.a/=matrixData.z;
            }}else raw/=matrixData.z;
        }}
        vec4 working=raw;
        if({str(not bypass).lower()}){{
            if({str(unpremult).lower()}&&raw.a!=0.0)working.rgb/=raw.a;
            working=ocioInput(working);
            if({str(associate).lower()}&&raw.a!=0.0)working.rgb*=raw.a;
        }}
        vec3 rgb=working.rgb*exp2(controls.x);
        int channel=int(controls.y);
        if(channel>0)rgb=vec3(working[channel-1])*exp2(controls.x);
        else if({str(not bypass).lower()}){{rgb=ocioView(vec4(rgb,1.0)).rgb;{hdr}}}
        fragment=vec4(rgb,1.0);
    }}'''
    return {'glsl':source,'textures':textures,'encoding':encoding,'mode':mode,'config_sha256':cm.fingerprint(color.get('config'))}
