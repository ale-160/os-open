import { describe, expect, it } from 'vitest';

import { OS_APPS } from '@/config/apps';
import { IconItem } from '@/lib/configManager';

import { buildCommands, CommandDescriptor } from './commandItems';

function makeIcon(partial: Partial<IconItem> & { id: string; name: string; url: string }): IconItem {
  return { order: 0, isHidden: false, ...partial } as IconItem;
}

const BASE_INPUT = {
  language: 'zh' as const,
  icons: [],
  folders: [],
  pages: [{ id: 'page-1', name: '首页', iconIds: [] }]
};

function groupOf(commands: CommandDescriptor[], group: CommandDescriptor['group']) {
  return commands.filter(command => command.group === group);
}

describe('命令面板命令构建', () => {
  it('系统应用分组覆盖注册表全量，中文名与 app 指令齐全', () => {
    const commands = buildCommands(BASE_INPUT);
    const apps = groupOf(commands, 'apps');

    expect(apps).toHaveLength(OS_APPS.length);
    for (const app of OS_APPS) {
      const found = apps.find(command => command.appId === app.id);
      expect(found?.label).toBe(app.name);
      expect(found?.keywords).toContain(app.nameEn);
      expect(found?.iconUrl).toBe(app.icon);
    }
  });

  it('英文语言下应用显示英文名', () => {
    const commands = buildCommands({ ...BASE_INPUT, language: 'en' });
    for (const app of groupOf(commands, 'apps')) {
      const registered = OS_APPS.find(item => item.id === app.appId);
      expect(app.label).toBe(registered?.nameEn);
    }
  });

  it('桌面图标进入 icons 分组：外链带 URL 与域名关键词，sublabel 标注所在页面/文件夹', () => {
    const commands = buildCommands({
      ...BASE_INPUT,
      icons: [
        makeIcon({ id: 'i-1', name: 'GitHub', url: 'https://github.com/ale-160', iconUrl: 'https://github.com/favicon.ico' }),
        makeIcon({ id: 'i-2', name: '笔记', url: 'https://note.example.com', folderId: 'f-1' })
      ],
      folders: [{ id: 'f-1', name: '工作', order: 0 }],
      pages: [{ id: 'page-1', name: '首页', iconIds: ['i-1'] }]
    });
    const icons = groupOf(commands, 'icons');

    expect(icons).toHaveLength(2);
    const github = icons.find(command => command.id === 'icon-i-1');
    expect(github?.url).toBe('https://github.com/ale-160');
    expect(github?.keywords).toBe('github.com');
    expect(github?.sublabel).toBe('首页');
    expect(github?.iconUrl).toBe('https://github.com/favicon.ico');

    const note = icons.find(command => command.id === 'icon-i-2');
    expect(note?.sublabel).toBe('工作');
    expect(note?.emoji).toBeTruthy();
  });

  it('app:// 图标与注册表去重，隐藏图标不出现', () => {
    const commands = buildCommands({
      ...BASE_INPUT,
      icons: [
        makeIcon({ id: 'i-app', name: '图片工具箱', url: 'app://web-img' }),
        makeIcon({ id: 'i-hidden', name: '隐藏项', url: 'https://hidden.example.com', isHidden: true })
      ]
    });

    expect(groupOf(commands, 'icons')).toHaveLength(0);
    expect(commands.filter(command => command.appId === 'web-img')).toHaveLength(1);
    expect(commands.some(command => command.id === 'icon-i-hidden')).toBe(false);
  });

  it('系统操作分组：默认五项，showHome 时附加回到桌面', () => {
    const actionsOf = (showHome: boolean) =>
      groupOf(buildCommands({ ...BASE_INPUT, showHome }), 'actions').map(command => command.action);

    expect(actionsOf(false)).toEqual(['theme', 'language', 'settings', 'store', 'help']);
    expect(actionsOf(true)).toContain('home');
  });

  it('网络搜索回退：有输入且有搜索引擎时才生成，搜索词被编码进 URL', () => {
    const withQuery = buildCommands({
      ...BASE_INPUT,
      query: '  hello world  ',
      searchEngine: 'https://www.bing.com/search?q='
    });
    const web = groupOf(withQuery, 'web');
    expect(web).toHaveLength(1);
    expect(web[0].searchQuery).toBe('hello world');
    expect(web[0].url).toBe('https://www.bing.com/search?q=hello%20world');

    expect(groupOf(buildCommands({ ...BASE_INPUT, searchEngine: 'https://www.bing.com/search?q=' }), 'web')).toHaveLength(0);
    expect(groupOf(buildCommands({ ...BASE_INPUT, query: 'hello' }), 'web')).toHaveLength(0);
  });
});
