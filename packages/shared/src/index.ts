/**
 * Ale OS 运行时公共库：壳与内嵌应用共享的系统级能力。
 * 新应用接入：dependencies 加 "@os/shared": "workspace:*"，
 * Next 构建经 transpilePackages 自动转译（next-preset 已内置）。
 */
export {
  cn
} from './css';

export {
  WALLPAPER_ASSET_SCHEME,
  isWallpaperAssetRef,
  wallpaperIdFromRef,
  saveAsset,
  listAssets,
  deleteAsset,
  saveWallpaper,
  getWallpaper,
  deleteWallpaper,
  resolveWallpaperUrl,
  setClipboardItem,
  getClipboardItem
} from './os-assets';
export type {
  GalleryAsset,
  WallpaperAsset,
  ClipboardItemData
} from './os-assets';

export {
  OS_LANGUAGE_KEY,
  readOsLanguage,
  writeOsLanguage,
  subscribeOsLanguage,
  useOsLanguage
} from './os-language';
export type { OsLanguage, UseOsLanguageOptions } from './os-language';
