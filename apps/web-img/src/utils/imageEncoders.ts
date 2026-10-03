'use client';

/**
 * 纯前端图片编码器：BMP 与 ICO。
 *
 * 浏览器 Canvas 原生只支持导出 jpeg/png/webp；
 * 这里补充两种无依赖的编码实现，扩展格式转换的输出矩阵：
 * - BMP：24 位真彩色（自底向上行序，行按 4 字节对齐），不支持透明通道
 * - ICO：Windows 图标容器，内嵌多尺寸 PNG（16/32/48/64/128/256）
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
