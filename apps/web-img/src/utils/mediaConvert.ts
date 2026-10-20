/**
 * 音视频转换核心：ffmpeg.wasm（@ffmpeg/ffmpeg 0.12 + @ffmpeg/core 0.12.10）。
 *
 * 隐私与体积说明：
 * - 转码全程在浏览器本地 WASM 中执行，文件不上传；
 * - 核心体积约 31MB，超过 Cloudflare Pages 单文件 25MiB 上限无法自托管，
 *   首次使用时从公共 CDN（jsdelivr，锁定版本）加载，经 Cache API 持久缓存，
 *   之后离线可用；非媒体功能完全不受影响。
 */
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

const CORE_VERSION = '0.12.10';
const CORE_BASE = `https://cdn.jsdelivr.net/npm/@ffmpeg/core@${CORE_VERSION}/dist/umd`;

export type MediaOutputFormat = 'mp3' | 'm4a' | 'wav' | 'ogg' | 'flac' | 'mp4' | 'webm' | 'gif';

export interface MediaOutputPreset {
  id: MediaOutputFormat;
  ext: string;
  /** audio=任意输入提取/转为音频；video=视频输出（需要视频输入） */
  kind: 'audio' | 'video';
  note: { zh: string; en: string };
  /** ffmpeg 输出参数（不含 -i 与输出文件名） */
  args: string[];
}

export const MEDIA_OUTPUT_PRESETS: MediaOutputPreset[] = [
  { id: 'mp3', ext: '.mp3', kind: 'audio', note: { zh: '通用音频 192kbps', en: 'Universal audio 192kbps' }, args: ['-codec:a', 'libmp3lame', '-b:a', '192k'] },
  { id: 'm4a', ext: '.m4a', kind: 'audio', note: { zh: 'AAC 音频 192kbps', en: 'AAC audio 192kbps' }, args: ['-codec:a', 'aac', '-b:a', '192k'] },
  { id: 'wav', ext: '.wav', kind: 'audio', note: { zh: '无损 PCM', en: 'Lossless PCM' }, args: ['-codec:a', 'pcm_s16le'] },
  { id: 'ogg', ext: '.ogg', kind: 'audio', note: { zh: 'Vorbis 质量 5', en: 'Vorbis quality 5' }, args: ['-codec:a', 'libvorbis', '-q:a', '5'] },
  { id: 'flac', ext: '.flac', kind: 'audio', note: { zh: '无损压缩音频', en: 'Lossless audio' }, args: ['-codec:a', 'flac'] },
  { id: 'mp4', ext: '.mp4', kind: 'video', note: { zh: 'H.264+AAC（快速）', en: 'H.264+AAC (fast)' }, args: ['-codec:v', 'libx264', '-preset', 'ultrafast', '-crf', '28', '-codec:a', 'aac', '-b:a', '128k', '-movflags', '+faststart'] },
  { id: 'webm', ext: '.webm', kind: 'video', note: { zh: 'VP8+Vorbis 开放格式', en: 'VP8+Vorbis open format' }, args: ['-codec:v', 'libvpx', '-b:v', '1M', '-codec:a', 'libvorbis'] },
  { id: 'gif', ext: '.gif', kind: 'video', note: { zh: '动图（10fps，宽 480）', en: 'Animated GIF (10fps, w480)' }, args: ['-vf', 'fps=10,scale=480:-2:flags=lanczos', '-loop', '0'] },
];

const MIME: Record<MediaOutputFormat, string> = {
  mp3: 'audio/mpeg',
  m4a: 'audio/mp4',
  wav: 'audio/wav',
  ogg: 'audio/ogg',
  flac: 'audio/flac',
  mp4: 'video/mp4',
  webm: 'video/webm',
  gif: 'image/gif',
};

/** 转码可选参数（分辨率上限 / 视频质量 / 音频码率） */
export interface MediaConvertOptions {
  /** 视频高度上限（原始分辨率缩放到该高度，等宽自适应；不传保持原始） */
  maxHeight?: number;
  /** 视频质量档位（mp4 走 CRF，webm 走码率） */
  videoQuality?: 'high' | 'medium' | 'low';
  /** 有损音频码率（mp3/m4a/ogg 及视频音轨） */
  audioBitrate?: string;
}

const VIDEO_CRF: Record<NonNullable<MediaConvertOptions['videoQuality']>, string> = {
  high: '23',
  medium: '28',
  low: '33',
};
const VIDEO_BV: Record<NonNullable<MediaConvertOptions['videoQuality']>, string> = {
  high: '2M',
  medium: '1M',
  low: '600k',
};

