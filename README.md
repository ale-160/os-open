# Ale OS（os-open）

> 一个站点，多个应用。OS 式桌面作壳，工具以 App 图标嵌入——像手机主屏一样点击打开。

![Ale OS 桌面](https://public.ale160.com/repo-assets/docs/screenshot-desktop.png?v=20261026a)

<details>
<summary>应用窗口（多任务）</summary>
<img src="https://public.ale160.com/repo-assets/docs/screenshot-app.png?v=20261026a" alt="Ale OS 应用窗口" width="800" />
</details>

线上：**[os.ale160.com](https://os.ale160.com)**（Cloudflare Pages）

## 系统能力

- **多任务**：`Home` 键 / `Esc` / 底部圆形按键最小化回桌面，应用保活不销毁——再次点击图标或桌面 dock 即时切回，不重载不丢状态；dock 上可关闭运行中的应用；URL 随之同步（`os.ale160.com/img/` 可直链，直接访问时应用独立运行）。
- **全局命令面板**：`Ctrl`/`⌘`+`K` 或顶栏搜索按钮唤起 Spotlight 式启动器（基于 [cmdk](https://cmdk.paco.me/)）——一步直达系统应用（注册表全量，含未上架桌面的）、桌面图标与系统操作（切主题/语言/设置/商城/帮助/回桌面），无结果时回退配置的搜索引擎。
- **系统图库 + 系统剪贴板**：应用产物存入共享资产库（IndexedDB，本地存储），任何应用从图库取用——图片工具箱「保存到图库」，Markdown 编辑器「插入图片」挑选插入，P2P 聊天室聊天图片一键「存入图库」。无人为大小限制，容量仅受浏览器存储配额约束。
- **壁纸走资产库**：本地上传的壁纸存入 IndexedDB 壁纸库，配置只保留 `asset://` 引用——不再把 base64 塞进 localStorage 的整份配置（旧配置加载时自动迁移），上传上限随之放宽到 8MB。
- **应用商城**：顶栏商城入口管理桌面应用入口，删除的应用随时加回；注册表即上架清单。
- **统一语言管理**：中文为主，根目录即中文站；壳与应用共享语言设置，切换全系统即时生效。
- **统一毛玻璃视觉**：亮/暗主题下的玻璃层（顶栏 / dock / 弹窗）与极光渐变桌面底。

## 应用

| 应用 | 路径 | 说明 |
|---|---|---|
| 桌面壳 shell | `/` | 网格桌面、多任务、主题、命令面板 |
| 图片工具箱 web-img | `/img/` | 纯前端图片压缩/水印/格式转换/GIF/PDF |
| Markdown 编辑器 web-text | `/text/` | 实时预览、历史版本、多文档 |
| P2P 聊天室 nchat | `/chat/` | Ed25519 身份、端到端私聊、文件传输 |
| 文字动画 TypeV | `/typev/` | 脚本驱动打字动画、录制导出 |
| 咕咕 GuGu | `/pet/` | 原创养成桌宠：旅行、天气、日记、十款小游戏 |
| 麦堡突击队 Burger Commando | `/burger/` | 第三方作者的非官方同人横版街机射击原型 |

## 架构

```
os-open/
├── apps/
│   ├── shell/      # 桌面壳（网格、文件夹、多页、主题、多任务）
│   ├── web-img/    # 图片工具箱（/img/）
│   ├── web-text/   # Markdown 编辑器（/text/）
│   ├── nchat/      # P2P 聊天室（/chat/）
│   ├── typev/      # 文字动画（/typev/）
│   ├── pet/        # 咕咕桌宠（/pet/）
│   └── burger/     # 麦堡突击队静态游戏（/burger/）
├── scripts/
│   ├── build-all.mjs   # 依次构建全部应用（子应用带 basePath）并合成
│   └── compose.mjs     # 把全部静态导出合成单一 out/
└── pnpm-workspace.yaml
```

- 桌面壳构建到根路径 `/`；子应用分别以 `basePath` 静态导出后合入同一次部署，同源不同子路径。
- 各应用保留独立构建与测试，互不影响；壳的原有单测 + Playwright e2e 全量保留。
- **图片/音视频素材不打包进仓库**：咕咕与 burger 的运行时素材走 R2 `https://public.ale160.com`（`gugu/**`、`burger/**`），素材 URL 带 `ASSET_VERSION` 防 CDN 旧缓存。

## 添加新应用（三步）

1. `apps/` 下新建应用目录（任意能产出静态站点的框架），接入 `scripts/build-all.mjs`（加一行，带上对应的 `APP_BASE_PATH`）；
2. `apps/shell/src/config/apps.ts` 注册表加一条 `OsApp`（id、名称、路径、图标、**category**）——商城自动上架并归入对应分类；
3. 需要出现在默认桌面时，在 `apps/shell/public/config.json` 加一个 `url: "app://<id>"` 的图标。

### 共享技术栈（推荐直接复用）

Next.js 应用不必重复配置与复制公共逻辑，声明依赖即可：

```jsonc
// package.json
"dependencies": { "@os/shared": "workspace:*" },
"devDependencies": {
  "@os/tsconfig": "workspace:*",
  "@os/eslint-config": "workspace:*",
  "@os/next-preset": "workspace:*"
}
```

```jsonc
// tsconfig.json
{ "extends": "@os/tsconfig/next.json", "compilerOptions": { "paths": { "@/*": ["./src/*"] } } }
```

```js
// eslint.config.mjs
import { createOsEslintConfig } from '@os/eslint-config';
export default createOsEslintConfig();

// next.config.ts —— 自动带 output:'export'、trailingSlash、APP_BASE_PATH、@os/* 转译
import { withOsPreset } from '@os/next-preset';
export default withOsPreset();
```

跨应用共享依赖统一写在 `pnpm-workspace.yaml` 的 `catalog:` 段，应用内用 `"next": "catalog:"` 引用，
升级时改一处全系统生效。

运行时公共能力（`@os/shared`）：

| 模块 | 能力 |
|---|---|
| `@os/shared/os-assets` | 系统资产库：`saveAsset` / `listAssets` / `setClipboardItem` / `getClipboardItem`、壁纸库（`saveWallpaper` / `resolveWallpaperUrl`） |
| `@os/shared/os-language` | 系统语言：`useOsLanguage`（React）与 `read/write/subscribeOsLanguage`（非 React），跨 iframe 实时同步 |
| `@os/shared/css` | `cn()` 类名合并 |

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

> 依赖用 pnpm workspace 管理（单一 lockfile + `catalog:` 统一版本）；子应用互相隔离（strict hoisting），直接 import 未声明的依赖会构建失败。
> 共享包在 `packages/`（`@os/shared` 运行时能力、`@os/tsconfig` / `@os/eslint-config` / `@os/next-preset` 构建配置）。

## 部署（Cloudflare Pages）

项目通过 wrangler 直传部署（Pages 项目名 `os-open`，自定义域 `os.ale160.com`）：

```bash
pnpm build                                  # 构建 + compose → out/
pnpm deploy:cf                              # wrangler pages deploy out（需 wrangler login）
node scripts/attach-domain.mjs              # （仅首次）绑定自定义域
```

推送 master 后 Cloudflare Pages 从 git 构建并部署（素材不打包，运行时从 R2 加载）；也可以本地 `pnpm build` 后 `pnpm deploy:cf` 直传。

## 许可

本项目整体以 [Apache-2.0](./LICENSE) 开源。桌面壳源自 [hub-nav](https://github.com/ale-160/hub-nav)（Apache-2.0）；web-img（MIT）与 web-text（Apache-2.0）为独立开源应用，三者的完整 git 历史经由 subtree 保留在本仓库中，各应用目录内的许可与其原始仓库一致。
