'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';

/**
 * Ale OS 一键数据迁移页
 *
 * 通过隐藏 iframe 调起三个旧站的 /migrate.html（origin 白名单内），
 * 拉取各站用户数据并写入本站：
 * - hub-nav：localStorage（hub-nav-config / hub-nav-theme）
 * - web-text：localStorage + IndexedDB web-text-db（docs / history）
 * - web-img：localStorage（主题 / 预设等 5 键）
 * 写入策略：目标键/库已有数据时默认跳过，不覆盖。
 */

type AppId = 'hub-nav' | 'web-text' | 'web-img';

interface MigrationSource {
  appId: AppId;
  /** 旧站显示名 */
  label: string;
  /** 迁移内容描述 */
  detail: string;
  origin: string;
}

const SOURCES: MigrationSource[] = [
  {
    appId: 'hub-nav',
    label: 'hub-nav 导航',
    detail: '桌面布局、图标文件夹、主题与壁纸设置',
    origin: 'https://hub-nav.ale160.com'
  },
  {
    appId: 'web-text',
    label: 'web-text 文档',
    detail: '全部文档、历史版本与界面偏好',
    origin: 'https://web-text.ale160.com'
  },
  {
    appId: 'web-img',
    label: 'web-img 工具箱',
    detail: '压缩预设、导出格式与界面偏好',
    origin: 'https://web-img.ale160.com'
  }
];

type SourceStatus =
  | { state: 'idle' }
  | { state: 'pulling' }
  | { state: 'done'; summary: string }
  | { state: 'skipped'; summary: string }
  | { state: 'error'; message: string };

const REQUEST_TIMEOUT_MS = 20_000;

