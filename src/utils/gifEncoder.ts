'use client';

/**
 * 纯前端 GIF 编码器（GIF89a），支持单帧与多帧动画。
 *
 * - 颜色：中位切分法（median cut）量化至 ≤255 色；若原图不透明且颜色数足够少则直接使用原色
 * - 透明：alpha < 128 的像素映射到保留的透明索引（通过 Graphic Control Extension 声明）
 * - 压缩：标准 GIF 变宽 LZW，码长 12 位封顶后重置码表
 * - 动画：每帧独立局部色表 + 帧延时，NETSCAPE2.0 循环扩展
 */

/** 打包不透明像素颜色，便于去重与缓存：(r<<16)|(g<<8)|b */
function packColor(r: number, g: number, b: number): number {
  return (r << 16) | (g << 8) | b;
}

interface QuantizeResult {
  /** 调色板 [[r,g,b], ...]，长度 ≤ 256 */
  palette: number[][];
  /** 每个像素的调色板索引 */
  indices: Uint8Array;
  /** 透明索引；无透明像素时为 -1 */
  transparentIndex: number;
}

interface ColorBox {
  colors: number[]; // 去重后的 packed 颜色
  count: number;    // 像素权重合计
}

/**
 * 中位切分量化：按像素出现次数加权，反复沿最长通道切分颜色盒，
 * 直到盒数达到上限或无法再分，最后取各盒加权平均色作为调色板项。
 */
function medianCut(colorCounts: Map<number, number>, maxColors: number): number[][] {
  const initial: ColorBox = {
    colors: [...colorCounts.keys()],
    count: 0,
  };
  for (const c of colorCounts.values()) initial.count += c;

  const boxes: ColorBox[] = [initial];

  while (boxes.length < maxColors) {
    // 选择像素数最多且可分割的盒
    let targetIdx = -1;
    let targetCount = 0;
    for (let i = 0; i < boxes.length; i++) {
      const box = boxes[i];
      if (box.colors.length > 1 && box.count > targetCount) {
        targetCount = box.count;
        targetIdx = i;
      }
    }
    if (targetIdx === -1) break;

    const box = boxes[targetIdx];

    // 找出该盒内跨度最大的通道
    let rMin = 255, rMax = 0, gMin = 255, gMax = 0, bMin = 255, bMax = 0;
    for (const c of box.colors) {
      const r = (c >> 16) & 0xff, g = (c >> 8) & 0xff, b = c & 0xff;
      if (r < rMin) rMin = r; if (r > rMax) rMax = r;
      if (g < gMin) gMin = g; if (g > gMax) gMax = g;
      if (b < bMin) bMin = b; if (b > bMax) bMax = b;
    }
    const spanR = rMax - rMin, spanG = gMax - gMin, spanB = bMax - bMin;
    const shift = spanR >= spanG && spanR >= spanB ? 16 : spanG >= spanB ? 8 : 0;

    // 按该通道排序并找加权中位点
    const sorted = [...box.colors].sort((a, b) => ((a >> shift) & 0xff) - ((b >> shift) & 0xff));
    let acc = 0;
    let splitAt = 0;
    const half = box.count / 2;
    for (let i = 0; i < sorted.length - 1; i++) {
      acc += colorCounts.get(sorted[i]) ?? 0;
      if (acc >= half) {
        splitAt = i + 1;
        break;
      }
    }
    if (splitAt === 0 || splitAt >= sorted.length) {
      // 无法按中位切分（极端权重分布），退化为对半
      splitAt = sorted.length >> 1;
    }

    const makeBox = (colors: number[]): ColorBox => {
      let count = 0;
      for (const c of colors) count += colorCounts.get(c) ?? 0;
      return { colors, count };
    };

    boxes.splice(
      targetIdx,
      1,
      makeBox(sorted.slice(0, splitAt)),
      makeBox(sorted.slice(splitAt))
    );
  }

  // 各盒加权平均色
  return boxes.map(box => {
    let rSum = 0, gSum = 0, bSum = 0, wSum = 0;
    for (const c of box.colors) {
      const w = colorCounts.get(c) ?? 0;
      rSum += ((c >> 16) & 0xff) * w;
      gSum += ((c >> 8) & 0xff) * w;
      bSum += (c & 0xff) * w;
      wSum += w;
    }
    if (wSum === 0) wSum = 1;
    return [
      Math.round(rSum / wSum),
      Math.round(gSum / wSum),
      Math.round(bSum / wSum),
    ];
  });
}

