'use client';

import React, { useEffect, useMemo } from 'react';
import {
  Globe as GlobeIcon,
  HelpCircle as HelpCircleIcon,
  Home as HomeIcon,
  Settings as SettingsIcon,
  Store as StoreIcon
} from 'lucide-react';

import { getAppById } from '@/config/apps';
import { UserConfig } from '@/lib/configManager';
import { getStrings } from '@/data/i18n';
import { useAppWindow } from './AppWindow';
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList
} from '@/components/ui/command';
import { ThemeToggleIcon } from '@/components/ui/theme-toggle-icon';

import {
  buildCommands,
  CommandAction,
  CommandDescriptor,
  CommandGroup as CommandGroupType
} from './commandItems';

/** 桌面壳接线回调（主题/语言/面板类动作由壳执行） */
export interface CommandPaletteHandlers {
  toggleTheme: () => void;
  toggleLanguage: () => void;
  openSettings: () => void;
  openStore: () => void;
  openHelp: () => void;
}

interface CommandPaletteProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  config: UserConfig;
  handlers: CommandPaletteHandlers;
}

/** 操作命令对应的图标（与应用/图标的图片图标区分） */
function ActionIcon({ action }: { action: CommandAction }) {
  const className = 'size-4 shrink-0 text-muted-foreground';
  switch (action) {
    case 'theme':
      // ThemeToggleIcon 自带固定尺寸（与顶栏一致），不接收 className
      return <ThemeToggleIcon />;
    case 'language':
      return <GlobeIcon className={className} />;
    case 'settings':
      return <SettingsIcon className={className} />;
    case 'store':
      return <StoreIcon className={className} />;
    case 'help':
      return <HelpCircleIcon className={className} />;
    case 'home':
      return <HomeIcon className={className} />;
  }
}

function CommandIcon({ command }: { command: CommandDescriptor }) {
  if (command.action) {
    return <ActionIcon action={command.action} />;
  }
  if (command.iconUrl) {
    return (
      <img
        src={command.iconUrl}
        alt=""
        className="size-4 shrink-0 rounded object-contain"
      />
    );
  }
  return <span className="grid size-4 shrink-0 place-items-center text-xs leading-none">{command.emoji}</span>;
}

/**
 * 全局命令面板（Spotlight，参考 macOS Spotlight / Raycast / cmdk）：
 * Ctrl/⌘+K 全局唤起，聚合系统应用、桌面图标、系统操作，
 * 无结果时回退到配置的搜索引擎进行网络搜索。
 * 须渲染在 AppWindowProvider 内部，应用启动/回桌面走真实窗口系统。
 */
export function CommandPalette({ isOpen, onOpenChange, config, handlers }: CommandPaletteProps) {
  const S = getStrings(config.theme.language);
  const { openApp, goHome, runningApps } = useAppWindow();

  // Ctrl/⌘+K 全局唤起/关闭；Escape 打开时必关（捕获阶段——
  // 焦点在 cmdk 输入框时其 Escape 处理会阻断冒泡，仅依赖 radix 关闭会偶发失效）
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        (event.ctrlKey || event.metaKey) &&
        !event.altKey &&
        !event.shiftKey &&
        event.key.toLowerCase() === 'k'
      ) {
        event.preventDefault();
        onOpenChange(!isOpen);
        return;
      }
      if (event.key === 'Escape' && isOpen) {
        onOpenChange(false);
      }
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [isOpen, onOpenChange]);

  const commands = useMemo(
    () =>
      buildCommands({
        language: config.theme.language,
        query: '',
        icons: config.icons,
        folders: config.folders,
        pages: config.pages,
        searchEngine: config.searchEngine,
        showHome: runningApps.length > 0
      }),
    [config, runningApps]
  );

  const runCommand = (command: CommandDescriptor) => {
    onOpenChange(false);
    if (command.appId) {
      const app = getAppById(command.appId);
      if (app) openApp(app);
      return;
    }
    if (command.action) {
      switch (command.action) {
        case 'theme':
          handlers.toggleTheme();
          break;
        case 'language':
          handlers.toggleLanguage();
          break;
        case 'settings':
          handlers.openSettings();
          break;
        case 'store':
          handlers.openStore();
          break;
        case 'help':
          handlers.openHelp();
          break;
        case 'home':
          goHome();
          break;
      }
      return;
    }
    if (command.url) {
      window.open(command.url, '_blank');
    }
  };

  const groupLabels: Record<CommandGroupType, string> = {
    apps: S.commandGroupApps,
    icons: S.commandGroupIcons,
    actions: S.commandGroupActions,
    web: S.commandGroupWeb
  };
  const groupOrder: CommandGroupType[] = ['apps', 'icons', 'actions', 'web'];

  return (
    <CommandDialog
      open={isOpen}
      onOpenChange={onOpenChange}
      title={S.commandPaletteTitle}
      description={S.commandPaletteDescription}
      className="sm:max-w-lg"
    >
      {/* 本仓库的 CommandDialog 不内置 Command 根（与标准 shadcn 模板不同），须显式包裹 */}
      <Command className="size-full">
        <PaletteBody
          key={config.theme.language}
          config={config}
          commands={commands}
          groupLabels={groupLabels}
          groupOrder={groupOrder}
          strings={S}
          onRun={runCommand}
        />
      </Command>
    </CommandDialog>
  );
}

/**
 * 面板主体：输入框随输入实时构建命令（网络搜索回退依赖当前 query），
 * key 取语言以保证语言切换后输入框文案刷新。
 */
function PaletteBody({
  config,
  commands,
  groupLabels,
  groupOrder,
  strings,
  onRun
}: {
  config: UserConfig;
  commands: CommandDescriptor[];
  groupLabels: Record<CommandGroupType, string>;
  groupOrder: CommandGroupType[];
  strings: ReturnType<typeof getStrings>;
  onRun: (command: CommandDescriptor) => void;
}) {
  const [query, setQuery] = React.useState('');

  const filtered = useMemo(() => {
    // cmdk 按条目 value 过滤；网络搜索回退条目依赖当前输入，单独补建
    const base = commands.filter(command => command.group !== 'web');
    const trimmed = query.trim();
    if (trimmed && config.searchEngine) {
      base.push(
        ...buildCommands({
          language: config.theme.language,
          query: trimmed,
          icons: [],
          folders: [],
          pages: [],
          searchEngine: config.searchEngine
        }).filter(command => command.group === 'web')
      );
    }
    return base;
  }, [commands, query, config.searchEngine, config.theme.language]);

  return (
    <>
      <CommandInput
        placeholder={strings.commandPlaceholder}
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        <CommandEmpty>{strings.commandNoResults}</CommandEmpty>
        {groupOrder.map(group => {
          const items = filtered.filter(command => command.group === group);
          if (items.length === 0) return null;
          return (
            <CommandGroup key={group} heading={groupLabels[group]}>
              {items.map(command => (
                <CommandItem
                  key={command.id}
                  value={`${command.label} ${command.sublabel ?? ''} ${command.keywords ?? ''}`}
                  onSelect={() => onRun(command)}
                >
                  <CommandIcon command={command} />
                  <span className="min-w-0 flex-1 truncate">
                    {command.label}
                    {command.sublabel && (
                      <span className="ml-2 text-xs text-muted-foreground">{command.sublabel}</span>
                    )}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          );
        })}
      </CommandList>
    </>
  );
}
