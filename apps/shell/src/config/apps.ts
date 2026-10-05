/**
 * 内嵌应用（OS 上的 App）注册表
 *
 * 新增应用：apps/ 下加入应用目录并在 scripts/build-all.mjs 接入构建，
 * 然后在此追加一条 OsApp 记录；桌面默认图标可在 public/config.json
 * 中用 app://<id> 形式的 URL 绑定到应用。
 */

export interface OsApp {
  id: string;
  /** 中文名 */
  name: string;
  /** 英文名 */
  nameEn: string;
  /** 应用部署子路径（以 / 开头、以 / 结尾） */
  path: string;
  /** 站内图标资源路径 */
  icon: string;
  description: string;
  descriptionEn: string;
  repository: string;
}

/** 桌面图标指向内嵌应用时使用的内部 URL 方案 */
export const APP_URL_SCHEME = 'app://';

/**
 * 全系统共享语言键（localStorage）：壳与内嵌应用统一读写，
 * 通过 storage 事件跨帧实时同步（同源 iframe 收到彼此的变更）
 */
export const OS_LANGUAGE_KEY = 'ale-os-language';

export const OS_APPS: readonly OsApp[] = [
  {
    id: 'web-img',
    name: '图片工具箱',
    nameEn: 'Image Toolbox',
    path: '/img/',
    icon: '/apps/web-img.png',
    description: '纯前端在线图片处理工具箱：压缩、水印、格式转换、GIF、PDF',
    descriptionEn:
      'Client-side image toolbox: compress, watermark, convert, GIF, PDF',
    repository: 'https://github.com/ale-160/web-img'
  },
  {
    id: 'web-text',
    name: 'Markdown 编辑器',
    nameEn: 'Markdown Editor',
    path: '/text/',
    icon: '/apps/web-text.png',
    description: '在线 Markdown 编辑器：实时预览、历史版本、多文档管理',
    descriptionEn:
      'Online Markdown editor with live preview, version history and multi-doc',
    repository: 'https://github.com/ale-160/web-text'
  }
];

/** 按 id 查找应用 */
export function getAppById(id: string): OsApp | null {
  return OS_APPS.find(app => app.id === id) ?? null;
}

/** 解析 app://<id> 形式的 URL，非应用 URL 返回 null */
export function getAppFromUrl(url: string): OsApp | null {
  if (!url || !url.startsWith(APP_URL_SCHEME)) return null;
  return getAppById(url.slice(APP_URL_SCHEME.length));
}

/** 按路径匹配应用（用于深链接，如 /img/） */
export function getAppByPath(pathname: string): OsApp | null {
  return (
    OS_APPS.find(app => pathname === app.path || pathname.startsWith(app.path)) ??
    null
  );
}
