# 优化移动端 UI、测试音视频传输、实现视频冷启动 实施计划

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**目标：** 改善移动端用户体验，验证音视频 P2P 传输是否工作，并实现视频冷启动（通话前预览）以提升移动端 UX。

**架构：**
- 移动端 UI 调整：修改 `src/components` 中的 Vue 组件和 `src/styles` 中的样式，使其响应式且触控友好。
- 音视频测试：利用 PeerJS media connection 和现有媒体流 API；在 UI 中添加测试通话按钮。
- 视频冷启动：通话发起前显示本地视频预览，使用 `getUserMedia` 预览和暂停/恢复逻辑。

**技术栈：** Vue 3, Composition API, PeerJS, WebRTC, Vite, CSS.

---

### 任务 1：分析当前移动端 UI 并识别痛点

**目标：** 在移动端视口下审查现有 UI，记录问题（如触控目标过小、溢出、PWA 安装提示不可见等）。

**文件：**
- 读取：`src/App.vue`, `src/components/`, `src/styles/`, `public/manifest.json`

**步骤 1：检查当前 UI**
- 打开开发者工具设备工具栏（或用真实手机）访问 http://localhost:5173/
- 记录任何溢出、按钮过小、缺少触控友好间距的情况。

**步骤 2：记录问题**
- 创建临时笔记文件：`notes/mobile-issues.md`（稍后可删除）

**步骤 3：启动开发服务器验证**
运行：`npm run dev`
预期：Vite 开发服务器启动，可在 http://localhost:5173/ 访问

**步骤 4：提交**
```bash
git add notes/mobile-issues.md
git commit -m "docs: record mobile UI issues for nchat"
```

---

### 任务 2：改进房间列表和房间卡片布局以适配触控

**目标：** 增加触控目标尺寸，改进垂直滚动布局，若可行添加滑动操作。

**文件：**
- 修改：`src/components/RoomList.vue`（若存在）或 `App.vue` 中相关部分
- 修改：`src/styles/main.css` 或组件内 scoped CSS

**步骤 1：定位房间列表组件**
搜索：`search_files("RoomList", target="files", path="src/", file_glob="*.vue")`

**步骤 2：调整 CSS**
- 将房间卡片最小高度设为至少 48dp。
- 增加内边距和外边距。
- 确保按钮图标至少有 48x48 的触控区域。

**步骤 3：添加响应式断点**
- 使用 CSS 媒体查询 `max-width: 600px` 实现垂直堆叠。

**步骤 4：验证更改**
运行：`npm run dev` 并在设备工具栏测试。

**步骤 5：提交**
```bash
git add src/components/RoomList.vue src/styles/main.css
git commit -m "feat: enlarge touch targets for room list on mobile"
```

---

### 任务 3：改进房间设置和通话按钮的可访问性

**目标：** 使设置齿轮、通话、文件附件按钮易于点击。

**文件：**
- 修改：`src/components/RoomHeader.vue`（或类似组件）
- 修改：`src/styles/` 相应样式

**步骤 1：定位头部组件**
搜索包含通话/视频图标的组件。

**步骤 2：调整图标容器尺寸**
- 设置 `min-width/height: 48px`。
- 使用 `flex-center` 工具类或自定义类。

**步骤 3：添加激活/聚焦状态**
- 确保 `:focus-visible` 轮廓对键盘/辅助技术可见。

**步骤 4：验证**
运行开发服务器并测试点击目标。

**步骤 5：提交**
```bash
git add src/components/RoomHeader.vue src/styles/header.css
git commit -m "feat: improve accessibility of room header controls"
```

---

### 任务 4：为移动端添加 PWA 安装提示可见性

**目标：** 确保安装横幅不被遮挡且正确显示。

**文件：**
- 修改：`src/App.vue`（监听 `beforeinstallprompt` 事件）
- 修改：`src/components/PromptInstall.vue`（若不存在则创建）

**步骤 1：检查现有 PWA 逻辑**
搜索：`search_files("beforeinstallprompt", target="content", path="src/")`

**步骤 2：创建小横幅组件**
- 固定底部位置，可关闭。
- 当捕获到 `beforeinstallprompt` 且未安装时显示。

**步骤 3：集成到 App.vue**
- 监听事件，存储 promise，显示横幅。
- 点击按钮时调用 `prompt()` 并处理结果。

**步骤 4：测试**
- 构建：`npm run build && npm run preview --host`
- 在局域网服务，用 Chrome Android 查看安装横幅是否出现。

**步骤 5：提交**
```bash
git add src/App.vue src/components/PromptInstall.vue
git commit -m "feat: add visible PWA install prompt for mobile"
```

---

### 任务 5：实现音视频通话测试按钮

**目标：** 添加临时 UI 按钮，与另一 peer（可用第二个标签页）快速发起音视频通话以验证媒体流。

**文件：**
- 修改：`src/components/CallControls.vue`（若不存在则创建）
- 修改：`src/composables/usePeer.js`（或类似）暴露 `getUserMedia` 和 `callMedia` 函数。

**步骤 1：暴露媒体辅助函数**
- 确保 `usePeer.js` 有异步函数 `getLocalMedia(constraints)` 返回 stream。
- 确保有创建媒体通话的函数：`peer.call(peerId, stream)`。

**步骤 2：创建测试按钮 UI**
- 简单按钮标记 "Test Call"，提示输入 peer ID（可用当前房间第一个 peer）。
- 点击时请求麦克风/摄像头，然后发起通话。

