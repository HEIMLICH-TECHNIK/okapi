"""Single-stage distilled LTX-2.5 video-to-video graph configured for Alpha Gen."""
import secrets

MODELS = {
    "diffusion_models": ("ltx-2.5-22b-distilled-transformer-bf16.safetensors",),
    "text_encoders": ("gemma4-12b-with-proj-ltx-2.5-bf16.safetensors",),
    "vae": ("ltx-2.5-video-vae-bf16.safetensors", "ltx-2.5-audio-vae-bf16.safetensors"),
    "loras": ("ltx-2.5-22b-ic-lora-alpha-gen/ltx-2.5-22b-ic-lora-alpha-gen-0.9.safetensors",),
}
CUSTOM_NODES = ("LTXAddVideoICLoRAGuide", "LTXICLoRALoaderModelOnly", "LTXVSetAudioRefTokens")
OUTPUT = "save"


VIDEO_OPERATIONS = frozenset({"alpha_gen", "invert", "flip", "blur"})


def make_prompt(job_id, filename, width, height, frames, fps, *, operations=("alpha_gen",),
                seed=None, blur_radius=3, parameters=None):
    graph = {}

    def node(key, class_type, **inputs):
        graph[key] = {"class_type": class_type, "inputs": inputs}
        return [key, 0]

    video = node("read", "LoadVideo", file=f"okapi/{filename}")
    images = node("frames", "GetVideoComponents", video=video)
    seen = set()
    for index, operation in enumerate(operations):
        values = parameters[index] if parameters is not None else {}
        prefix = f"step_{index}_" if operation in seen else ""
        seen.add(operation)
        local_keys = set()

        def operation_node(key, class_type, **inputs):
            if prefix:
                inputs = {
                    field: [prefix + value[0], value[1]]
                    if isinstance(value, list) and len(value) == 2
                    and isinstance(value[0], str) and value[0] in local_keys
                    else value
                    for field, value in inputs.items()
                }
            local_keys.add(key)
            return node(prefix + key, class_type, **inputs)

        if operation == "alpha_gen":
            images = alpha_matte(operation_node, images, width, height, frames, fps,
                                 values.get("seed", seed))
        elif operation == "invert":
            images = operation_node("invert", "ImageInvert", image=images)
        elif operation == "flip":
            images = operation_node("flip", "ImageFlip", image=images, flip_method="y-axis: horizontally")
        elif operation == "blur":
            images = operation_node("blur", "ImageBlur", image=images,
                                    blur_radius=values.get("blur_radius", blur_radius), sigma=1.0)

    output = node("matte", "CreateVideo", images=images, fps=fps, bit_depth=8,
                  color_space="sRGB", chroma_subsampling="420")
    node(OUTPUT, "SaveVideo", video=output, filename_prefix=f"okapi/{job_id}/matte",
         format="mp4", **{"format.codec": "h264"})
    return graph


def alpha_matte(node, images, width, height, frames, fps, seed):
    padded_width = max(64, (width + 31) // 32 * 32)
    padded_height = max(64, (height + 31) // 32 * 32)
    padded_frames = max(9, ((frames - 1 + 7) // 8) * 8 + 1)
    if (width, height) != (padded_width, padded_height):
        images = node("pad", "ImagePadForOutpaint", image=images, left=0, top=0,
                      right=padded_width-width, bottom=padded_height-height, feathering=0)
    if frames < padded_frames:
        last = node("last_frame", "ImageFromBatch", image=images, batch_index=frames-1, length=1)
        tail = node("repeat", "RepeatImageBatch", image=last, amount=padded_frames-frames)
        images = node("extend", "ImageBatch", image1=images, image2=tail)

    transformer = node("transformer", "UNETLoader", unet_name=MODELS["diffusion_models"][0], weight_dtype="default")
    model = node("adapter", "LTXICLoRALoaderModelOnly", model=transformer,
                 lora_name=MODELS["loras"][0], strength_model=1.0)
    vae = node("video_vae", "VAELoader", vae_name=MODELS["vae"][0])
    audio_vae = node("audio_vae", "VAELoader", vae_name=MODELS["vae"][1])
    clip = node("text_encoder", "CLIPLoader", clip_name=MODELS["text_encoders"][0], type="ltxv", device="default")
    blank = node("empty_prompt", "CLIPTextEncode", clip=clip, text="")
    conditioned = node("fps", "LTXVConditioning", positive=blank, negative=blank, frame_rate=fps)
    latent = node("video_latent", "EmptyLTXVLatentVideo", width=padded_width,
                  height=padded_height, length=padded_frames, batch_size=1)
    guide = node("guide", "LTXAddVideoICLoRAGuide", positive=conditioned, negative=["fps", 1],
                 vae=vae, latent=latent, image=images, frame_idx=0, strength=1.0,
                 latent_downscale_factor=["adapter", 1], crop="disabled",
                 use_tiled_encode=True, tile_size=256, tile_overlap=64)
    silence = node("silence", "EmptyAudio", duration=padded_frames/fps, sample_rate=44100, channels=2)
    audio = node("audio_latent", "VAEEncodeAudio", audio=silence, vae=audio_vae)
    node("audio_ref", "LTXVSetAudioRefTokens", positive=conditioned, negative=["fps", 1], audio_latent=audio)
    combined = node("combined", "LTXVConcatAVLatent", video_latent=["guide", 2], audio_latent=["audio_ref", 2])
    noise = node("noise", "RandomNoise", noise_seed=secrets.randbits(32) if seed is None else seed)
    guider = node("guider", "CFGGuider", model=model, positive=guide, negative=["guide", 1], cfg=1.0)
    sampler = node("sampler", "KSamplerSelect", sampler_name="euler_ancestral")
    sigmas = node("sigmas", "ManualSigmas", sigmas="1.0, 0.99375, 0.9875, 0.98125, 0.975, 0.909375, 0.725, 0.421875, 0.0")
    sampled = node("denoise", "SamplerCustomAdvanced", noise=noise, guider=guider,
                   sampler=sampler, sigmas=sigmas, latent_image=combined)
    split = node("split_latent", "LTXVSeparateAVLatent", av_latent=sampled)
    node("crop_guides", "LTXVCropGuides", positive=guide, negative=["guide", 1], latent=split)
    decoded = node("decode", "VAEDecodeTiled", samples=["crop_guides", 2], vae=vae,
                   tile_size=512, overlap=64, temporal_size=128, temporal_overlap=32)
    if frames < padded_frames:
        decoded = node("trim", "ImageFromBatch", image=decoded, batch_index=0, length=frames)
    if (width, height) != (padded_width, padded_height):
        decoded = node("crop_matte", "ImageCrop", image=decoded, x=0, y=0, width=width, height=height)
    return decoded
