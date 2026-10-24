'use client';

/**
 * 自定义皮肤存储（IndexedDB ale-pet-db / skins）。
 * 图片以 dataURL 存放（单图皮肤体积小）；远程 URL 皮肤只存引用。
 */

export interface CustomSkinRecord {
  id: string;
  name: string;
  /** 本地图片（dataURL） */
  imageDataUrl?: string;
  /** 远程图片地址（与 imageDataUrl 二选一） */
  url?: string;
  /** 是否在图上叠加咕咕 SVG 表情（适合无脸底图） */
  faceOverlay: boolean;
  createdAt: number;
}

const DB_NAME = 'ale-pet-db';
const DB_VERSION = 1;
const STORE = 'skins';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) {
        req.result.createObjectStore(STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB open failed'));
  });
}

async function withStore<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const req = fn(db.transaction(STORE, mode).objectStore(STORE));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error ?? new Error('IndexedDB request failed'));
    });
  } finally {
    db.close();
  }
}

export function saveSkinRecord(record: CustomSkinRecord): Promise<IDBValidKey> {
  return withStore('readwrite', (store) => store.put(record));
}

export function listSkinRecords(): Promise<CustomSkinRecord[]> {
  return withStore<CustomSkinRecord[]>('readonly', (store) => store.getAll() as IDBRequest<CustomSkinRecord[]>);
}

export function deleteSkinRecord(id: string): Promise<undefined> {
  return withStore('readwrite', (store) => store.delete(id) as IDBRequest<undefined>);
}
