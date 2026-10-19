/**
 * Ale OS 系统资产库（壳侧）
 *
 * 系统级图库 + 系统剪贴板 + 壁纸库，基于 IndexedDB（同源共享，壳与所有应用读写同一库）：
 * - 图库：应用把产物「存进去」，任何应用随时「取出来用」（拉模型）；
 * - 剪贴板：单槽，存最近一次复制的内容（图片或文本）；
 * - 壁纸：本地上传的壁纸以资产形式入库，配置里只存 `asset://<id>` 引用，
 *   避免把 base64 塞进 localStorage 的整份配置（5MB 容量告警）。
 */

const DB_NAME = 'ale-os-assets';
// v2：新增 wallpapers 存储（壁纸迁出 localStorage）。web-img/web-text 副本仍以 v1 打开已升级的库，属合法操作。
const DB_VERSION = 2;
const STORE_ASSETS = 'assets';
const STORE_CLIPBOARD = 'clipboard';
const STORE_WALLPAPERS = 'wallpapers';
const CLIPBOARD_KEY = 'current';

/** 壁纸资产引用 URL 方案：配置中的 wallpaperUrl 指向壁纸库资产 */
export const WALLPAPER_ASSET_SCHEME = 'asset://';

/** 判断壁纸 URL 是否为壁纸库资产引用（纯函数，便于单测） */
export function isWallpaperAssetRef(url: string | undefined | null): url is string {
  return !!url && url.startsWith(WALLPAPER_ASSET_SCHEME);
}

/** 从资产引用中取资产 id，非引用返回 null（纯函数，便于单测） */
export function wallpaperIdFromRef(url: string | undefined | null): string | null {
  if (!isWallpaperAssetRef(url)) return null;
  const id = url.slice(WALLPAPER_ASSET_SCHEME.length);
  return id || null;
}

export interface GalleryAsset {
  id: string;
  type: 'image';
  name: string;
  dataUrl: string;
  createdAt: number;
}

export interface WallpaperAsset {
  id: string;
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
      if (!db.objectStoreNames.contains(STORE_WALLPAPERS)) {
        const store = db.createObjectStore(STORE_WALLPAPERS, { keyPath: 'id' });
        store.createIndex('createdAt', 'createdAt');
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

async function withStore<T>(
  storeName: string,
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => Promise<T>
): Promise<T> {
  const db = await openDb();
  try {
    return await run(db.transaction(storeName, mode).objectStore(storeName));
  } finally {
    db.close();
  }
}

/** 保存图片到系统图库（容量仅受浏览器 IndexedDB 配额限制，不做人为上限） */
export async function saveAsset(input: { name: string; dataUrl: string }): Promise<GalleryAsset> {
  const asset: GalleryAsset = {
    id: `asset-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type: 'image',
    name: input.name,
    dataUrl: input.dataUrl,
    createdAt: Date.now()
  };
  await withStore(STORE_ASSETS, 'readwrite', async store => {
    store.put(asset);
    return undefined;
  });
  return asset;
}

/** 按时间倒序列出图库全部资产 */
export async function listAssets(): Promise<GalleryAsset[]> {
  return withStore(STORE_ASSETS, 'readonly', async store => {
    const all = await requestToPromise(store.getAll()) as GalleryAsset[];
    return all.sort((a, b) => b.createdAt - a.createdAt);
  });
}

/** 删除图库资产 */
export async function deleteAsset(id: string): Promise<void> {
  await withStore(STORE_ASSETS, 'readwrite', async store => {
    await requestToPromise(store.delete(id));
    return undefined;
  });
}

/** 保存壁纸到壁纸库，返回的资产 id 用于拼 `asset://<id>` 引用存入配置 */
export async function saveWallpaper(input: { name: string; dataUrl: string }): Promise<WallpaperAsset> {
  const asset: WallpaperAsset = {
    id: `wallpaper-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: input.name,
    dataUrl: input.dataUrl,
    createdAt: Date.now()
  };
  await withStore(STORE_WALLPAPERS, 'readwrite', async store => {
    store.put(asset);
    return undefined;
  });
  return asset;
}

/** 读取壁纸资产；不存在返回 null */
export async function getWallpaper(id: string): Promise<WallpaperAsset | null> {
  return withStore(STORE_WALLPAPERS, 'readonly', async store => {
    const asset = await requestToPromise(store.get(id)) as WallpaperAsset | undefined;
    return asset ?? null;
  });
}

/** 删除壁纸资产（壁纸被替换/清除时回收存储） */
export async function deleteWallpaper(id: string): Promise<void> {
  await withStore(STORE_WALLPAPERS, 'readwrite', async store => {
    await requestToPromise(store.delete(id));
    return undefined;
  });
}

/**
 * 解析壁纸 URL：`asset://<id>` 引用查库返回 dataUrl，
 * 其他形式（渐变/远程 URL/data:）原样返回，null 表示不是壁纸 URL。
 */
export async function resolveWallpaperUrl(url: string): Promise<string | null> {
  const id = wallpaperIdFromRef(url);
  if (!id) return url || null;
  const asset = await getWallpaper(id);
  return asset?.dataUrl ?? null;
}

/** 写入系统剪贴板（单槽覆盖） */
export async function setClipboardItem(item: Omit<ClipboardItemData, 'updatedAt'>): Promise<void> {
  await withStore(STORE_CLIPBOARD, 'readwrite', async store => {
    await requestToPromise(
      store.put({ ...item, updatedAt: Date.now() }, CLIPBOARD_KEY)
    );
    return undefined;
  });
}

/** 读取系统剪贴板（可能为空） */
export async function getClipboardItem(): Promise<ClipboardItemData | null> {
  return withStore(STORE_CLIPBOARD, 'readonly', async store => {
    const item = await requestToPromise(store.get(CLIPBOARD_KEY)) as ClipboardItemData | undefined;
    return item ?? null;
  });
}
