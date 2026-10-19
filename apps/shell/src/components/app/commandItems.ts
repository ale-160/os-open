/**
 * 命令面板（Spotlight）命令构建逻辑（纯函数，便于单测）
 *
 * 聚合四类命令：
 * - apps：系统应用注册表（app:// 内嵌应用，全量可用，无论是否已上架桌面）
 * - icons：桌面图标（含文件夹内图标，隐藏的除外；与注册表重复的 app:// 图标去重）
 * - actions：系统操作（切主题/切语言/设置/商城/帮助/回到桌面）
 * - web：网络搜索回退（有输入且配置了搜索引擎时）
 */

import { IconItem, FolderItem, Page } from '@/lib/configManager';
import { OS_APPS, getAppFromUrl } from '@/config/apps';
import { getStrings } from '@/data/i18n';
import { extractDomain, getFallbackIcon } from '@/utils/url';

export type CommandGroup = 'apps' | 'icons' | 'actions' | 'web';

export type CommandAction = 'theme' | 'language' | 'settings' | 'store' | 'help' | 'home';

/** 命令描述（纯数据，由 CommandPalette 负责执行与渲染） */
export interface CommandDescriptor {
  id: string;
  group: CommandGroup;
  label: string;
  /** 次要说明（应用简介、图标所在页面/文件夹名、搜索词等） */
  sublabel?: string;
  /** 额外匹配关键词（如英文名、域名） */
  keywords?: string;
  /** 指向系统应用注册表（走 openApp 全屏窗口） */
  appId?: string;
  /** 指向普通 URL（新标签打开） */
  url?: string;
  /** 系统操作 */
  action?: CommandAction;
  /** 条目左侧图标的图片地址 */
  iconUrl?: string;
  /** 无图片时的 emoji/字符回退 */
  emoji?: string;
  /** web 组搜索词 */
  searchQuery?: string;
}

export interface BuildCommandsInput {
  language: 'zh' | 'en';
  /** 当前输入（仅影响 web 回退组） */
  query?: string;
  icons: IconItem[];
  folders: FolderItem[];
  pages: Page[];
  searchEngine?: string;
  /** 是否提供「回到桌面」操作（有运行中的应用时） */
  showHome?: boolean;
}

/** 构建命令面板的全部命令（分组顺序：应用 → 图标 → 操作 → 网络搜索） */
export function buildCommands(input: BuildCommandsInput): CommandDescriptor[] {
  const { language, query = '', icons, folders, pages, searchEngine, showHome } = input;
  const S = getStrings(language);
  const commands: CommandDescriptor[] = [];

  // 1. 系统应用（注册表全量，尚未上架桌面的也能直接启动）
  for (const app of OS_APPS) {
    commands.push({
      id: `app-${app.id}`,
      group: 'apps',
      label: language === 'zh' ? app.name : app.nameEn,
      sublabel: language === 'zh' ? app.description : app.descriptionEn,
      keywords: `${app.name} ${app.nameEn}`,
      appId: app.id,
      iconUrl: app.icon
    });
  }

  // 2. 桌面图标（含文件夹内图标；隐藏的除外；内嵌应用已由注册表覆盖，去重）
  const folderNames = new Map(folders.map(folder => [folder.id, folder.name]));
  const pageNames = new Map<string, string>();
  for (const page of pages) {
    for (const iconId of page.iconIds) {
      if (!pageNames.has(iconId)) pageNames.set(iconId, page.name);
    }
  }

  for (const icon of icons) {
    if (icon.isHidden) continue;
    if (getAppFromUrl(icon.url)) continue;
    const domain = extractDomain(icon.url);
    const iconUrl = icon.iconType === 'custom' ? icon.customIconUrl : icon.iconUrl;
    commands.push({
      id: `icon-${icon.id}`,
      group: 'icons',
      label: icon.name,
      sublabel: icon.folderId ? folderNames.get(icon.folderId) : pageNames.get(icon.id),
      keywords: domain ?? '',
      url: icon.url,
      iconUrl,
      emoji: iconUrl ? undefined : getFallbackIcon(icon.name)
    });
  }

  // 3. 系统操作
  const actions: Array<{ action: CommandAction; label: string; emoji: string }> = [
    { action: 'theme', label: S.themeToggle, emoji: '🌗' },
    { action: 'language', label: S.actionToggleLanguage, emoji: '🌐' },
    { action: 'settings', label: S.settings, emoji: '⚙️' },
    { action: 'store', label: S.appStore, emoji: '🛍️' },
    { action: 'help', label: S.help, emoji: '❓' }
  ];
  if (showHome) {
    actions.push({ action: 'home', label: S.backToDesktop, emoji: '🏠' });
  }
  for (const item of actions) {
    commands.push({
      id: `action-${item.action}`,
      group: 'actions',
      label: item.label,
      keywords: item.action,
      action: item.action,
      emoji: item.emoji
    });
  }

  // 4. 网络搜索回退
  const trimmed = query.trim();
  if (trimmed && searchEngine) {
    commands.push({
      id: 'web-search',
      group: 'web',
      label: S.webSearchLabel,
      sublabel: trimmed,
      keywords: trimmed,
      url: searchEngine + encodeURIComponent(trimmed),
      searchQuery: trimmed,
      emoji: '🔍'
    });
  }

  return commands;
}
