# TypeV · 文字动画制作器

脚本驱动的文字打字动画工具：用类自然语言的标签脚本描述动画，实时预览，一键录制导出 WebM 视频。Ale OS（[os-open](https://github.com/ale-160/os-open)）内嵌应用，部署于 `/typev/`。

## 特性

- **双语标签脚本**：`[global-style mode=centerTypewriter; color=#ffffff]` 与 `【全局样式 模式：居中打字机】` 等价可用，标签/属性/常见值中英文混写（红=red、大=48px）
- **动画效果**：居中打字机、淡入、弹入、旋转进入、缩放进入、颜色波浪、大小跳跃
- **实时预览**：脚本解析后画布自动播放，Canvas 渲染，可暂停/停止
- **录制导出**：MediaRecorder 录制画布导出 WebM 视频
- **脚本持久化**：编辑内容存于浏览器，刷新不丢；首次访问自带演示脚本
- **样式指南**：内置分类示例（基础标签/高级用法/标签词典），点击即预览
- **中英双语界面**：跟随 Ale OS 系统语言（ale-os-language），也可在设置内独立切换

## 脚本语法速览

```
[global-style mode=centerTypewriter; color=#ffffff; fontSize=40px]
全局：每行按居中打字机逐字出现
[style color=#38bdf8; effect=fadeIn]局部片段样式与动画[/style]
[row-style color=#fbbf24]整行样式
```

- `global-style` 全局默认（mode/color/fontSize/fontFamily/maxVisible…）
- `style` 行内片段、`row-style` 整行、`def-style` 定义可复用样式、`clear-style` 清除、`section` 分节
- 属性分隔符 `;` 或 `，`，键值 `=` 或 `：`，详见应用内「样式指南」

## 开发

```bash
pnpm --filter typev dev        # localhost:8526
pnpm --filter typev build      # 静态导出（构建链自动带 APP_BASE_PATH=/typev）
pnpm --filter typev lint
```

技术栈：Next.js（静态导出）+ React + zustand + Tailwind CSS。许可随 [os-open](https://github.com/ale-160/os-open) 仓库（Apache-2.0）。