function quantize(imageData: ImageData, maxColors: number): QuantizeResult {
  const { data } = imageData;
  const pixelCount = imageData.width * imageData.height;
  const indices = new Uint8Array(pixelCount);

  // 统计不透明颜色的出现次数
  const colorCounts = new Map<number, number>();
  let hasTransparent = false;
  const opaqueMask = new Uint8Array(pixelCount); // 1 = 不透明
  for (let p = 0; p < pixelCount; p++) {
    const a = data[p * 4 + 3];
    if (a < 128) {
      hasTransparent = true;
      continue;
    }
    opaqueMask[p] = 1;
    const packed = packColor(data[p * 4], data[p * 4 + 1], data[p * 4 + 2]);
    colorCounts.set(packed, (colorCounts.get(packed) ?? 0) + 1);
  }

  // 为可能的透明索引预留一个槽位
  const paletteLimit = hasTransparent ? maxColors - 1 : maxColors;

  let palette: number[][];
  if (colorCounts.size <= paletteLimit) {
    // 颜色数未超限，直接使用原色
    palette = [...colorCounts.keys()].map(c => [
      (c >> 16) & 0xff,
      (c >> 8) & 0xff,
      c & 0xff,
    ]);
  } else {
    palette = medianCut(colorCounts, paletteLimit);
  }

  // 颜色 → 索引 映射（精确命中缓存 + 最近邻回退）
  const exactMap = new Map<number, number>();
  for (let i = 0; i < palette.length; i++) {
    exactMap.set(packColor(palette[i][0], palette[i][1], palette[i][2]), i);
  }

  const transparentIndex = hasTransparent ? palette.length : -1;

  const nearestIndex = (r: number, g: number, b: number): number => {
    let best = 0;
    let bestDist = Infinity;
    for (let i = 0; i < palette.length; i++) {
      const dr = r - palette[i][0];
      const dg = g - palette[i][1];
      const db = b - palette[i][2];
      const dist = dr * dr + dg * dg + db * db;
      if (dist < bestDist) {
        bestDist = dist;
        best = i;
        if (dist === 0) break;
      }
    }
    return best;
  };

  const cache = new Map<number, number>();
  for (let p = 0; p < pixelCount; p++) {
    if (!opaqueMask[p]) continue;
    const packed = packColor(data[p * 4], data[p * 4 + 1], data[p * 4 + 2]);
    let idx = exactMap.get(packed);
    if (idx === undefined) {
      const cached = cache.get(packed);
      if (cached === undefined) {
        idx = nearestIndex(data[p * 4], data[p * 4 + 1], data[p * 4 + 2]);
        cache.set(packed, idx);
      } else {
        idx = cached;
      }
    }
    indices[p] = idx;
  }

  // 透明像素指向保留的透明索引
  if (transparentIndex >= 0) {
    for (let p = 0; p < pixelCount; p++) {
      if (!opaqueMask[p]) indices[p] = transparentIndex;
    }
  }

  return { palette, indices, transparentIndex };
}

// ─────────────────────────────────────────────────────────────────────────────
// LZW 压缩（GIF 规范：LSB 优先、变宽码、12 位封顶）
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 对索引序列做 LZW 压缩，返回未分块的码流字节。
 */
