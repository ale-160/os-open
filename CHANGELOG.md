# Changelog

本项目遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/) 与 [语义化版本](https://semver.org/lang/zh-CN/)。

## [Unreleased]

### 新增

- **预设持久化**：自定义尺寸预设、固定状态、导出格式排序与自定义分组现在保存到 localStorage，刷新页面不再丢失；存储带版本号，未来内置数据结构变更时旧缓存自动失效回退默认值

### 修复

- **内存泄漏**：`useImageEditor` 中测量图片尺寸的临时 ObjectURL 从不释放、预览 URL 未纳入跟踪、历史 dataURL 堆积在 Map 中，现统一跟踪并在替换/卸载时释放
- **内存泄漏**：水印面板更换水印图、合并面板移除/更换追加图片时未释放旧 ObjectURL
- **挂起问题**：主界面旋转/镜像在图片加载失败时会永久等待（无 `onerror` 处理），现增加错误提示
- **文案错误**：水印与合并功能处理成功后 toast 显示"处理中..."而非"处理完成"
- **拖拽抖动**：窗口内元素间拖动会触发 `dragleave` 导致拖拽指示器闪烁，现仅在真正离开窗口时取消状态

### 变更

- **PDF 批量下载**：多页转换时打包为单个 ZIP 下载（复用 jszip），避免浏览器拦截连续多次下载
- **pdfjs 按需加载**：改为客户端动态导入，消除静态预渲染时 Node 环境的 legacy build 告警，并将约 1.4MB 解析推迟到实际使用时
- **语言一致性**：语言 Provider 移至各语言路由页面并传入路由语言，未保存偏好时 `/zh` 页面不再出现英文界面；已保存的用户偏好仍然优先
- **主题防闪烁**：`<head>` 注入首帧前执行的主题初始化脚本，暗色用户不再看到亮色闪烁
- **代码清理**：移除 `pdfToImage.ts` 中从未使用的占位函数、`CompressPanel` 悬空的死代码回调与未使用的 `imageSize` prop、`UploadZone` 未使用的导入与 prop；重构 `PdfMainPage` 消除 `any` 类型与"声明前访问"
- **健壮性**：`canvas.ts` 的 `loadImage` 失败时释放 ObjectURL 并抛出 Error；`canvasToBlob` 编码失败时明确 reject 而非返回 null 断言

### 质量

- ESLint 警告从 20 个清零（0 错误 / 0 警告）

## [0.1.0] - 2026-08-05

### 新增

- **图片压缩**：支持 PNG、JPEG、WebP 格式，可调节压缩质量
- **图片水印**：为图片添加文字水印
- **格式转换**：PNG、JPEG、WebP 等格式互转
- **图片裁剪**：自定义裁剪区域
- **旋转与镜像**：旋转图片、水平/垂直翻转
- **RGB 调色**：调整图片色彩参数
- **PDF 转图片**：将 PDF 页面转换为 PNG、JPEG、WebP 格式，支持多页批量转换
- **多语言**：支持中文和英文界面
- **暗色模式**：亮色/暗色主题切换
- **SEO**：结构化数据（Person、WebSite、WebApplication）、sitemap、hreflang
