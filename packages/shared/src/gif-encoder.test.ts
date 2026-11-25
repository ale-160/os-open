import { describe, expect, it } from 'vitest';
import {
  GifAnimationEncoder,
  encodeAnimatedGIF,
  encodeGIF,
  type GifImageData,
} from './gif-encoder';

type RGBA = [number, number, number, number];

/** 构造纯色 RGBA 帧（node 环境没有 ImageData，编码器接受结构兼容对象） */
function solidFrame(width: number, height: number, rgb: [number, number, number]): GifImageData {
  return frameFrom(width, height, () => [rgb[0], rgb[1], rgb[2], 255]);
}

function frameFrom(width: number, height: number, pixel: (p: number) => RGBA): GifImageData {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let p = 0; p < width * height; p++) data.set(pixel(p), p * 4);
  return { width, height, data };
}

/** 确定性伪随机（LCG），让噪声图稳定可复现 */
function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

async function bytesOf(blob: Blob): Promise<Uint8Array> {
  return new Uint8Array(await blob.arrayBuffer());
}

/** 标准 GIF 变宽 LZW 解码（LSB 优先，12 位封顶，CLEAR 重置），独立于编码器实现 */
function lzwDecode(data: Uint8Array, minCodeSize: number): number[] {
  const clearCode = 1 << minCodeSize;
  const eoiCode = clearCode + 1;
  const out: number[] = [];
  let codeSize = minCodeSize + 1;
  let dict: number[][] = [];
  let next = eoiCode + 1;
  const reset = () => {
    dict = [];
    for (let i = 0; i < clearCode; i++) dict[i] = [i];
    codeSize = minCodeSize + 1;
    next = eoiCode + 1;
  };
  reset();

  let bitPos = 0;
  const read = (): number => {
    let code = 0;
    for (let i = 0; i < codeSize; i++, bitPos++) {
      const byte = data[bitPos >> 3];
      if (byte === undefined) throw new Error('LZW stream ended without EOI');
      code |= ((byte >> (bitPos & 7)) & 1) << i;
    }
    return code;
  };

  let prev = -1;
  for (;;) {
    const code = read();
    if (code === clearCode) {
      reset();
      prev = -1;
      continue;
    }
    if (code === eoiCode) break;
    let entry: number[];
    if (prev === -1) {
      entry = dict[code];
    } else {
      if (code < next) {
        entry = dict[code];
        if (next < 4096) dict[next++] = [...dict[prev], entry[0]];
      } else if (code === next) {
        entry = [...dict[prev], dict[prev][0]];
        if (next < 4096) dict[next++] = entry;
      } else {
        throw new Error(`invalid LZW code ${code} (next=${next})`);
      }
      if (next === 1 << codeSize && codeSize < 12) codeSize++;
    }
    if (!entry) throw new Error(`unknown LZW code ${code}`);
    out.push(...entry);
    prev = code;
  }
  return out;
}

interface DecodedFrame {
  delayCs: number | null;
  disposal: number | null;
  transparentIndex: number | null;
  colorTable: number[][];
  indices: number[];
}

interface DecodedGif {
  width: number;
  height: number;
  globalColorTable: number[][] | null;
  hasLoop: boolean;
  frames: DecodedFrame[];
}

