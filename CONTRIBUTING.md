# 贡献指南

感谢对 Ale OS 的兴趣！这是一个「OS 式桌面作壳、工具以应用嵌入」的开源项目，欢迎任何形式的贡献——报告问题、完善文档、或把你的工具集成为系统应用。

## 开发环境

- Node.js ≥ 20.9（推荐 22）
- pnpm ≥ 10（`corepack enable` 或 `npm i -g pnpm`）

```bash
git clone https://github.com/ale-160/os-open.git
cd os-open
pnpm install

pnpm dev          # 壳的开发服务器（localhost:8525）
pnpm test         # 单元测试
pnpm build        # 全量构建 → out/
pnpm e2e          # Playwright e2e（自动 serve out/）
```

## 项目结构

```
apps/
├── shell/      # 桌面壳：网格、多任务窗口、dock、应用商城、系统图库
├── web-img/    # 应用：图片工具箱（/img/）
├── web-text/   # 应用：Markdown 编辑器（/text/）
└── nchat/      # 应用：P2P 聊天室（/chat/）
scripts/        # build-all（构建编排）与 compose（产物合成）
```

## 新增一个应用（三步）

1. **`apps/` 下新建应用目录**：任何能产出静态站点的框架都可以（Next.js、Vite、Astro…）。
   子路径部署约定：读取环境变量 `APP_BASE_PATH`（如 `/my-app`）作为部署前缀。
2. **`scripts/build-all.mjs` 加一行**：
   ```js
   run('pnpm', ['--filter', 'my-app', 'build'], { APP_BASE_PATH: '/my-app' });
   ```
   同时在 `scripts/compose.mjs` 的 `parts` 数组加 `['apps/my-app/out', 'my-app']`。
3. **注册表加一条 `OsApp`**（`apps/shell/src/config/apps.ts`）——应用商城自动上架。
   想出现在默认桌面，再在 `apps/shell/public/config.json` 加一个 `url: "app://<id>"` 的图标。

提交 PR 后，Cloudflare Pages 会为每个 PR 自动生成**预览部署**（地址会评论在 PR 里），合并前就能看到效果。

### 接入系统能力（可选）

- **系统图库 / 剪贴板**（IndexedDB，本机存储）：参考 `apps/web-img/src/utils/osAssets.ts`
  —— `saveAsset` 存产物、`getClipboardItem` 取剪贴板，实现跨应用数据流转；
- **统一语言**：读取 `localStorage['ale-os-language']`（`zh`/`en`），默认中文，监听 `storage` 事件可实时跟随系统切换。

## 规范

- **语言**：代码注释与 UI 文案以中文为主，标识符用英文；
- **提交信息**：`feat:/fix:/chore:/docs:` 前缀，一句话说清改动；
- **测试**：改动壳请保证 `pnpm test` 与 `pnpm e2e` 通过；新功能鼓励补测试；
- **依赖**：pnpm 严格隔离，直接 import 未声明的依赖会构建失败——请在对应 package.json 中显式声明。

## PR 预览

每个 PR 都会自动触发 Cloudflare Pages 预览部署：

- 生产分支（master）→ `os-open.pages.dev`（即 os.ale160.com）
- PR 分支 → `https://<分支名>.os-open.pages.dev`（地址会评论到 PR）

## 许可

提交即表示你同意以 [Apache-2.0](./LICENSE) 许可你的贡献。
