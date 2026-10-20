/**
 * 标签中英文双语词典
 * 提供标签名、属性键和常见值的中英文映射
 */

/**
 * 标签和属性的中英文映射（英文 -> 中文）
 */
export const TAG_DICT: Record<string, string> = {
  // 标签名
  'style': '样式',
  'def-style': '定义样式',
  'row-style': '行样式',
  'global-style': '全局样式',
  'clear-style': '清除样式',
  'section': '分节',
  
  // 属性键
  'effect': '效果',
  'mode': '模式',
  'color': '颜色',
  'fontSize': '字号',
  'size': '大小',
  'time': '时间',
  'duration': '时长',
  'name': '名称',
  'text': '文本',
  'fontWeight': '字重',
  'transform': '变换',
  'opacity': '透明度',
  'background': '背景',
  'rotate': '旋转',
  'animation': '动画',
  'layout': '布局',
  'speed': '倍速',
  'jumpScale': '大小跳跃',
  'centerTypewriter': '居中打字机',
  'fadeIn': '淡入',
  'bounceIn': '弹入',
  'rotateIn': '旋转进入',
  'scaleIn': '缩放进入',
  'colorWave': '颜色波浪',
};

/**
 * 反向映射（中文 -> 英文）
 */
export const TAG_DICT_EN: Record<string, string> = Object.fromEntries(
  Object.entries(TAG_DICT).map(([en, cn]) => [cn, en])
);

/**
 * 常见中文值映射
 */
const VALUE_MAP: Record<string, Record<string, string>> = {
  color: {
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
  },
  fontSize: {
    '大': '48px',
    '中': '32px',
    '小': '24px',
  },
  size: {
    '大': '48px',
    '中': '32px',
    '小': '24px',
  },
  mode: {
    '大小跳跃': 'jumpScale',
    '居中打字机': 'centerTypewriter',
  },
};

/**
 * 将中文或中英混合标签名转为英文名
 * @param tag - 标签名
 * @returns 英文标签名，如果找不到映射则返回原值
 */
export function normalizeTag(tag: string): string {
  const trimmed = tag.trim();
  // 先尝试直接匹配英文
  if (TAG_DICT[trimmed.toLowerCase()]) {
    return trimmed.toLowerCase();
  }
  // 再尝试匹配中文
  const enTag = TAG_DICT_EN[trimmed];
  if (enTag) {
    return enTag;
  }
  // 返回原值（保持兼容性）
  return trimmed;
}

/**
 * 将中文属性键转为英文键
 * @param key - 属性键
 * @returns 英文属性键，如果找不到映射则返回原值的小写形式
 */
export function normalizeAttrKey(key: string): string {
  const trimmed = key.trim();
  const lowerCase = trimmed.toLowerCase();
  
  // 先尝试直接匹配英文（检查是否在 TAG_DICT 的键中）
  if (TAG_DICT[lowerCase]) {
    return lowerCase;
  }
  
  // 再尝试匹配中文（使用原始输入，不转小写）
  const enKey = TAG_DICT_EN[trimmed];
  if (enKey) {
    return enKey;
  }
  
  // 返回原值的小写形式
  return lowerCase;
}

/**
 * 处理常见中文值转换
 * @param key - 属性键（英文）
 * @param value - 属性值
 * @returns 转换后的值，如果没有映射则返回原值
 */
export function normalizeAttrValue(key: string, value: string): string {
  const trimmed = value.trim();
  const normalizedKey = key.toLowerCase();
  
  // 查找对应的值映射表
  const map = VALUE_MAP[normalizedKey];
  if (map && map[trimmed]) {
    return map[trimmed];
  }
  
  // 没有映射，返回原值
  return trimmed;
}
