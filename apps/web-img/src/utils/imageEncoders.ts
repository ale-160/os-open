'use client';

/**
 * 纯前端图片编码器：AVIF、BMP、ICO 与 TIFF。
 *
 * 浏览器 Canvas 原生只支持导出 jpeg/png/webp；
 * 这里补充无依赖/懒加载的编码实现，扩展格式转换的输出矩阵：
 * - AVIF：libavif WASM（@jsquash/avif，按需动态加载），全平台可用
 * - BMP：24 位真彩色（自底向上行序，行按 4 字节对齐），不支持透明通道
 * - ICO：Windows 图标容器，内嵌多尺寸 PNG（16/32/48/64/128/256）
 * - TIFF：未压缩基线（RGB / RGBA），支持透明通道的无损位图
 */

/**
 * 将 ImageData 编码为 24 位 BMP Blob。
 * 注意：BMP 无 Alpha 通道，透明区域需在绘制阶段先合成到背景色上。
 */
export function encodeBMP(imageData: ImageData): Blob {
  const { width, height, data } = imageData;
  const rowSize = Math.ceil((width * 3) / 4) * 4; // 每行按 4 字节对齐
  const pixelArraySize = rowSize * height;
  const fileSize = 54 + pixelArraySize;

  const buffer = new ArrayBuffer(fileSize);
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);

  // ── BITMAPFILEHEADER (14 bytes) ──
  bytes[0] = 0x42; // 'B'
  bytes[1] = 0x4d; // 'M'
  view.setUint32(2, fileSize, true);
  view.setUint32(6, 0, true); // reserved
  view.setUint32(10, 54, true); // 像素数据偏移

  // ── BITMAPINFOHEADER (40 bytes) ──
  view.setUint32(14, 40, true); // header size
  view.setInt32(18, width, true);
  view.setInt32(22, height, true); // 正值 = 自底向上
  view.setUint16(26, 1, true); // planes
  view.setUint16(28, 24, true); // bpp
  view.setUint32(30, 0, true); // BI_RGB 无压缩
  view.setUint32(34, pixelArraySize, true);
  view.setInt32(38, 2835, true); // 72 DPI
  view.setInt32(42, 2835, true);
  view.setUint32(46, 0, true); // colors used
  view.setUint32(50, 0, true); // colors important

  // ── 像素数据：自底向上、BGR 序 ──
  for (let y = 0; y < height; y++) {
    const srcY = height - 1 - y; // 自底向上
    let offset = 54 + y * rowSize;
    for (let x = 0; x < width; x++) {
      const i = (srcY * width + x) * 4;
      bytes[offset++] = data[i + 2]; // B
      bytes[offset++] = data[i + 1]; // G
      bytes[offset++] = data[i];     // R
    }
  }

  return new Blob([buffer], { type: 'image/bmp' });
}

export function canvasToBMP(canvas: HTMLCanvasElement): Blob | null {
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  return encodeBMP(ctx.getImageData(0, 0, canvas.width, canvas.height));
}

/**
 * 将 ImageData 编码为 AVIF Blob（@jsquash/avif，libavif WASM）。
 *
 * 各主流浏览器的 canvas 原生均不支持 AVIF 编码（toBlob 会静默回退 PNG，
 * 产出与扩展名不符的文件），因此走 WASM 实现：
 * - 模块仅在真正转换 AVIF 时动态加载（wasm 约 3.5MB，其他格式零开销）；
 * - Worker / 主线程均可运行；quality 1-100（与 jpeg/webp 滑条同语义），speed 8 取速度与压缩率平衡。
 */
export async function encodeAVIF(imageData: ImageData, quality = 90): Promise<Blob> {
  const { encode } = await import('@jsquash/avif');
  const buffer = await encode(imageData, { quality, speed: 8 });
  return new Blob([buffer], { type: 'image/avif' });
}

/**
 * 将 ImageData 编码为未压缩基线 TIFF Blob（小端 II）。
 * - 像素全部不透明时写 3 采样 RGB；存在 alpha<255 像素时写 4 采样 RGBA
 *   （ExtraSamples=2 未关联 alpha），补齐 BMP 不支持透明的无损导出场景。
 * - 单条带（StripOffsets/RowsPerStrip=height），无 DOM 依赖，可在 Worker 中运行。
 */
