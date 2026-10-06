/**
 * Ale OS 系统资产库（web-img 侧）
 *
 * 系统级图库 + 系统剪贴板，基于 IndexedDB（同源共享，壳与所有应用读写同一库）：
 * - 图库：应用把产物「存进去」，任何应用随时「取出来用」（拉模型）；
 * - 剪贴板：单槽，存最近一次复制的内容（图片或文本）。
 */

const DB_NAME = 'ale-os-assets';
const DB_VERSION = 1;
const STORE_ASSETS = 'assets';
const STORE_CLIPBOARD = 'clipboard';
const CLIPBOARD_KEY = 'current';

export interface GalleryAsset {
  id: string;
  type: 'image';
  name: string;
  dataUrl: string;
  createdAt: number;
}

export interface ClipboardItemData {
  type: 'image' | 'text';
  name?: string;
  dataUrl?: string;
  text?: string;
  updatedAt: number;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_ASSETS)) {
        const store = db.createObjectStore(STORE_ASSETS, { keyPath: 'id' });
        store.createIndex('createdAt', 'createdAt');
      }
      if (!db.objectStoreNames.contains(STORE_CLIPBOARD)) {
        db.createObjectStore(STORE_CLIPBOARD);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/** 保存图片到系统图库（容量仅受浏览器 IndexedDB 配额限制，不做人为上限） */
export async function saveAsset(input: { name: string; dataUrl: string }): Promise<GalleryAsset> {
  const db = await openDb();
  const asset: GalleryAsset = {
    id: `asset-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type: 'image',
    name: input.name,
    dataUrl: input.dataUrl,
    createdAt: Date.now()
  };
  const tx = db.transaction(STORE_ASSETS, 'readwrite');
  tx.objectStore(STORE_ASSETS).put(asset);
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
  return asset;
}

/** 按时间倒序列出图库全部资产 */
export async function listAssets(): Promise<GalleryAsset[]> {
  const db = await openDb();
  const store = db.transaction(STORE_ASSETS, 'readonly').objectStore(STORE_ASSETS);
  const all = await requestToPromise(store.getAll()) as GalleryAsset[];
  db.close();
  return all.sort((a, b) => b.createdAt - a.createdAt);
}

/** 删除图库资产 */
export async function deleteAsset(id: string): Promise<void> {
  const db = await openDb();
  await requestToPromise(
    db.transaction(STORE_ASSETS, 'readwrite').objectStore(STORE_ASSETS).delete(id)
  );
  db.close();
}

/** 写入系统剪贴板（单槽覆盖） */
export async function setClipboardItem(item: Omit<ClipboardItemData, 'updatedAt'>): Promise<void> {
  const db = await openDb();
  await requestToPromise(
    db
      .transaction(STORE_CLIPBOARD, 'readwrite')
      .objectStore(STORE_CLIPBOARD)
      .put({ ...item, updatedAt: Date.now() }, CLIPBOARD_KEY)
  );
  db.close();
}

/** 读取系统剪贴板（可能为空） */
export async function getClipboardItem(): Promise<ClipboardItemData | null> {
  const db = await openDb();
  const item = await requestToPromise(
    db.transaction(STORE_CLIPBOARD, 'readonly').objectStore(STORE_CLIPBOARD).get(CLIPBOARD_KEY)
  ) as ClipboardItemData | undefined;
  db.close();
  return item ?? null;
}
