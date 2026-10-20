import { v4 as uuidv4 } from 'uuid';
import type { Script, ScriptLine, TextSegment } from '@/types/script';
import { normalizeTag, normalizeAttrKey, normalizeAttrValue } from '@/lib/tagDictionary';

type EffectType = ScriptLine['effect'];

/**
 * 默认全局样式
 */
const DEFAULT_GLOBAL_STYLE: Record<string, string> = {
  color: '#ffffff',
  fontSize: '48px',
  fontFamily: 'monospace'
};

/**
 * 颜色名称映射表
 */
const COLOR_MAP: Record<string, string> = {
  '红': '#ff0000',
  '红色': '#ff0000',
  '绿': '#00ff00',
  '绿色': '#00ff00',
  '蓝': '#0000ff',
  '蓝色': '#0000ff',
  '白': '#ffffff',
  '白色': '#ffffff',
  '黑': '#000000',
  '黑色': '#000000',
  '黄': '#ffff00',
  '黄色': '#ffff00',
};

/**
 * 字号映射表
 */
const SIZE_MAP: Record<string, string> = {
  '大': '48px',
  '中': '32px',
  '小': '24px',
};

/**
 * 解析属性字符串（支持中英文符号）
 * @param attrStr - 属性字符串，格式为 key=value;key1=value1
 * @returns 解析后的属性对象
 */
function parseAttributes(attrStr: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  // 支持中英文分号、逗号作为分隔符
  const pairs = attrStr.split(/[;；,，]/).filter(p => p.trim());
  
  pairs.forEach(pair => {
    // 支持等号、中文等号、冒号、中文冒号作为键值分隔符
    // 键：不包含等号、冒号的字符
    // 值：可以包含任意字符（包括空格、等号、冒号），直到行尾
    const match = pair.match(/^\s*([^=:：]+?)\s*[=:：]\s*(.+)$/);
    if (match) {
      const rawKey = match[1].trim();
      let rawValue = match[2].trim();
      
      // 移除值末尾可能的分号（如果 split 没有完全分割）
      rawValue = rawValue.replace(/[;；]\s*$/, '');
      
      const cleanKey = rawKey.toLowerCase();
      
      // 处理颜色
      if (cleanKey === '颜色' || cleanKey === 'color') {
        attrs['color'] = COLOR_MAP[rawValue] || rawValue;
      }
      // 处理大小
      else if (cleanKey === '大小' || cleanKey === 'size' || cleanKey === 'fontsize') {
        attrs['fontSize'] = SIZE_MAP[rawValue] || rawValue;
      }
      // 处理时间
      else if (cleanKey === '时间' || cleanKey === 'duration') {
        attrs['duration'] = rawValue;
      }
      // 处理旋转
      else if (cleanKey === '旋转' || cleanKey === 'rotate') {
        attrs['rotate'] = rawValue;
      }
      // 处理动画效果
      else if (cleanKey === '动画' || cleanKey === 'animation' || cleanKey === 'effect') {
        // 使用 normalizeAttrValue 转换中文值为英文
        let normalizedEffect = normalizeAttrValue('effect', rawValue);
        
        // 补充逻辑：如果 normalizeAttrValue 未处理，手动映射常见中文值
        if (!normalizedEffect || normalizedEffect === rawValue) {
          const effectLower = rawValue.toLowerCase();
          const effectMap: Record<string, string> = {
            '淡入': 'fadeIn',
            '弹入': 'bounceIn',
            '旋转进入': 'rotateIn',
            '缩放进入': 'scaleIn',
            '颜色波浪': 'colorWave',
            'fadein': 'fadeIn',
            'bouncein': 'bounceIn',
            'rotatein': 'rotateIn',
            'scalein': 'scaleIn',
            'colorwave': 'colorWave',
          };
          normalizedEffect = effectMap[effectLower] || rawValue;
        }
        
        attrs['effect'] = normalizedEffect;
      }
      // 处理飞出方向
      else if (cleanKey === '飞出方向' || cleanKey === 'flydirection') {
        const normalizedValue = rawValue.toLowerCase();
        if (['left', 'up', 'topleft'].includes(normalizedValue)) {
          attrs['flyDirection'] = normalizedValue;
        } else {
          attrs['flyDirection'] = 'left'; // 默认值
        }
      }
      // 处理飞出时长
      else if (cleanKey === '飞出时长' || cleanKey === 'flyduration') {
        const durationValue = parseFloat(rawValue);
        if (!isNaN(durationValue) && durationValue > 0) {
          attrs['flyDuration'] = durationValue.toString();
        } else {
          attrs['flyDuration'] = '5'; // 默认值
        }
      }
      // 处理最大可见数
      else if (cleanKey === '最大可见数' || cleanKey === 'maxvisible') {
        const visibleValue = parseInt(rawValue, 10);
        if (!isNaN(visibleValue) && visibleValue > 0) {
          attrs['maxVisible'] = visibleValue.toString();
        } else {
          attrs['maxVisible'] = '2'; // 默认值
        }
      }
      // 处理倍速
      else if (cleanKey === '倍速' || cleanKey === 'speed') {
        const speedValue = parseFloat(rawValue);
        if (!isNaN(speedValue) && speedValue > 0) {
          attrs['speed'] = rawValue;
        } else {
          attrs['speed'] = '1'; // 默认值
        }
      }
      // 处理命名样式名称（特殊处理：只提取首个有效 token）
      else if (cleanKey === 'name' || cleanKey === '名称') {
        const nameMatch = rawValue.match(/^\s*([^\s=:：;；]+)/);
        if (nameMatch) {
          attrs['name'] = nameMatch[1];
        } else {
          attrs['name'] = rawValue;
        }
      }
      // 处理模式（mode）属性，用于设置 effect
      else if (cleanKey === 'mode' || cleanKey === '模式') {
        // 使用 normalizeAttrValue 转换中文值为英文
        let normalizedMode = normalizeAttrValue('mode', rawValue);
        
        // 补充逻辑：如果 normalizeAttrValue 未处理，手动映射常见中文值
        if (!normalizedMode || normalizedMode === rawValue) {
          const modeLower = rawValue.toLowerCase();
          const modeMap: Record<string, string> = {
            '基础模式': 'centerTypewriter',
            '居中打字机': 'centerTypewriter',
            '高级模式': 'jumpScale',
            '大小跳跃': 'jumpScale',
            '淡入': 'fadeIn',
            '弹入': 'bounceIn',
            '旋转进入': 'rotateIn',
            '缩放进入': 'scaleIn',
            '颜色波浪': 'colorWave',
            'centertypewriter': 'centerTypewriter',
            'jumpscale': 'jumpScale',
            'fadein': 'fadeIn',
            'bouncein': 'bounceIn',
            'rotatein': 'rotateIn',
            'scalein': 'scaleIn',
            'colorwave': 'colorWave',
          };
          normalizedMode = modeMap[modeLower] || rawValue;
        }
        
        attrs['mode'] = normalizedMode;
      }
      // 其他样式直接存储
      else {
        attrs[cleanKey] = rawValue;
      }
    }
  });
  
  return attrs;
}

