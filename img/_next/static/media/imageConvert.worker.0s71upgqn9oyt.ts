/**
 * 图片转换 Worker：解码 → 缩放 → 编码全部在子线程执行，
 * 避免大图转换阻塞主线程（UI 卡顿）。
 *
 * 使用 createImageBitmap 解码（与 <img> 同等的格式支持，含 EXIF 方向），
 * OffscreenCanvas 绘制；JPEG/PNG/WebP 用原生 convertToBlob，
 * BMP/GIF/ICO 走共享的自研编码器（无 DOM 依赖）。
 */

import { encodeBMP, encodeICO } from '../utils/imageEncoders';
import { encodeGIF } from '../utils/gifEncoder';
import { buildFilename } from './protocol';

interface ConvertRequest {
  id: string;
  file: File;
  format: 'jpeg' | 'png' | 'webp' | 'gif' | 'bmp' | 'ico';
  quality?: number;
  maxWidth?: number | null;
  maxHeight?: number | null;
}

// tsconfig 的 lib 含 DOM，self 被推导为 Window；此处收窄为 Worker 所需的最小接口
const workerCtx = self as unknown as {
  postMessage(message: unknown): void;
  addEventListener(
    type: 'message',
    listener: (event: MessageEvent<ConvertRequest>) => void
  ): void;
};

workerCtx.addEventListener('message', async (event: MessageEvent<ConvertRequest>) => {
  const { id, file, format, quality, maxWidth, maxHeight } = event.data;

  try {
    // 显式应用 EXIF 方向，与主线程 <img> 解码行为保持一致
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    const srcW = bitmap.width || 1024;
    const srcH = bitmap.height || 1024;

    // 可选：限制最大尺寸（等比缩小，只缩不放）
    let targetW = srcW;
    let targetH = srcH;
    const mw = maxWidth ?? 0;
    const mh = maxHeight ?? 0;
    if (mw > 0 && mh > 0) {
      const scale = Math.min(1, mw / srcW, mh / srcH);
      targetW = Math.max(1, Math.round(srcW * scale));
      targetH = Math.max(1, Math.round(srcH * scale));
    }

    // ICO 以原始分辨率位图为源，内部自行生成多尺寸
    if (format === 'ico') {
      const blob = await encodeICO(bitmap, srcW, srcH);
      bitmap.close();
      workerCtx.postMessage({
        id, ok: true, blob,
        width: 256, height: 256,
        filename: buildFilename(file.name, format),
      });
      return;
    }

    const canvas = new OffscreenCanvas(targetW, targetH);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('OffscreenCanvas 2D unavailable');

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    if (format === 'bmp') {
      // BMP 无透明通道，合成白色背景
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, targetW, targetH);
    }
    ctx.drawImage(bitmap, 0, 0, targetW, targetH);
    bitmap.close();

    let outBlob: Blob;
    if (format === 'gif' || format === 'bmp') {
      const imageData = ctx.getImageData(0, 0, targetW, targetH);
      outBlob = format === 'gif' ? encodeGIF(imageData) : encodeBMP(imageData);
    } else {
      const q = format === 'jpeg' || format === 'webp' ? (quality ?? 90) / 100 : undefined;
      outBlob = await canvas.convertToBlob({ type: `image/${format}`, quality: q });
      if (!outBlob) throw new Error(`${format} encode failed`);
    }

    workerCtx.postMessage({
      id, ok: true, blob: outBlob,
      width: targetW, height: targetH,
      filename: buildFilename(file.name, format),
    });
  } catch (err) {
    workerCtx.postMessage({
      id, ok: false,
      error: err instanceof Error ? err.message : String(err),
    });
  }
});
