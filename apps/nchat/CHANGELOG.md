# Changelog

本项目遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)。

## [Unreleased]

### 新增

- **Ale OS 未读角标集成**：他人消息未读时向桌面壳上报计数（dock 图标红色徽标，打开应用即清零，99+ 封顶）；独立运行时降级为标签页标题（`(N) nchat`）
- **通知可见性判定修正**：iframe 内 `document.hidden` 只反映标签页可见性，无法感知壳以 CSS 最小化应用——改用 `visibilityState==='visible' && document.hasFocus()` 判定前台，最小化时消息通知与角标均正常工作

