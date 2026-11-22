# Changelog

本项目遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)。

## [Unreleased]

### 新增

- **跟随系统语言**：界面骨架（导航、列表栏、聊天头部、输入框、房间列表、搜索、欢迎页与空状态、加入密码弹窗）跟随 Ale OS 系统语言（`ale-os-language`）中英切换；极简响应式 i18n（`src/i18n`），经 `@os/shared/os-language-core` 订阅，不引入 React。设置面板、成员列表、云文档、通话及确认提示等深层文案仍为中文
- **系统图库改用共享运行时**：删除手抄的 `utils/osAssets.js`（停留在 DB v1），直接使用 `@os/shared/os-assets`（与壳一致的 v2 结构，含壁纸库），旧 v1 库自动升级、已有图库资产保留
- **Ale OS 未读角标集成**：他人消息未读时向桌面壳上报计数（dock 图标红色徽标，打开应用即清零，99+ 封顶）；独立运行时降级为标签页标题（`(N) nchat`）
- **通知可见性判定修正**：iframe 内 `document.hidden` 只反映标签页可见性，无法感知壳以 CSS 最小化应用——改用 `visibilityState==='visible' && document.hasFocus()` 判定前台，最小化时消息通知与角标均正常工作

