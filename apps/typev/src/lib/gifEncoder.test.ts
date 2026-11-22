import { describe, expect, it } from 'vitest';
import {
  GifAnimationEncoder,
  encodeAnimatedGIF,
  type GifImageData,
} from '@os/shared/gif-encoder';
import { planGifFrames } from './gifPlan';

/** 构造纯色 RGBA 帧（node 环境没有 ImageData，编码器接受结构兼容对象） */
function solidFrame(width: number, height: number, rgb: [number, number, number]): GifImageData {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let p = 0; p < width * height; p++) {
    data[p * 4] = rgb[0];
    data[p * 4 + 1] = rgb[1];
    data[p * 4 + 2] = rgb[2];
    data[p * 4 + 3] = 255;
  }
  return { width, height, data };
}

async function bytesOf(blob: Blob): Promise<Uint8Array> {
  return new Uint8Array(await blob.arrayBuffer());
}

/** 按 GIF89a 块结构遍历，收集每帧的 Graphic Control Extension 延时（厘秒） */
function readFrameDelays(bytes: Uint8Array): { delaysCs: number[]; hasLoop: boolean } {
  let p = 13;
  const flags = bytes[10];
  if (flags & 0x80) p += 3 * (1 << ((flags & 0x07) + 1)); // 跳过 GCT
  const delaysCs: number[] = [];
  let hasLoop = false;
  const skipSubBlocks = () => {
    while (bytes[p] !== 0) p += bytes[p] + 1;
    p++;
  };
  while (p < bytes.length) {
    const block = bytes[p++];
    if (block === 0x3b) break; // Trailer
    if (block === 0x21) {
      const label = bytes[p++];
      if (label === 0xf9) {
        delaysCs.push(bytes[p + 2] | (bytes[p + 3] << 8));
      } else if (label === 0xff) {
        const app = String.fromCharCode(...bytes.subarray(p + 1, p + 12));
        if (app === 'NETSCAPE2.0') hasLoop = true;
      }
      skipSubBlocks();
    } else if (block === 0x2c) {
      const packed = bytes[p + 8];
      p += 9;
      if (packed & 0x80) p += 3 * (1 << ((packed & 0x07) + 1)); // 跳过 LCT
      p++; // LZW 最小码长
      skipSubBlocks();
    } else {
      throw new Error(`unexpected block 0x${block.toString(16)} at ${p - 1}`);
    }
  }
  return { delaysCs, hasLoop };
}

describe('@os/shared/gif-encoder (as used by TypeV GIF export)', () => {
  it('writes a GIF89a header with the logical screen size', async () => {
    const blob = encodeAnimatedGIF([{ imageData: solidFrame(320, 180, [30, 30, 46]), delayMs: 100 }]);
    expect(blob.type).toBe('image/gif');
    const bytes = await bytesOf(blob);
    expect(String.fromCharCode(...bytes.subarray(0, 6))).toBe('GIF89a');
    expect(bytes[6] | (bytes[7] << 8)).toBe(320);
    expect(bytes[8] | (bytes[9] << 8)).toBe(180);
    expect(bytes.at(-1)).toBe(0x3b); // Trailer
  });

  it('roundtrips planned frame delays and the loop extension through the streaming encoder', async () => {
    const plan = planGifFrames({ durationMs: 400, requestedFps: 10, endHoldMs: 500 });
    const encoder = new GifAnimationEncoder({ loop: true });
    plan.timesMs.forEach((t, i) => {
      const shade = Math.round((t / 400) * 255);
      encoder.addFrame({ imageData: solidFrame(8, 4, [shade, 0, 255 - shade]), delayMs: plan.delaysMs[i] });
    });
    expect(encoder.frameCount).toBe(plan.timesMs.length);

    const { delaysCs, hasLoop } = readFrameDelays(await bytesOf(encoder.finish()));
    expect(hasLoop).toBe(true);
    expect(delaysCs).toEqual(plan.delaysMs.map(ms => ms / 10));
  });

  it('streaming output is byte-identical to the one-shot encoder', async () => {
    const frames = [
      { imageData: solidFrame(6, 6, [255, 0, 0]), delayMs: 70 },
      { imageData: solidFrame(6, 6, [0, 255, 0]), delayMs: 1070 },
    ];
    const encoder = new GifAnimationEncoder();
    frames.forEach(f => encoder.addFrame(f));
    const streamed = await bytesOf(encoder.finish());
    const oneShot = await bytesOf(encodeAnimatedGIF(frames));
    expect(streamed).toEqual(oneShot);
  });

  it('rejects mismatched frame sizes and empty animations', () => {
    const encoder = new GifAnimationEncoder();
    expect(() => encoder.finish()).toThrow(/no frames/);
    encoder.addFrame({ imageData: solidFrame(4, 4, [0, 0, 0]), delayMs: 100 });
    expect(() => encoder.addFrame({ imageData: solidFrame(5, 4, [0, 0, 0]), delayMs: 100 })).toThrow(
      /same canvas size/
    );
  });
});
