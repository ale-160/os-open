/**
 * 图片 → PDF 浏览器端组装管线。
 * 解码、压缩（CompressionStream）与页面尺寸计算在此完成，
 * PDF 结构组装交给零依赖的 pdfWriter。
 */
import { loadImage } from './canvas';
import {
  buildPdf,
  getJpegOrientation,
  type PdfBuildItem,
  type PdfImageInput,
  type PdfPageSize,
} from './pdfWriter';

export type ComposeMode = 'lossless' | 'jpeg';
export type PagePreset = 'auto' | 'a4' | 'letter';
export type PageOrientation = 'auto' | 'portrait' | 'landscape';

/** px → pt（按 96dpi） */
const PT_PER_PX = 72 / 96;

/** 常用页面尺寸（pt，纵向） */
export const PAGE_PRESETS: Record<Exclude<PagePreset, 'auto'>, [number, number]> = {
  a4: [595.28, 841.89],
  letter: [612, 792],
};

/** deflate（zlib 格式），PDF FlateDecode 所需 */
async function deflate(data: Uint8Array): Promise<Uint8Array> {
  const cs = new CompressionStream('deflate');
  const stream = new Blob([data as BlobPart]).stream().pipeThrough(cs);
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/**
 * 单个文件 → 可嵌入 PDF 的图像对象。
 *
 * - 无损模式：EXIF 方向为 1 的 JPEG 原始字节直嵌（DCTDecode）；
 *   其余经 canvas 解码后以 RGB FlateDecode 嵌入，非全不透明时附带 SMask
 * - JPEG 模式：统一经 canvas 重编码为 JPEG（白底合成透明区域）
 */
export async function fileToPdfImage(
  file: File,
  mode: ComposeMode,
  jpegQuality: number
): Promise<PdfImageInput> {
  const img = await loadImage(file);
  const w = img.naturalWidth;
  const h = img.naturalHeight;

  if (mode === 'lossless') {
    const isJpeg = file.type === 'image/jpeg' || /\.jpe?g$/i.test(file.name);
    if (isJpeg) {
      const bytes = new Uint8Array(await file.arrayBuffer());
      // 方向 ≠ 1 时浏览器解码已自动旋转，必须走 canvas 路径重编码
      if (getJpegOrientation(bytes) === 1) {
        return { width: w, height: h, data: bytes, filter: 'DCTDecode' };
      }
    }
    return await imgToFlateImage(img, w, h);
  }
  return await imgToJpegImage(img, w, h, jpegQuality);
}

/** 已解码图像 → RGB(+alpha) deflate */
async function imgToFlateImage(img: HTMLImageElement, w: number, h: number): Promise<PdfImageInput> {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unavailable');
  ctx.drawImage(img, 0, 0);

  const rgba = ctx.getImageData(0, 0, w, h).data;
  const rgb = new Uint8Array(w * h * 3);
  const alpha = new Uint8Array(w * h);
  let opaque = true;
  for (let i = 0, j = 0, k = 0; i < rgba.length; i += 4, j += 3, k++) {
    rgb[j] = rgba[i];
    rgb[j + 1] = rgba[i + 1];
    rgb[j + 2] = rgba[i + 2];
    const a = rgba[i + 3];
    alpha[k] = a;
    if (a !== 255) opaque = false;
  }

  return {
    width: w,
    height: h,
    data: await deflate(rgb),
    filter: 'FlateDecode',
    alpha: opaque ? null : await deflate(alpha),
  };
}

/** 已解码图像 → 白底 JPEG 重编码 */
async function imgToJpegImage(
  img: HTMLImageElement,
  w: number,
  h: number,
  quality: number
): Promise<PdfImageInput> {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unavailable');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      b => (b ? resolve(b) : reject(new Error('JPEG encode failed'))),
      'image/jpeg',
      quality / 100
    );
  });
  return {
    width: w,
    height: h,
    data: new Uint8Array(await blob.arrayBuffer()),
    filter: 'DCTDecode',
  };
}

/** 计算单页页面尺寸（pt） */
export function computePageSize(
  imgWidthPx: number,
  imgHeightPx: number,
  preset: PagePreset,
  orientation: PageOrientation,
  marginPt: number
): PdfPageSize {
  if (preset === 'auto') {
    return {
      width: imgWidthPx * PT_PER_PX + marginPt * 2,
      height: imgHeightPx * PT_PER_PX + marginPt * 2,
    };
  }
  let [w, h] = PAGE_PRESETS[preset];
  const landscape =
    orientation === 'landscape' || (orientation === 'auto' && imgWidthPx > imgHeightPx);
  if (landscape) [w, h] = [h, w];
  return { width: w, height: h };
}

/** 组装完整 PDF */
export async function composePdf(
  entries: Array<{ file: File; width: number; height: number }>,
  options: {
    mode: ComposeMode;
    jpegQuality: number;
    preset: PagePreset;
    orientation: PageOrientation;
    marginPt: number;
  }
): Promise<Blob> {
  const items: PdfBuildItem[] = [];
  for (const entry of entries) {
    const image = await fileToPdfImage(entry.file, options.mode, options.jpegQuality);
    const page = computePageSize(
      image.width || entry.width,
      image.height || entry.height,
      options.preset,
      options.orientation,
      options.marginPt
    );
    items.push({ image, page, margin: options.marginPt });
  }
  return new Blob([buildPdf(items) as BlobPart], { type: 'application/pdf' });
}
