/**
 * TIFF/TIF 输入解码：Chrome / Firefox 的 <img> 无法解码 TIFF（Safari 可以），
 * 用纯 JS 的 UTIF（Photopea，MIT，约 100KB）补齐——仅在真正导入 TIFF 时按需加载。
 *
 * 解码策略：统一转 PNG（无损容器，保留 alpha 通道），进入后续处理管线；
 * 多页 TIFF 取第一页。pako（UTIF 的依赖）负责 deflate 压缩的 TIFF。
 */
import { toast } from 'sonner';

/** 同步预判：扩展名或 MIME 像不像 TIFF（零开销，先过滤再精确检测） */
export function looksLikeTiff(file: File): boolean {
  return /\.tiff?$/i.test(file.name) || /^image\/tiff$/.test(file.type);
}

type UtifModule = typeof import('utif');

let modulePromise: Promise<UtifModule> | null = null;

function loadUtifModule(): Promise<UtifModule> {
  modulePromise ??= import('utif');
  return modulePromise;
}

/** 单个 TIFF 文件 → PNG File（无损转存，保留透明通道；多页取第一页） */
async function decodeTiffFile(file: File): Promise<File> {
  const UTIF = await loadUtifModule();
  const buffer = await file.arrayBuffer();
  const ifds = UTIF.decode(buffer);
  if (!ifds.length) throw new Error('TIFF 中没有图像数据');

  const ifd = ifds[0];
  UTIF.decodeImage(buffer, ifd);
  const rgba = UTIF.toRGBA8(ifd);
  const width = ifd.width;
  const height = ifd.height;
  if (!width || !height) throw new Error('TIFF 尺寸无效');

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unavailable');
  ctx.putImageData(new ImageData(new Uint8ClampedArray(rgba), width, height), 0, 0);

  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('PNG encode failed'))), 'image/png')
  );
  const base = file.name.replace(/\.[^.]+$/, '');
  return new File([blob], `${base}.png`, { type: 'image/png' });
}

/**
 * 批量归一化：把列表中的 TIFF 解码为 PNG，其余原样通过。
 * 检测到 TIFF 时展示进度 toast；部分失败时提示成功/失败计数。
 */
export async function normalizeTiffFiles(files: File[], lang: 'zh' | 'en'): Promise<File[]> {
  const tiffCount = files.filter(looksLikeTiff).length;
  if (tiffCount === 0) return files;

  const toastId = toast.loading(
    lang === 'zh' ? `正在解码 TIFF（0/${tiffCount}）…` : `Decoding TIFF (0/${tiffCount})…`
  );

  const out: File[] = [];
  let ok = 0;
  let fail = 0;
  for (const file of files) {
    if (!looksLikeTiff(file)) {
      out.push(file);
      continue;
    }
    try {
      out.push(await decodeTiffFile(file));
      ok++;
    } catch {
      fail++;
    }
    toast.loading(
      lang === 'zh' ? `正在解码 TIFF（${ok + fail}/${tiffCount}）…` : `Decoding TIFF (${ok + fail}/${tiffCount})…`,
      { id: toastId }
    );
  }

  if (fail > 0) {
    toast.error(
      lang === 'zh'
        ? `TIFF 解码：成功 ${ok} 个，失败 ${fail} 个`
        : `TIFF decode: ${ok} succeeded, ${fail} failed`,
      { id: toastId }
    );
  } else {
    toast.success(
      lang === 'zh' ? `已解码 ${ok} 个 TIFF 文件` : `Decoded ${ok} TIFF file${ok > 1 ? 's' : ''}`,
      { id: toastId }
    );
  }
  return out;
}
