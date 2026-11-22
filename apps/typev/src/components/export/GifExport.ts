import { GifAnimationEncoder } from '@os/shared/gif-encoder';
import { AnimationRenderer } from '@/components/preview/AnimationRenderer';
import { computeGifSize, getScriptDurationMs, planGifFrames, type Size } from '@/lib/gifPlan';
import type { Script } from '@/types/script';

export interface GifExportOptions {
  script: Script;
  /** 与预览一致的最大可见句数 */
  maxVisibleLines: number;
  /** 导出设置中的分辨率（GIF 会再按最长边封顶） */
  resolution: Size;
  /** 导出设置中的帧率（GIF 会再按上限封顶） */
  frameRate: number;
  /** 进度回调：0~1 */
  onProgress?: (progress: number) => void;
  /** 取消信号：中途 abort 会以 AbortError 拒绝 */
  signal?: AbortSignal;
}

/** 让出主线程，使进度 UI 有机会刷新、点击取消能被响应 */
function yieldToBrowser(): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, 0));
}

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) {
    throw new DOMException('GIF export aborted', 'AbortError');
  }
}

/**
 * 将脚本动画离线渲染并编码为 GIF。
 *
 * 与视频录制走同一套 AnimationRenderer 绘制逻辑，但使用独立的离屏画布与渲染器实例，
 * 按规划好的时间点逐帧确定性渲染（不受实时播放/掉帧影响，也不打断预览）。
 * 源画布按脚本分辨率渲染（保证排版与预览一致），再缩放到 GIF 输出尺寸取像素；
 * 每帧取出后立刻交给流式编码器压缩，内存中只保留压缩结果。
 */
export async function exportScriptAsGif({
  script,
  maxVisibleLines,
  resolution,
  frameRate,
  onProgress,
  signal,
}: GifExportOptions): Promise<Blob> {
  throwIfAborted(signal);

  const sourceCanvas = document.createElement('canvas');
  const renderer = new AnimationRenderer(sourceCanvas, script);
  renderer.setMaxVisibleLines(maxVisibleLines);

  const size = computeGifSize(
    { width: sourceCanvas.width, height: sourceCanvas.height },
    resolution
  );
  const outCanvas = document.createElement('canvas');
  outCanvas.width = size.width;
  outCanvas.height = size.height;
  const outCtx = outCanvas.getContext('2d', { willReadFrequently: true });
  if (!outCtx) {
    throw new Error('Canvas 2D context unavailable');
  }
  outCtx.imageSmoothingEnabled = true;
  outCtx.imageSmoothingQuality = 'high';

  const plan = planGifFrames({
    durationMs: getScriptDurationMs(script),
    requestedFps: frameRate,
  });
  const total = plan.timesMs.length;
  const encoder = new GifAnimationEncoder({ loop: true });

  onProgress?.(0);
  for (let i = 0; i < total; i++) {
    throwIfAborted(signal);
    renderer.renderFrame(plan.timesMs[i]);
    outCtx.drawImage(sourceCanvas, 0, 0, size.width, size.height);
    encoder.addFrame({
      imageData: outCtx.getImageData(0, 0, size.width, size.height),
      delayMs: plan.delaysMs[i],
    });
    onProgress?.((i + 1) / total);
    await yieldToBrowser();
  }

  return encoder.finish();
}
