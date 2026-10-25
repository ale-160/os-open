/**
 * 素材地址统一接入层：
 * - R2 CDN（https://public.ale160.com）优先——大图（场景/明信片/身体/配件等）走 CDN，减小主站体积；
 * - 本地 /pet/skins/gugu/** 兜底（R2 不可用或未上传时自动回落，通过 onerror 或构造时不切）；
 * - 缩略图：访客/表情贴纸等小图始终本地（体积小）；
 * - 可通过 localStorage `ale-pet-cdn` = 'off' 强制回本地（排查用）。
 */

export const R2_CDN = 'https://public.ale160.com';
export const LOCAL_BASE = '/pet/skins/gugu';

let cdnEnabled: boolean | null = null;

export function isCdnEnabled(): boolean {
  if (cdnEnabled !== null) return cdnEnabled;
  try {
    cdnEnabled = typeof localStorage === 'undefined' || localStorage.getItem('ale-pet-cdn') !== 'off';
  } catch {
    cdnEnabled = true;
  }
  return cdnEnabled;
}

/** 相对路径（skins.ts 产出，如 '/pet/skins/gugu/acc/beanie.png'）→ 完整 URL */
export function assetUrl(localUrl: string): string {
  if (!isCdnEnabled()) return localUrl;
  // /pet/skins/gugu/<rel> → R2: gugu/<rel>
  const marker = '/skins/gugu/';
  const i = localUrl.indexOf(marker);
  if (i === -1) return localUrl;
  const rel = localUrl.slice(i + marker.length);
  return `${R2_CDN}/gugu/${rel}`;
}

/** R2 小图（缩略图）路径约定：gugu/thumb/<rel>（本地不存在，仅 CDN 上生成缩略版时启用） */
export function thumbUrl(localUrl: string): string {
  if (!isCdnEnabled()) return localUrl;
  const marker = '/skins/gugu/';
  const i = localUrl.indexOf(marker);
  if (i === -1) return localUrl;
  const rel = localUrl.slice(i + marker.length);
  return `${R2_CDN}/gugu/thumb/${rel}`;
}
