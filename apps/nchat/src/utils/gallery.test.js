import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { IDBFactory } from 'fake-indexeddb'

import { listAssets } from '@os/shared/os-assets'
import { DEFAULT_GALLERY_NAME, galleryKey, saveChatImageToGallery } from './gallery.js'

const DB_NAME = 'ale-os-assets'

beforeEach(() => {
  // 每个用例独立的 IndexedDB
  globalThis.indexedDB = new IDBFactory()
})

/** 不带版本号打开现有库，读取其版本与存储列表 */
function inspectDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME)
    req.onsuccess = () => {
      const db = req.result
      const info = { version: db.version, stores: Array.from(db.objectStoreNames) }
      db.close()
      resolve(info)
    }
    req.onerror = () => reject(req.error)
  })
}

describe('galleryKey', () => {
  it('优先 fileId，其次文件名', () => {
    expect(galleryKey({ fileId: 'f1', name: 'a.png' })).toBe('f1')
    expect(galleryKey({ name: 'a.png' })).toBe('a.png')
  })
})

describe('聊天图片存入系统图库（@os/shared/os-assets）', () => {
  it('dataUrl 直接入库，系统图库可列出', async () => {
    const result = await saveChatImageToGallery({ fileId: 'f1', name: 'cat.png', dataUrl: 'data:image/png;base64,CAT' })
    expect(result.status).toBe('saved')
    expect(result.asset.id).toMatch(/^asset-/)

    const assets = await listAssets()
    expect(assets).toHaveLength(1)
    expect(assets[0]).toMatchObject({ type: 'image', name: 'cat.png', dataUrl: 'data:image/png;base64,CAT' })
  })

  it('无文件名时使用默认名', async () => {
    await saveChatImageToGallery({ dataUrl: 'data:image/png;base64,X' })
    const [asset] = await listAssets()
    expect(asset.name).toBe(DEFAULT_GALLERY_NAME)
  })

  it('只有 blobUrl 时先转 dataUrl 再入库', async () => {
    const toDataUrl = vi.fn(async () => 'data:image/png;base64,BLOB')
    const result = await saveChatImageToGallery({ name: 'b.png', blobUrl: 'blob:x' }, { toDataUrl })
    expect(toDataUrl).toHaveBeenCalledWith('blob:x')
    expect(result.status).toBe('saved')
    expect((await listAssets())[0].dataUrl).toBe('data:image/png;base64,BLOB')
  })

  it('原图未下载（无 dataUrl / blobUrl）时要求先下载，不写库', async () => {
    const result = await saveChatImageToGallery({ fileId: 'f2', name: 'meta-only.png' })
    expect(result).toEqual({ status: 'needs-download' })
    expect(await listAssets()).toHaveLength(0)
  })

  it('使用与壳一致的规范库结构（含壁纸库，版本 ≥ 2）', async () => {
    await saveChatImageToGallery({ name: 'a.png', dataUrl: 'data:image/png;base64,A' })
    const { version, stores } = await inspectDb()
    expect(version).toBeGreaterThanOrEqual(2)
    expect(stores).toEqual(expect.arrayContaining(['assets', 'clipboard', 'wallpapers']))
  })

  it('旧 nchat 副本建的 v1 库可被升级，已有图库资产保留', async () => {
    // 模拟旧版 nchat（手抄副本，DB_VERSION = 1）留下的库
    const v1 = await new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1)
      req.onupgradeneeded = () => {
        const db = req.result
        db.createObjectStore('assets', { keyPath: 'id' }).createIndex('createdAt', 'createdAt')
        db.createObjectStore('clipboard')
      }
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
    await new Promise((resolve, reject) => {
      const tx = v1.transaction('assets', 'readwrite')
      tx.objectStore('assets').put({ id: 'asset-old', type: 'image', name: 'old.png', dataUrl: 'data:,OLD', createdAt: 1 })
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
    v1.close()

    await saveChatImageToGallery({ name: 'new.png', dataUrl: 'data:,NEW' })
    const names = (await listAssets()).map((a) => a.name)
    expect(names).toEqual(['new.png', 'old.png'])
    expect((await inspectDb()).stores).toContain('wallpapers')
  })
})