function lzwEncodeCoded(indices: Uint8Array, minCodeSize: number): number[] {
  const clearCode = 1 << minCodeSize;
  const eoiCode = clearCode + 1;

  const codedBytes: number[] = [];
  let bitBuf = 0;
  let bitCnt = 0;
  const emit = (code: number, len: number) => {
    bitBuf |= code << bitCnt;
    bitCnt += len;
    while (bitCnt >= 8) {
      codedBytes.push(bitBuf & 0xff);
      bitBuf >>>= 8;
      bitCnt -= 8;
    }
  };

  let codeSize = minCodeSize + 1;
  let dictSize = eoiCode + 1;
  let dict = new Map<number, number>();

  emit(clearCode, codeSize);
  let prefix = indices[0];
  for (let i = 1; i < indices.length; i++) {
    const k = indices[i];
    const key = (prefix << 8) | k;
    const existing = dict.get(key);
    if (existing !== undefined) {
      prefix = existing;
      continue;
    }
    emit(prefix, codeSize);
    if (dictSize < 4096) {
      dict.set(key, dictSize);
      dictSize++;
      // 解码器的码表滞后编码器一条（首码不建表），因此编码器在
      // next == 2^codeSize + 1 时才加宽（等价于 omggif 的 pre-assign >= 规则）
      if (dictSize === (1 << codeSize) + 1 && codeSize < 12) {
        codeSize++;
      }
    } else {
      // 码表满：以当前码宽发送 CLEAR，双方各自重置
      emit(clearCode, codeSize);
      dict = new Map();
      dictSize = eoiCode + 1;
      codeSize = minCodeSize + 1;
    }
    prefix = k;
  }
  emit(prefix, codeSize);
  emit(eoiCode, codeSize);
  if (bitCnt > 0) codedBytes.push(bitBuf & 0xff);

  return codedBytes;
}

/** 子块封装（每块 ≤ 255 字节，以 0x00 结束） */
function packSubBlocks(codedBytes: number[]): number[] {
  const dataBlocks: number[] = [];
  for (let i = 0; i < codedBytes.length; i += 255) {
    const chunk = codedBytes.slice(i, i + 255);
    dataBlocks.push(chunk.length, ...chunk);
  }
  dataBlocks.push(0);
  return dataBlocks;
}

interface ColorTableInfo {
  /** 已填充至 2 的幂对齐的字节序列 */
  bytes: number[];
  /** 屏幕描述符中的表大小字段 N（表项数 = 2^(N+1)） */
  fieldN: number;
  /** 最小 LZW 码长 */
  minCodeSize: number;
}

/** 由调色板构建 GIF 色表字节（透明槽位追加在末尾，RGB 值无关紧要） */
function buildColorTable(palette: number[][], transparentIndex: number): ColorTableInfo {
  const paletteSize = palette.length + (transparentIndex >= 0 ? 1 : 0);
  // GCT 大小必须为 2 的幂；描述符字段 N 满足 表项数 = 2^(N+1)
  const k = Math.ceil(Math.log2(Math.max(2, paletteSize))); // ≥ 1
  const entries = 1 << k;
  const bytes: number[] = [];
  for (const [r, g, b] of palette) {
    bytes.push(r, g, b);
  }
  if (transparentIndex >= 0) bytes.push(0, 0, 0);
  while (bytes.length < entries * 3) bytes.push(0, 0, 0);
  return { bytes, fieldN: k - 1, minCodeSize: Math.max(2, k) };
}

interface EncodedFrame {
  table: ColorTableInfo;
  blocks: number[];
  transparentIndex: number;
  delayCs: number;
}

function encodeFrame(frame: { imageData: ImageData; delayMs: number }): EncodedFrame {
  const q = quantize(frame.imageData, 256);
  const table = buildColorTable(q.palette, q.transparentIndex);
  const coded = lzwEncodeCoded(q.indices, table.minCodeSize);
  return {
    table,
    blocks: packSubBlocks(coded),
    transparentIndex: q.transparentIndex,
    // 浏览器把 <2cs（20ms）的延时视作 10cs，故下限取 2
    delayCs: Math.max(2, Math.round(frame.delayMs / 10)),
  };
}

/**
 * 将 ImageData 编码为单帧 GIF Blob。
 */