export function encodeTIFF(imageData: ImageData): Blob {
  const { width, height, data } = imageData;

  let hasAlpha = false;
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] < 255) {
      hasAlpha = true;
      break;
    }
  }
  const spp = hasAlpha ? 4 : 3; // SamplesPerPixel

  // IFD 条目按 tag 升序：RGB 12 项，RGBA 13 项（多 ExtraSamples）
  const entryCount = hasAlpha ? 13 : 12;
  const ifdOffset = 8;
  const ifdSize = 2 + entryCount * 12 + 4;
  const bitsOffset = ifdOffset + ifdSize; // BitsPerSample 数组（spp × SHORT）
  const xResOffset = bitsOffset + spp * 2; // XResolution RATIONAL
  const yResOffset = xResOffset + 8; // YResolution RATIONAL
  const pixelOffset = yResOffset + 8; // 像素数据（单条带，字对齐）

  const pixelSize = width * height * spp;
  const buffer = new ArrayBuffer(pixelOffset + pixelSize);
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);

  // ── 文件头：II（小端）+ 42 + IFD 偏移 ──
  view.setUint8(0, 0x49);
  view.setUint8(1, 0x49);
  view.setUint16(2, 42, true);
  view.setUint32(4, ifdOffset, true);

  // ── IFD ──
  const TYPE_SHORT = 3;
  const TYPE_LONG = 4;
  const TYPE_RATIONAL = 5;
  view.setUint16(ifdOffset, entryCount, true);
  let e = ifdOffset + 2;
  const entry = (tag: number, type: number, count: number, value: number) => {
    view.setUint16(e, tag, true);
    view.setUint16(e + 2, type, true);
    view.setUint32(e + 4, count, true);
    // SHORT/LONG 内联进值字段；数组/RATIONAL 存偏移
    view.setUint32(e + 8, value, true);
    e += 12;
  };

  entry(256, TYPE_LONG, 1, width); // ImageWidth
  entry(257, TYPE_LONG, 1, height); // ImageLength
  entry(258, TYPE_SHORT, spp, bitsOffset); // BitsPerSample（外部数组）
  entry(259, TYPE_SHORT, 1, 1); // Compression = 无压缩
  entry(262, TYPE_SHORT, 1, 2); // PhotometricInterpretation = RGB
  entry(273, TYPE_LONG, 1, pixelOffset); // StripOffsets
  entry(277, TYPE_SHORT, 1, spp); // SamplesPerPixel
  entry(278, TYPE_LONG, 1, height); // RowsPerStrip（单条带）
  entry(279, TYPE_LONG, 1, pixelSize); // StripByteCounts
  entry(282, TYPE_RATIONAL, 1, xResOffset); // XResolution = 72/1
  entry(283, TYPE_RATIONAL, 1, yResOffset); // YResolution = 72/1
  entry(296, TYPE_SHORT, 1, 2); // ResolutionUnit = 英寸
  if (hasAlpha) entry(338, TYPE_SHORT, 1, 2); // ExtraSamples = 未关联 alpha
  view.setUint32(e, 0, true); // 无下一 IFD

  // ── 外部数据 ──
  for (let i = 0; i < spp; i++) view.setUint16(bitsOffset + i * 2, 8, true);
  view.setUint32(xResOffset, 72, true);
  view.setUint32(xResOffset + 4, 1, true);
  view.setUint32(yResOffset, 72, true);
  view.setUint32(yResOffset + 4, 1, true);

  // ── 像素：TIFF 条带为自顶向下逐行 ──
  const rowSrc = width * 4;
  if (hasAlpha) {
    for (let y = 0; y < height; y++) {
      bytes.set(data.subarray(y * rowSrc, (y + 1) * rowSrc), pixelOffset + y * rowSrc);
    }
  } else {
    for (let y = 0; y < height; y++) {
      let src = y * rowSrc;
      let dst = pixelOffset + y * width * 3;
      for (let x = 0; x < width; x++) {
        bytes[dst] = data[src]; // R
        bytes[dst + 1] = data[src + 1]; // G
        bytes[dst + 2] = data[src + 2]; // B
        src += 4;
        dst += 3;
      }
    }
  }

  return new Blob([buffer], { type: 'image/tiff' });
}

