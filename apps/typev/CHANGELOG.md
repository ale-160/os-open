# Changelog

本项目遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)。

## [Unreleased]

### 新增

- **GIF 动图导出**：启用此前「暂不可用」的 GIF 选项——离屏逐帧渲染整段动画，经共享编码器 `@os/shared/gif-encoder` 的流式 `GifAnimationEncoder` 逐帧编码（只保留压缩后字节，长动画不 OOM）
  - 规划为纯函数（`src/lib/gifPlan.ts`）：时长 = 各行 duration 之和 ÷ 倍速，与预览计时一致；帧率 ≤15fps，帧延时取整到厘秒且由延时累加得出、不漂移；结尾额外停留 1 秒
  - 封顶：输出最长边 ≤960px（保持画布宽高比、不放大），最多 300 帧（超长脚本自动降帧率覆盖全程）
  - 导出中显示进度，再次点击按钮即可取消；卸载组件时自动取消进行中的导出
  - 导出设置弹窗的格式选项与限制说明跟随界面语言中英切换
- **保存到图库**：导出的 GIF / WebM 一键「保存到图库」，以 dataURL 写入 Ale OS 系统资产库（`@os/shared/os-assets`），系统图库与其他应用即时可见；系统图库对视频资产以 `<video>` 呈现（此前显示为坏图）
- **操作提示**：接入 sonner toast，导出完成 / 取消 / 保存结果均有反馈
- **单元测试**：接入 vitest（`pnpm --filter typev test`），覆盖 GIF 帧采样、尺寸封顶与时长计算（`src/lib/gifPlan.test.ts`）；GIF 编码往返测试随编码器迁至 `@os/shared`；typecheck 与单测已接入 CI
