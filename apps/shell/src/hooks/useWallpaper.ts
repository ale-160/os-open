'use client';

import { useEffect, useState } from 'react';

import { isWallpaperAssetRef, resolveWallpaperUrl } from '@os/shared/os-assets';

// 模块级缓存：资产壁纸 dataUrl 跨组件/跨渲染复用，避免重复查库与切换壁纸时闪烁
const resolvedCache = new Map<string, string>();

interface ResolvedWallpaperState {
  url: string | undefined;
  dataUrl: string | undefined;
}

function toState(url: string | undefined): ResolvedWallpaperState {
  return {
    url,
    dataUrl: url && isWallpaperAssetRef(url) ? resolvedCache.get(url) : url
  };
}

/**
 * 解析壁纸 URL 为可直接用于 CSS 背景的值：
 - 渐变/远程 URL/data: 原样返回；`asset://<id>` 引用查 IndexedDB 取 dataUrl（带缓存）；
 * 无壁纸或资产缺失时返回 undefined（渲染回退桌面底色）。
 */
export function useResolvedWallpaper(wallpaperUrl: string | undefined): string | undefined {
  const [resolved, setResolved] = useState<ResolvedWallpaperState>(() => toState(wallpaperUrl));

  // 壁纸 URL 变化时在渲染期调整状态（React 官方派生状态模式）；缓存命中即刻可用
  if (resolved.url !== wallpaperUrl) {
    setResolved(toState(wallpaperUrl));
  }

  // 缓存未命中的资产引用异步查库
  useEffect(() => {
    if (!wallpaperUrl || !isWallpaperAssetRef(wallpaperUrl)) return;
    if (resolvedCache.has(wallpaperUrl)) return;
    let cancelled = false;
    resolveWallpaperUrl(wallpaperUrl)
      .then(dataUrl => {
        if (cancelled) return;
        if (dataUrl) resolvedCache.set(wallpaperUrl, dataUrl);
        setResolved({ url: wallpaperUrl, dataUrl: dataUrl ?? undefined });
      })
      .catch(() => {
        if (!cancelled) setResolved({ url: wallpaperUrl, dataUrl: undefined });
      });
    return () => {
      cancelled = true;
    };
  }, [wallpaperUrl]);

  return resolved.url === wallpaperUrl ? resolved.dataUrl : undefined;
}
