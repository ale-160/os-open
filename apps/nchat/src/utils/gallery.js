/**
 * 聊天图片 → Ale OS 系统图库
 *
 * 资产库直接复用 @os/shared/os-assets（与壳 / web-img / web-text 同一实现与同一 DB 版本），
 * 不再在 nchat 内维护手抄副本，避免 IndexedDB 版本与存储结构漂移。
 */

import { saveAsset } from '@os/shared/os-assets'

/** 图片未命名时存入图库使用的默认名 */
export const DEFAULT_GALLERY_NAME = 'nchat-image'

/** 存图状态（保存中 / 已保存）使用的去重键 */
export function galleryKey(file) {
  return file.fileId || file.name
}

/** blob: URL → data URL（浏览器环境） */
export async function blobUrlToDataUrl(blobUrl) {
  const blob = await (await fetch(blobUrl)).blob()
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

/**
 * 把聊天中的图片文件存入系统图库。
 * - 优先使用 file.dataUrl，其次把 file.blobUrl 转成 data URL；
 * - 两者都没有（仅收到元信息、原图未下载）时返回 { status: 'needs-download' }，由调用方先拉取原图。
 * @param {{ fileId?: string, name?: string, dataUrl?: string, blobUrl?: string }} file
 * @param {{ toDataUrl?: (blobUrl: string) => Promise<string> }} [options]
 * @returns {Promise<{ status: 'saved', asset: import('@os/shared/os-assets').GalleryAsset } | { status: 'needs-download' }>}
 */
export async function saveChatImageToGallery(file, { toDataUrl = blobUrlToDataUrl } = {}) {
  let dataUrl = file.dataUrl
  if (!dataUrl && file.blobUrl) {
    dataUrl = await toDataUrl(file.blobUrl)
  }
  if (!dataUrl) return { status: 'needs-download' }
  const asset = await saveAsset({ name: file.name || DEFAULT_GALLERY_NAME, dataUrl })
  return { status: 'saved', asset }
}
