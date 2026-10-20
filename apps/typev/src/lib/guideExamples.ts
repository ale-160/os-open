/**
 * 样式指南示例脚本
 * 每个分类对应一个示例脚本，用于实时预览
 */

export interface GuideExample {
  categoryId: string;
  script: string;
  scriptZh?: string;
  description: string;
}

export const GUIDE_EXAMPLES: Record<string, GuideExample> = {
  // 入门修炼 - 基础样式标签
  'style-tag': {
    categoryId: 'basic',
    script: `[global-style mode=centerTypewriter; color=#ffffff; fontSize=32px]
[style color=#ff0000; fontSize=48px]红色大字[/style] [style color=#ffffff; fontSize=32px]普通文字[/style] [style color=#00ff00; fontSize=32px]绿色文字[/style]`,
    scriptZh: `【全局样式 模式：居中打字机，颜色：#ffffff，字号：32px】
【样式 颜色：#ff0000，字号：48px】红色大字【/样式】 【样式 颜色：#ffffff，字号：32px】普通文字【/样式】 【样式 颜色：#00ff00，字号：32px】绿色文字【/样式】`,
    description: '使用 style 标签为不同片段设置颜色和字号'
  },
  
  // 行样式
  'row-style': {
    categoryId: 'basic',
    script: `[global-style mode=centerTypewriter; color=#ffffff; fontSize=32px]
[row-style color=#00ff00]整行显示绿色
[row-style color=#ffff00]整行显示黄色`,
    scriptZh: `【全局样式 模式：居中打字机，颜色：#ffffff，字号：32px】
【行样式 颜色：#00ff00】整行显示绿色
【行样式 颜色：#ffff00】整行显示黄色`,
    description: '使用 row-style 为整行设置基础样式'
  },
  
  // 全局样式
  'global-style': {
    categoryId: 'basic',
    script: `[global-style mode=centerTypewriter; color=#00ffff; fontSize=36px]
第一行青色
第二行也是青色
第三行继续青色`,
    scriptZh: `【全局样式 模式：居中打字机，颜色：#00ffff，字号：36px】
第一行青色
第二行也是青色
第三行继续青色`,
    description: '使用 global-style 设置全局默认样式'
  },
  
  // 定义样式
  'def-style': {
    categoryId: 'basic',
    script: `[global-style mode=centerTypewriter]
[def-style name=highlight; color=#ffff00; fontSize=40px]
[def-style name=normal; color=#ffffff; fontSize=32px]
[style name=highlight]高亮文本[/style]
[style name=normal]普通文本[/style]
[style name=highlight]再次高亮[/style]`,
    scriptZh: `【全局样式 模式：居中打字机】
【定义样式 名称：highlight，颜色：#ffff00，字号：40px】
【定义样式 名称：normal，颜色：#ffffff，字号：32px】
【样式 名称：highlight】高亮文本【/样式】
【样式 名称：normal】普通文本【/样式】
【样式 名称：highlight】再次高亮【/样式】`,
    description: '使用 def-style 定义命名样式，通过 name 引用'
  },
  
  // 清除样式
  'clear-style': {
    categoryId: 'basic',
    script: `[global-style mode=centerTypewriter; color=#ff0000; fontSize=48px]
第一段红色大字
[clear-style]
第二段恢复默认白色`,
    scriptZh: `【全局样式 模式：居中打字机，颜色：#ff0000，字号：48px】
第一段红色大字
[清除样式]
第二段恢复默认白色`,
    description: '使用 clear-style 重置所有样式为默认值'
  },
  
  // 分节标记
  'section': {
    categoryId: 'advanced',
    script: `[global-style mode=centerTypewriter; color=#ffffff; fontSize=32px]
[section duration=3s]
第一节内容
[section duration=5s]
第二节内容时间更长`,
    scriptZh: `【全局样式 模式：居中打字机，颜色：#ffffff，字号：32px】
【分节 时长：3s】
第一节内容
[分节 时长：5s】
第二节内容时间更长`,
    description: '使用 section 标记章节和时长（不显示，仅标注）'
  },
  
  // 倍速控制
  'speed-control': {
    categoryId: 'advanced',
    script: `[global-style mode=centerTypewriter; color=#ffffff; fontSize=48px; speed=0.5]
Speed control demo text`,
    scriptZh: `【全局样式 模式：居中打字机，颜色：#ffffff，字号：48px，倍速：0.5】
倍速演示文字`,
    description: '使用 speed 属性控制整体播放速度，默认值为1.0'
  },
  
  // 时间控制
  'time-control': {
    categoryId: 'advanced',
    script: `[global-style mode=centerTypewriter; color=#ffffff; fontSize=32px]
[style duration=2s]这段显示２秒[/style]
[style duration=4s]这段显示４秒[/style]`,
    scriptZh: `【全局样式 模式：居中打字机，颜色：#ffffff，字号：32px】
【样式 时长：2s】这段显示２秒【/样式】
【样式 时长：4s】这段显示４秒【/样式】`,
    description: '使用 duration 属性控制文本显示时长'
  },
  
  // 基础模式
  'centerTypewriter-basic': {
    categoryId: 'advanced',
    script: `[global-style mode=centerTypewriter; color=#ffffff; fontSize=36px]
第一行普通白色文字
[style color=#00ff00; fontSize=48px]第二行绿色大字[/style]
[style color=#ff0000; fontSize=24px]第三行红色小字[/style]
[style color=#ffff00; fontSize=40px; fontWeight=bold]第四行黄色粗体[/style]
[style color=#00ffff; fontSize=32px; opacity=0.6]第五行青色半透明[/style]`,
    scriptZh: `【全局样式 模式：居中打字机，颜色：#ffffff，字号：36px】
第一行普通白色文字
【样式 颜色：#00ff00，字号：48px】第二行绿色大字【/样式】
【样式 颜色：#ff0000，字号：24px】第三行红色小字【/样式】
【样式 颜色：#ffff00，字号：40px，字重：bold】第四行黄色粗体【/样式】
【样式 颜色：#00ffff，字号：32px，透明度：0.6】第五行青色半透明【/样式】`,
    description: '使用 centerTypewriter 模式展示多种字号、颜色、字重和透明度的组合效果'
  },
  
  // 淡入效果
  'fadeIn-basic': {
    categoryId: 'advanced',
    script: `[global-style mode=centerTypewriter; color=#ffffff; fontSize=48px]
[style effect=fadeIn]淡入效果演示文字[/style]`,
    scriptZh: `【全局样式 模式：居中打字机，颜色：#ffffff，字号：48px】
【样式 效果：淡入】淡入效果演示文字【/样式】`,
    description: '文字从透明逐渐显现的淡入效果'
  },
  
  // 弹入效果
  'bounceIn-basic': {
    categoryId: 'advanced',
    script: `[global-style mode=centerTypewriter; color=#ffffff; fontSize=48px]
[style effect=bounceIn]弹入效果演示文字[/style]`,
    scriptZh: `【全局样式 模式：居中打字机，颜色：#ffffff，字号：48px】
【样式 效果：弹入】弹入效果演示文字【/样式】`,
    description: '文字带有弹性缩放效果的弹入动画'
  },
  
  // 旋转进入效果
  'rotateIn-basic': {
    categoryId: 'advanced',
    script: `[global-style mode=centerTypewriter; color=#ffffff; fontSize=48px]
[style effect=rotateIn]旋转进入效果演示文字[/style]`,
    scriptZh: `【全局样式 模式：居中打字机，颜色：#ffffff，字号：48px】
【样式 效果：旋转进入】旋转进入效果演示文字【/样式】`,
    description: '文字从旋转状态逐渐摆正的进入效果'
  },
  
  // 缩放进入效果
  'scaleIn-basic': {
    categoryId: 'advanced',
    script: `[global-style mode=centerTypewriter; color=#ffffff; fontSize=48px]
[style effect=scaleIn]缩放进入效果演示文字[/style]`,
    scriptZh: `【全局样式 模式：居中打字机，颜色：#ffffff，字号：48px】
【样式 效果：缩放进入】缩放进入效果演示文字【/样式】`,
    description: '文字从小变大逐渐放大的进入效果'
  },
  
  // 颜色波浪效果
  'colorWave-basic': {
    categoryId: 'advanced',
    script: `[global-style mode=centerTypewriter; fontSize=48px]
[style effect=colorWave]颜色波浪效果演示文字[/style]`,
    scriptZh: `【全局样式 模式：居中打字机，字号：48px】
【样式 效果：颜色波浪】颜色波浪效果演示文字【/样式】`,
    description: '文字呈现彩虹色波浪渐变的视觉效果'
  },
  
  // 高级模式
  'jumpScale-advanced': {
    categoryId: 'advanced',
    script: `[global-style mode=jumpScale; color=#ffffff; fontSize=36px; flyDirection=left; flyDuration=5s; maxVisible=2]
跳跃式缩放效果展示
文字逐个从左侧飞出
最大可见数为2个`,
    scriptZh: `【全局样式 模式：大小跳跃，颜色：#ffffff，字号：36px，飞出方向：left，飞出时长：5s，最大可见数：2】
跳跃式缩放效果展示
文字逐个从左侧飞出
最大可见数为2个`,
    description: '使用 jumpScale 模式实现高级的跳跃式缩放效果'
  },
  
  // 颜色与字号
  'color-size': {
    categoryId: 'advanced',
    script: `[global-style mode=centerTypewriter]
[style color=#ff0000; fontSize=48px]大红字[/style]
[style color=#00ff00; fontSize=32px]中绿字[/style]
[style color=#0000ff; fontSize=24px]小蓝字[/style]`,
    scriptZh: `【全局样式 模式：居中打字机】
【样式 颜色：#ff0000，字号：48px】大红字【/样式】
【样式 颜色：#00ff00，字号：32px】中绿字【/样式】
【样式 颜色：#0000ff，字号：24px】小蓝字【/样式】`,
    description: '组合使用颜色和字号属性'
  },
  
  // 字体粗细与透明度
  'font-opacity': {
    categoryId: 'advanced',
    script: `[global-style mode=centerTypewriter; color=#ffffff; fontSize=36px]
[style fontWeight=normal]正常字体文字[/style]
[style fontWeight=bold]加粗字体文字[/style]
[style opacity=0.5]半透明文字展示[/style]
[style fontWeight=bold; opacity=0.7]粗体半透明文字[/style]`,
    scriptZh: `【全局样式 模式：居中打字机，颜色：#ffffff，字号：36px】
【样式 字重：normal】正常字体文字【/样式】
【样式 字重：bold】加粗字体文字【/样式】
【样式 透明度：0.5】半透明文字展示【/样式】
【样式 字重：bold，透明度：0.7】粗体半透明文字【/样式】`,
    description: '使用 fontWeight 和 opacity 属性控制字体样式'
  },
  
  // 变换与旋转
  'transform-rotate': {
    categoryId: 'advanced',
    script: `[global-style mode=centerTypewriter; color=#ffffff; fontSize=36px]
[style rotate=45deg]旋转45度[/style]
[style transform=scale(1.5)]放大1.5倍[/style]`,
    scriptZh: `【全局样式 模式：居中打字机，颜色：#ffffff，字号：36px】
【样式 旋转：45deg】旋转45度【/样式】
【样式 变换：scale(1.5)】放大1.5倍【/样式】`,
    description: '使用 rotate 和 transform 属性进行变换'
  },
  
  // 样式继承
  'inheritance': {
    categoryId: 'advanced',
    script: `[global-style mode=centerTypewriter; color=#ffffff; fontSize=32px]
[row-style color=#00ff00]
绿色行中的 [style color=#ff0000]红色片段[/style]
普通行中的 [style color=#0000ff]蓝色片段[/style]`,
    scriptZh: `【全局样式 模式：居中打字机，颜色：#ffffff，字号：32px】
【行样式 颜色：#00ff00】
绿色行中的 【样式 颜色：#ff0000】红色片段【/样式】
普通行中的 【样式 颜色：#0000ff】蓝色片段【/样式】`,
    description: '演示全局、行、片段样式的优先级继承'
  },
  
  // 标签对照表（无预览）
  'tag-names': {
    categoryId: 'dictionary',
    script: '',
    description: '标签名中英文对照表，暂无预览'
  },
  'attr-keys': {
    categoryId: 'dictionary',
    script: '',
    description: '属性键中英文对照表，暂无预览'
  },
  'attr-values': {
    categoryId: 'dictionary',
    script: '',
    description: '属性值中英文对照表，暂无预览'
  },
  
  // 大小跳跃模式
  'jumpScale-mode': {
    categoryId: 'advanced',
    script: `[global-style mode=jumpScale; color=#ffffff; fontSize=36px]
跳跃式缩放效果展示
文字逐个跳跃出现`,
    scriptZh: `【全局样式 模式：大小跳跃，颜色：#ffffff，字号：36px】
跳跃式缩放效果展示
文字逐个跳跃出现`,
    description: '使用 jumpScale 模式实现文字跳跃式缩放效果'
  },
  
  // 简单居中模式
  'centerTypewriter-mode': {
    categoryId: 'advanced',
    script: `[global-style mode=centerTypewriter; color=#ffffff; fontSize=36px]
居中打字机效果展示
文字从中心逐字打出`,
    scriptZh: `【全局样式 模式：居中打字机，颜色：#ffffff，字号：36px】
居中打字机效果展示
文字从中心逐字打出`,
    description: '使用 centerTypewriter 模式实现基础打字机效果'
  }
};

/**
 * 根据分类ID获取示例
 */
export function getExampleByItemId(itemId: string): GuideExample | undefined {
  return GUIDE_EXAMPLES[itemId];
}

/**
 * 获取分类的所有示例
 */
export function getExamplesByCategory(categoryId: string): GuideExample[] {
  return Object.values(GUIDE_EXAMPLES).filter(ex => ex.categoryId === categoryId);
}