/** 按 GIF89a 块结构完整解析（色表、GCE、图像数据 LZW 解码），用于往返校验 */
function decodeGif(bytes: Uint8Array): DecodedGif {
  if (String.fromCharCode(...bytes.subarray(0, 6)) !== 'GIF89a') throw new Error('not GIF89a');
  const width = bytes[6] | (bytes[7] << 8);
  const height = bytes[8] | (bytes[9] << 8);
  let p = 13;
  const readTable = (flags: number): number[][] => {
    const n = 1 << ((flags & 0x07) + 1);
    const table: number[][] = [];
    for (let i = 0; i < n; i++) table.push([bytes[p + i * 3], bytes[p + i * 3 + 1], bytes[p + i * 3 + 2]]);
    p += n * 3;
    return table;
  };
  const readSubBlocks = (): Uint8Array => {
    const chunks: number[] = [];
    while (bytes[p] !== 0) {
      const len = bytes[p++];
      for (let i = 0; i < len; i++) chunks.push(bytes[p + i]);
      p += len;
    }
    p++;
    return new Uint8Array(chunks);
  };

  const globalColorTable = bytes[10] & 0x80 ? readTable(bytes[10]) : null;
  const frames: DecodedFrame[] = [];
  let hasLoop = false;
  let pendingGce: Pick<DecodedFrame, 'delayCs' | 'disposal' | 'transparentIndex'> | null = null;

  while (p < bytes.length) {
    const block = bytes[p++];
    if (block === 0x3b) break; // Trailer
    if (block === 0x21) {
      const label = bytes[p++];
      if (label === 0xf9) {
        const packed = bytes[p + 1];
        pendingGce = {
          disposal: (packed >> 2) & 0x07,
          delayCs: bytes[p + 2] | (bytes[p + 3] << 8),
          transparentIndex: packed & 0x01 ? bytes[p + 4] : null,
        };
      } else if (label === 0xff) {
        if (String.fromCharCode(...bytes.subarray(p + 1, p + 12)) === 'NETSCAPE2.0') hasLoop = true;
      }
      readSubBlocks();
    } else if (block === 0x2c) {
      const packed = bytes[p + 8];
      p += 9;
      const local = packed & 0x80 ? readTable(packed) : null;
      const minCodeSize = bytes[p++];
      const indices = lzwDecode(readSubBlocks(), minCodeSize);
      frames.push({
        delayCs: pendingGce?.delayCs ?? null,
        disposal: pendingGce?.disposal ?? null,
        transparentIndex: pendingGce?.transparentIndex ?? null,
        colorTable: local ?? globalColorTable ?? [],
        indices,
      });
      pendingGce = null;
    } else {
      throw new Error(`unexpected block 0x${block.toString(16)} at ${p - 1}`);
    }
  }
  return { width, height, globalColorTable, hasLoop, frames };
}

/** 把解码帧还原为 RGBA（透明索引 → alpha 0） */
function frameToRgba(frame: DecodedFrame): RGBA[] {
  return frame.indices.map(i => {
    if (i === frame.transparentIndex) return [0, 0, 0, 0];
    const [r, g, b] = frame.colorTable[i];
    return [r, g, b, 255];
  });
}

function rgbaOf(image: GifImageData): RGBA[] {
  const out: RGBA[] = [];
  for (let p = 0; p < image.width * image.height; p++) {
    const a = image.data[p * 4 + 3] < 128 ? 0 : 255;
    out.push(a === 0 ? [0, 0, 0, 0] : [image.data[p * 4], image.data[p * 4 + 1], image.data[p * 4 + 2], 255]);
  }
  return out;
}

describe('encodeGIF（单帧）', () => {
  it('写出 GIF89a 头、逻辑屏幕尺寸与 Trailer，MIME 为 image/gif', async () => {
    const blob = encodeGIF(solidFrame(320, 180, [30, 30, 46]));
    expect(blob.type).toBe('image/gif');
    const bytes = await bytesOf(blob);
    expect(String.fromCharCode(...bytes.subarray(0, 6))).toBe('GIF89a');
    expect(bytes[6] | (bytes[7] << 8)).toBe(320);
    expect(bytes[8] | (bytes[9] << 8)).toBe(180);
    expect(bytes.at(-1)).toBe(0x3b);
  });

  it('≤256 色的图像无损往返（LZW 码表多次写满并 CLEAR 重置）', async () => {
    // 200 色随机噪声：颜色数未超限走原色路径，像素应逐个还原；
    // 128×128 的高熵索引流足以让 4096 项码表写满并触发重置
    const rand = lcg(42);
    const colors: RGBA[] = Array.from({ length: 200 }, (_, i) => [i, (i * 7) & 0xff, 255 - i, 255]);
    const image = frameFrom(128, 128, () => colors[Math.floor(rand() * colors.length)]);

    const gif = decodeGif(await bytesOf(encodeGIF(image)));
    expect(gif.frames).toHaveLength(1);
    expect(gif.globalColorTable).toHaveLength(256);
    expect(frameToRgba(gif.frames[0])).toEqual(rgbaOf(image));
  });

  it('alpha < 128 的像素映射到透明索引，并通过 GCE 声明', async () => {
    const image = frameFrom(4, 4, p => (p % 2 === 0 ? [255, 0, 0, 255] : [0, 0, 255, 127]));
    const gif = decodeGif(await bytesOf(encodeGIF(image)));
    const [frame] = gif.frames;
    expect(frame.transparentIndex).not.toBeNull();
    expect(frameToRgba(frame)).toEqual(rgbaOf(image));
    expect(frame.indices.filter(i => i === frame.transparentIndex)).toHaveLength(8);
  });

  it('不透明图像不写 GCE（无透明索引）', async () => {
    const gif = decodeGif(await bytesOf(encodeGIF(solidFrame(3, 3, [1, 2, 3]))));
    expect(gif.frames[0].transparentIndex).toBeNull();
    expect(gif.frames[0].delayCs).toBeNull();
  });

  it('超过 256 色时中位切分量化到 ≤256 色，解码结果接近原图', async () => {
    // 64×64 平滑渐变 ≈ 4096 种颜色
    const image = frameFrom(64, 64, p => [(p % 64) * 4, Math.floor(p / 64) * 4, 128, 255]);
    const gif = decodeGif(await bytesOf(encodeGIF(image)));
    const decoded = frameToRgba(gif.frames[0]);
    const original = rgbaOf(image);
    expect(decoded).toHaveLength(original.length);
    expect(new Set(decoded.map(c => c.join(','))).size).toBeLessThanOrEqual(256);

    let maxErr = 0;
    decoded.forEach((c, i) => {
      for (let ch = 0; ch < 3; ch++) maxErr = Math.max(maxErr, Math.abs(c[ch] - original[i][ch]));
    });
    expect(maxErr).toBeLessThanOrEqual(16);
  });
});