/**
 * 合并样式对象（后者覆盖前者）
 */
function mergeStyles(base: Record<string, string>, override: Record<string, string>): Record<string, string> {
  return { ...base, ...override };
}

/**
 * 预处理标签字符串，将中文标签和属性转换为英文
 * @param tagContent - 标签内容（不含方括号）
 * @returns 转换后的标准英文标签串
 */
function preprocessTag(tagContent: string): string {
  // 匹配标签名和属性部分
  // 格式：tagName key1=value1; key2=value2
  const match = tagContent.match(/^\s*([^\s]+?)\s+(.+)$/);
  
  if (!match) {
    // 没有属性，只处理标签名
    const tagName = tagContent.trim();
    return normalizeTag(tagName);
  }
  
  const rawTagName = match[1];
  const attrsPart = match[2];
  
  // 转换标签名
  const normalizedTagName = normalizeTag(rawTagName);
  
  // 转换属性部分（支持分号、逗号分隔，等号、冒号赋值）
  const normalizedAttrs = attrsPart.replace(
    /([^=:：,，]+?)\s*[=:：]\s*([^;；,，]*)/g,
    (_, rawKey, rawValue) => {
      const enKey = normalizeAttrKey(rawKey.trim());
      const enValue = normalizeAttrValue(enKey, rawValue.trim());
      return `${enKey}=${enValue}`;
    }
  );
  
  return `${normalizedTagName} ${normalizedAttrs}`;
}

/**
 * 解析单行文本为 TextSegment 数组（增强版，支持命名样式）
 * @param lineText - 一行文本内容（已去除 row-style 标签）
 * @param rowStyle - 行基础样式
 * @param globalStyle - 全局样式
 * @param namedStyles - 命名样式 Map
 * @returns TextSegment 数组及行级属性（duration、animation）
 */
