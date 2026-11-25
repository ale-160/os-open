import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  WALLPAPER_ASSET_SCHEME,
  deleteAsset,
  deleteWallpaper,
  getClipboardItem,
  getWallpaper,
  isWallpaperAssetRef,
  listAssets,
  resolveWallpaperUrl,
  saveAsset,
  saveWallpaper,
  setClipboardItem,
  wallpaperIdFromRef,
} from './os-assets';

const DB_NAME = 'ale-os-assets';

let now = 1_000;

beforeEach(() => {
  // 每个用例独立的 IndexedDB（从零建库）
  indexedDB = new IDBFactory();
  // 单调递增的时间戳：createdAt 排序与 updatedAt 可断言
  now = 1_000;
  vi.spyOn(Date, 'now').mockImplementation(() => ++now);
});

afterEach(() => {
  vi.restoreAllMocks();
});

/** 不带版本号打开现有库，读取其版本与存储列表 */
function inspectDb(): Promise<{ version: number; stores: string[] }> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME);
    req.onsuccess = () => {
      const db = req.result;
      const info = { version: db.version, stores: Array.from(db.objectStoreNames) };
      db.close();
      resolve(info);
    };
    req.onerror = () => reject(req.error);
  });
}

/** 让下一次 put 在请求排队后中止事务，模拟提交阶段失败（如配额不足） */
function abortNextPut() {
  const originalPut = IDBObjectStore.prototype.put;
  const spy = vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(function (
    this: IDBObjectStore,
    ...args: Parameters<IDBObjectStore['put']>
  ) {
    const request = originalPut.apply(this, args);
    this.transaction.abort();
    spy.mockRestore();
    return request;
  });
}

describe('壁纸资产引用（纯函数）', () => {
  it('isWallpaperAssetRef 只识别 asset:// 方案', () => {
    expect(WALLPAPER_ASSET_SCHEME).toBe('asset://');
    expect(isWallpaperAssetRef('asset://wallpaper-1')).toBe(true);
    expect(isWallpaperAssetRef('radial-gradient(at 15% 15%, #93c5fd)')).toBe(false);
    expect(isWallpaperAssetRef('data:image/png;base64,AAA')).toBe(false);
    expect(isWallpaperAssetRef('')).toBe(false);
    expect(isWallpaperAssetRef(undefined)).toBe(false);
    expect(isWallpaperAssetRef(null)).toBe(false);
  });

  it('wallpaperIdFromRef 提取资产 id，空引用与非引用返回 null', () => {
    expect(wallpaperIdFromRef('asset://wallpaper-123')).toBe('wallpaper-123');
    expect(wallpaperIdFromRef('asset://')).toBeNull();
    expect(wallpaperIdFromRef('https://example.com/a.png')).toBeNull();
    expect(wallpaperIdFromRef(null)).toBeNull();
  });
});

describe('系统图库', () => {
  it('saveAsset 返回带 id / type / createdAt 的资产，listAssets 可列出', async () => {
    const asset = await saveAsset({ name: 'a.png', dataUrl: 'data:image/png;base64,A' });
    expect(asset).toMatchObject({ type: 'image', name: 'a.png', dataUrl: 'data:image/png;base64,A' });
    expect(asset.id).toMatch(/^asset-\d+-[a-z0-9]+$/);
    expect(asset.createdAt).toBeGreaterThan(1_000);

    expect(await listAssets()).toEqual([asset]);
  });

  it('空库 listAssets 返回空数组', async () => {
    expect(await listAssets()).toEqual([]);
  });

  it('listAssets 按 createdAt 倒序（最新在前）', async () => {
    await saveAsset({ name: 'first.png', dataUrl: 'data:,1' });
    await saveAsset({ name: 'second.png', dataUrl: 'data:,2' });
    await saveAsset({ name: 'third.png', dataUrl: 'data:,3' });
    expect((await listAssets()).map(a => a.name)).toEqual(['third.png', 'second.png', 'first.png']);
  });

  it('deleteAsset 只删除指定资产；删除不存在的 id 不报错', async () => {
    const a = await saveAsset({ name: 'a.png', dataUrl: 'data:,A' });
    const b = await saveAsset({ name: 'b.png', dataUrl: 'data:,B' });
    await deleteAsset(a.id);
    expect((await listAssets()).map(x => x.id)).toEqual([b.id]);
    await expect(deleteAsset('asset-missing')).resolves.toBeUndefined();
    expect(await listAssets()).toHaveLength(1);
  });

  it('写入在事务提交阶段失败时 saveAsset 抛错，而不是报告已保存', async () => {
    abortNextPut();
    await expect(saveAsset({ name: 'lost.png', dataUrl: 'data:,LOST' })).rejects.toMatchObject({
      name: 'AbortError',
    });
    expect(await listAssets()).toEqual([]);

    // 失败不影响后续写入
    await saveAsset({ name: 'ok.png', dataUrl: 'data:,OK' });
    expect((await listAssets()).map(a => a.name)).toEqual(['ok.png']);
  });
});

