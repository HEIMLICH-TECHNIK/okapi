// Progressive packet reader adapted from nuke-REA v0.8; float32 RGBA payload.
export async function consume(response, handlers) {
  if (!response.body) throw new Error('브라우저가 이미지 스트리밍을 지원하지 않습니다.');
  const reader = response.body.getReader(); let pending = new Uint8Array(0), offset = 0, finished = false;
  async function take(length) {
    const result = new Uint8Array(length); let written = 0;
    while (written < length) {
      if (handlers.isCurrent && !handlers.isCurrent()) throw new DOMException('이전 이미지 요청', 'AbortError');
      if (offset === pending.length) {
        const item = await reader.read();
        if (item.done) throw new Error('이미지 스트림이 완료되기 전에 끊겼습니다.');
        pending = item.value; offset = 0;
      }
      const count = Math.min(length-written, pending.length-offset);
      result.set(pending.subarray(offset, offset+count), written); written += count; offset += count;
    }
    return result;
  }
  try {
    while (!finished) {
      const sizeBytes = await take(4), size = new DataView(sizeBytes.buffer).getUint32(0);
      if (size < 2 || size > 65536) throw new Error('잘못된 이미지 스트림 헤더입니다.');
      const header = JSON.parse(new TextDecoder().decode(await take(size)));
      if (!Number.isSafeInteger(header.bytes) || header.bytes < 0 || header.bytes > 64*1024*1024) throw new Error('잘못된 이미지 밴드 크기입니다.');
      const pixels = await take(header.bytes);
      if (handlers.isCurrent && !handlers.isCurrent()) throw new DOMException('이전 이미지 요청', 'AbortError');
      if (header.kind === 'error') throw new Error(header.error);
      if (header.kind === 'start') await handlers.onStart(header);
      else if (header.kind === 'band') {
        if (header.bytes !== header.width*header.height*(header.bytes_per_pixel||16)) throw new Error('이미지 밴드의 픽셀 크기가 맞지 않습니다.');
        await handlers.onBand(header, pixels);
      } else if (header.kind === 'done') { finished = true; handlers.onDone?.(header); return header; }
      else throw new Error('알 수 없는 이미지 스트림입니다.');
    }
  } finally {
    if (!finished) await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
