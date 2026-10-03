/**
 * HEIC/HEIF 输入解码：基于开源 heic-to（libheif WASM，自包含 bundle 约 3MB）。
 * 解码器仅在用户真正导入 HEIC 时才动态加载，其他格式零开销。
 *
 * 转换策略：统一转为 JPEG（质量 0.92）——HEIC 主要是 iPhone 照片，
 * JPEG 体积与兼容性最优；透明 HEIF 贴纸场景较少，如需保留可后续扩展 PNG 分支。
 */
import { toast } from 'sonner';

/** 同步预判：扩展名或 MIME 像不像 HEIC（零开销，先过滤再精确检测） */
export function looksLikeHeic(file: File): boolean {
  return /\.hei[cf]$/i.test(file.name) || /^image\/hei[cf]$/.test(file.type);
}

type HeicModule = typeof import('heic-to/next');

let modulePromise: Promise<HeicModule> | null = null;

function loadHeicModule(): Promise<HeicModule> {
  modulePromise ??= import('heic-to/next');
  return modulePromise;
}

/** 单个 HEIC 文件 → JPEG File */
async function decodeHeicFile(file: File): Promise<File> {
  const { heicTo } = await loadHeicModule();
  const blob = await heicTo({ blob: file, type: 'image/jpeg', quality: 0.92 });
  const base = file.name.replace(/\.[^.]+$/, '');
  return new File([blob], `${base}.jpg`, { type: 'image/jpeg' });
}

/**
 * 批量归一化：把列表中的 HEIC 解码为浏览器可直接处理的 JPEG，其余原样通过。
 * 检测到 HEIC 时展示进度 toast；全部失败时抛错。
 */
export async function normalizeImageFiles(files: File[], lang: 'en' | 'zh'): Promise<File[]> {
  if (!files.some(looksLikeHeic)) return files;

  const msg = {
    loading: lang === 'zh' ? '正在解码 HEIC...' : 'Decoding HEIC...',
    success: (n: number) =>
      lang === 'zh' ? `${n} 张 HEIC 已转换` : `${n} HEIC image${n > 1 ? 's' : ''} converted`,
    partial: (ok: number, fail: number) =>
      lang === 'zh' ? `${ok} 张已转换，${fail} 张失败` : `${ok} converted, ${fail} failed`,
    error: lang === 'zh' ? 'HEIC 解码失败' : 'Failed to decode HEIC',
  };

  let failed = 0;
  const heicCount = files.filter(looksLikeHeic).length;

  const task_ = async (): Promise<File[]> => {
    const out: File[] = [];
    failed = 0;
    // heic-to 内部为单 Worker 串行处理，顺序解码避免内存峰值
    for (const file of files) {
      if (!looksLikeHeic(file)) {
        out.push(file);
        continue;
      }
      try {
        out.push(await decodeHeicFile(file));
      } catch {
        failed++;
      }
    }
    if (out.length === 0) throw new Error(msg.error);
    return out;
  };

  const task = task_();
  // toast 仅作观察者，函数返回原始任务 Promise，避免 sonner 联合类型污染返回值
  toast.promise(task, {
    loading: msg.loading,
    success: () => {
      if (failed > 0) {
        toast.warning(msg.partial(heicCount - failed, failed));
      }
      return msg.success(heicCount - failed);
    },
    error: msg.error,
  });
  return task;
}