export function encodeGIF(imageData: ImageData): Blob {
  const { width, height } = imageData;
  const frame = encodeFrame({ imageData, delayMs: 100 });
  const out: number[] = [];

  // Header
  out.push(0x47, 0x49, 0x46, 0x38, 0x39, 0x61); // "GIF89a"

  // Logical Screen Descriptor
  out.push(width & 0xff, (width >> 8) & 0xff);
  out.push(height & 0xff, (height >> 8) & 0xff);
  // GCT 存在, 颜色位数(信息性), 表大小字段
  out.push(0x80 | ((frame.table.minCodeSize - 1) << 4) | frame.table.fieldN);
  out.push(0x00); // 背景色索引
  out.push(0x00); // 像素宽高比

  // Global Color Table
  out.push(...frame.table.bytes);

  // Graphic Control Extension（仅需要透明时）
  if (frame.transparentIndex >= 0) {
    out.push(0x21, 0xf9, 0x04);
    out.push(0x01); // 透明标志
    out.push(0x00, 0x00); // 延时
    out.push(frame.transparentIndex);
    out.push(0x00); // 块结束
  }

  // Image Descriptor
  out.push(0x2c);
  out.push(0x00, 0x00, 0x00, 0x00); // left, top
  out.push(width & 0xff, (width >> 8) & 0xff);
  out.push(height & 0xff, (height >> 8) & 0xff);
  out.push(0x00); // 无局部色表、非隔行

  // LZW
  out.push(frame.table.minCodeSize);
  out.push(...frame.blocks);

  // Trailer
  out.push(0x3b);

  return new Blob([new Uint8Array(out)], { type: 'image/gif' });
}

// ─────────────────────────────────────────────────────────────────────────────
// 多帧动画 GIF
// ─────────────────────────────────────────────────────────────────────────────

export interface GifFrameInput {
  imageData: ImageData;
  /** 该帧显示时长（毫秒） */
  delayMs: number;
}

/**
 * 将多帧同尺寸 ImageData 编码为动画 GIF。
 *
 * - 每帧独立量化并携带局部色表（LCT），互不影响
 * - 含透明的帧使用 disposal=2（恢复背景），不透明帧 disposal=1
 * - loop=true 写入 NETSCAPE2.0 无限循环扩展
 *
 * 所有帧的 width/height 必须一致（调用方负责归一化画布）。
 */
export function encodeAnimatedGIF(
  framesInput: readonly GifFrameInput[],
  options?: { loop?: boolean }
): Blob {
  if (framesInput.length === 0) throw new Error('no frames');
  const width = framesInput[0].imageData.width;
  const height = framesInput[0].imageData.height;
  for (const f of framesInput) {
    if (f.imageData.width !== width || f.imageData.height !== height) {
      throw new Error('all frames must share the same canvas size');
    }
  }

  const frames = framesInput.map(encodeFrame);
  const first = frames[0];
  const loop = options?.loop !== false;

  const out: number[] = [];

  // Header + Logical Screen Descriptor（GCT 取首帧色表，兼容旧解码器）
  out.push(0x47, 0x49, 0x46, 0x38, 0x39, 0x61); // "GIF89a"
  out.push(width & 0xff, (width >> 8) & 0xff);
  out.push(height & 0xff, (height >> 8) & 0xff);
  out.push(0x80 | ((first.table.minCodeSize - 1) << 4) | first.table.fieldN);
  out.push(0x00); // 背景色索引
  out.push(0x00); // 像素宽高比

  out.push(...first.table.bytes);

  // NETSCAPE2.0 循环扩展（无限循环）
  if (loop) {
    const ns = 'NETSCAPE2.0';
    out.push(0x21, 0xff, 0x0b);
    for (let i = 0; i < ns.length; i++) out.push(ns.charCodeAt(i));
    out.push(0x03, 0x01, 0x00, 0x00, 0x00); // 子块 ID=1, 循环次数=0(无限)
  }

  for (const frame of frames) {
    const hasAlpha = frame.transparentIndex >= 0;

    // Graphic Control Extension：每帧都需要（承载帧延时）
    out.push(0x21, 0xf9, 0x04);
    // 不透明帧 disposal=1(不清除)；含透明帧 disposal=2(恢复背景)
    out.push(hasAlpha ? 0x09 : 0x04);
    out.push(frame.delayCs & 0xff, (frame.delayCs >> 8) & 0xff);
    out.push(hasAlpha ? frame.transparentIndex : 0x00);
    out.push(0x00);

    // Image Descriptor（带局部色表标志）
    out.push(0x2c);
    out.push(0x00, 0x00, 0x00, 0x00); // left, top
    out.push(width & 0xff, (width >> 8) & 0xff);
    out.push(height & 0xff, (height >> 8) & 0xff);
    out.push(0x80 | frame.table.fieldN);

    out.push(...frame.table.bytes);
    out.push(frame.table.minCodeSize);
    out.push(...frame.blocks);
  }

  // Trailer
  out.push(0x3b);

  return new Blob([new Uint8Array(out)], { type: 'image/gif' });
}
