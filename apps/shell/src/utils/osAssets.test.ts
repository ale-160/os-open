import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';

import {
  deleteWallpaper,
  getWallpaper,
  isWallpaperAssetRef,
  listAssets,
  resolveWallpaperUrl,
  saveWallpaper,
  WALLPAPER_ASSET_SCHEME,
  wallpaperIdFromRef
} from './osAssets';

beforeEach(() => {
  // 每个用例独立的 IndexedDB（同时覆盖从零建库到 v2 的路径）
  indexedDB = new IDBFactory();
});

describe('壁纸资产引用（纯函数）', () => {
  it('isWallpaperAssetRef 只识别 asset:// 方案', () => {
    expect(isWallpaperAssetRef('asset://wallpaper-1')).toBe(true);
    expect(isWallpaperAssetRef('radial-gradient(at 15% 15%, #93c5fd)')).toBe(false);
    expect(isWallpaperAssetRef('https://example.com/a.png')).toBe(false);
    expect(isWallpaperAssetRef('data:image/png;base64,AAA')).toBe(false);
    expect(isWallpaperAssetRef('')).toBe(false);
    expect(isWallpaperAssetRef(undefined)).toBe(false);
    expect(isWallpaperAssetRef(null)).toBe(false);
  });

  it('wallpaperIdFromRef 提取资产 id，空引用与非引用返回 null', () => {
    expect(wallpaperIdFromRef('asset://wallpaper-123')).toBe('wallpaper-123');
    expect(wallpaperIdFromRef('asset://')).toBeNull();
    expect(wallpaperIdFromRef('https://example.com/a.png')).toBeNull();
    expect(wallpaperIdFromRef(undefined)).toBeNull();
  });

  it('引用方案常量为 asset://', () => {
    expect(WALLPAPER_ASSET_SCHEME).toBe('asset://');
  });
});

describe('壁纸库（IndexedDB v2）', () => {
  it('保存→读取→解析引用→删除→解析为 null', async () => {
    const asset = await saveWallpaper({ name: 'w.png', dataUrl: 'data:image/png;base64,AAA' });
    expect(asset.id).toMatch(/^wallpaper-/);

    expect((await getWallpaper(asset.id))?.dataUrl).toBe('data:image/png;base64,AAA');

    expect(await resolveWallpaperUrl(`asset://${asset.id}`)).toBe('data:image/png;base64,AAA');
    expect(await resolveWallpaperUrl('radial-gradient(at 1% 1%, #fff)')).toBe('radial-gradient(at 1% 1%, #fff)');
    expect(await resolveWallpaperUrl('')).toBeNull();

    await deleteWallpaper(asset.id);
    expect(await getWallpaper(asset.id)).toBeNull();
    expect(await resolveWallpaperUrl(`asset://${asset.id}`)).toBeNull();
  });

  it('v1 旧库升级到 v2：已有图库资产保留，壁纸库可用', async () => {
    // 手工建一个 v1 结构的旧库（assets + clipboard），塞入一条旧图库资产
    const v1 = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open('ale-os-assets', 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        db.createObjectStore('assets', { keyPath: 'id' }).createIndex('createdAt', 'createdAt');
        db.createObjectStore('clipboard');
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    await new Promise<void>((resolve, reject) => {
      const tx = v1.transaction('assets', 'readwrite');
      tx.objectStore('assets').put({
        id: 'asset-old',
        type: 'image',
        name: 'old.png',
        dataUrl: 'data:image/png;base64,OLD',
        createdAt: 1
      });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    v1.close();

    // v2 打开（自动升级出 wallpapers 存储），旧资产不受影响
    const wp = await saveWallpaper({ name: 'new.png', dataUrl: 'data:image/png;base64,NEW' });
    expect(await getWallpaper(wp.id)).not.toBeNull();

    const assets = await listAssets();
    expect(assets.some(item => item.id === 'asset-old')).toBe(true);
  });
});
