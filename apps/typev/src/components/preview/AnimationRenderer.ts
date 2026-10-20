import type { Script, ScriptLine } from '@/types/script';

/**
 * 动画渲染器类
 * 负责在 Canvas 上渲染脚本动画效果
 */
export class AnimationRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private script: Script;
  private animationId: number | null = null;
  private startTime: number | null = null;
  private isPlaying: boolean = false;
  private pausedTime: number = 0;
  private loop: boolean = false;
  
  // 动态拆分缓存：存储每行的拆分子行
  private splitLinesCache: Map<number, string[]> = new Map();
  
  // 预计算每行的起始时间（秒）
  private lineStartTimes: number[] = [];
  
  // 已完成句子的列表（用于居中打字机模式）
  private completedLinesForTypewriter: Array<{
    text: string;
    segments: Array<{ text: string; style?: Record<string, string> }>;
    style: Record<string, string>;
    startX: number;
    startY: number;
    finishTime: number;
    fontSize: number;
    lineIndex?: number; // 行索引，用于同步集合
  }> = [];
  
  // 已完成句子的索引集合（用于快速查找）
  private completedLineIndices: Set<number> = new Set();
  
  // 最大可见行数
  private maxVisibleLines: number = 2;

  constructor(canvas: HTMLCanvasElement, script: Script, loop: boolean = false) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.script = script;
    this.loop = loop;
    
    // 设置 canvas 尺寸
    this.canvas.width = script.resolution.width;
    this.canvas.height = script.resolution.height;
    
    // 预计算每行的起始时间（秒）
    this.lineStartTimes = [];
    let accumulatedTime = 0;
    for (const line of script.lines) {
      this.lineStartTimes.push(accumulatedTime);
      accumulatedTime += line.duration;
    }
  }

  /**
   * 开始播放动画
   */
  play() {
    if (this.isPlaying) {
      return;
    }

    this.isPlaying = true;
    this.startTime = performance.now() - this.pausedTime;
    this.animate();
  }

  /**
   * 暂停动画
   */
  pause() {
    if (!this.isPlaying) {
      return;
    }

    this.isPlaying = false;
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
    
    // 记录暂停时的时间
    if (this.startTime !== null) {
      this.pausedTime = performance.now() - this.startTime;
    }
  }

  /**
   * 清空画布
   */
  private clearCanvas() {
    this.ctx.fillStyle = this.script.background;
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }

  /**
   * 停止动画并清屏
   */
  stop() {
    this.isPlaying = false;
    this.pausedTime = 0;
    this.startTime = null;
    this.splitLinesCache.clear(); // 清空动态拆分缓存
    this.completedLinesForTypewriter = []; // 清空已完成句子列表
    this.completedLineIndices.clear(); // 清空已完成句子索引集合
    
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
    
    // 清空画布
    this.clearCanvas();
  }

  /**
   * 动画循环
   */
  private animate() {
    if (!this.isPlaying) {
      return;
    }

    const currentTime = performance.now();
    const elapsedTime = this.startTime !== null ? currentTime - this.startTime : 0;

    // 从 globalStyle 读取倍速值，默认 1
    const speedValue = parseFloat(this.script.globalStyle?.speed || '1');
    // 倍速转换：speedFactor = speed（值越大越快，越小越慢）
    const speedFactor = speedValue || 1;
    // 调整后的时间
    const adjustedTime = elapsedTime * speedFactor;

    // 确定当前行索引，以获取该行的 effect
    let currentLineIndex = -1;
    for (let i = 0; i < this.lineStartTimes.length; i++) {
      const startTime = this.lineStartTimes[i];
      const duration = this.script.lines[i].duration;
      if (adjustedTime >= startTime * 1000 && adjustedTime < (startTime + duration) * 1000) {
        currentLineIndex = i;
        break;
      }
    }
    
    // 根据当前行的 effect 决定渲染模式（如果没有当前行，使用第一行的 effect）
    const lineEffect = currentLineIndex >= 0 
      ? this.script.lines[currentLineIndex].effect 
      : (this.script.lines[0]?.effect || 'centerTypewriter');
    
    if (lineEffect === 'jumpScale') {
      // 大小跳跃模式
      this.renderJumpScale(adjustedTime);
    } else {
      // 简单居中打字机模式（默认）
      this.renderSimpleCenterTypewriter(adjustedTime);
    }

    // 检查是否所有行都已显示完毕
    const totalDuration = this.script.lines.reduce((sum, line) => sum + line.duration * 1000, 0);
    if (adjustedTime >= totalDuration && totalDuration > 0) {
      if (this.loop) {
        // 循环播放：重置时间
        this.startTime = performance.now();
        this.splitLinesCache.clear();
        this.completedLinesForTypewriter = [];
        this.completedLineIndices.clear();
      } else {
        // 保持最后一帧显示，不自动停止
        return;
      }
    }

    // 继续下一帧
    this.animationId = requestAnimationFrame(() => this.animate());
  }

  /**
   * 获取行的完整文本（从 segments 拼接）
   */
  private getLineFullText(line: ScriptLine): string {
    return line.segments.map(seg => seg.text).join('');
  }

  /**
   * 根据字体大小和画布宽度动态计算每行最大字符数
   * @param fontSize - 字体大小（像素）
   * @returns 每行最大字符数
   */
  private calculateMaxCharsPerLine(fontSize: number): number {
    // 计算单字符近似宽度：中文等宽系数 0.6
    const charWidth = fontSize * 0.6;
    // 计算每行最大字符数，至少为 1
    const maxChars = Math.floor(this.canvas.width / charWidth);
    return Math.max(1, maxChars);
  }

  /**
   * 对指定行进行动态拆分（带缓存）
   * @param lineIndex - 行索引
   * @param fontSize - 字体大小
   * @returns 拆分后的子行数组
   */
  private getSplitLinesForLine(lineIndex: number, fontSize: number): string[] {
    // 检查缓存
    const cacheKey = lineIndex;
    if (this.splitLinesCache.has(cacheKey)) {
      return this.splitLinesCache.get(cacheKey)!;
    }

    const line = this.script.lines[lineIndex];
    const fullText = this.getLineFullText(line);
    const maxCharsPerLine = this.calculateMaxCharsPerLine(fontSize);

    // 如果不需要拆分，直接返回原文本
    if (fullText.length <= maxCharsPerLine) {
      this.splitLinesCache.set(cacheKey, [fullText]);
      return [fullText];
    }

    // 按 maxCharsPerLine 切割文本
    const subLines: string[] = [];
    for (let i = 0; i < fullText.length; i += maxCharsPerLine) {
      subLines.push(fullText.substring(i, i + maxCharsPerLine));
    }

    this.splitLinesCache.set(cacheKey, subLines);
    return subLines;
  }

  /**
   * 合并行的样式（全局样式 + 行样式）
   */
  private mergeLineStyles(line: ScriptLine): Record<string, string> {
    return { ...this.script.globalStyle, ...(line.segments[0]?.style || {}) };
  }

  /**
   * 大小跳跃渲染模式（原 renderLineByLine）
   */
  private renderJumpScale(elapsedTimeMs: number) {
    const currentTime = elapsedTimeMs / 1000; // 转换为秒
    
    // 清屏，填充背景
    this.ctx.fillStyle = this.script.background;
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // 确定当前行索引
    let currentLineIndex = -1;
    for (let i = 0; i < this.lineStartTimes.length; i++) {
      const startTime = this.lineStartTimes[i];
      const duration = this.script.lines[i].duration;
      if (currentTime >= startTime && currentTime < startTime + duration) {
        currentLineIndex = i;
        break;
      }
    }

    // 更新 completedLinesForTypewriter：将所有已完成的行加入
    for (let i = 0; i < this.script.lines.length; i++) {
      const startTime = this.lineStartTimes[i];
      const duration = this.script.lines[i].duration;
      
      // 如果该行已完成且还未添加到列表
      if (startTime + duration <= currentTime) {
        // 使用 Set 快速检查是否已存在
        if (!this.completedLineIndices.has(i)) {
          const fullText = this.getLineFullText(this.script.lines[i]);
          const line = this.script.lines[i];
          
          // 保存 segments 信息以支持多段不同样式
          const segments = line.segments.map(seg => ({
            text: seg.text,
            style: seg.style
          }));
          
          // 使用第一个 segment 的样式作为代表（用于计算位置和缩放）
          const mergedStyle = this.mergeLineStyles(line);
          const fontSizeStr = mergedStyle.fontSize || '144px';
          const baseFontSize = parseFloat(fontSizeStr);
          const fontSize = baseFontSize * 3;
          
          // 根据字体大小计算跳跃位置，确保不遮挡中心
          const jumpOffsetX = fontSize * 1.5;
          const jumpOffsetY = fontSize * 1.5;
          
          this.completedLinesForTypewriter.push({
            text: fullText,
            segments: segments,
            style: mergedStyle,
            startX: this.canvas.width / 2 - jumpOffsetX,
            startY: this.canvas.height / 2 - jumpOffsetY,
            finishTime: startTime + duration,
            fontSize: fontSize,
            lineIndex: i // 存储行索引
          });
          
          // 标记该行已加入
          this.completedLineIndices.add(i);
        }
      }
    }

    // 限制同时显示的已完成句子数量（硬限制）
    while (this.completedLinesForTypewriter.length > this.maxVisibleLines + 2) {
      const removedItem = this.completedLinesForTypewriter.shift(); // 移除并获取第一个元素
      if (removedItem && removedItem.lineIndex !== undefined) {
        this.completedLineIndices.delete(removedItem.lineIndex); // 同步删除集合
      }
    }

    // 绘制 completedLinesForTypewriter 中的每一句
    const flyDirection = this.script.globalStyle?.flyDirection || 'left';
    const disappearDuration = parseFloat(this.script.globalStyle?.flyDuration || '5'); // 默认5秒
    
    for (let i = this.completedLinesForTypewriter.length - 1; i >= 0; i--) {
      const item = this.completedLinesForTypewriter[i];
      const age = currentTime - item.finishTime;
      
      // 计算进度比例 t = age / disappearDuration，clamp 到 [0, 1]
      const t = Math.min(1, Math.max(0, age / disappearDuration));
      
      // 使用缓出曲线：p = t³
      const p = t * t * t;
      
      // 根据飞出方向计算偏移
      let offsetX = 0;
      let offsetY = 0;
      const maxMoveDistance = Math.max(this.canvas.width * 0.5, item.fontSize * 2);
      
      switch (flyDirection) {
        case 'left':
          offsetX = maxMoveDistance * p;
          break;
        case 'up':
          offsetY = maxMoveDistance * p;
          break;
        case 'topLeft':
          offsetX = maxMoveDistance * p;
          offsetY = maxMoveDistance * p;
          break;
        default:
          offsetX = maxMoveDistance * p;
      }
      
      const x = item.startX - offsetX;
      const y = item.startY - offsetY;
      
      // 缩放比例：从 1 加速降到 0
      const scale = Math.max(0, 1 - p);
      
      // 透明度：从 1 加速降到 0
      const alpha = Math.max(0, 1 - p);
      
      // 如果完全消失（p >= 1），从数组中移除
      if (p >= 1 || scale <= 0 || alpha <= 0) {
        this.completedLinesForTypewriter.splice(i, 1);
        continue;
      }
      
      // 绘制（支持多彩样式）
      this.ctx.save();
      this.ctx.globalAlpha = alpha;
      this.ctx.textAlign = 'left'; // 使用 left-align，通过 startX 控制居中
      this.ctx.textBaseline = 'middle';
      this.ctx.translate(x, y);
      this.ctx.scale(scale, scale);
      
      // 计算缩放后的字体大小
      const scaledFontSize = item.fontSize * scale;
      
      // 先测量所有 segment 的总宽度（用于居中）
      let totalWidth = 0;
      for (const seg of item.segments) {
        const segStyle = seg.style || {};
        const mergedSegStyle = { ...item.style, ...segStyle };
        const fontSizeStr = mergedSegStyle.fontSize || '144px';
        const baseFontSize = parseFloat(fontSizeStr);
        const segScaledFontSize = baseFontSize * 3 * scale;
        const fontWeight = mergedSegStyle.fontWeight || 'normal';
        
        this.ctx.font = `${fontWeight} ${segScaledFontSize}px ${mergedSegStyle.fontFamily || 'monospace'}`;
        const metrics = this.ctx.measureText(seg.text);
        totalWidth += metrics.width;
      }
      
      // 从负的总宽度一半开始绘制，实现居中对齐
      let currentX = -totalWidth / 2;
      
      // 遍历每个 segment，使用各自的样式
      for (const seg of item.segments) {
        const segStyle = seg.style || {};
        const mergedSegStyle = { ...item.style, ...segStyle };
        const fontSizeStr = mergedSegStyle.fontSize || '144px';
        const baseFontSize = parseFloat(fontSizeStr);
        const segScaledFontSize = baseFontSize * 3 * scale;
        const color = mergedSegStyle.color || '#ffffff';
        const fontWeight = mergedSegStyle.fontWeight || 'normal';
        
        this.ctx.font = `${fontWeight} ${segScaledFontSize}px ${mergedSegStyle.fontFamily || 'monospace'}`;
        this.ctx.fillStyle = color;
        
        // 应用透明度
        const styleOpacity = mergedSegStyle.opacity ? parseFloat(mergedSegStyle.opacity) : 1;
        this.ctx.globalAlpha = alpha * styleOpacity;
        
        this.ctx.fillText(seg.text, currentX, 0);
        
        // 更新 x 偏移
        const metrics = this.ctx.measureText(seg.text);
        currentX += metrics.width;
        
        // 在每个 segment 后追加一个空格宽度
        const charWidth = segScaledFontSize * 0.6;
        currentX += charWidth;
      }
      
      this.ctx.restore();
    }

    // 判断是否所有行都已播放完毕
    if (currentLineIndex === -1) {
      if (this.completedLinesForTypewriter.length === 0) {
        // 所有句子都飞走了，停止动画
        this.stop();
        return;
      }
      // 否则，只绘制已完成句子，不绘制当前行，继续动画循环
      return;
    }

    // 绘制当前行（如果存在）
    if (currentLineIndex >= 0 && currentLineIndex < this.script.lines.length) {
      const line = this.script.lines[currentLineIndex];
      const lineStartTime = this.lineStartTimes[currentLineIndex];
      const elapsed = currentTime - lineStartTime;
      
      // 合并全局样式作为基础
      const mergedStyle = this.mergeLineStyles(line);
      
      // 计算总字符数
      const totalChars = line.segments.reduce((sum, seg) => sum + seg.text.length, 0);
      
      // 计算显示的字符数（混合方案：0.5-1秒停顿）
      const minPause = 0.5;
      const maxPause = 1.0;
      const lastCharPause = Math.min(maxPause, Math.max(minPause, totalChars * 0.05));
      const displayTime = line.duration - lastCharPause;
      
      let charsShown: number;
      
      if (elapsed >= displayTime) {
        charsShown = totalChars;
      } else {
        charsShown = Math.min(
          totalChars,
          Math.floor((elapsed / displayTime) * totalChars)
        );
      }
      
      // 安全计数器：单帧最多渲染 500 个字符
      const MAX_CHARS_PER_FRAME = 500;
      if (charsShown > MAX_CHARS_PER_FRAME) {
        charsShown = MAX_CHARS_PER_FRAME;
      }
      
      // 逐 segment 渲染，支持不同样式
      let renderedChars = 0;
      
      // 估算总宽度（避免 measureText 调用）
      const maxWidth = this.canvas.width * 0.9; // 最大宽度为画布的90%
      
      // 找到最大的基准字号
      let maxBaseFontSize = 0;
      for (const segment of line.segments) {
        const segStyle = segment.style || {};
        const mergedSegStyle = { ...mergedStyle, ...segStyle };
        const fontSizeStr = mergedSegStyle.fontSize || '144px';
        const baseFontSize = parseFloat(fontSizeStr);
        if (baseFontSize > maxBaseFontSize) {
          maxBaseFontSize = baseFontSize;
        }
      }
      
      // 估算总宽度：统一使用最大字号计算每个字符的宽度，避免不同字号导致的位置偏移
      const estimatedTotalWidth = totalChars * maxBaseFontSize * 3 * 0.6;
      const scaleRatio = estimatedTotalWidth > maxWidth ? maxWidth / estimatedTotalWidth : 1;
      
      // 固定步进宽度基于最大字号
      const step = maxBaseFontSize * 3 * scaleRatio * 0.6;
      
      // 从中心位置开始绘制
      let currentX = this.canvas.width / 2 - (estimatedTotalWidth * scaleRatio) / 2;
      const centerY = this.canvas.height / 2;
      
      // 第二次遍历：实际绘制
      for (let i = 0; i < line.segments.length; i++) {
        if (renderedChars >= charsShown) break;
        
        const segment = line.segments[i];
        const segStyle = segment.style || {};
        const mergedSegStyle = { ...mergedStyle, ...segStyle };
        const fontSizeStr = mergedSegStyle.fontSize || '144px';
        const baseFontSize = parseFloat(fontSizeStr);
        const fontSize = baseFontSize * 3 * scaleRatio; // 应用缩放
        const color = mergedSegStyle.color || '#ffffff';
        
        // 计算当前 segment 需要显示的字符数
        const charsInThisSegment = Math.min(
          segment.text.length,
          Math.max(0, charsShown - renderedChars)
        );
        
        if (charsInThisSegment > 0) {
          const displayText = segment.text.substring(0, charsInThisSegment);
          
          this.ctx.save();
          this.ctx.textAlign = 'left';
          this.ctx.textBaseline = 'middle';
          
          // 应用 fontWeight 和 opacity
          const fontWeight = mergedSegStyle.fontWeight || 'normal';
          this.ctx.font = `${fontWeight} ${fontSize}px ${mergedSegStyle.fontFamily || 'monospace'}`;
          this.ctx.fillStyle = color;
          
          // 应用透明度
          const opacity = mergedSegStyle.opacity ? parseFloat(mergedSegStyle.opacity) : 1;
          this.ctx.globalAlpha = opacity;
          
          this.ctx.fillText(displayText, currentX, centerY);
          this.ctx.restore();
          
          // 更新偏移量：使用固定步进，避免不同字号导致的叠压
          currentX += step * charsInThisSegment;
        }
        
        renderedChars += charsInThisSegment;
      }
    }
  }

  /**
   * 简单居中打字机渲染模式（高性能）
   */
  private renderSimpleCenterTypewriter(elapsedTimeMs: number) {
    const currentTime = elapsedTimeMs / 1000; // 转换为秒
    
    // 清屏，填充背景
    this.ctx.fillStyle = this.script.background;
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // 确定当前行索引
    let currentLineIndex = -1;
    for (let i = 0; i < this.lineStartTimes.length; i++) {
      const startTime = this.lineStartTimes[i];
      const duration = this.script.lines[i].duration;
      if (currentTime >= startTime && currentTime < startTime + duration) {
        currentLineIndex = i;
        break;
      }
    }

    // 如果所有行播放完毕，保持最后一句完整显示在中央
    if (currentLineIndex === -1) {
      if (this.script.lines.length > 0) {
        // 绘制最后一行
        this.drawFullLineAtCenter(this.script.lines[this.script.lines.length - 1]);
      }
      return;
    }

    // 绘制当前行
    const line = this.script.lines[currentLineIndex];
    const lineStartTime = this.lineStartTimes[currentLineIndex];
    const elapsed = currentTime - lineStartTime;
    
    // 检查当前行的 effect，如果不是 centerTypewriter，调用对应的专用渲染方法
    if (line.effect !== 'centerTypewriter') {
      const progress = Math.min(1, elapsed / line.duration);
      
      switch (line.effect) {
        case 'fadeIn':
          this.renderFadeIn(line, progress);
          return;
        case 'bounceIn':
          this.renderBounceIn(line, progress);
          return;
        case 'rotateIn':
          this.renderRotateIn(line, progress);
          return;
        case 'scaleIn':
          this.renderScaleIn(line, progress);
          return;
        case 'colorWave':
          this.renderColorWave(line, progress);
          return;
      }
    }
    
    // 合并全局样式作为基础
    const mergedStyle = this.mergeLineStyles(line);
    
    // 计算总字符数
    const totalChars = line.segments.reduce((sum, seg) => sum + seg.text.length, 0);
    
    // 计算显示的字符数（混合方案：0.5-1秒停顿）
    const minPause = 0.5;
    const maxPause = 1.0;
    const lastCharPause = Math.min(maxPause, Math.max(minPause, totalChars * 0.05));
    const displayTime = line.duration - lastCharPause;
    
    let charsShown: number;
    
    if (elapsed >= displayTime) {
      charsShown = totalChars;
    } else {
      charsShown = Math.min(
        totalChars,
        Math.floor((elapsed / displayTime) * totalChars)
      );
    }
    
    // 安全计数器：单帧最多渲染 500 个字符
    const MAX_CHARS_PER_FRAME = 500;
    if (charsShown > MAX_CHARS_PER_FRAME) {
      charsShown = MAX_CHARS_PER_FRAME;
    }
    
    // 如果没有字符需要显示，直接返回
    if (charsShown === 0) {
      return;
    }
    
    // 逐 segment 渲染，支持不同样式
    let renderedChars = 0;
    
    // 使用 measureText 精确测量每个 segment 的宽度
    const maxWidth = this.canvas.width * 0.9; // 最大宽度为画布的90%
    
    // 先测量所有 segment 的总宽度
    let estimatedTotalWidth = 0;
    const segmentWidths: number[] = [];
    
    for (let i = 0; i < line.segments.length; i++) {
      const segment = line.segments[i];
      const segStyle = segment.style || {};
      const mergedSegStyle = { ...mergedStyle, ...segStyle };
      const fontSizeStr = mergedSegStyle.fontSize || '96px';
      const baseFontSize = parseFloat(fontSizeStr);
      const fontWeight = mergedSegStyle.fontWeight || 'normal';
      
      this.ctx.font = `${fontWeight} ${baseFontSize}px ${mergedSegStyle.fontFamily || 'monospace'}`;
      const metrics = this.ctx.measureText(segment.text);
      const segWidth = metrics.width;
      
      segmentWidths.push(segWidth);
      estimatedTotalWidth += segWidth;
      
      // 如果不是最后一个 segment，添加一个空格宽度
      if (i < line.segments.length - 1) {
        const spaceMetrics = this.ctx.measureText(' ');
        estimatedTotalWidth += spaceMetrics.width;
      }
    }
    
    const scaleRatio = estimatedTotalWidth > maxWidth ? maxWidth / estimatedTotalWidth : 1;
    
    // 从中心位置开始绘制
    let currentX = this.canvas.width / 2 - (estimatedTotalWidth * scaleRatio) / 2;
    const centerY = this.canvas.height / 2;
    
    // 遍历每个 segment
    for (let i = 0; i < line.segments.length; i++) {
      if (renderedChars >= charsShown) break;
      
      const segment = line.segments[i];
      const segStyle = segment.style || {};
      const mergedSegStyle = { ...mergedStyle, ...segStyle };
      const fontSizeStr = mergedSegStyle.fontSize || '96px';
      const baseFontSize = parseFloat(fontSizeStr);
      const fontSize = baseFontSize * scaleRatio; // 应用缩放
      const color = mergedSegStyle.color || '#ffffff';
      
      // 计算当前 segment 需要显示的字符数
      const charsInThisSegment = Math.min(
        segment.text.length,
        Math.max(0, charsShown - renderedChars)
      );
      
      if (charsInThisSegment > 0) {
        const displayText = segment.text.substring(0, charsInThisSegment);
        
        this.ctx.save();
        this.ctx.textAlign = 'left';
        this.ctx.textBaseline = 'middle';
        
        // 应用 fontWeight 和 opacity
        const fontWeight = mergedSegStyle.fontWeight || 'normal';
        this.ctx.font = `${fontWeight} ${fontSize}px ${mergedSegStyle.fontFamily || 'monospace'}`;
        this.ctx.fillStyle = color;
        
        // 应用透明度
        const opacity = mergedSegStyle.opacity ? parseFloat(mergedSegStyle.opacity) : 1;
        this.ctx.globalAlpha = opacity;
        
        this.ctx.fillText(displayText, currentX, centerY);
        this.ctx.restore();
        
        // 更新偏移量：使用精确测量的宽度
        const segWidth = segmentWidths[i] * scaleRatio;
        const charRatio = charsInThisSegment / segment.text.length;
        currentX += segWidth * charRatio;
        
        // 如果不是最后一个 segment，额外累加一个空格宽度
        if (i < line.segments.length - 1) {
          this.ctx.font = `${mergedSegStyle.fontWeight || 'normal'} ${fontSize}px ${mergedSegStyle.fontFamily || 'monospace'}`;
          const spaceMetrics = this.ctx.measureText(' ');
          currentX += spaceMetrics.width;
        }
      }
      
      renderedChars += charsInThisSegment;
    }
  }

  /**
   * 在画布中央绘制完整的一行（用于结束后保持显示）
   */
  private drawFullLineAtCenter(line: ScriptLine) {
    const mergedStyle = this.mergeLineStyles(line);
    const centerX = this.canvas.width / 2;
    const centerY = this.canvas.height / 2;
    
    // 使用 measureText 精确测量每个 segment 的宽度
    let totalWidth = 0;
    const segmentWidths: number[] = [];
    
    for (const segment of line.segments) {
      const segStyle = segment.style || {};
      const mergedSegStyle = { ...mergedStyle, ...segStyle };
      const fontSizeStr = mergedSegStyle.fontSize || '96px';
      const fontSize = parseFloat(fontSizeStr);
      const fontWeight = mergedSegStyle.fontWeight || 'normal';
      
      this.ctx.font = `${fontWeight} ${fontSize}px ${mergedSegStyle.fontFamily || 'monospace'}`;
      const metrics = this.ctx.measureText(segment.text);
      const segWidth = metrics.width;
      
      segmentWidths.push(segWidth);
      totalWidth += segWidth;
    }
    
    // 从中心向左偏移一半宽度开始绘制
    let currentX = centerX - totalWidth / 2;
    
    // 逐段绘制
    for (let i = 0; i < line.segments.length; i++) {
      const segment = line.segments[i];
      const segStyle = segment.style || {};
      const mergedSegStyle = { ...mergedStyle, ...segStyle };
      const fontSizeStr = mergedSegStyle.fontSize || '96px';
      const fontSize = parseFloat(fontSizeStr);
      const color = mergedSegStyle.color || '#ffffff';
      const fontWeight = mergedSegStyle.fontWeight || 'normal';
      
      this.ctx.save();
      this.ctx.textAlign = 'left';
      this.ctx.textBaseline = 'middle';
      this.ctx.font = `${fontWeight} ${fontSize}px ${mergedSegStyle.fontFamily || 'monospace'}`;
      this.ctx.fillStyle = color;
      
      const opacity = mergedSegStyle.opacity ? parseFloat(mergedSegStyle.opacity) : 1;
      this.ctx.globalAlpha = opacity;
      
      this.ctx.fillText(segment.text, currentX, centerY);
      this.ctx.restore();
      
      // 更新 x 偏移：使用精确测量的宽度
      currentX += segmentWidths[i];
    }
  }

  /**
   * 设置最大可见行数
   */
  public setMaxVisibleLines(n: number): void {
    this.maxVisibleLines = n;
  }

  /**
   * 淡入效果渲染
   */
  private renderFadeIn(line: ScriptLine, progress: number) {
    const mergedStyle = this.mergeLineStyles(line);
    const centerX = this.canvas.width / 2;
    const centerY = this.canvas.height / 2;
    
    // 使用 measureText 精确测量每个 segment 的宽度
    let totalWidth = 0;
    const segmentWidths: number[] = [];
    
    for (const segment of line.segments) {
      const segStyle = segment.style || {};
      const mergedSegStyle = { ...mergedStyle, ...segStyle };
      const fontSizeStr = mergedSegStyle.fontSize || '96px';
      const fontSize = parseFloat(fontSizeStr);
      const fontWeight = mergedSegStyle.fontWeight || 'normal';
      
      this.ctx.font = `${fontWeight} ${fontSize}px ${mergedSegStyle.fontFamily || 'monospace'}`;
      const metrics = this.ctx.measureText(segment.text);
      const segWidth = metrics.width;
      
      segmentWidths.push(segWidth);
      totalWidth += segWidth;
    }
    
    let currentX = centerX - totalWidth / 2;
    
    // 逐段绘制，应用透明度
    for (let i = 0; i < line.segments.length; i++) {
      const segment = line.segments[i];
      const segStyle = segment.style || {};
      const mergedSegStyle = { ...mergedStyle, ...segStyle };
      const fontSizeStr = mergedSegStyle.fontSize || '96px';
      const fontSize = parseFloat(fontSizeStr);
      const color = mergedSegStyle.color || '#ffffff';
      const fontWeight = mergedSegStyle.fontWeight || 'normal';
      
      this.ctx.save();
      this.ctx.textAlign = 'left';
      this.ctx.textBaseline = 'middle';
      this.ctx.font = `${fontWeight} ${fontSize}px ${mergedSegStyle.fontFamily || 'monospace'}`;
      this.ctx.fillStyle = color;
      this.ctx.globalAlpha = progress;
      
      this.ctx.fillText(segment.text, currentX, centerY);
      this.ctx.restore();
      
      // 使用精确测量的宽度
      currentX += segmentWidths[i];
    }
  }

  /**
   * 弹入效果渲染
   */
  private renderBounceIn(line: ScriptLine, progress: number) {
    const mergedStyle = this.mergeLineStyles(line);
    const centerX = this.canvas.width / 2;
    const centerY = this.canvas.height / 2;
    
    // 弹入曲线：1 + 0.3*sin(progress * π * 4) * (1 - progress)
    const bounceScale = 1 + 0.3 * Math.sin(progress * Math.PI * 4) * (1 - progress);
    
    // 使用 measureText 精确测量每个 segment 的宽度
    let totalWidth = 0;
    const segmentWidths: number[] = [];
    
    for (const segment of line.segments) {
      const segStyle = segment.style || {};
      const mergedSegStyle = { ...mergedStyle, ...segStyle };
      const fontSizeStr = mergedSegStyle.fontSize || '96px';
      const baseFontSize = parseFloat(fontSizeStr);
      const fontWeight = mergedSegStyle.fontWeight || 'normal';
      const fontSize = baseFontSize * bounceScale;
      
      this.ctx.font = `${fontWeight} ${fontSize}px ${mergedSegStyle.fontFamily || 'monospace'}`;
      const metrics = this.ctx.measureText(segment.text);
      const segWidth = metrics.width;
      
      segmentWidths.push(segWidth);
      totalWidth += segWidth;
    }
    
    let currentX = centerX - totalWidth / 2;
    
    // 逐段绘制，应用缩放
    for (let i = 0; i < line.segments.length; i++) {
      const segment = line.segments[i];
      const segStyle = segment.style || {};
      const mergedSegStyle = { ...mergedStyle, ...segStyle };
      const fontSizeStr = mergedSegStyle.fontSize || '96px';
      const baseFontSize = parseFloat(fontSizeStr);
      const fontSize = baseFontSize * bounceScale;
      const color = mergedSegStyle.color || '#ffffff';
      const fontWeight = mergedSegStyle.fontWeight || 'normal';
      
      this.ctx.save();
      this.ctx.textAlign = 'left';
      this.ctx.textBaseline = 'middle';
      this.ctx.font = `${fontWeight} ${fontSize}px ${mergedSegStyle.fontFamily || 'monospace'}`;
      this.ctx.fillStyle = color;
      
      this.ctx.fillText(segment.text, currentX, centerY);
      this.ctx.restore();
      
      // 使用精确测量的宽度
      currentX += segmentWidths[i];
    }
  }

  /**
   * 旋转进入效果渲染
   */
  private renderRotateIn(line: ScriptLine, progress: number) {
    const mergedStyle = this.mergeLineStyles(line);
    const centerX = this.canvas.width / 2;
    const centerY = this.canvas.height / 2;
    
    // 旋转角度从 2π 到 0
    const angle = 2 * Math.PI * (1 - progress);
    // 透明度从 0 到 1
    const alpha = progress;
    
    // 使用 measureText 精确测量每个 segment 的宽度
    let totalWidth = 0;
    const segmentWidths: number[] = [];
    
    for (const segment of line.segments) {
      const segStyle = segment.style || {};
      const mergedSegStyle = { ...mergedStyle, ...segStyle };
      const fontSizeStr = mergedSegStyle.fontSize || '96px';
      const fontSize = parseFloat(fontSizeStr);
      const fontWeight = mergedSegStyle.fontWeight || 'normal';
      
      this.ctx.font = `${fontWeight} ${fontSize}px ${mergedSegStyle.fontFamily || 'monospace'}`;
      const metrics = this.ctx.measureText(segment.text);
      const segWidth = metrics.width;
      
      segmentWidths.push(segWidth);
      totalWidth += segWidth;
    }
    
    let currentX = centerX - totalWidth / 2;
    
    // 逐段绘制，应用旋转和透明度
    for (let i = 0; i < line.segments.length; i++) {
      const segment = line.segments[i];
      const segStyle = segment.style || {};
      const mergedSegStyle = { ...mergedStyle, ...segStyle };
      const fontSizeStr = mergedSegStyle.fontSize || '96px';
      const fontSize = parseFloat(fontSizeStr);
      const color = mergedSegStyle.color || '#ffffff';
      const fontWeight = mergedSegStyle.fontWeight || 'normal';
      
      this.ctx.save();
      this.ctx.translate(currentX + segmentWidths[i] / 2, centerY);
      this.ctx.rotate(angle);
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.font = `${fontWeight} ${fontSize}px ${mergedSegStyle.fontFamily || 'monospace'}`;
      this.ctx.fillStyle = color;
      this.ctx.globalAlpha = alpha;
      
      this.ctx.fillText(segment.text, 0, 0);
      this.ctx.restore();
      
      // 使用精确测量的宽度
      currentX += segmentWidths[i];
    }
  }

  /**
   * 缩放进入效果渲染
   */
  private renderScaleIn(line: ScriptLine, progress: number) {
    const mergedStyle = this.mergeLineStyles(line);
    const centerX = this.canvas.width / 2;
    const centerY = this.canvas.height / 2;
    
    // 缩放从 0 到 1
    const scale = progress;
    // 透明度从 0 到 1
    const alpha = progress;
    
    // 使用 measureText 精确测量每个 segment 的宽度
    let totalWidth = 0;
    const segmentWidths: number[] = [];
    
    for (const segment of line.segments) {
      const segStyle = segment.style || {};
      const mergedSegStyle = { ...mergedStyle, ...segStyle };
      const fontSizeStr = mergedSegStyle.fontSize || '96px';
      const baseFontSize = parseFloat(fontSizeStr);
      const fontWeight = mergedSegStyle.fontWeight || 'normal';
      const fontSize = baseFontSize * scale;
      
      this.ctx.font = `${fontWeight} ${fontSize}px ${mergedSegStyle.fontFamily || 'monospace'}`;
      const metrics = this.ctx.measureText(segment.text);
      const segWidth = metrics.width;
      
      segmentWidths.push(segWidth);
      totalWidth += segWidth;
    }
    
    let currentX = centerX - totalWidth / 2;
    
    // 逐段绘制，应用缩放和透明度
    for (let i = 0; i < line.segments.length; i++) {
      const segment = line.segments[i];
      const segStyle = segment.style || {};
      const mergedSegStyle = { ...mergedStyle, ...segStyle };
      const fontSizeStr = mergedSegStyle.fontSize || '96px';
      const baseFontSize = parseFloat(fontSizeStr);
      const fontSize = baseFontSize * scale;
      const color = mergedSegStyle.color || '#ffffff';
      const fontWeight = mergedSegStyle.fontWeight || 'normal';
      
      this.ctx.save();
      this.ctx.textAlign = 'left';
      this.ctx.textBaseline = 'middle';
      this.ctx.font = `${fontWeight} ${fontSize}px ${mergedSegStyle.fontFamily || 'monospace'}`;
      this.ctx.fillStyle = color;
      this.ctx.globalAlpha = alpha;
      
      this.ctx.fillText(segment.text, currentX, centerY);
      this.ctx.restore();
      
      // 使用精确测量的宽度
      currentX += segmentWidths[i];
    }
  }

  /**
   * 颜色波浪效果渲染
   */
  private renderColorWave(line: ScriptLine, progress: number) {
    const mergedStyle = this.mergeLineStyles(line);
    const centerX = this.canvas.width / 2;
    const centerY = this.canvas.height / 2;
    
    // 使用 measureText 精确测量每个字符的宽度
    let totalWidth = 0;
    const charWidths: number[][] = []; // 存储每个 segment 中每个字符的宽度
    
    for (const segment of line.segments) {
      const segStyle = segment.style || {};
      const mergedSegStyle = { ...mergedStyle, ...segStyle };
      const fontSizeStr = mergedSegStyle.fontSize || '96px';
      const fontSize = parseFloat(fontSizeStr);
      const fontWeight = mergedSegStyle.fontWeight || 'normal';
      
      this.ctx.font = `${fontWeight} ${fontSize}px ${mergedSegStyle.fontFamily || 'monospace'}`;
      
      const segmentCharWidths: number[] = [];
      for (let i = 0; i < segment.text.length; i++) {
        const char = segment.text[i];
        const metrics = this.ctx.measureText(char);
        segmentCharWidths.push(metrics.width);
        totalWidth += metrics.width;
      }
      charWidths.push(segmentCharWidths);
    }
    
    let currentX = centerX - totalWidth / 2;
    
    // 逐字符绘制，应用颜色波浪
    let charIndex = 0;
    const totalChars = line.segments.reduce((sum, seg) => sum + seg.text.length, 0);
    
    for (let segIdx = 0; segIdx < line.segments.length; segIdx++) {
      const segment = line.segments[segIdx];
      const segStyle = segment.style || {};
      const mergedSegStyle = { ...mergedStyle, ...segStyle };
      const fontSizeStr = mergedSegStyle.fontSize || '96px';
      const fontSize = parseFloat(fontSizeStr);
      const fontWeight = mergedSegStyle.fontWeight || 'normal';
      
      for (let i = 0; i < segment.text.length; i++) {
        const char = segment.text[i];
        const charProgress = charIndex / totalChars;
        
        // Hue 从 240（蓝）过渡到 0（红）
        const hue = 240 * (1 - charProgress);
        const color = `hsl(${hue}, 100%, 50%)`;
        
        // 透明度根据进度
        const alpha = Math.min(1, progress * 2 - charProgress);
        
        if (alpha > 0) {
          this.ctx.save();
          this.ctx.textAlign = 'left';
          this.ctx.textBaseline = 'middle';
          this.ctx.font = `${fontWeight} ${fontSize}px ${mergedSegStyle.fontFamily || 'monospace'}`;
          this.ctx.fillStyle = color;
          this.ctx.globalAlpha = alpha;
          
          this.ctx.fillText(char, currentX, centerY);
          this.ctx.restore();
        }
        
        // 使用精确测量的字符宽度
        currentX += charWidths[segIdx][i];
        charIndex++;
      }
    }
  }
}