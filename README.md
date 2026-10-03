# Ale OS（os-open）

> 一个站点，多个应用。OS 式桌面作壳，工具以 App 图标嵌入——像手机主屏一样点击打开。

线上：**[os.ale160.com](https://os.ale160.com)**（GitHub Pages）

## 架构

```
os-open/
├── apps/
│   ├── shell/      # 桌面壳（基于 hub-nav）：网格、文件夹、多页、主题、中英双语
│   ├── web-img/    # App：图片工具箱（/img/，纯前端图片处理）
│   └── web-text/   # App：Markdown 编辑器（/text/，实时预览+历史版本）
├── scripts/
│   ├── build-all.mjs   # 依次构建三应用（子应用带 basePath）并合成
│   └── compose.mjs     # 把三个静态导出合成单一 out/（+ .nojekyll / CNAME）
└── pnpm-workspace.yaml
```

- 桌面壳构建到根路径 `/`；两个应用分别以 `basePath=/img`、`/text` 静态导出后合入同一次部署，同源不同子路径。
- 点击桌面上的 App 图标（`app://<id>`）以全屏窗口打开对应应用；`Home` 键 / `Esc` / 底部圆形按键最小化回桌面，**应用保活不销毁**——再次点击图标或桌面 dock 即时切回，不重载不丢状态；dock 上可一键关闭运行中的应用；URL 随之同步（`os.ale160.com/img/` 可直链，直接访问时应用独立运行）。
- 首次打开应用显示加载骨架；语言为**中文为主**：单路由树，根目录即中文，语言切换在应用内即时生效。
- 各应用保留独立构建与测试，互不影响；壳的原有单测 + Playwright e2e 全量保留。

## 添加新应用（三步）

1. `apps/` 下新建应用目录（任意能产出静态站点的框架），接入 `scripts/build-all.mjs`（加一行，带上对应的 `APP_BASE_PATH`）；
2. `apps/shell/src/config/apps.ts` 注册表加一条 `OsApp`（id、名称、路径、图标）；
3. 需要出现在默认桌面时，在 `apps/shell/public/config.json` 加一个 `url: "app://<id>"` 的图标。

## 本地开发

```bash
pnpm install

pnpm dev          # 壳的开发服务器（localhost:8525）
pnpm --filter web-img dev    # 单独开发某个应用
pnpm --filter web-text dev

pnpm test         # 所有应用的单测
pnpm build        # 全量构建 + compose → out/
pnpm e2e          # 壳的 Playwright e2e（serve out/）
```

> 依赖用 pnpm workspace 管理；子应用互相隔离（strict hoisting），直接 import 未声明的依赖会构建失败——这暴露并修复了从 npm 迁移来时被提升机制掩盖的缺失依赖。

## 部署

推送 `master` 后 `deploy.yml` 自动构建并发布到 GitHub Pages（gh-pages 分支），自定义域 `os.ale160.com`。

## 历史

桌面壳源自 [hub-nav](https://github.com/ale-160/hub-nav)（Apache-2.0）；web-img 与 web-text 为独立开源应用（分别 MIT / Apache-2.0），三者的完整 git 历史经由 subtree 保留在本仓库中。
