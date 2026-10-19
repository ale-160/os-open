# web-img

一个纯前端的在线图片处理工具箱，所有图片在浏览器本地处理，不会上传到服务器，保护您的隐私。

在线体验：[https://web-img.ale160.com/zh/](https://web-img.ale160.com/zh/)

个人主站：[http://ale160.com/zh/](http://ale160.com/zh/)

## 功能特性

- **图片压缩** — 支持 PNG、JPEG、WebP 等格式，可调节压缩质量
- **图片水印** — 为图片添加文字水印
- **音视频转换（/media）** — ffmpeg.wasm 本地转码：MP3 / M4A / WAV / OGG / FLAC / MP4 / WebM / GIF，支持从视频提取音轨（核心约 31MB 首次从 CDN 加载并缓存）
- **数据转换（/sheet）** — XLSX / XLS / CSV / TSV / ODS / JSON 表格互转 + PDF 提取文本为 TXT，多表按表拆分打包下载，纯 JS 本地转换
- **批量格式转换** — 批量转换为 JPG / PNG / WebP / **AVIF**（libavif WASM 按需加载）/ **TIFF**（自研零依赖，支持透明）/ GIF / BMP / ICO 共 8 种，支持 AVIF、TIFF、SVG、HEIC 等输入，可调质量与尺寸，打包 ZIP 下载或存入系统图库；常规转换在 Web Worker 线程池中并发执行，不阻塞界面
- **GIF 动画合成** — 多张图片合成为可循环播放的 GIF 动图，帧排序、帧延时可调，实时预览动画效果
- **图片裁剪** — 自定义裁剪区域
- **旋转与镜像** — 旋转图片、水平/垂直翻转
- **RGB 调色** — 调整图片色彩参数
- **PDF 转图片** — 将 PDF 页面转换为 PNG、JPEG、WebP 格式，支持批量转换并打包下载
- **多语言** — 支持中文和英文界面
- **暗色模式** — 支持亮色和暗色主题切换
- **纯前端** — 所有图片处理在浏览器本地完成，无需服务器，保护隐私

## 技术栈

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS v4
- shadcn/ui
- pdfjs-dist

## 本地开发

```bash
# 克隆仓库
git clone https://github.com/ale-160/web-img.git
cd web-img

# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

打开 [http://localhost:3000](http://localhost:3000) 查看效果。

## 开源协议

MIT License

## 支持与赞助 💖

如需支持本项目的持续开发，请前往统一赞赏页面：

👉 [https://ale160.com/sponsor](https://ale160.com/sponsor)

## 关于

由 [ale-160](http://ale160.com/) 开发维护。
