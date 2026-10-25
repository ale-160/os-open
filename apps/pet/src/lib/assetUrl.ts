/**
 * 素材地址统一接入层：
 * - R2 CDN（https://public.ale160.com）优先——大图（场景/明信片/身体/配件等）走 CDN，减小主站体积；
 * - 本地 /pet/skins/gugu/** 兜底（R2 不可用或未上传时自动回落，通过 onerror 或构造时不切）；
 * - 缩略图：访客/表情贴纸等小图始终本地（体积小）；
 * - 可通过 localStorage `ale-pet-cdn` = 'off' 强制回本地（排查用）。
 */

export const R2_CDN = 'https://public.ale160.com';
export const LOCAL_BASE = '/pet/skins/gugu';

/**
 * 素材版本：R2 自定义域会缓存对象；素材更新后必须改这个值，强制绕过旧缓存。
 * （只影响 R2 URL，本地兜底路径不变）
 */
export const ASSET_VERSION = '20261026a';

function withVersion(url: string): string {
  if (!url.startsWith(R2_CDN)) return url;
  return `${url}${url.includes('?') ? '&' : '?'}v=${ASSET_VERSION}`;
}

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
  return withVersion(`${R2_CDN}/gugu/${rel}`);
}

/** R2 小图（缩略图）路径约定：gugu/thumb/<rel>（本地不存在，仅 CDN 上生成缩略版时启用） */
export function thumbUrl(localUrl: string): string {
  if (!isCdnEnabled()) return localUrl;
  const marker = '/skins/gugu/';
  const i = localUrl.indexOf(marker);
  if (i === -1) return localUrl;
  const rel = localUrl.slice(i + marker.length);
  return withVersion(`${R2_CDN}/gugu/thumb/${rel}`);
}

/**
 * <img onError> 兜底：R2 上缺对象时先切本地文件，本地也失败才隐藏。
 * 用于装扮/装饰/场景/身体等 assetUrl 产出的地址。
 */
export function fallbackToLocal(e: { currentTarget: HTMLImageElement }, localSrc: string): void {
  const img = e.currentTarget;
  if (img.dataset.localFallback === '1') {
    img.style.display = 'none';
    return;
  }
  img.dataset.localFallback = '1';
  img.src = localSrc;
}

/** 本地缩略图路径：/pet/skins/gugu/acc/x.png → /pet/skins/gugu/thumb/acc/x.png（已带 thumb 则原样返回） */
export function thumbLocalSrc(localUrl: string): string {
  const marker = '/skins/gugu/';
  const i = localUrl.indexOf(marker);
  if (i === -1) return localUrl;
  const rel = localUrl.slice(i + marker.length);
  if (rel.startsWith('thumb/')) return localUrl;
  return `${localUrl.slice(0, i + marker.length)}thumb/${rel}`;
}

/** R2 缩略图 URL（CDN 关闭时回本地 thumb；已带 thumb 的地址不再重复加） */
export function assetThumbUrl(localUrl: string): string {
  if (!isCdnEnabled()) return thumbLocalSrc(localUrl);
  const marker = '/skins/gugu/';
  const i = localUrl.indexOf(marker);
  if (i === -1) return localUrl;
  const rel = localUrl.slice(i + marker.length);
  if (rel.startsWith('thumb/')) return assetUrl(localUrl);
  return withVersion(`${R2_CDN}/gugu/thumb/${rel}`);
}

/** 社区模板地址（R2 templates/ 优先，本地兜底由调用方处理） */
export function templateUrl(localUrl: string): string {
  if (!isCdnEnabled()) return localUrl;
  const marker = '/templates/';
  const i = localUrl.indexOf(marker);
  if (i === -1) return localUrl;
  return withVersion(`${R2_CDN}${localUrl.slice(i)}`);
}

/**
 * 通用图片兜底链：当前 R2 缩略图 → R2 原图 → 本地缩略图 → 本地原图 → 隐藏。
 * onFail 在完全失败时调用（例如游戏格子回退 emoji）。
 */
export function fallbackAsset(
  e: { currentTarget: HTMLImageElement },
  localFull: string,
  onFail?: () => void,
): void {
  const img = e.currentTarget;
  const stage = Number(img.dataset.assetStage || '0') + 1;
  img.dataset.assetStage = String(stage);
  if (stage === 1) {
    img.src = assetUrl(localFull);
    return;
  }
  if (stage === 2) {
    img.src = thumbLocalSrc(localFull);
    return;
  }
  if (stage === 3) {
    img.src = localFull;
    return;
  }
  img.style.display = 'none';
  onFail?.();
}