/** 按用户选项改写预设参数（码率/质量/分辨率滤镜） */
function buildArgs(preset: MediaOutputPreset, opts: MediaConvertOptions | undefined): string[] {
  const args = [...preset.args];
  if (!opts) return args;

  if (opts.audioBitrate) {
    const i = args.indexOf('-b:a');
    if (i !== -1) args[i + 1] = opts.audioBitrate;
  }
  if (opts.videoQuality) {
    const crf = args.indexOf('-crf');
    if (crf !== -1) args[crf + 1] = VIDEO_CRF[opts.videoQuality];
    const bv = args.indexOf('-b:v');
    if (bv !== -1) args[bv + 1] = VIDEO_BV[opts.videoQuality];
  }
  if (opts.maxHeight) {
    const vf = args.indexOf('-vf');
    if (vf !== -1) {
      // gif 预设自带 scale：替换其高度
      args[vf + 1] = args[vf + 1].replace(/scale=\d+:-2/, `scale=-2:${opts.maxHeight}`);
    } else if (preset.kind === 'video') {
      args.push('-vf', `scale=-2:${opts.maxHeight}:flags=lanczos`);
    }
  }
  return args;
}

let instance: FFmpeg | null = null;
let loadPromise: Promise<FFmpeg> | null = null;

/** Cache-First 获取核心文件：31MB 只从 CDN 下载一次，之后走浏览器缓存（离线可用） */
async function cachedBlobURL(url: string, mime: string): Promise<string> {
  if (typeof caches !== 'undefined') {
    try {
      const cache = await caches.open('web-img-ffmpeg-core');
      const hit = await cache.match(url);
      if (hit) return URL.createObjectURL(await hit.blob());
      const resp = await fetch(url);
      if (resp.ok) {
        await cache.put(url, resp.clone());
        return URL.createObjectURL(await resp.blob());
      }
    } catch {
      /* 缓存不可用（隐私模式等）时直接走网络 */
    }
  }
  return toBlobURL(url, mime);
}

/** 加载（单例）ffmpeg 核心；首次调用触发 ~31MB 的 CDN 下载 */
export async function loadFFmpeg(): Promise<FFmpeg> {
  if (instance) return instance;
  loadPromise ??= (async () => {
    const ff = new FFmpeg();
    // 下载进度日志（ffmpeg.util 的 toBlobURL 不带进度，这里仅提示大小）
    const jsUrl = await cachedBlobURL(`${CORE_BASE}/ffmpeg-core.js`, 'text/javascript');
    const wasmUrl = await cachedBlobURL(`${CORE_BASE}/ffmpeg-core.wasm`, 'application/wasm');
    await ff.load({ coreURL: jsUrl, wasmURL: wasmUrl });
    instance = ff;
    return ff;
  })();
  return loadPromise;
}

/** ffmpeg 单实例不支持并发执行——全局串行化所有转码 */
let chain: Promise<unknown> = Promise.resolve();

function extOf(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot === -1 ? '' : name.slice(dot).toLowerCase();
}

/**
 * 转换媒体文件到目标格式。
 * 输入可以是任意 ffmpeg 可解码的音视频容器（mp4/webm/mov/mkv/mp3/wav/ogg/flac/m4a...）；
 * 音频目标从视频中提取音轨，GIF 仅接受视频输入。
 */
export async function convertMedia(
  file: File,
  target: MediaOutputFormat,
  onProgress?: (ratio: number) => void,
  options?: MediaConvertOptions
): Promise<Blob> {
  const preset = MEDIA_OUTPUT_PRESETS.find((p) => p.id === target)!;
  const outArgs = buildArgs(preset, options);

  const run = async (): Promise<Blob> => {
    const ff = await loadFFmpeg();
    const inName = `in-${Date.now()}-${Math.random().toString(36).slice(2)}${extOf(file.name) || '.bin'}`;
    const outName = `out-${target}-${Date.now()}${preset.ext}`;

    const progressHandler = ({ progress }: { progress: number }) => {
      if (Number.isFinite(progress) && progress >= 0 && progress <= 1) onProgress?.(progress);
    };
    ff.on('progress', progressHandler);
    try {
      await ff.writeFile(inName, await fetchFile(file));
      await ff.exec(['-i', inName, ...outArgs, outName]);
      const data = await ff.readFile(outName);
      const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data;
      if (!bytes.length) throw new Error('转码输出为空（输入可能损坏或格式不受支持）');
      return new Blob([bytes as unknown as BlobPart], { type: MIME[target] });
    } finally {
      ff.off('progress', progressHandler);
      try {
        await ff.deleteFile(inName);
      } catch {
        /* ignore */
      }
      try {
        await ff.deleteFile(outName);
      } catch {
        /* ignore */
      }
    }
  };

  // 串行排队
  const result = chain.then(run, run);
  chain = result.catch(() => {});
  return result;
}

/** 输出文件名 */
export function mediaOutputName(sourceName: string, target: MediaOutputFormat): string {
  const preset = MEDIA_OUTPUT_PRESETS.find((p) => p.id === target)!;
  return `${sourceName.replace(/\.[^/.]+$/, '')}${preset.ext}`;
}
