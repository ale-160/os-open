# 麦堡突击队 · Burger Commando

第三方作者制作的麦当劳主题横版街机射击原型（非官方同人作品，商标与素材版权归原作者/权利方所有）。本仓库只做 Ale OS 集成与静态托管，游戏逻辑保持原样。

- 独立入口：`https://os.ale160.com/burger/`
- 桌面入口：`app://burger`（壳内 iframe 打开）
- 源码：`apps/burger/src`（index.html / game.js / engine.mjs / style.css / icon.svg / assets/manifest.json）
- 构建：`node apps/burger/build.mjs` → `apps/burger/out`

## 素材

4 张 AI 背景/角色概念图（`characters.png`、`stage-1/2/3.png`，约 0.4MB WebP）已上传 R2：

```
https://public.ale160.com/burger/assets/<file>?v=20261026a
```

本地 `apps/burger/assets-local/` 仅用于重新上传（已加入 `.gitignore`，不入库）。`game.js` 里的 `ASSET_BASE/ASSET_VERSION` 和 `index.html` 的 `characters.png` 已指向 R2；更新素材时同时修改版本号并重新上传。

## 版权与来源

原始体验包：`burger-commando-v0.1`（作者提供的本地发布包）。游戏内页脚保留“非官方作品”声明；正式公开或商业使用前请确认名称、商标与素材授权。