describe('GifAnimationEncoder / encodeAnimatedGIF（多帧）', () => {
  it('写出逻辑屏幕尺寸、每帧局部色表与像素往返', async () => {
    const frames = [
      { imageData: solidFrame(6, 4, [255, 0, 0]), delayMs: 100 },
      { imageData: frameFrom(6, 4, p => (p < 12 ? [0, 255, 0, 255] : [0, 0, 0, 0])), delayMs: 100 },
    ];
    const gif = decodeGif(await bytesOf(encodeAnimatedGIF(frames)));
    expect([gif.width, gif.height]).toEqual([6, 4]);
    expect(gif.frames).toHaveLength(2);
    gif.frames.forEach((f, i) => expect(frameToRgba(f)).toEqual(rgbaOf(frames[i].imageData)));
    // 不透明帧 disposal=1（不清除），含透明帧 disposal=2（恢复背景）
    expect(gif.frames.map(f => f.disposal)).toEqual([1, 2]);
  });

  it('帧延时按厘秒取整，下限 2cs；默认写入 NETSCAPE2.0 循环扩展', async () => {
    const delaysMs = [100, 74, 1070, 5, 0];
    const encoder = new GifAnimationEncoder();
    delaysMs.forEach((delayMs, i) =>
      encoder.addFrame({ imageData: solidFrame(8, 4, [i * 40, 0, 255 - i * 40]), delayMs })
    );
    expect(encoder.frameCount).toBe(delaysMs.length);

    const gif = decodeGif(await bytesOf(encoder.finish()));
    expect(gif.hasLoop).toBe(true);
    expect(gif.frames.map(f => f.delayCs)).toEqual([10, 7, 107, 2, 2]);
  });

  it('loop: false 时不写循环扩展', async () => {
    const blob = encodeAnimatedGIF([{ imageData: solidFrame(2, 2, [9, 9, 9]), delayMs: 100 }], { loop: false });
    expect(decodeGif(await bytesOf(blob)).hasLoop).toBe(false);
  });

  it('流式输出与一次性编码逐字节一致', async () => {
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

  it('finish() 可重复调用且结果一致，之后不可再加帧', async () => {
    const encoder = new GifAnimationEncoder();
    encoder.addFrame({ imageData: solidFrame(2, 2, [1, 1, 1]), delayMs: 100 });
    const first = await bytesOf(encoder.finish());
    const second = await bytesOf(encoder.finish());
    expect(second).toEqual(first);
    expect(first.at(-1)).toBe(0x3b);
    expect(() => encoder.addFrame({ imageData: solidFrame(2, 2, [1, 1, 1]), delayMs: 100 })).toThrow(
      /already finished/
    );
  });

  it('拒绝空动画与尺寸不一致的帧', () => {
    const encoder = new GifAnimationEncoder();
    expect(() => encoder.finish()).toThrow(/no frames/);
    encoder.addFrame({ imageData: solidFrame(4, 4, [0, 0, 0]), delayMs: 100 });
    expect(() => encoder.addFrame({ imageData: solidFrame(5, 4, [0, 0, 0]), delayMs: 100 })).toThrow(
      /same canvas size/
    );

    expect(() => encodeAnimatedGIF([])).toThrow(/no frames/);
    expect(() =>
      encodeAnimatedGIF([
        { imageData: solidFrame(4, 4, [0, 0, 0]), delayMs: 100 },
        { imageData: solidFrame(4, 5, [0, 0, 0]), delayMs: 100 },
      ])
    ).toThrow(/same canvas size/);
  });
});
