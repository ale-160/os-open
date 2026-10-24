# 主角卡（1024 游戏赛道提交物）

成品：`apps/pet/docs/character-card.png`（1080×1440 PNG）。

## 内容构成

- **一句话**：「一句话，变出一只属于你的小鸟：它住进你的『网页 OS』桌面，吃饭、洗澡、打工、学习，离线也在偷偷长大——用 AI 画出它的样子，用 AI 听懂它说的话。」
- **AI 生成的角色**：官方主角「咕咕」奶黄幼年形态（身体由 gpt-image-2 生成，表情为游戏内同款 SVG 叠加）
- **游戏里的样子**：左=`/pet/` 游戏内实拍；右=AleOS 桌面挂件实拍

## 再生成步骤

1. 素材截图（headless Chromium，en-US locale）：
   - `/pet/` 游戏页 420×760（预置存档后截图）→ `.asset-tmp/card/ingame.png`
   - 桌面+挂件 1280×800（`ale-os-pet-widget=on`）→ `.asset-tmp/card/desktop.png`
   - 身体素材直接复制 `apps/pet/public/skins/gugu/cream-baby.png`
2. 排版 HTML（源见会话记录/本文件末尾提示）：`.asset-tmp/card/character-card.html`，引用上述三图
3. 渲染：`page.screenshot({ path: 'apps/pet/docs/character-card.png' })`（viewport 1080×1440）

> 表情定位参数与游戏内 `FACE_LAYOUTS.cream.baby` 一致（eyeY .395 / eyeDX .105 / beakY .455）。
