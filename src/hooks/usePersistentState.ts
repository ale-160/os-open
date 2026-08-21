'use client';

import { useEffect, useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';

/**
 * 持久化到 localStorage 的 useState。
 *
 * - 读取：挂载时从 localStorage 恢复（SSR/预渲染环境回退到默认值）
 * - 写入：跳过首次渲染（避免用默认值覆盖已存数据），之后每次变更自动保存
 * - 版本号：payload 携带 version，内置数据结构变更时递增 STORAGE_SCHEMA_VERSION
 *   使旧缓存整体失效、回退到新默认值，避免脏数据
 */
const STORAGE_SCHEMA_VERSION = 1;

interface VersionedPayload<T> {
  version: number;
  items: T;
}

function isVersionedPayload<T>(value: unknown): value is VersionedPayload<T> {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as { version?: unknown; items?: unknown };
  return typeof v.version === 'number' && v.version === STORAGE_SCHEMA_VERSION && 'items' in v;
}

export function usePersistentState<T>(
  key: string,
  defaultValue: T,
  validate?: (value: unknown) => boolean
): [T, Dispatch<SetStateAction<T>>] {
  const [state, setState] = useState<T>(() => {
    if (typeof window === 'undefined') return defaultValue;
    try {
      const raw = window.localStorage.getItem(key);
      if (raw === null) return defaultValue;
      const parsed: unknown = JSON.parse(raw);
      if (!isVersionedPayload<T>(parsed)) return defaultValue;
      if (validate && !validate(parsed.items)) return defaultValue;
      return parsed.items;
    } catch {
      // JSON 损坏或存储不可用时回退到默认值
      return defaultValue;
    }
  });

  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    try {
      const payload: VersionedPayload<T> = { version: STORAGE_SCHEMA_VERSION, items: state };
      window.localStorage.setItem(key, JSON.stringify(payload));
    } catch {
      // 隐私模式等场景下写入失败，静默降级为会话内状态
    }
  }, [key, state]);

  return [state, setState];
}
