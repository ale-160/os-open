/**
 * Ale OS 系统资产库（nchat 侧）
 *
 * 与 shell / web-img / web-text 共享同一 IndexedDB（ale-os-assets）：
 * - 图库：聊天图片可「存进去」，供系统图库 App 与其他应用取用；
 * - 剪贴板：单槽，存最近一次复制的内容（图片或文本）。
 *
 * 注意：保持 DB_VERSION = 1（与 web-img/web-text 副本一致）。
 * 壳侧副本升级到 v2 增加壁纸存储，低版本打开已升级的库属合法操作。
 */

const DB_NAME = 'ale-os-assets';
const DB_VERSION = 1;
const STORE_ASSETS = 'assets';
const STORE_CLIPBOARD = 'clipboard';
const CLIPBOARD_KEY = 'current';

export const OS_ASSETS_DB_NAME = DB_NAME;

export function isGalleryAvailable() {
  return typeof indexedDB !== 'undefined';
}

export async function saveAsset({ name, dataUrl }) {
  const asset = {
    id: `asset-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type: 'image',
    name,
    dataUrl,
    createdAt: Date.now()
  };
  const db = await openDb();
  await txDone(db, STORE_ASSETS, 'readwrite', store => store.put(asset));
  db.close();
  return asset;
}

export async function listAssets() {
  const db = await openDb();
  const all = await new Promise((resolve, reject) => {
    const req = db.transaction(STORE_ASSETS, 'readonly').objectStore(STORE_ASSETS).getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return all.sort((a, b) => b.createdAt - a.createdAt);
}

export async function setClipboardItem(item) {
  const db = await openDb();
  await txDone(db, STORE_CLIPBOARD, 'readwrite', store => store.put({ ...item, updatedAt: Date.now() }, CLIPBOARD_KEY));
  db.close();
}

export async function getClipboardItem() {
  const db = await openDb();
  const item = await new Promise((resolve, reject) => {
    const req = db.transaction(STORE_CLIPBOARD, 'readonly').objectStore(STORE_CLIPBOARD).get(CLIPBOARD_KEY);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return item ?? null;
}

function openDb() {
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

function txDone(db, storeName, mode, run) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    run(tx.objectStore(storeName));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
