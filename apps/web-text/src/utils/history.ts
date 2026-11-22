/**
 * 历史版本列表的纯逻辑（无 IndexedDB / React 依赖，便于单测）
 *
 * 约定：同一文档的 history 数组里既有普通版本，也有 pinned 版本（pinned: true）。
 * 固定版本是用户显式保留的，不参与去重与数量淘汰。
 */
import type { HistoryEntry } from './storage';

/** 普通（未固定）历史版本的保留上限 */
export const HISTORY_LIMIT = 50;

/**
 * 记录一次保存产生的新版本，返回新的 history 数组（不修改入参）。
 *
 * - 与新版本内容相同的普通版本被去重（相当于把它“顶”到最前）；
 * - 若某个固定版本内容与之相同，则不再追加重复的普通版本；
 * - 固定版本永不因去重或超限被删除；普通版本只保留最新的 `limit` 条。
 */
export function pushHistoryEntry(
  prev: readonly HistoryEntry[],
  entry: HistoryEntry,
  limit: number = HISTORY_LIMIT
): HistoryEntry[] {
  const hasPinnedTwin = prev.some((item) => item.pinned && item.content === entry.content);
  const kept = prev.filter((item) => item.pinned || item.content !== entry.content);
  const next = hasPinnedTwin ? kept : [entry, ...kept];
  let unpinned = 0;
  return next.filter((item) => item.pinned || ++unpinned <= limit);
}