function parseLineSegments(
  lineText: string,
  rowStyle: Record<string, string>,
  globalStyle: Record<string, string>,
  namedStyles?: Map<string, Record<string, string>>
): { segments: TextSegment[]; duration?: number; animation?: string } {
  const segments: TextSegment[] = [];
  let remainingText = lineText;
  let lineDuration: number | undefined;
  let lineAnimation: string | undefined;
  
  // 正则匹配 [style 属性列表]文本[/style]
  const styleTagRegex = /\[style\s+(.*?)\](.*?)\[\/style\]/i;
  
  while (remainingText.length > 0) {
    const match = remainingText.match(styleTagRegex);
    
    if (!match) {
      // 没有更多 style 标签，剩余文本作为普通片段
      if (remainingText.trim()) {
        // 修复 4：确保样式合并顺序正确：全局样式 < 行样式
        const baseStyle = mergeStyles(globalStyle, rowStyle);
        segments.push({
          text: remainingText,
          style: Object.keys(baseStyle).length > 0 ? baseStyle : undefined
        });
      }
      break;
    }
    
    const matchStart = match.index!;
    const matchEnd = matchStart + match[0].length;
    
    // 提取标签前的普通文本
    if (matchStart > 0) {
      const beforeText = remainingText.substring(0, matchStart);
      if (beforeText.trim()) {
        // 修复 4：普通文本也使用正确的样式优先级
        const baseStyle = mergeStyles(globalStyle, rowStyle);
        segments.push({
          text: beforeText,
          style: Object.keys(baseStyle).length > 0 ? baseStyle : undefined
        });
      }
    }
    
    // 修复 1：每次循环都重新解析属性，防止片段样式相互污染
    const attrStr = match[1];
    const tagText = match[2];
    
    // 重新调用 parseAttributes 得到当前标签的属性
    const currentAttrs = parseAttributes(attrStr);
    
    // 提取 duration 和 animation
    if (currentAttrs.duration && lineDuration === undefined) {
      const durationMatch = currentAttrs.duration.match(/(\d+(?:\.\d+)?)\s*s?/i);
      if (durationMatch) {
        lineDuration = parseFloat(durationMatch[1]);
      }
    }
    
    if (currentAttrs.animation && !lineAnimation) {
      lineAnimation = currentAttrs.animation;
    }
    
    // 修复 3：处理命名样式合并
    let finalSegmentStyle: Record<string, string> = {};
    
    if (currentAttrs.name && namedStyles) {
      const styleName = currentAttrs.name.toLowerCase();
      const namedStyle = namedStyles.get(styleName);
      
      if (namedStyle) {
        // 从 namedStyles 取出对应样式作为基础
        finalSegmentStyle = { ...namedStyle };
        
        // 用当前 props（除去 name）覆盖
        const { name, ...overrideProps } = currentAttrs;
        finalSegmentStyle = mergeStyles(finalSegmentStyle, overrideProps);
      } else {
        // 未找到命名样式，给出警告但继续处理
        if (process.env.NODE_ENV === 'development') {
          console.warn(`[ScriptParser] 未找到命名样式: "${styleName}"，请确保已使用 [def-style name=${styleName} ...] 定义`);
        }
        // 保留除 name 外的其他属性
        const { name, ...otherProps } = currentAttrs;
        finalSegmentStyle = otherProps;
      }
    } else {
      // 没有 name 属性，直接使用当前属性
      finalSegmentStyle = { ...currentAttrs };
    }
    
    // 修复 4：确保样式合并顺序：全局样式 < 行样式 < 片段样式
    const baseStyle = mergeStyles(globalStyle, rowStyle);
    const mergedStyle = mergeStyles(baseStyle, finalSegmentStyle);
    
    segments.push({
      text: tagText,
      style: Object.keys(mergedStyle).length > 0 ? mergedStyle : undefined
    });
    
    // 继续处理剩余文本
    remainingText = remainingText.substring(matchEnd);
  }
  
  return { segments, duration: lineDuration, animation: lineAnimation };
}

/**
 * 将文本解析为脚本对象（高级版，基于标签的样式体系）
 * @param text - 输入的文本内容
 * @param defaultEffect - 默认动画效果（undefined 时使用 centerTypewriter）
 * @returns 解析后的 Script 对象
 */