describe('系统剪贴板（单槽）', () => {
  it('空剪贴板读为 null', async () => {
    expect(await getClipboardItem()).toBeNull();
  });

  it('写入图片后可读回，并附带 updatedAt', async () => {
    await setClipboardItem({ type: 'image', name: 'c.png', dataUrl: 'data:image/png;base64,C' });
    const item = await getClipboardItem();
    expect(item).toMatchObject({ type: 'image', name: 'c.png', dataUrl: 'data:image/png;base64,C' });
    expect(item?.updatedAt).toBeGreaterThan(1_000);
  });

  it('后写覆盖先写（只保留最近一次复制的内容）', async () => {
    await setClipboardItem({ type: 'image', name: 'c.png', dataUrl: 'data:,C' });
    const before = (await getClipboardItem())!.updatedAt;
    await setClipboardItem({ type: 'text', text: 'hello' });
    const item = await getClipboardItem();
    expect(item).toEqual({ type: 'text', text: 'hello', updatedAt: expect.any(Number) });
    expect(item!.updatedAt).toBeGreaterThan(before);
  });

  it('剪贴板与图库互不干扰', async () => {
    await setClipboardItem({ type: 'text', text: 'x' });
    expect(await listAssets()).toEqual([]);
  });

  it('写入在事务提交阶段失败时 setClipboardItem 抛错', async () => {
    abortNextPut();
    await expect(setClipboardItem({ type: 'text', text: 'lost' })).rejects.toBeTruthy();
    expect(await getClipboardItem()).toBeNull();
  });
});

describe('壁纸库', () => {
  it('saveWallpaper → getWallpaper → asset:// 引用解析为 dataUrl', async () => {
    const wp = await saveWallpaper({ name: 'w.png', dataUrl: 'data:image/png;base64,W' });
    expect(wp.id).toMatch(/^wallpaper-/);
    expect(await getWallpaper(wp.id)).toEqual(wp);
    expect(await resolveWallpaperUrl(`${WALLPAPER_ASSET_SCHEME}${wp.id}`)).toBe('data:image/png;base64,W');
  });

  it('壁纸不进入图库列表', async () => {
    await saveWallpaper({ name: 'w.png', dataUrl: 'data:,W' });
    expect(await listAssets()).toEqual([]);
  });

  it('非引用形式（渐变 / 远程 URL / data:）原样返回，空串为 null', async () => {
    const gradient = 'radial-gradient(at 15% 15%, #93c5fd 0, transparent 50%)';
    expect(await resolveWallpaperUrl(gradient)).toBe(gradient);
    expect(await resolveWallpaperUrl('https://example.com/a.jpg')).toBe('https://example.com/a.jpg');
    expect(await resolveWallpaperUrl('data:image/png;base64,D')).toBe('data:image/png;base64,D');
    expect(await resolveWallpaperUrl('')).toBeNull();
  });

  it('引用的资产不存在或为空引用时解析为 null', async () => {
    expect(await resolveWallpaperUrl('asset://wallpaper-missing')).toBeNull();
    // 空 id 的引用不能原样返回 'asset://' 当作可渲染的 URL
    expect(await resolveWallpaperUrl('asset://')).toBeNull();
  });

  it('deleteWallpaper 后引用解析为 null', async () => {
    const wp = await saveWallpaper({ name: 'w.png', dataUrl: 'data:,W' });
    await deleteWallpaper(wp.id);
    expect(await getWallpaper(wp.id)).toBeNull();
    expect(await resolveWallpaperUrl(`asset://${wp.id}`)).toBeNull();
  });
});

describe('库结构与 v1 → v2 升级', () => {
  it('新建库为 v2，含 assets / clipboard / wallpapers 三个存储', async () => {
    await listAssets();
    const { version, stores } = await inspectDb();
    expect(version).toBe(2);
    expect(stores.sort()).toEqual(['assets', 'clipboard', 'wallpapers']);
  });

  it('v1 旧库升级到 v2：已有图库资产与剪贴板保留，壁纸库可用', async () => {
    // 手工建一个 v1 结构的旧库（assets + clipboard），塞入旧资产与剪贴板内容
    const v1 = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        db.createObjectStore('assets', { keyPath: 'id' }).createIndex('createdAt', 'createdAt');
        db.createObjectStore('clipboard');
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    await new Promise<void>((resolve, reject) => {
      const tx = v1.transaction(['assets', 'clipboard'], 'readwrite');
      tx.objectStore('assets').put({
        id: 'asset-old',
        type: 'image',
        name: 'old.png',
        dataUrl: 'data:,OLD',
        createdAt: 1,
      });
      tx.objectStore('clipboard').put({ type: 'text', text: 'old clip', updatedAt: 1 }, 'current');
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    v1.close();
    expect((await inspectDb()).stores).not.toContain('wallpapers');

    // 以 v2 打开（自动升级出 wallpapers 存储），旧数据不受影响
    const wp = await saveWallpaper({ name: 'new.png', dataUrl: 'data:,NEW' });
    expect(await resolveWallpaperUrl(`asset://${wp.id}`)).toBe('data:,NEW');

    await saveAsset({ name: 'new.png', dataUrl: 'data:,NEW-ASSET' });
    expect((await listAssets()).map(a => a.id)).toEqual([expect.stringMatching(/^asset-\d+/), 'asset-old']);
    expect(await getClipboardItem()).toEqual({ type: 'text', text: 'old clip', updatedAt: 1 });

    const { version, stores } = await inspectDb();
    expect(version).toBe(2);
    expect(stores).toContain('wallpapers');
  });
});
