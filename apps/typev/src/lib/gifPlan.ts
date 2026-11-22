/**
 * GIF 导出规划（纯函数，无 DOM 依赖，便于单测）
 *
 * - 时长：脚本各行 duration 之和 ÷ 倍速（与 AnimationRenderer 的计时一致）
 * - 帧采样：≤ GIF_MAX_FPS，帧延时取整到厘秒（GIF 时间单位），帧时间由延时累加得出，不漂移
 * - 封顶：帧数 ≤ GIF_MAX_FRAMES（超长脚本自动降帧率覆盖全程），最长边 ≤ GIF_MAX_EDGE
 */
import type { Script } from '@/types/script';

/** GIF 采样帧率上限（GIF 是调色板格式，高帧率只会让体积暴涨） */
export const GIF_MAX_FPS = 15;
/** 单个 GIF 最多帧数（防止超长脚本把编码时间与文件体积拖垮） */
export const GIF_MAX_FRAMES = 300;
/** GIF 输出最长边（像素） */
export const GIF_MAX_EDGE = 960;
/** 结尾停留时长：最后一帧额外展示，循环播放时不至于瞬间跳回开头 */
export const GIF_END_HOLD_MS = 1000;

export interface Size {
  width: number;
  height: number;
}

/**
 * 脚本实际播放时长（毫秒）。
 * 渲染器以 adjustedTime = elapsed * speed 推进，故真实时长 = 内容时长 / speed。
 */
export function getScriptDurationMs(script: Pick<Script, 'lines' | 'globalStyle'>): number {
  const contentSec = script.lines.reduce(
    (sum, line) => sum + (Number.isFinite(line.duration) && line.duration > 0 ? line.duration : 0),
    0
  );
  const speed = parseFloat(script.globalStyle?.speed || '1');
  const speedFactor = Number.isFinite(speed) && speed > 0 ? speed : 1;
  return (contentSec * 1000) / speedFactor;
}

/**
 * 计算 GIF 输出尺寸：保持源画布宽高比，放进导出分辨率框内，再按最长边封顶。
 * 不放大超过源画布；结果为 ≥1 的整数。
 */
export function computeGifSize(source: Size, target: Size, maxEdge: number = GIF_MAX_EDGE): Size {
  const sw = Math.max(1, source.width);
  const sh = Math.max(1, source.height);
  const tw = target.width > 0 ? target.width : sw;
  const th = target.height > 0 ? target.height : sh;

  let scale = Math.min(tw / sw, th / sh, 1);
  const longEdge = Math.max(sw, sh) * scale;
  if (maxEdge > 0 && longEdge > maxEdge) {
    scale = maxEdge / Math.max(sw, sh);
  }
  return {
    width: Math.max(1, Math.round(sw * scale)),
    height: Math.max(1, Math.round(sh * scale)),
  };
}

export interface GifFramePlan {
  /** 实际帧率（由厘秒延时反推，可能低于请求值） */
  fps: number;
  /** 常规帧延时（毫秒，10 的整数倍） */
  delayMs: number;
  /** 每帧的渲染时间点（毫秒，从 0 起，末帧恰为动画结束时刻） */
  timesMs: number[];
  /** 每帧显示时长（毫秒）；末帧含结尾停留 */
  delaysMs: number[];
}

export interface PlanGifFramesOptions {
  durationMs: number;
  /** 用户导出设置里的帧率；GIF 会再被 maxFps 封顶 */
  requestedFps: number;
  maxFps?: number;
  maxFrames?: number;
  endHoldMs?: number;
}

/**
 * 规划 GIF 帧采样时间点与延时。
 *
 * 延时以厘秒为粒度（GIF 规范），且 ≥2cs（浏览器把更短的延时当 10cs 处理）。
 * 帧数超过 maxFrames 时加大延时（降帧率）而不是截断，保证完整覆盖动画。
 */
export function planGifFrames({
  durationMs,
  requestedFps,
  maxFps = GIF_MAX_FPS,
  maxFrames = GIF_MAX_FRAMES,
  endHoldMs = GIF_END_HOLD_MS,
}: PlanGifFramesOptions): GifFramePlan {
  const duration = Number.isFinite(durationMs) && durationMs > 0 ? durationMs : 0;
  const frameCap = Math.max(2, Math.floor(maxFrames));
  const fps = Math.max(1, Math.min(
    Number.isFinite(requestedFps) && requestedFps > 0 ? requestedFps : maxFps,
    maxFps
  ));

  let delayCs = Math.max(2, Math.round(100 / fps));
  // 覆盖 [0, duration] 需要的帧数（含首尾）
  const framesFor = (cs: number) => Math.ceil(duration / (cs * 10)) + 1;
  if (framesFor(delayCs) > frameCap) {
    delayCs = Math.max(delayCs, Math.ceil(duration / 10 / (frameCap - 1)));
  }
  const delayMs = delayCs * 10;

  const frameCount = duration === 0 ? 1 : Math.min(frameCap, framesFor(delayCs));
  const timesMs: number[] = [];
  const delaysMs: number[] = [];
  for (let i = 0; i < frameCount; i++) {
    timesMs.push(Math.min(i * delayMs, duration));
    delaysMs.push(delayMs);
  }
  delaysMs[frameCount - 1] = delayMs + Math.max(0, endHoldMs);

  return { fps: 100 / delayCs, delayMs, timesMs, delaysMs };
}

/** 导出文件名：typev-导出-<时间戳>.<扩展名>（保持既有命名） */
export function buildExportFilename(extension: string, date: Date = new Date()): string {
  const timestamp = date.toISOString().replace(/[:.]/g, '-');
  return `typev-导出-${timestamp}.${extension}`;
}

/**
 * 归一化存入图库的 MIME：MediaRecorder 产物可能带 codecs 参数（video/webm;codecs=vp9），
 * dataURL 只保留主类型，图库按 data:<mime>; 前缀识别类型。
 */
export function baseMimeType(mime: string, fallback: string): string {
  const base = mime.split(';')[0]?.trim().toLowerCase();
  return base || fallback;
}