**步骤 3：处理来电**
- 确保 `usePeer.js` 中现有来电处理器将远程流设置到隐藏的 video 元素用于测试。

**步骤 4：验证**
- 打开两个标签页，一个点击测试通话，输入另一个的 peer ID，查看是否出现视频/音频。

**步骤 5：提交（仅开发环境，用 `import.meta.env.DEV` 保护）**
```bash
git add src/composables/usePeer.js src/components/CallControls.vue
git commit -m "feat: add test audio/video call button (dev only)"
```

---

### 任务 6：实现视频冷启动（通话前本地预览）

**目标：** 用户点击"开启视频"时显示本地视频预览，以便在发送前调整构图/摄像头。

**文件：**
- 修改：`src/components/VideoButton.vue`（或类似）
- 修改：`src/composables/useVideoPreview.js`（新建）

**步骤 1：创建预览 composable**
- 函数 `requestPreview()` 调用 `navigator.mediaDevices.getUserMedia({video:true, audio:false})` 返回 stream。
- 函数 `stopPreview(stream)` 停止轨道。

**步骤 2：集成到视频按钮**
- 点击时，若不在通话中，在小 video 元素中显示预览（镜像）。
- 预览就绪后显示"开始通话"按钮。
- 点击"开始通话"时，复用同一 stream 发起 PeerJS 通话，避免再次弹权限。

**步骤 3：清理**
- 通话结束或用户取消时，停止预览轨道。

**步骤 4：验证**
- 确保预览在移动端 Safari/Chrome 工作（需 HTTPS，但 localhost 可用）。
- 确保无重复权限弹窗。

**步骤 5：提交**
```bash
git add src/composables/useVideoPreview.js src/components/VideoButton.vue
git commit -m "feat: add video cold start preview before call"
```

---

### 任务 7：运行端到端移动端测试场景

**目标：** 在真实移动设备验证完整流程：安装 PWA、加入房间、测试音视频通话、验证视频冷启动。

**文件：** 无（手动测试）

**步骤 1：构建并服务**
```bash
npm run build
npm run preview --host
```
记录显示的局域网 IP。

**步骤 2：在移动设备上**
- 连接同一 WiFi。
- 打开 `http://<IP>:4173/`（preview 端口）。
- 通过提示添加到主屏幕。
- 从主屏幕启动。

**步骤 3：测试流程**
- 创建房间，记下 PeerID。
- 第二个标签页（或第二设备）加入同一房间。
- 用测试通话按钮发起音视频。
- 验证双方都能看见/听见对方。
- 测试视频冷启动：点击视频按钮，看到预览，再开始通话。

**步骤 4：记录发现**
- 创建 `test-results/mobile-test-2026-08-01.md` 记录观察结果。

**步骤 5：提交测试结果（可选）**
```bash
git add test-results/mobile-test-2026-08-01.md
git commit -m "docs: record mobile test results for video/audio and PWA"
```

---

### 任务 8：清理临时测试代码（如需要）

**目标：** 移除或用 dev 标志保护仅测试代码，保持生产环境干净。

**文件：**
- 修改：`src/components/CallControls.vue`（用 `if (import.meta.dev)` 包裹）
- 修改：任何仅测试的导入。

**步骤 1：包裹测试按钮**
```js
if (import.meta.env.DEV) {
  // 显示测试通话按钮
}
```

**步骤 2：验证生产构建**
```bash
npm run build
```
检查输出中无测试按钮。

**步骤 3：提交**
```bash
git add src/components/CallControls.vue
git commit -m "chore: guard test call button behind dev flag"
```

---

### 可能变更的文件

- `src/components/RoomList.vue`
- `src/components/RoomHeader.vue`
- `src/components/VideoButton.vue`（或类似）
- `src/components/CallControls.vue`（新建或修改）
- `src/components/PromptInstall.vue`（新建）
- `src/composables/usePeer.js`
- `src/composables/useVideoPreview.js`（新建）
- `src/App.vue`
- `src/styles/main.css`（或各组件 scoped CSS）
- `public/manifest.json`（可能调整图标）
- `test-results/mobile-test-2026-08-01.md`（可选）
- `notes/mobile-issues.md`（临时）

---

### 测试 / 验证

- 在设备工具栏和真实设备上手动视觉测试。
- 用 Lighthouse 验证 PWA install manifest。
- 确保无缺失媒体权限的控制台错误。
- 确认测试通话中音视频双向工作。
- 确认视频预览在通话前出现、通话后停止。

---

### 风险、权衡、开放问题

- **风险：** 移动端浏览器可能限制无用户手势的自动播放/getUserMedia。缓解：仅在显式按钮点击时请求媒体。
- **权衡：** 添加预览 UI 增加轻微复杂度；确保不需要时隐藏。
- **开放问题：** 是否跨会话持久化摄像头/麦克风权限？MVP 不需要；依赖浏览器持久化。
- **开放问题：** 移动端如何处理前后摄像头切换？可作为未来增强。

---

### 验证步骤总结

1. 运行 `npm run dev` 检查移动端布局。
2. 生产构建并在真实 Android/iOS 设备上通过局域网测试。
3. 确认 PWA 安装提示出现且工作。
4. 确认两 peer 间音视频通话工作。
5. 确认视频预览在通话前出现、通话后停止。
6. 确保现有聊天/文件传输功能无回归。

---

**计划完成并已保存。准备使用 subagent-driven-development 执行 — 我会为每个任务派发新的 subagent 并进行两阶段审查（规范合规性然后代码质量）。是否继续？**