import { describe, expect, it } from 'vitest';

import { addDiaryEvent, diaryDayLines, diaryLine } from './diary';
import { isBadWeather, weatherFor } from './weather';

describe('weather 天气', () => {
  it('同一天天气恒定（确定性）', () => {
    const d = new Date(2026, 9, 25);
    expect(weatherFor(d)).toBe(weatherFor(d));
  });

  it('不同天可能不同天气且总在枚举内', () => {
    const seen = new Set<string>();
    for (let i = 1; i <= 40; i++) {
      const w = weatherFor(new Date(2026, 8, i));
      expect(['sunny', 'cloudy', 'rain', 'snow']).toContain(w);
      seen.add(w);
    }
    // 9 月的 40 天应至少覆盖 2 种天气（统计上必然）
    expect(seen.size).toBeGreaterThanOrEqual(2);
  });

  it('坏天气判定', () => {
    expect(isBadWeather('rain')).toBe(true);
    expect(isBadWeather('snow')).toBe(true);
    expect(isBadWeather('sunny')).toBe(false);
    expect(isBadWeather('cloudy')).toBe(false);
  });
});

describe('diary 日记', () => {
  const day = 'Sat Oct 25 2026';

  it('计数事件聚合', () => {
    let d = addDiaryEvent({}, day, 'feed');
    d = addDiaryEvent(d, day, 'feed');
    d = addDiaryEvent(d, day, 'feed');
    expect(d[day]).toEqual(['feed:3']);
  });

  it('单发事件不重复', () => {
    let d = addDiaryEvent({}, day, 'hatch');
    d = addDiaryEvent(d, day, 'hatch');
    expect(d[day]).toEqual(['hatch']);
  });

  it('带参事件追加', () => {
    let d = addDiaryEvent({}, day, 'trip:onsen');
    d = addDiaryEvent(d, day, 'best:snack:18');
    expect(d[day]).toEqual(['trip:onsen', 'best:snack:18']);
  });

  it('超过 30 天淘汰最旧', () => {
    let d: Record<string, string[]> = {};
    for (let i = 1; i <= 32; i++) {
      d = addDiaryEvent(d, new Date(2026, 0, i).toDateString(), 'checkin');
    }
    expect(Object.keys(d).length).toBe(30);
    expect(d[new Date(2026, 0, 1).toDateString()]).toBeUndefined();
    expect(d[new Date(2026, 0, 32).toDateString()]).toEqual(['checkin']);
  });

  it('token → 中文句子', () => {
    expect(diaryLine('hatch', 'zh')).toContain('破壳');
    expect(diaryLine('feed:3', 'zh')).toContain('3');
    expect(diaryLine('trip:onsen', 'zh')).toContain('温泉');
  });

  it('token → 英文句子', () => {
    expect(diaryLine('hatch', 'en')).toContain('hatched');
    expect(diaryLine('best:snack:18', 'en')).toContain('18');
  });

  it('按天渲染句子列表', () => {
    const d = addDiaryEvent(addDiaryEvent({}, day, 'feed'), day, 'hatch');
    const lines = diaryDayLines(d, day, 'zh');
    expect(lines).toHaveLength(2);
  });
});