export function parseTextToScriptAdvanced(text: string, defaultEffect?: string): Script {
  // 按换行符分割文本
  const lines = text.split('\n');
  
  // 命名样式 Map（不区分大小写）
  const namedStyles = new Map<string, Record<string, string>>();
  
  // 默认动画效果（可被 clear-style 重置）
  let effect: 'centerTypewriter' | 'jumpScale' | 'fadeIn' | 'bounceIn' | 'rotateIn' | 'scaleIn' | 'colorWave' = 'centerTypewriter';
  
  // 全局样式
  const globalStyle = { ...DEFAULT_GLOBAL_STYLE };
  
  // 生成 ScriptLine 数组
  const scriptLines: ScriptLine[] = [];
  
  // 用于累积 section 的暂停时间
  let pendingPause = 0;
  
  for (const line of lines) {
    const trimmedLine = line.trim();
    
    // 跳过空行
    if (!trimmedLine) {
      continue;
    }
    
    // 预处理：将中文方括号转换为英文方括号
    const normalizedBrackets = trimmedLine.replace(/【/g, '[').replace(/】/g, ']');
    
    // 提取所有方括号内的内容并转换
    const processedLine = normalizedBrackets.replace(
      /\[([^\]]+)\]/g,
      (_, content) => {
        // 检查是否为闭合标签 [/xxx]
        if (content.startsWith('/')) {
          // 提取闭合标签名并转换
          const closeTagName = content.substring(1).trim();
          const normalizedCloseTag = normalizeTag(closeTagName);
          return `[/${normalizedCloseTag}]`;
        }
        // 预处理标签内容
        const normalized = preprocessTag(content);
        return `[${normalized}]`;
      }
    );
    
    // 1. 检查是否为 [global-style ...] 单行标签（支持中英文符号）
    const globalStyleMatch = processedLine.match(/^\[global-style\s+(.*?)\]$/i);
    if (globalStyleMatch) {
      const attrs = parseAttributes(globalStyleMatch[1]);
      
      // 提取 mode 属性用于设置 effect
      const modeValue = attrs.mode;
      delete attrs.mode; // 从样式中移除 mode，避免污染 globalStyle
      
      // 如果 mode 有效，更新 effect（支持所有效果类型）
      if (modeValue) {
        const validEffects: Array<'centerTypewriter' | 'jumpScale' | 'fadeIn' | 'bounceIn' | 'rotateIn' | 'scaleIn' | 'colorWave'> = 
          ['centerTypewriter', 'jumpScale', 'fadeIn', 'bounceIn', 'rotateIn', 'scaleIn', 'colorWave'];
        if (validEffects.includes(modeValue as EffectType)) {
          effect = modeValue as EffectType;
        }
      }
      
      // 合并到全局样式（排除 effect 键）
      const { effect: effectAttr, ...styleProps } = attrs;
      Object.assign(globalStyle, styleProps);
      
      // 检查 effect 键设置动画效果（向后兼容）
      if (effectAttr) {
        const newEffect = effectAttr as 'centerTypewriter' | 'jumpScale';
        // 验证是否为合法的效果类型
        const validEffects: Array<'centerTypewriter' | 'jumpScale'> = ['centerTypewriter', 'jumpScale'];
        if (validEffects.includes(newEffect)) {
          effect = newEffect;
        } else {
          console.warn(`[ScriptParser] 无效的动画效果: "${newEffect}"`);
        }
      }
      
      // 该行不生成 ScriptLine
      continue;
    }
    
    // 2. 检查是否为命名样式定义标签 [def-style name=样式名 其他属性...]
    const defStyleMatch = processedLine.match(/^\[def-style\s+(.*?)\]$/i);
    if (defStyleMatch) {
      const attrs = parseAttributes(defStyleMatch[1]);
      const styleName = attrs.name?.toLowerCase();
      
      if (styleName) {
        const { name, ...styleProps } = attrs;
        namedStyles.set(styleName, styleProps);
      }
      // 命名样式定义行不产生 ScriptLine
      continue;
    }
    
    // 3. 检查是否为时长标注行 [section ...]（提取 duration 并累加到 pendingPause）
    const sectionMatch = processedLine.match(/^\[section\s+(.*?)\]$/i);
    if (sectionMatch) {
      const attrs = parseAttributes(sectionMatch[1]);
      // 提取 duration 属性
      if (attrs.duration) {
        const durationMatch = attrs.duration.match(/(\d+(?:\.\d+)?)\s*s?/i);
        if (durationMatch) {
          const pauseSeconds = parseFloat(durationMatch[1]);
          pendingPause += pauseSeconds;
        }
      }
      // 直接跳过，不生成 ScriptLine
      continue;
    }
    
    // 4. 检查是否为清除样式标签 [clear-style]（重置全局样式为默认值）
    const clearStyleMatch = processedLine.match(/^\[clear-style\]$/i);
    if (clearStyleMatch) {
      // 重置全局样式为默认值
      Object.keys(globalStyle).forEach(key => delete globalStyle[key]);
      Object.assign(globalStyle, DEFAULT_GLOBAL_STYLE);
      // 清空命名样式
      namedStyles.clear();
      // 重置动画效果为默认值
      effect = 'centerTypewriter';
      // 该行不生成 ScriptLine
      continue;
    }
    
    // 检查行首是否有 row-style 标签
    let rowStyle: Record<string, string> = {};
    let lineContent = processedLine;
    
    const rowStyleMatch = processedLine.match(/^\[row-style\s+(.*?)\](.*)$/i);
    if (rowStyleMatch) {
      rowStyle = parseAttributes(rowStyleMatch[1]);
      lineContent = rowStyleMatch[2].trim();
    }
    
    // 如果行内容为空，跳过
    if (!lineContent) {
      continue;
    }
    
    // 解析行内的 segments（传递 namedStyles 用于命名样式查找）
    const { segments, duration: lineDuration, animation: lineAnimation } = parseLineSegments(
      lineContent,
      rowStyle,
      globalStyle,
      namedStyles
    );
    
    // 如果没有任何 segment，跳过
    if (segments.length === 0) {
      continue;
    }
    
    // 检查行内是否有 effect 属性（从 segments 中提取）
    let lineEffect = effect; // 默认使用全局 effect
    for (const seg of segments) {
      if (seg.style && seg.style.effect) {
        const segEffect = seg.style.effect as 'centerTypewriter' | 'jumpScale' | 'fadeIn' | 'bounceIn' | 'rotateIn' | 'scaleIn' | 'colorWave';
        const validEffects: Array<'centerTypewriter' | 'jumpScale' | 'fadeIn' | 'bounceIn' | 'rotateIn' | 'scaleIn' | 'colorWave'> = 
          ['centerTypewriter', 'jumpScale', 'fadeIn', 'bounceIn', 'rotateIn', 'scaleIn', 'colorWave'];
        if (validEffects.includes(segEffect)) {
          lineEffect = segEffect;
          break; // 使用第一个有效的 effect
        }
      }
    }
    
    // 检查 rowStyle 中是否有 effect
    if (rowStyle.effect) {
      const rowEffect = rowStyle.effect as 'centerTypewriter' | 'jumpScale' | 'fadeIn' | 'bounceIn' | 'rotateIn' | 'scaleIn' | 'colorWave';
      const validEffects: Array<'centerTypewriter' | 'jumpScale' | 'fadeIn' | 'bounceIn' | 'rotateIn' | 'scaleIn' | 'colorWave'> = 
        ['centerTypewriter', 'jumpScale', 'fadeIn', 'bounceIn', 'rotateIn', 'scaleIn', 'colorWave'];
      if (validEffects.includes(rowEffect)) {
        lineEffect = rowEffect;
      }
    }
    
    // 计算持续时间
    let duration: number;
    if (lineDuration !== undefined) {
      // 用户指定的时间 + 根据字数计算的停顿（最多1秒）+ pendingPause
      const totalLength = segments.reduce((sum, seg) => sum + seg.text.length, 0);
      const pauseTime = Math.min(1.0, totalLength * 0.05); // 每字0.05秒，最多1秒
      duration = lineDuration + pauseTime + pendingPause;
      // 清零 pendingPause
      pendingPause = 0;
    } else {
      // 根据文本总长度计算 + 根据字数计算的停顿（最多1秒）+ pendingPause
      const totalLength = segments.reduce((sum, seg) => sum + seg.text.length, 0);
      const displayTime = Math.max(1, totalLength * 0.08);
      const pauseTime = Math.min(1.0, totalLength * 0.05); // 每字0.05秒，最多1秒
      duration = displayTime + pauseTime + pendingPause;
      // 清零 pendingPause
      pendingPause = 0;
    }
    
    scriptLines.push({
      id: uuidv4(),
      segments,
      effect: lineEffect,
      duration,
      animation: lineAnimation
    });
  }
  
  // 返回完整的 Script 对象（不再进行静态拆分，交给渲染器动态处理）
  return {
    lines: scriptLines,
    background: '#000000',
    resolution: {
      width: 1920,
      height: 1080
    },
    frameRate: 30,
    globalStyle
  };
}

/**
 * 将文本解析为脚本对象（基础版，调用高级版）
 * @param text - 输入的文本内容
 * @returns 解析后的 Script 对象
 */
export function parseTextToScript(text: string): Script {
  return parseTextToScriptAdvanced(text, undefined);
}
