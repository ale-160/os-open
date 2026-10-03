'use client';

import { useCallback, useEffect, useRef } from 'react';
import type { ConvertRequest, ConvertResponse, ConvertSuccess } from '@/workers/protocol';

interface PendingEntry {
  resolve: (value: ConvertSuccess) => void;
  reject: (reason: Error) => void;
}

/**
 * 转换 Worker 线程池：
 * - 懒初始化：首次 run() 才创建 Worker（数量 = min(4, CPU 核数)，至少 2）
 * - 队列调度：空闲 Worker 取队首任务，任务完成后回池继续取
 * - 自动降级：Worker 创建失败或运行出错时，全部未完成任务回退到
 *   主线程 fallback 实现，保证功能永远可用
 */
export function useConversionPool(
  fallback: (req: ConvertRequest) => Promise<ConvertSuccess>
) {
  const workersRef = useRef<Worker[]>([]);
  const idleRef = useRef<Worker[]>([]);
  const queueRef = useRef<{ req: ConvertRequest; entry: PendingEntry }[]>([]);
  const pendingRef = useRef<Map<string, PendingEntry>>(new Map());
  /** 已派发给 Worker、尚未返回的请求（降级时需重跑） */
  const inflightRef = useRef<Map<string, ConvertRequest>>(new Map());
  const disabledRef = useRef(false);

  // 最新 fallback 引用（避免闭包过期）
  const fallbackRef = useRef(fallback);
  fallbackRef.current = fallback;

  const dispatchNext = useCallback(() => {
    for (;;) {
      const worker = idleRef.current.pop();
      if (!worker) return;
      const job = queueRef.current.shift();
      if (!job) {
        idleRef.current.push(worker);
        return;
      }
      inflightRef.current.set(job.req.id, job.req);
      worker.postMessage(job.req);
    }
  }, []);

  /** Worker 异常：销毁线程池，所有未完成任务按序走主线程兜底 */
  const failover = useCallback(() => {
    disabledRef.current = true;
    workersRef.current.forEach(w => {
      w.onmessage = null;
      w.onerror = null;
      w.terminate();
    });
    workersRef.current = [];
    idleRef.current = [];

    const orphaned: { req: ConvertRequest; entry: PendingEntry }[] = [];
    inflightRef.current.forEach(req => {
      const entry = pendingRef.current.get(req.id);
      if (entry) orphaned.push({ req, entry });
    });
    inflightRef.current.clear();
    while (queueRef.current.length > 0) {
      orphaned.push(queueRef.current.shift()!);
    }
    pendingRef.current.clear();

    void (async () => {
      for (const { req, entry } of orphaned) {
        try {
          entry.resolve(await fallbackRef.current(req));
        } catch (err) {
          entry.reject(err instanceof Error ? err : new Error(String(err)));
        }
      }
    })();
  }, []);

  const ensurePool = useCallback((): boolean => {
    if (disabledRef.current) return false;
    if (workersRef.current.length > 0) return true;
    try {
      const count = Math.min(4, Math.max(2, navigator.hardwareConcurrency || 2));
      const created: Worker[] = [];
      for (let i = 0; i < count; i++) {
        const worker = new Worker(
          new URL('../workers/imageConvert.worker.ts', import.meta.url)
        );
        worker.onmessage = (event: MessageEvent<ConvertResponse>) => {
          const res = event.data;
          const entry = pendingRef.current.get(res.id);
          inflightRef.current.delete(res.id);
          pendingRef.current.delete(res.id);
          idleRef.current.push(worker);
          if (entry) {
            if (res.ok) entry.resolve(res);
            else entry.reject(new Error(res.error));
          }
          dispatchNext();
        };
        worker.onerror = () => failover();
        created.push(worker);
        idleRef.current.push(worker);
      }
      workersRef.current = created;
      return true;
    } catch {
      return false;
    }
  }, [dispatchNext, failover]);

  const run = useCallback(
    (req: ConvertRequest): Promise<ConvertSuccess> => {
      if (!ensurePool()) {
        return fallbackRef.current(req);
      }
      return new Promise<ConvertSuccess>((resolve, reject) => {
        const entry: PendingEntry = { resolve, reject };
        pendingRef.current.set(req.id, entry);
        queueRef.current.push({ req, entry });
        dispatchNext();
      });
    },
    [ensurePool, dispatchNext]
  );

  // 卸载：终止线程、拒绝未完成请求（StrictMode 双挂载下会重建）
  useEffect(
    () => () => {
      workersRef.current.forEach(w => w.terminate());
      workersRef.current = [];
      idleRef.current = [];
      pendingRef.current.forEach(entry =>
        entry.reject(new Error('component unmounted'))
      );
      pendingRef.current.clear();
      queueRef.current = [];
      inflightRef.current.clear();
      disabledRef.current = false;
    },
    []
  );

  return { run };
}
