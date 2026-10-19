/**
 * JPEG XL 输入解码：所有主流浏览器的 <img> 均无法解码 JXL，
 * 用 @jsquash/jxl（libjxl WASM，按需加载，约 1MB）补齐。
 * 解码后统一转 PNG（无损容器，保留 alpha），进入后续处理管线。
 */
import { toast } from 'sonner';

/** 同步预判：扩展名或 MIME 像不像 JXL */
export function looksLikeJxl(file: File): boolean {
  return /\.jxl$/i.test(file.name) || /^image\/jxl$/i.test(file.type);
}

async function decodeJxlFile(file: File): Promise<File> {
  const { decode } = await import('@jsquash/jxl');
  const imageData = await decode(await file.arrayBuffer());

  const canvas = document.createElement('canvas');
  canvas.width = imageData.width;
  canvas.height = imageData.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unavailable');
  ctx.putImageData(imageData, 0, 0);

  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('PNG encode failed'))), 'image/png')
  );
  const base = file.name.replace(/\.[^.]+$/, '');
  return new File([blob], `${base}.png`, { type: 'image/png' });
}

/** 批量归一化：把列表中的 JXL 解码为 PNG，其余原样通过（带进度与成败提示） */
export async function normalizeJxlFiles(files: File[], lang: 'zh' | 'en'): Promise<File[]> {
  const jxlCount = files.filter(looksLikeJxl).length;
  if (jxlCount === 0) return files;

  const toastId = toast.loading(
    lang === 'zh' ? `正在解码 JPEG XL（0/${jxlCount}）…` : `Decoding JPEG XL (0/${jxlCount})…`
  );

  const out: File[] = [];
  let ok = 0;
  let fail = 0;
  for (const file of files) {
    if (!looksLikeJxl(file)) {
      out.push(file);
      continue;
    }
    try {
      out.push(await decodeJxlFile(file));
      ok++;
    } catch {
      fail++;
    }
    toast.loading(
      lang === 'zh' ? `正在解码 JPEG XL（${ok + fail}/${jxlCount}）…` : `Decoding JPEG XL (${ok + fail}/${jxlCount})…`,
      { id: toastId }
    );
  }

  if (fail > 0) {
    toast.error(
      lang === 'zh' ? `JXL 解码：成功 ${ok} 个，失败 ${fail} 个` : `JXL decode: ${ok} succeeded, ${fail} failed`,
      { id: toastId }
    );
  } else {
    toast.success(
      lang === 'zh' ? `已解码 ${ok} 个 JXL 文件` : `Decoded ${ok} JXL file${ok > 1 ? 's' : ''}`,
      { id: toastId }
    );
  }
  return out;
}