/** ICO 内嵌的标准尺寸集合 */
export const ICO_SIZES = [16, 32, 48, 64, 128, 256] as const;

/**
 * 创建 2D 画布：优先 OffscreenCanvas（Worker 可用），回退 DOM Canvas。
 */
function makeCanvas(width: number, height: number): {
  canvas: OffscreenCanvas | HTMLCanvasElement;
  ctx: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D;
} | null {
  if (typeof OffscreenCanvas !== 'undefined') {
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext('2d');
    if (ctx) return { canvas, ctx };
  }
  if (typeof document !== 'undefined') {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (ctx) return { canvas, ctx };
  }
  return null;
}

/** 画布 → PNG Blob，兼容 OffscreenCanvas 与 DOM Canvas */
function toPngBlob(canvas: OffscreenCanvas | HTMLCanvasElement): Promise<Blob> {
  const oc = canvas as OffscreenCanvas;
  if (typeof oc.convertToBlob === 'function') {
    return oc.convertToBlob({ type: 'image/png' });
  }
  return new Promise<Blob>((resolve, reject) => {
    (canvas as HTMLCanvasElement).toBlob(
      (b) => (b ? resolve(b) : reject(new Error('PNG encode failed'))),
      'image/png'
    );
  });
}

/**
 * 将源图像编码为多尺寸 ICO Blob（内嵌 PNG）。
 * 各尺寸按等比缩放居中放置于正方形画布，适合生成 favicon/应用图标。
 * 无 DOM 依赖，可在 Web Worker 中运行。
 */
export async function encodeICO(
  source: CanvasImageSource,
  sourceWidth: number,
  sourceHeight: number,
  sizes: readonly number[] = ICO_SIZES
): Promise<Blob> {
  const pngs: { size: number; blob: Blob }[] = [];

  for (const size of sizes) {
    const made = makeCanvas(size, size);
    if (!made) continue;
    const { canvas, ctx } = made;

    // 等比缩放并居中（contain），保留透明边距
    const scale = Math.min(size / sourceWidth, size / sourceHeight);
    const w = Math.max(1, Math.round(sourceWidth * scale));
    const h = Math.max(1, Math.round(sourceHeight * scale));
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(source, Math.floor((size - w) / 2), Math.floor((size - h) / 2), w, h);

    pngs.push({ size, blob: await toPngBlob(canvas) });
  }

  if (pngs.length === 0) {
    throw new Error('ICO encode failed');
  }

  // ICONDIR (6 bytes) + N × ICONDIRENTRY (16 bytes) + 图像数据
  const headerSize = 6 + pngs.length * 16;
  const totalSize = headerSize + pngs.reduce((sum, p) => sum + p.blob.size, 0);
  const buffer = new ArrayBuffer(totalSize);
  const view = new DataView(buffer);

  view.setUint16(0, 0, true); // reserved
  view.setUint16(2, 1, true); // type: icon
  view.setUint16(4, pngs.length, true);

  let offset = headerSize;
  let entryOffset = 6;
  for (const { size, blob } of pngs) {
    view.setUint8(entryOffset, size >= 256 ? 0 : size); // width（0 表示 256）
    view.setUint8(entryOffset + 1, size >= 256 ? 0 : size); // height
    view.setUint8(entryOffset + 2, 0); // 调色板色数
    view.setUint8(entryOffset + 3, 0); // reserved
    view.setUint16(entryOffset + 4, 1, true); // planes
    view.setUint16(entryOffset + 6, 32, true); // bit count
    view.setUint32(entryOffset + 8, blob.size, true);
    view.setUint32(entryOffset + 12, offset, true);
    entryOffset += 16;

    new Uint8Array(buffer).set(new Uint8Array(await blob.arrayBuffer()), offset);
    offset += blob.size;
  }

  return new Blob([buffer], { type: 'image/x-icon' });
}