export default function MigrateClient() {
  const [statuses, setStatuses] = useState<Record<AppId, SourceStatus>>({
    'hub-nav': { state: 'idle' },
    'web-text': { state: 'idle' },
    'web-img': { state: 'idle' }
  });
  const [overall, setOverall] = useState<'idle' | 'running' | 'done'>('idle');
  const iframesRef = useRef<Record<AppId, HTMLIFrameElement | null>>({
    'hub-nav': null,
    'web-text': null,
    'web-img': null
  });

  useEffect(() => {
    document.documentElement.lang = 'zh-CN';
  }, []);

  /** 写入 localStorage 键（目标已有则跳过），返回 {written, skipped} */
  const writeLocalStorage = useCallback((entries: Record<string, string>) => {
    let written = 0;
    let skipped = 0;
    for (const [key, value] of Object.entries(entries)) {
      try {
        if (localStorage.getItem(key) !== null) {
          skipped += 1;
          continue;
        }
        localStorage.setItem(key, value);
        written += 1;
      } catch {
        skipped += 1;
      }
    }
    return { written, skipped };
  }, []);

  /** 写入 web-text 的 IndexedDB（本地 docs 非空则整体跳过） */
  const writeWebTextIdb = useCallback(
    (idb: { docs?: unknown[]; history?: unknown[] }) => {
      return new Promise<{ written: number; skipped: string | null }>(resolve => {
        try {
          const request = indexedDB.open('web-text-db', 1);
          request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains('docs')) {
              db.createObjectStore('docs', { keyPath: 'id' });
            }
            if (!db.objectStoreNames.contains('history')) {
              db.createObjectStore('history', { keyPath: 'id' });
            }
          };
          request.onerror = () => resolve({ written: 0, skipped: '存储打开失败' });
          request.onsuccess = () => {
            const db = request.result;
            const tx = db.transaction('docs', 'readonly');
            const countRequest = tx.objectStore('docs').count();
            countRequest.onsuccess = () => {
              if (countRequest.result > 0) {
                db.close();
                resolve({ written: 0, skipped: '本站已有文档，未覆盖' });
                return;
              }
              const writeTx = db.transaction(['docs', 'history'], 'readwrite');
              const docsStore = writeTx.objectStore('docs');
              const historyStore = writeTx.objectStore('history');
              for (const doc of idb.docs ?? []) docsStore.put(doc);
              for (const entry of idb.history ?? []) historyStore.put(entry);
              writeTx.oncomplete = () => {
                db.close();
                resolve({
                  written: (idb.docs?.length ?? 0) + (idb.history?.length ?? 0),
                  skipped: null
                });
              };
              writeTx.onerror = () => {
                db.close();
                resolve({ written: 0, skipped: '写入失败' });
              };
            };
            countRequest.onerror = () => {
              db.close();
              resolve({ written: 0, skipped: '读取失败' });
            };
          };
        } catch {
          resolve({ written: 0, skipped: '浏览器不支持' });
        }
      });
    },
    []
  );

  /** 拉取单个旧站数据并写入 */
  const migrateOne = useCallback(
    (source: MigrationSource): Promise<{ state: 'done' | 'skipped' | 'error'; summary?: string; message?: string }> => {
      return new Promise<{ state: 'done' | 'skipped' | 'error'; summary?: string; message?: string }>(resolve => {
        const iframe = iframesRef.current[source.appId];
        if (!iframe || !iframe.contentWindow) {
          resolve({ state: 'error', message: '迁移助手未加载（旧站不可达？）' });
          return;
        }
        const requestId = `${source.appId}-${Date.now()}`;
        let settled = false;

        const onMessage = (event: MessageEvent) => {
          if (event.origin !== source.origin) return;
          const data = event.data as {
            type?: string;
            requestId?: string;
            app?: string;
            payload?: { localStorage?: Record<string, string>; idb?: { docs?: unknown[]; history?: unknown[] } };
          } | null;
          if (data?.type !== 'ale-migrate-data' || data.requestId !== requestId) return;
          settled = true;
          window.removeEventListener('message', onMessage);
          clearTimeout(timer);

          const payload = data.payload ?? {};
          const lsResult = writeLocalStorage(payload.localStorage ?? {});
          const parts: string[] = [];
          if (lsResult.written > 0) parts.push(`${lsResult.written} 项设置`);
          if (lsResult.skipped > 0) parts.push(`${lsResult.skipped} 项已存在跳过`);

          if (data.app === 'web-text' && payload.idb) {
            void writeWebTextIdb(payload.idb).then(idbResult => {
              if (idbResult.skipped) {
                parts.push(idbResult.skipped);
              } else if (idbResult.written > 0) {
                parts.push(`${idbResult.written} 条文档/历史`);
              }
              const total = lsResult.written + idbResult.written;
              resolve({
                state: total > 0 ? 'done' : 'skipped',
                summary: total > 0 ? `已迁移：${parts.join('，')}` : '旧站没有可迁移的数据'
              });
            });
            return;
          }

          resolve({
            state: lsResult.written > 0 ? 'done' : 'skipped',
            summary: lsResult.written > 0 ? `已迁移：${parts.join('，')}` : '旧站没有可迁移的数据'
          });
        };

        const timer = setTimeout(() => {
          if (settled) return;
          window.removeEventListener('message', onMessage);
          resolve({ state: 'error', message: '旧站响应超时（数据为空或助手页未部署？）' });
        }, REQUEST_TIMEOUT_MS);

        window.addEventListener('message', onMessage);
        iframe.contentWindow.postMessage(
          { type: 'ale-migrate-request', requestId },
          source.origin
        );
      });
    },
    [writeLocalStorage, writeWebTextIdb]
  );

  const runMigration = useCallback(async () => {
    setOverall('running');
    for (const source of SOURCES) {
      setStatuses(prev => ({ ...prev, [source.appId]: { state: 'pulling' } }));
      const result = await migrateOne(source);
      setStatuses(prev => ({ ...prev, [source.appId]: result }));
    }
    setOverall('done');
  }, [migrateOne]);

  const allSettled = useMemo(
    () => Object.values(statuses).every(status => status.state !== 'idle' && status.state !== 'pulling'),
    [statuses]
  );

  return (
    <main className="min-h-screen os-desktop-bg flex items-start justify-center px-4 py-10">
      <div className="w-full max-w-2xl">
        <h1 className="text-2xl font-bold text-foreground mb-2">数据迁移到 Ale OS</h1>
        <p className="text-sm text-muted-foreground mb-6">
          把你在旧站点（hub-nav / web-img / web-text）本地保存的数据搬到新家。
          数据只在你自己的浏览器内转移（本页通过隐藏框架从旧站读取、写入本站），不经过任何服务器。
          目标已有数据时默认跳过，不会覆盖。
        </p>

        <div className="glass rounded-2xl p-4 sm:p-5 space-y-3">
          {SOURCES.map(source => {
            const status = statuses[source.appId];
            return (
              <div
                key={source.appId}
                className="flex items-start gap-3 rounded-xl border border-border/60 p-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-sm">{source.label}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{source.detail}</div>
                  <div className="text-xs mt-1.5">
                    {status.state === 'idle' && <span className="text-muted-foreground">等待迁移</span>}
                    {status.state === 'pulling' && <span className="text-blue-600 dark:text-blue-400">正在从旧站读取…</span>}
                    {status.state === 'done' && <span className="text-green-600 dark:text-green-400">✓ {status.summary}</span>}
                    {status.state === 'skipped' && <span className="text-muted-foreground">— {status.summary}</span>}
                    {status.state === 'error' && <span className="text-red-600 dark:text-red-400">✕ {status.message}</span>}
                  </div>
                </div>
              </div>
            );
          })}

          <button
            type="button"
            onClick={() => void runMigration()}
            disabled={overall === 'running'}
            className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {overall === 'running' ? '迁移中…' : allSettled ? '再次迁移' : '开始迁移'}
          </button>
        </div>

        {overall === 'done' && (
          <div className="mt-5 text-center">
            <Link
              href="/"
              className="inline-block px-6 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              迁移完成，进入 Ale OS →
            </Link>
          </div>
        )}

        <p className="text-xs text-muted-foreground mt-6 text-center">
          旧站点将服务至 2026 年 11 月 3 日，之后请使用新地址 os.ale160.com
        </p>
      </div>

      {/* 隐藏的旧站迁移助手框架 */}
      {SOURCES.map(source => (
        <iframe
          key={source.appId}
          ref={el => {
            iframesRef.current[source.appId] = el;
          }}
          src={`${source.origin}/migrate.html`}
          title={`迁移助手 ${source.label}`}
          className="hidden"
          referrerPolicy="no-referrer"
        />
      ))}
    </main>
  );
}
