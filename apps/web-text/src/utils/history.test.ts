import { describe, expect, it } from 'vitest';
import { HISTORY_LIMIT, pushHistoryEntry } from './history';
import type { HistoryEntry } from './storage';

const entry = (id: string, content: string, extra: Partial<HistoryEntry> = {}): HistoryEntry => ({
  id,
  docId: 'doc',
  content,
  timestamp: Number(id.replace(/\D/g, '')) || 0,
  ...extra,
});

describe('pushHistoryEntry', () => {
  it('新版本插到最前面，且不修改入参', () => {
    const prev = [entry('h1', 'a')];
    const next = pushHistoryEntry(prev, entry('h2', 'b'));
    expect(next.map((e) => e.id)).toEqual(['h2', 'h1']);
    expect(prev.map((e) => e.id)).toEqual(['h1']);
  });

  it('与新版本内容相同的普通版本被去重（相当于顶到最前）', () => {
    const prev = [entry('h3', 'c'), entry('h2', 'b'), entry('h1', 'a')];
    const next = pushHistoryEntry(prev, entry('h4', 'b'));
    expect(next.map((e) => e.id)).toEqual(['h4', 'h3', 'h1']);
  });

  it('保存与固定版本相同的内容时，固定版本保留且不追加重复版本', () => {
    // 回归：旧逻辑按内容去重会把固定版本删掉，用户刚固定的版本在下次保存时消失
    const pinned = entry('h1', 'same', { pinned: true, name: '定稿' });
    const next = pushHistoryEntry([pinned], entry('h2', 'same'));
    expect(next).toEqual([pinned]);
  });

  it('普通版本超过上限时淘汰最旧的', () => {
    const prev = Array.from({ length: 3 }, (_, i) => entry(`h${3 - i}`, `v${3 - i}`));
    const next = pushHistoryEntry(prev, entry('h4', 'v4'), 3);
    expect(next.map((e) => e.id)).toEqual(['h4', 'h3', 'h2']);
  });

  it('固定版本不计入上限，也不会因超限被淘汰', () => {
    // 回归：旧逻辑 slice(0, 50) 会把排在后面的旧固定版本一起截掉
    const old = entry('h1', 'oldest', { pinned: true });
    const prev = [entry('h3', 'v3'), entry('h2', 'v2'), old];
    const next = pushHistoryEntry(prev, entry('h4', 'v4'), 2);
    expect(next.map((e) => e.id)).toEqual(['h4', 'h3', 'h1']);
    expect(next.find((e) => e.id === 'h1')?.pinned).toBe(true);
  });

  it('默认上限为 HISTORY_LIMIT 条普通版本', () => {
    let list: HistoryEntry[] = [entry('p0', 'pinned', { pinned: true })];
    for (let i = 1; i <= HISTORY_LIMIT + 10; i++) {
      list = pushHistoryEntry(list, entry(`h${i}`, `v${i}`));
    }
    expect(list.filter((e) => !e.pinned)).toHaveLength(HISTORY_LIMIT);
    expect(list.filter((e) => e.pinned).map((e) => e.id)).toEqual(['p0']);
    expect(list[0].id).toBe(`h${HISTORY_LIMIT + 10}`);
  });

  it('limit 为 0 时只保留固定版本', () => {
    const pinned = entry('h1', 'x', { pinned: true });
    expect(pushHistoryEntry([pinned], entry('h2', 'y'), 0)).toEqual([pinned]);
  });
});
