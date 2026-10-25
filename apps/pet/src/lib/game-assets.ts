/** 小游戏素材路径：R2 缩略图优先，失败按 R2 原图 → 本地缩略图 → 本地原图 → emoji/隐藏。 */

import { BASE_PATH } from './skins';
import { assetThumbUrl, fallbackAsset } from './assetUrl';

export function gameFullSrc(file: string): string {
  return `${BASE_PATH}/skins/gugu/game/${file}`;
}

export function gameThumbSrc(file: string): string {
  return assetThumbUrl(gameFullSrc(file));
}

export function gameImgError(
  e: { currentTarget: HTMLImageElement },
  file: string,
  onFinalFail?: () => void,
): void {
  fallbackAsset(e, gameFullSrc(file), onFinalFail);
}