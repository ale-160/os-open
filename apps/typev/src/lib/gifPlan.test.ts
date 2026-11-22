import { describe, expect, it } from 'vitest';
import {
  GIF_END_HOLD_MS,
  GIF_MAX_EDGE,
  GIF_MAX_FPS,
  GIF_MAX_FRAMES,
  baseMimeType,
  buildExportFilename,
  computeGifSize,
  getScriptDurationMs,
  planGifFrames,
} from './gifPlan';
import type { ScriptLine } from '@/types/script';

const line = (duration: number): ScriptLine => ({
  id: String(duration),
  segments: [{ text: 'hi' }],
  effect: 'centerTypewriter',
  duration,
});

describe('getScriptDurationMs', () => {
  it('sums line durations in milliseconds', () => {
    expect(getScriptDurationMs({ lines: [line(1.5), line(2)] })).toBe(3500);
  });

  it('divides by globalStyle.speed like the renderer', () => {
    expect(getScriptDurationMs({ lines: [line(4)], globalStyle: { speed: '2' } })).toBe(2000);
    expect(getScriptDurationMs({ lines: [line(1)], globalStyle: { speed: '0.5' } })).toBe(2000);
  });

  it('ignores invalid speed and invalid durations', () => {
    expect(getScriptDurationMs({ lines: [line(1)], globalStyle: { speed: 'fast' } })).toBe(1000);
    expect(getScriptDurationMs({ lines: [line(1)], globalStyle: { speed: '-3' } })).toBe(1000);
    expect(getScriptDurationMs({ lines: [line(Number.NaN), line(-2), line(1)] })).toBe(1000);
    expect(getScriptDurationMs({ lines: [] })).toBe(0);
  });
});

describe('computeGifSize', () => {
  const source = { width: 1920, height: 1080 };

  it('caps the long edge at GIF_MAX_EDGE while keeping aspect ratio', () => {
    expect(computeGifSize(source, { width: 1920, height: 1080 })).toEqual({ width: GIF_MAX_EDGE, height: 540 });
    expect(computeGifSize(source, { width: 1280, height: 720 })).toEqual({ width: 960, height: 540 });
  });

  it('honours a smaller export resolution and never upscales', () => {
    expect(computeGifSize(source, { width: 640, height: 360 })).toEqual({ width: 640, height: 360 });
    expect(computeGifSize({ width: 400, height: 300 }, { width: 1920, height: 1080 })).toEqual({ width: 400, height: 300 });
  });

  it('fits a mismatched aspect ratio inside the target box', () => {
    // 源 16:9 放进 4:3 的框：宽度受限
    expect(computeGifSize(source, { width: 800, height: 600 })).toEqual({ width: 800, height: 450 });
    // 竖屏源：高度是长边
    expect(computeGifSize({ width: 1080, height: 1920 }, { width: 1920, height: 1920 })).toEqual({ width: 540, height: 960 });
  });

  it('supports a custom max edge and always returns >= 1px integers', () => {
    expect(computeGifSize(source, source, 320)).toEqual({ width: 320, height: 180 });
    const tiny = computeGifSize({ width: 10000, height: 1 }, { width: 10000, height: 1 });
    expect(tiny.width).toBe(GIF_MAX_EDGE);
    expect(tiny.height).toBe(1);
  });
});

describe('planGifFrames', () => {
  it('samples at most GIF_MAX_FPS with centisecond-aligned delays', () => {
    const plan = planGifFrames({ durationMs: 2000, requestedFps: 30 });
    expect(plan.delayMs).toBe(70); // 100/15 ≈ 6.67cs → 7cs
    expect(plan.delayMs % 10).toBe(0);
    expect(plan.fps).toBeLessThanOrEqual(GIF_MAX_FPS);
    expect(plan.timesMs[0]).toBe(0);
    expect(plan.timesMs.at(-1)).toBe(2000);
    expect(plan.timesMs).toHaveLength(Math.ceil(2000 / 70) + 1);
  });

  it('uses the requested fps when it is below the cap', () => {
    const plan = planGifFrames({ durationMs: 1000, requestedFps: 10 });
    expect(plan.delayMs).toBe(100);
    expect(plan.timesMs).toEqual([0, 100, 200, 300, 400, 500, 600, 700, 800, 900, 1000]);
  });

  it('keeps frame times monotonic and inside the animation', () => {
    const plan = planGifFrames({ durationMs: 3333, requestedFps: 24 });
    for (let i = 1; i < plan.timesMs.length; i++) {
      expect(plan.timesMs[i]).toBeGreaterThan(plan.timesMs[i - 1]);
      expect(plan.timesMs[i]).toBeLessThanOrEqual(3333);
    }
    expect(plan.timesMs.at(-1)).toBe(3333);
  });

  it('adds the end hold to the last frame only', () => {
    const plan = planGifFrames({ durationMs: 500, requestedFps: 10 });
    expect(plan.delaysMs.slice(0, -1).every(d => d === 100)).toBe(true);
    expect(plan.delaysMs.at(-1)).toBe(100 + GIF_END_HOLD_MS);
    expect(plan.delaysMs).toHaveLength(plan.timesMs.length);
  });

  it('caps the frame count by lowering the frame rate instead of truncating', () => {
    const durationMs = 10 * 60 * 1000; // 10 分钟
    const plan = planGifFrames({ durationMs, requestedFps: 60 });
    expect(plan.timesMs.length).toBeLessThanOrEqual(GIF_MAX_FRAMES);
    expect(plan.timesMs.at(-1)).toBe(durationMs);
    expect(plan.delayMs % 10).toBe(0);
    expect(plan.fps).toBeLessThan(1);
  });

  it('respects custom caps', () => {
    const plan = planGifFrames({ durationMs: 10_000, requestedFps: 15, maxFrames: 11, endHoldMs: 0 });
    expect(plan.timesMs).toHaveLength(11);
    expect(plan.delayMs).toBe(1000);
    expect(plan.delaysMs.at(-1)).toBe(1000);
  });

  it('enforces the 2cs minimum delay that browsers require', () => {
    const plan = planGifFrames({ durationMs: 100, requestedFps: 100, maxFps: 100 });
    expect(plan.delayMs).toBe(20);
  });

  it('returns a single frame for empty or invalid durations', () => {
    for (const durationMs of [0, -5, Number.NaN]) {
      const plan = planGifFrames({ durationMs, requestedFps: 30 });
      expect(plan.timesMs).toEqual([0]);
      expect(plan.delaysMs).toHaveLength(1);
    }
  });

  it('falls back to the cap for invalid requested fps', () => {
    expect(planGifFrames({ durationMs: 1000, requestedFps: 0 }).delayMs).toBe(70);
    expect(planGifFrames({ durationMs: 1000, requestedFps: Number.NaN }).delayMs).toBe(70);
  });
});

describe('export helpers', () => {
  it('builds timestamped filenames with the given extension', () => {
    const name = buildExportFilename('gif', new Date('2026-01-02T03:04:05.678Z'));
    expect(name).toBe('typev-导出-2026-01-02T03-04-05-678Z.gif');
  });

  it('strips codec parameters from mime types', () => {
    expect(baseMimeType('video/webm;codecs=vp9,opus', 'video/webm')).toBe('video/webm');
    expect(baseMimeType('image/gif', 'image/gif')).toBe('image/gif');
    expect(baseMimeType('', 'video/webm')).toBe('video/webm');
  });
});
