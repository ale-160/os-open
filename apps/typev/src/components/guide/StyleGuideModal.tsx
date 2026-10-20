'use client';

import { useState, useEffect, useRef } from 'react';
import { Modal } from '@/components/ui/Modal';
import { TAG_DICT } from '@/lib/tagDictionary';
import { getExampleByItemId } from '@/lib/guideExamples';
import { parseTextToScript } from '@/components/editor/ScriptParser';
import { AnimationRenderer } from '@/components/preview/AnimationRenderer';
import { useLocale } from '@/hooks/useLocale';

interface StyleGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialCategory?: string;
}

type Category = 'basic' | 'animation' | 'advanced' | 'dictionary';

interface MenuItem {
  id: string;
  label: string;
  icon: React.ReactNode;
}

interface CategoryConfig {
  id: Category;
  label: string;
  icon: React.ReactNode;
  items: MenuItem[];
}

/**
 * 样式使用指南模态框组件
 */
export default function StyleGuideModal({ isOpen, onClose, initialCategory }: StyleGuideModalProps) {
  const { locale } = useLocale();
  const [activeCategory, setActiveCategory] = useState<Category>((initialCategory as Category) || 'basic');
  const [activeItem, setActiveItem] = useState<string>('style-tag');
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({});
  const [previewTab, setPreviewTab] = useState<'manual' | 'preview'>('manual');
  const [previewLang, setPreviewLang] = useState<'zh' | 'en'>('zh');
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<AnimationRenderer | null>(null);

  /**
   * 切换分类折叠状态
   */
  const toggleCategory = (categoryId: string) => {
    setCollapsedCategories(prev => ({
      ...prev,
      [categoryId]: !prev[categoryId]
    }));
  };

  /**
   * 当选中项变化时，更新预览
   */
  useEffect(() => {
    if (previewTab !== 'preview' || !previewCanvasRef.current) {
      return;
    }

    const example = getExampleByItemId(activeItem);
    const scriptToUse = previewLang === 'zh' ? (example?.scriptZh || '') : (example?.script || '');
    
    if (!example || !scriptToUse) {
      // 清理之前的渲染器
      if (rendererRef.current) {
        rendererRef.current.stop();
        rendererRef.current = null;
      }
      return;
    }

    // 解析脚本
    const script = parseTextToScript(scriptToUse);
    
    // 创建新的渲染器（开启循环播放）
    if (rendererRef.current) {
      rendererRef.current.stop();
    }
    
    const renderer = new AnimationRenderer(previewCanvasRef.current, script, true);
    rendererRef.current = renderer;
    renderer.play();

    // 清理函数
    return () => {
      if (renderer) {
        renderer.stop();
      }
    };
  }, [activeItem, previewTab, previewLang]);

  // locale 变化时同步 previewLang（渲染期派生状态调整，React 官方模式）
  const [prevLocale, setPrevLocale] = useState(locale);
  if (prevLocale !== locale) {
    setPrevLocale(locale);
    setPreviewLang(locale);
  }

  /**
   * 菜单分类配置
   */
  const categories: CategoryConfig[] = [
    {
      id: 'basic',
      label: '基础标签',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
        </svg>
      ),
      items: [
        {
          id: 'style-tag',
          label: '样式标签',
          icon: null
        },
        {
          id: 'row-style',
          label: '行样式',
          icon: null
        },
        {
          id: 'global-style',
          label: '全局样式',
          icon: null
        },
        {
          id: 'def-style',
          label: '定义样式',
          icon: null
        },
        {
          id: 'clear-style',
          label: '清除样式',
          icon: null
        }
      ]
    },
    {
      id: 'animation',
      label: '动画效果',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
          <path d="M8 5v14l11-7z" />
        </svg>
      ),
      items: [
        {
          id: 'centerTypewriter-basic',
          label: '居中打字机',
          icon: null
        },
        {
          id: 'fadeIn-basic',
          label: '淡入效果',
          icon: null
        },
        {
          id: 'bounceIn-basic',
          label: '弹入效果',
          icon: null
        },
        {
          id: 'rotateIn-basic',
          label: '旋转进入',
          icon: null
        },
        {
          id: 'scaleIn-basic',
          label: '缩放进入',
          icon: null
        },
        {
          id: 'colorWave-basic',
          label: '颜色波浪',
          icon: null
        },
        {
          id: 'jumpScale-advanced',
          label: '大小跳跃',
          icon: null
        }
      ]
    },
    {
      id: 'advanced',
      label: '高级用法',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
        </svg>
      ),
      items: [
        {
          id: 'time-control',
          label: '时间控制',
          icon: null
        },
        {
          id: 'section',
          label: '分节标记',
          icon: null
        },
        {
          id: 'speed-control',
          label: '倍速控制',
          icon: null
        },
        {
          id: 'color-size',
          label: '颜色与字号',
          icon: null
        },
        {
          id: 'font-opacity',
          label: '字体粗细与透明度',
          icon: null
        },
        {
          id: 'transform-rotate',
          label: '变换与旋转',
          icon: null
        },
        {
          id: 'inheritance',
          label: '样式继承',
          icon: null
        }
      ]
    },
    {
      id: 'dictionary',
      label: '标签词典',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <line x1="2" y1="12" x2="22" y2="12" />
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
        </svg>
      ),
      items: [
        {
          id: 'tag-names',
          label: '标签名对照',
          icon: null
        },
        {
          id: 'attr-keys',
          label: '属性键对照',
          icon: null
        },
        {
          id: 'attr-values',
          label: '属性值对照',
          icon: null
        }
      ]
    }
  ];

  /**
   * 内容数据（中英文）
   */
  const contentData: Record<string, { zh: React.ReactNode; en: React.ReactNode }> = {
    // === 入门修炼 ===
    'style-tag': {
      zh: (
        <div className="space-y-4">
          <h4 className="text-lg font-semibold text-white">样式标签 [style]</h4>
          <p className="text-gray-300">用于为文本片段设置样式，支持多种属性。</p>
          
          <div className="bg-gray-900 p-3 rounded">
            <code className="text-blue-400">
              【样式 颜色=红; 字号=大】红色大字【/样式】
            </code>
          </div>
          
          <div className="bg-gray-900 p-3 rounded">
            <code className="text-green-400">
              [style color=#ff0000; fontSize=48px]红色大字[/style]
            </code>
          </div>
          
          <p className="text-gray-400 text-sm mt-4">常用属性：color（颜色）、fontSize（字号）、fontWeight（字重）、opacity（透明度）、time（时间）、effect（效果）</p>
        </div>
      ),
      en: (
        <div className="space-y-4">
          <h4 className="text-lg font-semibold text-white">Style Tag [style]</h4>
          <p className="text-gray-300">Used to set styles for text segments, supports multiple attributes.</p>
          
          <div className="bg-gray-900 p-3 rounded">
            <code className="text-green-400">
              [style color=#ff0000; fontSize=48px]Red Large Text[/style]
            </code>
          </div>
          
          <p className="text-gray-400 text-sm mt-4">Common attributes: color, fontSize, fontWeight, opacity</p>
        </div>
      )
    },
    'row-style': {
      zh: (
        <div className="space-y-4">
          <h4 className="text-lg font-semibold text-white">行样式 [row-style]</h4>
          <p className="text-gray-300">为整行文本设置基础样式，该行所有片段会继承这些样式。</p>
          
          <div className="bg-gray-900 p-3 rounded">
            <code className="text-blue-400">
              【行样式 颜色=绿】这是一行绿色文字【/行样式】
            </code>
          </div>
          
          <div className="bg-gray-900 p-3 rounded">
            <code className="text-green-400">
              [row-style color=#00ff00]这是一行绿色文字[/row-style]
            </code>
          </div>
        </div>
      ),
      en: (
        <div className="space-y-4">
          <h4 className="text-lg font-semibold text-white">Row Style [row-style]</h4>
          <p className="text-gray-300">Sets base style for entire line, all segments inherit these styles.</p>
          
          <div className="bg-gray-900 p-3 rounded">
            <code className="text-green-400">
              [row-style color=#00ff00]This is a green line[/row-style]
            </code>
          </div>
        </div>
      )
    },
    'global-style': {
      zh: (
        <div className="space-y-4">
          <h4 className="text-lg font-semibold text-white">全局样式 [global-style]</h4>
          <p className="text-gray-300">设置全局默认样式，影响后续所有行。也可设置动画效果。</p>
          
          <div className="bg-gray-900 p-3 rounded">
            <code className="text-blue-400">
              【全局样式 颜色=白; 字号=中; 效果=淡入】
            </code>
          </div>
          
          <div className="bg-gray-900 p-3 rounded">
            <code className="text-green-400">
              [global-style color=#ffffff; fontSize=32px; effect=fadeIn]
            </code>
          </div>
        </div>
      ),
      en: (
        <div className="space-y-4">
          <h4 className="text-lg font-semibold text-white">Global Style [global-style]</h4>
          <p className="text-gray-300">Sets global default styles, affects all subsequent lines. Can also set animation effects.</p>
          
          <div className="bg-gray-900 p-3 rounded">
            <code className="text-green-400">
              [global-style color=#ffffff; fontSize=32px; effect=fadeIn]
            </code>
          </div>
        </div>
      )
    },
    'def-style': {
      zh: (
        <div className="space-y-4">
          <h4 className="text-lg font-semibold text-white">定义样式 [def-style]</h4>
          <p className="text-gray-300">定义命名样式，后续可通过 name 属性引用。</p>
          
          <div className="bg-gray-900 p-3 rounded">
            <code className="text-blue-400">
              【定义样式 名称=高亮 颜色=黄; 字号=大】<br/>
              【样式 名称=高亮】高亮文本【/样式】
            </code>
          </div>
          
          <div className="bg-gray-900 p-3 rounded">
            <code className="text-green-400">
              [def-style name=highlight color=#ffff00; fontSize=40px]<br/>
              [style name=highlight]高亮文本[/style]
            </code>
          </div>
        </div>
      ),
      en: (
        <div className="space-y-4">
          <h4 className="text-lg font-semibold text-white">Define Style [def-style]</h4>
          <p className="text-gray-300">Defines named styles that can be referenced via name attribute later.</p>
          
          <div className="bg-gray-900 p-3 rounded">
            <code className="text-green-400">
              [def-style name=highlight color=#ffff00; fontSize=40px]<br/>
              [style name=highlight]Highlighted Text[/style]
            </code>
          </div>
        </div>
      )
    },

    // === 进阶法术 ===
    'time-control': {
      zh: (
        <div className="space-y-4">
          <h4 className="text-lg font-semibold text-white">时间控制</h4>
          <p className="text-gray-300">通过 time 或 duration 属性控制文本显示时长。</p>
          
          <div className="bg-gray-900 p-3 rounded">
            <code className="text-blue-400">
              【样式 时间=3秒】显示3秒【/样式】
            </code>
          </div>
          
          <div className="bg-gray-900 p-3 rounded">
            <code className="text-green-400">
              [style time=3s]显示3秒[/style]
            </code>
          </div>
        </div>
      ),
      en: (
        <div className="space-y-4">
          <h4 className="text-lg font-semibold text-white">Time Control</h4>
          <p className="text-gray-300">Control text display duration via time or duration attribute.</p>
          
          <div className="bg-gray-900 p-3 rounded">
            <code className="text-green-400">
              [style time=3s]Display for 3 seconds[/style]
            </code>
          </div>
        </div>
      )
    },
    'animation': {
      zh: (
        <div className="space-y-4">
          <h4 className="text-lg font-semibold text-white">基础动画效果</h4>
          <p className="text-gray-300">系统支持多种动画效果，但当前所有示例统一使用居中打字机模式演示。</p>
          
          <div className="bg-gray-900 p-3 rounded">
            <code className="text-green-400">
              [global-style mode=centerTypewriter]<br/>
              文本内容
            </code>
          </div>
          
          <p className="text-gray-400 text-sm mt-4">全局样式属性：mode（模式）、flyDirection（飞行方向）、flyDuration（飞行时长）、maxVisible（最大可见数）等</p>
        </div>
      ),
      en: (
        <div className="space-y-4">
          <h4 className="text-lg font-semibold text-white">Basic Animation Effects</h4>
          <p className="text-gray-300">The system supports multiple animation effects, but all examples currently use centerTypewriter mode.</p>
          
          <div className="bg-gray-900 p-3 rounded">
            <code className="text-green-400">
              [global-style mode=centerTypewriter]<br/>
              Text content
            </code>
          </div>
          
          <p className="text-gray-400 text-sm mt-4">Available effects: centerTypewriter, fadeIn, bounceIn, rotateIn, scaleIn, slideInLeft, colorWave, centerRotate</p>
        </div>
      )
    },
    'centerTypewriter-basic': {
      zh: (
        <div className="space-y-4">
          <h4 className="text-lg font-semibold text-white">基础模式 [centerTypewriter]</h4>
          <p className="text-gray-300">使用 centerTypewriter 模式实现基础的居中打字机效果，文字从中心逐字打出。</p>
          
          <div className="bg-gray-900 p-3 rounded mt-4">
            <code className="text-blue-400">
              【全局样式 模式：居中打字机，颜色：#ffffff，字号：36px】<br/>
              第一行普通白色文字<br/>
              【样式 颜色：#00ff00，字号：48px】第二行绿色大字【/样式】<br/>
              【样式 颜色：#ff0000，字号：24px】第三行红色小字【/样式】
            </code>
          </div>
          
          <div className="bg-gray-900 p-3 rounded">
            <code className="text-green-400">
              [global-style mode=centerTypewriter; color=#ffffff; fontSize=36px]<br/>
              第一行普通白色文字<br/>
              [style color=#00ff00; fontSize=48px]第二行绿色大字[/style]<br/>
              [style color=#ff0000; fontSize=24px]第三行红色小字[/style]
            </code>
          </div>
          
          <p className="text-gray-400 text-sm mt-4">这是最基础的打字机效果，适合展示简单的文本内容</p>
        </div>
      ),
      en: (
        <div className="space-y-4">
          <h4 className="text-lg font-semibold text-white">Basic Mode [centerTypewriter]</h4>
          <p className="text-gray-300">Use centerTypewriter mode to implement basic centered typewriter effect, text types out from center character by character.</p>
          
          <div className="bg-gray-900 p-3 rounded mt-4">
            <code className="text-green-400">
              [global-style mode=centerTypewriter; color=#ffffff; fontSize=36px]<br/>
              First line normal white text<br/>
              [style color=#00ff00; fontSize=48px]Second line green large text[/style]<br/>
              [style color=#ff0000; fontSize=24px]Third line red small text[/style]
            </code>
          </div>
          
          <p className="text-gray-400 text-sm mt-4">This is the most basic typewriter effect, suitable for displaying simple text content</p>
        </div>
      )
    },
    'fadeIn-basic': {
      zh: (
        <div className="space-y-4">
          <h4 className="text-lg font-semibold text-white">淡入效果 [fadeIn]</h4>
          <p className="text-gray-300">文字从透明逐渐显现的淡入动画效果。</p>
          
          <div className="bg-gray-900 p-3 rounded mt-4">
            <code className="text-blue-400">
              【全局样式 模式：居中打字机，颜色：#ffffff，字号：48px】<br/>
              【样式 效果：淡入】淡入效果演示文字【/样式】
            </code>
          </div>
          
          <div className="bg-gray-900 p-3 rounded">
            <code className="text-green-400">
              [global-style mode=centerTypewriter; color=#ffffff; fontSize=48px]<br/>
              [style effect=fadeIn]淡入效果演示文字[/style]
            </code>
          </div>
          
          <p className="text-gray-400 text-sm mt-4">使用 [style effect=fadeIn] 触发淡入效果，整行文字一次性显示，透明度从0渐变到1</p>
        </div>
      ),
      en: (
        <div className="space-y-4">
          <h4 className="text-lg font-semibold text-white">Fade In Effect [fadeIn]</h4>
          <p className="text-gray-300">Text gradually appears from transparent to opaque.</p>
          
          <div className="bg-gray-900 p-3 rounded mt-4">
            <code className="text-green-400">
              [global-style mode=centerTypewriter; color=#ffffff; fontSize=48px]<br/>
              [style effect=fadeIn]Fade in demo text[/style]
            </code>
          </div>
          
          <p className="text-gray-400 text-sm mt-4">Use [style effect=fadeIn] to trigger fade-in effect, entire line displays at once with opacity transitioning from 0 to 1</p>
        </div>
      )
    },
    'bounceIn-basic': {
      zh: (
        <div className="space-y-4">
          <h4 className="text-lg font-semibold text-white">弹入效果 [bounceIn]</h4>
          <p className="text-gray-300">文字带有弹性缩放效果的弹入动画。</p>
          
          <div className="bg-gray-900 p-3 rounded mt-4">
            <code className="text-blue-400">
              【全局样式 模式：居中打字机，颜色：#ffffff，字号：48px】<br/>
              【样式 效果：弹入】弹入效果演示文字【/样式】
            </code>
          </div>
          
          <div className="bg-gray-900 p-3 rounded">
            <code className="text-green-400">
              [global-style mode=centerTypewriter; color=#ffffff; fontSize=48px]<br/>
              [style effect=bounceIn]弹入效果演示文字[/style]
            </code>
          </div>
          
          <p className="text-gray-400 text-sm mt-4">使用 [style effect=bounceIn] 触发弹入效果，文字带有弹性缩放的视觉效果</p>
        </div>
      ),
      en: (
        <div className="space-y-4">
          <h4 className="text-lg font-semibold text-white">Bounce In Effect [bounceIn]</h4>
          <p className="text-gray-300">Text appears with elastic scaling bounce effect.</p>
          
          <div className="bg-gray-900 p-3 rounded mt-4">
            <code className="text-green-400">
              [global-style mode=centerTypewriter; color=#ffffff; fontSize=48px]<br/>
              [style effect=bounceIn]Bounce in demo text[/style]
            </code>
          </div>
          
          <p className="text-gray-400 text-sm mt-4">Use [style effect=bounceIn] to trigger bounce-in effect with elastic scaling visual</p>
        </div>
      )
    },
    'rotateIn-basic': {
      zh: (
        <div className="space-y-4">
          <h4 className="text-lg font-semibold text-white">旋转进入 [rotateIn]</h4>
          <p className="text-gray-300">文字从旋转状态逐渐摆正的进入效果。</p>
          
          <div className="bg-gray-900 p-3 rounded mt-4">
            <code className="text-blue-400">
              【全局样式 模式：居中打字机，颜色：#ffffff，字号：48px】<br/>
              【样式 效果：旋转进入】旋转进入效果演示文字【/样式】
            </code>
          </div>
          
          <div className="bg-gray-900 p-3 rounded">
            <code className="text-green-400">
              [global-style mode=centerTypewriter; color=#ffffff; fontSize=48px]<br/>
              [style effect=rotateIn]旋转进入效果演示文字[/style]
            </code>
          </div>
          
          <p className="text-gray-400 text-sm mt-4">使用 [style effect=rotateIn] 触发旋转进入效果，文字从2π旋转角度逐渐归零</p>
        </div>
      ),
      en: (
        <div className="space-y-4">
          <h4 className="text-lg font-semibold text-white">Rotate In Effect [rotateIn]</h4>
          <p className="text-gray-300">Text rotates into position from spinning state.</p>
          
          <div className="bg-gray-900 p-3 rounded mt-4">
            <code className="text-green-400">
              [global-style mode=centerTypewriter; color=#ffffff; fontSize=48px]<br/>
              [style effect=rotateIn]Rotate in demo text[/style]
            </code>
          </div>
          
          <p className="text-gray-400 text-sm mt-4">Use [style effect=rotateIn] to trigger rotate-in effect, text rotates from 2π to 0</p>
        </div>
      )
    },
    'scaleIn-basic': {
      zh: (
        <div className="space-y-4">
          <h4 className="text-lg font-semibold text-white">缩放进入 [scaleIn]</h4>
          <p className="text-gray-300">文字从小变大逐渐放大的进入效果。</p>
          
          <div className="bg-gray-900 p-3 rounded mt-4">
            <code className="text-blue-400">
              【全局样式 模式：居中打字机，颜色：#ffffff，字号：48px】<br/>
              【样式 效果：缩放进入】缩放进入效果演示文字【/样式】
            </code>
          </div>
          
          <div className="bg-gray-900 p-3 rounded">
            <code className="text-green-400">
              [global-style mode=centerTypewriter; color=#ffffff; fontSize=48px]<br/>
              [style effect=scaleIn]缩放进入效果演示文字[/style]
            </code>
          </div>
          
          <p className="text-gray-400 text-sm mt-4">使用 [style effect=scaleIn] 触发缩放进入效果，文字从0缩放到1，同时透明度渐变</p>
        </div>
      ),
      en: (
        <div className="space-y-4">
          <h4 className="text-lg font-semibold text-white">Scale In Effect [scaleIn]</h4>
          <p className="text-gray-300">Text scales up from small to large size.</p>
          
          <div className="bg-gray-900 p-3 rounded mt-4">
            <code className="text-green-400">
              [global-style mode=centerTypewriter; color=#ffffff; fontSize=48px]<br/>
              [style effect=scaleIn]Scale in demo text[/style]
            </code>
          </div>
          
          <p className="text-gray-400 text-sm mt-4">Use [style effect=scaleIn] to trigger scale-in effect, text scales from 0 to 1 with opacity fade</p>
        </div>
      )
    },
    'colorWave-basic': {
      zh: (
        <div className="space-y-4">
          <h4 className="text-lg font-semibold text-white">颜色波浪 [colorWave]</h4>
          <p className="text-gray-300">文字呈现彩虹色波浪渐变的视觉效果。</p>
          
          <div className="bg-gray-900 p-3 rounded mt-4">
            <code className="text-blue-400">
              【全局样式 模式：居中打字机，字号：48px】<br/>
              【样式 效果：颜色波浪】颜色波浪效果演示文字【/样式】
            </code>
          </div>
          
          <div className="bg-gray-900 p-3 rounded">
            <code className="text-green-400">
              [global-style mode=centerTypewriter; fontSize=48px]<br/>
              [style effect=colorWave]颜色波浪效果演示文字[/style]
            </code>
          </div>
          
          <p className="text-gray-400 text-sm mt-4">使用 [style effect=colorWave] 触发颜色波浪效果，逐字符呈现从蓝到红的彩虹渐变</p>
        </div>
      ),
      en: (
        <div className="space-y-4">
          <h4 className="text-lg font-semibold text-white">Color Wave Effect [colorWave]</h4>
          <p className="text-gray-300">Text displays rainbow color wave gradient effect.</p>
          
          <div className="bg-gray-900 p-3 rounded mt-4">
            <code className="text-green-400">
              [global-style mode=centerTypewriter; fontSize=48px]<br/>
              [style effect=colorWave]Color wave demo text[/style]
            </code>
          </div>
          
          <p className="text-gray-400 text-sm mt-4">Use [style effect=colorWave] to trigger color wave effect, character-by-character rainbow gradient from blue to red</p>
        </div>
      )
    },
    'jumpScale-advanced': {
      zh: (
        <div className="space-y-4">
          <h4 className="text-lg font-semibold text-white">高级模式 [jumpScale]</h4>
          <p className="text-gray-300">使用 jumpScale 模式实现高级的跳跃式缩放效果，支持飞出方向、时长和最大可见数等参数。</p>
          
          <div className="bg-gray-900 p-3 rounded mt-4">
            <code className="text-blue-400">
              【全局样式 模式：大小跳跃，颜色：#ffffff，字号：36px，飞出方向：left，飞出时长：5s，最大可见数：2】<br/>
              跳跃式缩放效果展示<br/>
              文字逐个从左侧飞出<br/>
              最大可见数为2个
            </code>
          </div>
          
          <div className="bg-gray-900 p-3 rounded">
            <code className="text-green-400">
              [global-style mode=jumpScale; color=#ffffff; fontSize=36px; flyDirection=left; flyDuration=5s; maxVisible=2]<br/>
              跳跃式缩放效果展示<br/>
              文字逐个从左侧飞出<br/>
              最大可见数为2个
            </code>
          </div>
          
          <p className="text-gray-400 text-sm mt-4">高级模式提供更多参数控制，适合制作动态视觉效果</p>
        </div>
      ),
      en: (
        <div className="space-y-4">
          <h4 className="text-lg font-semibold text-white">Advanced Mode [jumpScale]</h4>
          <p className="text-gray-300">Use jumpScale mode to implement advanced jumping scale effect, supports parameters like fly direction, duration and max visible count.</p>
          
          <div className="bg-gray-900 p-3 rounded mt-4">
            <code className="text-green-400">
              [global-style mode=jumpScale; color=#ffffff; fontSize=36px; flyDirection=left; flyDuration=5s; maxVisible=2]<br/>
              Jumping scale effect display<br/>
              Text flies out from left one by one<br/>
              Max visible count is 2
            </code>
          </div>
          
          <p className="text-gray-400 text-sm mt-4">Advanced mode provides more parameter control, suitable for creating dynamic visual effects</p>
        </div>
      )
    },
    'color-size': {
      zh: (
        <div className="space-y-4">
          <h4 className="text-lg font-semibold text-white">颜色与字号</h4>
          <p className="text-gray-300">支持中英文颜色名和字号快捷方式。</p>
          
          <div className="bg-gray-900 p-3 rounded space-y-2">
            <code className="text-blue-400 block">【样式 颜色=红】 = 【样式 颜色=#ff0000】</code>
            <code className="text-blue-400 block">【样式 字号=大】 = 【样式 字号=48px】</code>
            <code className="text-blue-400 block">【样式 字号=中】 = 【样式 字号=32px】</code>
            <code className="text-blue-400 block">【样式 字号=小】 = 【样式 字号=24px】</code>
          </div>
          
          <div className="bg-gray-900 p-3 rounded space-y-2 mt-4">
            <code className="text-green-400 block">[style color=红] = [style color=#ff0000]</code>
            <code className="text-green-400 block">[style fontSize=大] = [style fontSize=48px]</code>
            <code className="text-green-400 block">[style fontSize=中] = [style fontSize=32px]</code>
            <code className="text-green-400 block">[style fontSize=小] = [style fontSize=24px]</code>
          </div>
        </div>
      ),
      en: (
        <div className="space-y-4">
          <h4 className="text-lg font-semibold text-white">Color & Size</h4>
          <p className="text-gray-300">Supports Chinese/English color names and size shortcuts.</p>
          
          <div className="bg-gray-900 p-3 rounded space-y-2">
            <code className="text-green-400 block">[style color=red] = [style color=#ff0000]</code>
            <code className="text-green-400 block">[style fontSize=large] = [style fontSize=48px]</code>
            <code className="text-green-400 block">[style fontSize=medium] = [style fontSize=32px]</code>
            <code className="text-green-400 block">[style fontSize=small] = [style fontSize=24px]</code>
          </div>
          
          <div className="bg-gray-900 p-3 rounded space-y-2 mt-4">
            <code className="text-blue-400 block">【样式 颜色=红】 = 【样式 颜色=#ff0000】</code>
            <code className="text-blue-400 block">【样式 字号=大】 = 【样式 字号=48px】</code>
            <code className="text-blue-400 block">【样式 字号=中】 = 【样式 字号=32px】</code>
            <code className="text-blue-400 block">【样式 字号=小】 = 【样式 字号=24px】</code>
          </div>
        </div>
      )
    },
    'inheritance': {
      zh: (
        <div className="space-y-4">
          <h4 className="text-lg font-semibold text-white">样式继承</h4>
          <p className="text-gray-300">样式优先级：全局样式 &lt; 行样式 &lt; 片段样式。后者优先级更高，会覆盖前者。</p>
          
          <div className="bg-gray-900 p-3 rounded mt-4">
            <code className="text-blue-400">
              【全局样式 颜色=白】<br/>
              【行样式 颜色=绿】<br/>
              【样式 颜色=红】最终显示红色【/样式】
            </code>
          </div>
          
          <div className="bg-gray-900 p-3 rounded">
            <code className="text-green-400">
              [global-style color=#ffffff]<br/>
              [row-style color=#00ff00]<br/>
              [style color=#ff0000]最终显示红色[/style]
            </code>
          </div>
        </div>
      ),
      en: (
        <div className="space-y-4">
          <h4 className="text-lg font-semibold text-white">Style Inheritance</h4>
          <p className="text-gray-300">Style priority: Global &lt; Row &lt; Segment. Higher priority overrides lower ones.</p>
          
          <div className="bg-gray-900 p-3 rounded">
            <code className="text-green-400">
              [global-style color=#ffffff]<br/>
              [row-style color=#00ff00]<br/>
              [style color=#ff0000]Finally shows red[/style]
            </code>
          </div>
        </div>
      )
    },
    
    // 清除样式
    'clear-style': {
      zh: (
        <div className="space-y-4">
          <h4 className="text-lg font-semibold text-white">清除样式 [clear-style]</h4>
          <p className="text-gray-300">重置所有全局样式、命名样式和动画效果为默认值。</p>
          
          <div className="bg-gray-900 p-3 rounded mt-4">
            <code className="text-blue-400">
              【全局样式 颜色=红; 字号=大】<br/>
              红色大字<br/>
              【清除样式】<br/>
              恢复默认白色
            </code>
          </div>
          
          <div className="bg-gray-900 p-3 rounded">
            <code className="text-green-400">
              [global-style color=#ff0000; fontSize=48px]<br/>
              红色大字<br/>
              [clear-style]<br/>
              恢复默认白色
            </code>
          </div>
        </div>
      ),
      en: (
        <div className="space-y-4">
          <h4 className="text-lg font-semibold text-white">Clear Style [clear-style]</h4>
          <p className="text-gray-300">Reset all global styles, named styles and animation effects to defaults.</p>
          
          <div className="bg-gray-900 p-3 rounded">
            <code className="text-green-400">
              [global-style color=#ff0000; fontSize=48px]<br/>
              Red large text<br/>
              [clear-style]<br/>
              Back to default white
            </code>
          </div>
        </div>
      )
    },
    
    // 分节标记
    'section': {
      zh: (
        <div className="space-y-4">
          <h4 className="text-lg font-semibold text-white">分节标记 [section]</h4>
          <p className="text-gray-300">用于标记章节和时长，该行不生成 ScriptLine，仅作为标注。</p>
          
          <div className="bg-gray-900 p-3 rounded mt-4">
            <code className="text-blue-400">
              【分节 时长=5秒】<br/>
              第一节内容
            </code>
          </div>
          
          <div className="bg-gray-900 p-3 rounded">
            <code className="text-green-400">
              [section duration=5s]<br/>
              第一节内容
            </code>
          </div>
        </div>
      ),
      en: (
        <div className="space-y-4">
          <h4 className="text-lg font-semibold text-white">Section Mark [section]</h4>
          <p className="text-gray-300">Mark chapters and duration. This line does not generate ScriptLine, only as annotation.</p>
          
          <div className="bg-gray-900 p-3 rounded">
            <code className="text-green-400">
              [section duration=5s]<br/>
              Chapter 1 content
            </code>
          </div>
        </div>
      )
    },
    
    // 倍速控制
    'speed-control': {
      zh: (
        <div className="space-y-4">
          <h4 className="text-lg font-semibold text-white">倍速控制 [speed]</h4>
          <p className="text-gray-300">使用 speed 属性控制整体播放速度，默认值为1.0。数值越大速度越快。</p>
          
          <div className="bg-gray-900 p-3 rounded mt-4">
            <code className="text-blue-400">
              【全局样式 模式：居中打字机，颜色：#ffffff，字号：48px，倍速：0.5】<br/>
              倍速演示文字
            </code>
          </div>
          
          <div className="bg-gray-900 p-3 rounded">
            <code className="text-green-400">
              [global-style mode=centerTypewriter; color=#ffffff; fontSize=48px; speed=0.5]<br/>
              倍速演示文字
            </code>
          </div>
          
          <p className="text-gray-400 text-sm mt-4">示例说明：speed=0.5 表示半速播放（时间变为2倍）；speed=2 表示双倍速播放（时间减半）</p>
        </div>
      ),
      en: (
        <div className="space-y-4">
          <h4 className="text-lg font-semibold text-white">Speed Control [speed]</h4>
          <p className="text-gray-300">Use speed attribute to control overall playback speed, default value is 1.0. Higher values mean faster speed.</p>
          
          <div className="bg-gray-900 p-3 rounded mt-4">
            <code className="text-green-400">
              [global-style mode=centerTypewriter; color=#ffffff; fontSize=48px; speed=0.5]<br/>
              Speed demo text
            </code>
          </div>
          
          <p className="text-gray-400 text-sm mt-4">Example explanation: speed=0.5 means half speed (2x duration); speed=2 means double speed (0.5x duration)</p>
        </div>
      )
    },
    
    // 字体粗细与透明度
    'font-opacity': {
      zh: (
        <div className="space-y-4">
          <h4 className="text-lg font-semibold text-white">字体粗细与透明度</h4>
          <p className="text-gray-300">使用 fontWeight 和 opacity 属性控制字体粗细和透明度。</p>
          
          <div className="bg-gray-900 p-3 rounded mt-4">
            <code className="text-blue-400">
              【全局样式 模式=居中打字机; 时长=4秒】<br/>
              正常字体文字<br/>
              加粗字体文字<br/>
              半透明文字展示<br/>
              粗体半透明文字
            </code>
          </div>
          
          <div className="bg-gray-900 p-3 rounded">
            <code className="text-green-400">
              [global-style mode=centerTypewriter; duration=4s]<br/>
              正常字体文字<br/>
              加粗字体文字<br/>
              半透明文字展示<br/>
              粗体半透明文字
            </code>
          </div>
          
          <p className="text-gray-400 text-sm mt-4">当前示例使用全局样式，逐行展示不同效果</p>
        </div>
      ),
      en: (
        <div className="space-y-4">
          <h4 className="text-lg font-semibold text-white">Font Weight & Opacity</h4>
          <p className="text-gray-300">Use fontWeight and opacity attributes to control font weight and transparency.</p>
          
          <div className="bg-gray-900 p-3 rounded">
            <code className="text-green-400">
              [global-style mode=centerTypewriter; duration=4s]<br/>
              Normal font text<br/>
              Bold font text<br/>
              Semi-transparent text<br/>
              Bold semi-transparent text
            </code>
          </div>
          
          <p className="text-gray-400 text-sm mt-4">Current example uses global styles to show different effects line by line</p>
        </div>
      )
    },
    
    // 变换与旋转
    'transform-rotate': {
      zh: (
        <div className="space-y-4">
          <h4 className="text-lg font-semibold text-white">变换与旋转</h4>
          <p className="text-gray-300">使用 rotate 和 transform 属性进行几何变换。</p>
          
          <div className="bg-gray-900 p-3 rounded space-y-2 mt-4">
            <code className="text-blue-400 block">【样式 旋转=45度】旋转45度【/样式】</code>
            <code className="text-blue-400 block">【样式 变换=缩放(1.5)】放大1.5倍【/样式】</code>
          </div>
          
          <div className="bg-gray-900 p-3 rounded space-y-2">
            <code className="text-green-400 block">[style rotate=45deg]旋转45度[/style]</code>
            <code className="text-green-400 block">[style transform=scale(1.5)]放大1.5倍[/style]</code>
          </div>
        </div>
      ),
      en: (
        <div className="space-y-4">
          <h4 className="text-lg font-semibold text-white">Transform & Rotate</h4>
          <p className="text-gray-300">Use rotate and transform attributes for geometric transformations.</p>
          
          <div className="bg-gray-900 p-3 rounded space-y-2">
            <code className="text-green-400 block">[style rotate=45deg]Rotate 45 degrees[/style]</code>
            <code className="text-green-400 block">[style transform=scale(1.5)]Scale 1.5x[/style]</code>
          </div>
        </div>
      )
    },

    // === 标签词典 ===
    'tag-names': {
      zh: (
        <div className="space-y-4">
          <h4 className="text-lg font-semibold text-white">标签名对照</h4>
          <p className="text-gray-300 mb-4">所有标签的中英文映射关系。</p>
          
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-gray-800">
                  <th className="border border-gray-700 px-4 py-2 text-left text-white">英文</th>
                  <th className="border border-gray-700 px-4 py-2 text-left text-white">中文</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(TAG_DICT).filter(([en]) => 
                  ['style', 'def-style', 'row-style', 'global-style', 'clear-style', 'section'].includes(en)
                ).map(([en, cn], index) => (
                  <tr key={en} className={`${index % 2 === 0 ? 'bg-gray-900' : ''}`}>
                    <td className="border border-gray-700 px-4 py-2 font-mono text-green-400">
                      {en}
                    </td>
                    <td className="border border-gray-700 px-4 py-2 text-blue-400">
                      {cn}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ),
      en: (
        <div className="space-y-4">
          <h4 className="text-lg font-semibold text-white">Tag Names</h4>
          <p className="text-gray-300 mb-4">Mapping of all tag names between English and Chinese.</p>
          
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-gray-800">
                  <th className="border border-gray-700 px-4 py-2 text-left text-white">English</th>
                  <th className="border border-gray-700 px-4 py-2 text-left text-white">Chinese</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(TAG_DICT).filter(([en]) => 
                  ['style', 'def-style', 'row-style', 'global-style', 'clear-style', 'section'].includes(en)
                ).map(([en, cn], index) => (
                  <tr key={en} className={`${index % 2 === 0 ? 'bg-gray-900' : ''}`}>
                    <td className="border border-gray-700 px-4 py-2 font-mono text-green-400">
                      {en}
                    </td>
                    <td className="border border-gray-700 px-4 py-2 text-blue-400">
                      {cn}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )
    },
    'attr-keys': {
      zh: (
        <div className="space-y-4">
          <h4 className="text-lg font-semibold text-white">属性键对照</h4>
          <p className="text-gray-300 mb-4">所有属性键的中英文映射关系。</p>
          
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-gray-800">
                  <th className="border border-gray-700 px-4 py-2 text-left text-white">英文</th>
                  <th className="border border-gray-700 px-4 py-2 text-left text-white">中文</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(TAG_DICT).filter(([en]) => 
                  ['color', 'fontSize', 'time', 'duration', 'effect', 'mode', 'name', 'fontWeight', 'opacity', 'rotate', 'transform', 'flyDirection', 'flyDuration', 'maxVisible', 'speed'].includes(en)
                ).map(([en, cn], index) => (
                  <tr key={en} className={`${index % 2 === 0 ? 'bg-gray-900' : ''}`}>
                    <td className="border border-gray-700 px-4 py-2 font-mono text-green-400">
                      {en}
                    </td>
                    <td className="border border-gray-700 px-4 py-2 text-blue-400">
                      {cn}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ),
      en: (
        <div className="space-y-4">
          <h4 className="text-lg font-semibold text-white">Attribute Keys</h4>
          <p className="text-gray-300 mb-4">Mapping of all attribute keys between English and Chinese.</p>
          
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-gray-800">
                  <th className="border border-gray-700 px-4 py-2 text-left text-white">English</th>
                  <th className="border border-gray-700 px-4 py-2 text-left text-white">Chinese</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(TAG_DICT).filter(([en]) => 
                  ['color', 'fontSize', 'time', 'duration', 'effect', 'mode', 'name', 'fontWeight', 'opacity', 'rotate', 'transform', 'flyDirection', 'flyDuration', 'maxVisible', 'speed'].includes(en)
                ).map(([en, cn], index) => (
                  <tr key={en} className={`${index % 2 === 0 ? 'bg-gray-900' : ''}`}>
                    <td className="border border-gray-700 px-4 py-2 font-mono text-green-400">
                      {en}
                    </td>
                    <td className="border border-gray-700 px-4 py-2 text-blue-400">
                      {cn}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )
    },
    'attr-values': {
      zh: (
        <div className="space-y-4">
          <h4 className="text-lg font-semibold text-white">属性值对照</h4>
          <p className="text-gray-300 mb-4">常见属性值的中英文映射关系。</p>
          
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-gray-800">
                  <th className="border border-gray-700 px-4 py-2 text-left text-white">英文值</th>
                  <th className="border border-gray-700 px-4 py-2 text-left text-white">中文值</th>
                </tr>
              </thead>
              <tbody>
                <tr className="bg-gray-900">
                  <td className="border border-gray-700 px-4 py-2 font-mono text-green-400">red</td>
                  <td className="border border-gray-700 px-4 py-2 text-blue-400">红 / 红色</td>
                </tr>
                <tr>
                  <td className="border border-gray-700 px-4 py-2 font-mono text-green-400">green</td>
                  <td className="border border-gray-700 px-4 py-2 text-blue-400">绿 / 绿色</td>
                </tr>
                <tr className="bg-gray-900">
                  <td className="border border-gray-700 px-4 py-2 font-mono text-green-400">blue</td>
                  <td className="border border-gray-700 px-4 py-2 text-blue-400">蓝 / 蓝色</td>
                </tr>
                <tr>
                  <td className="border border-gray-700 px-4 py-2 font-mono text-green-400">left</td>
                  <td className="border border-gray-700 px-4 py-2 text-blue-400">左</td>
                </tr>
                <tr className="bg-gray-900">
                  <td className="border border-gray-700 px-4 py-2 font-mono text-green-400">fadeIn</td>
                  <td className="border border-gray-700 px-4 py-2 text-blue-400">淡入</td>
                </tr>
                <tr>
                  <td className="border border-gray-700 px-4 py-2 font-mono text-green-400">bounceIn</td>
                  <td className="border border-gray-700 px-4 py-2 text-blue-400">弹入</td>
                </tr>
                <tr className="bg-gray-900">
                  <td className="border border-gray-700 px-4 py-2 font-mono text-green-400">centerTypewriter</td>
                  <td className="border border-gray-700 px-4 py-2 text-blue-400">居中打字机</td>
                </tr>
                <tr>
                  <td className="border border-gray-700 px-4 py-2 font-mono text-green-400">jumpScale</td>
                  <td className="border border-gray-700 px-4 py-2 text-blue-400">大小跳跃</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      ),
      en: (
        <div className="space-y-4">
          <h4 className="text-lg font-semibold text-white">Attribute Values</h4>
          <p className="text-gray-300 mb-4">Mapping of common attribute values between English and Chinese.</p>
          
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-gray-800">
                  <th className="border border-gray-700 px-4 py-2 text-left text-white">English Value</th>
                  <th className="border border-gray-700 px-4 py-2 text-left text-white">Chinese Value</th>
                </tr>
              </thead>
              <tbody>
                <tr className="bg-gray-900">
                  <td className="border border-gray-700 px-4 py-2 font-mono text-green-400">red</td>
                  <td className="border border-gray-700 px-4 py-2 text-blue-400">红 / 红色</td>
                </tr>
                <tr>
                  <td className="border border-gray-700 px-4 py-2 font-mono text-green-400">green</td>
                  <td className="border border-gray-700 px-4 py-2 text-blue-400">绿 / 绿色</td>
                </tr>
                <tr className="bg-gray-900">
                  <td className="border border-gray-700 px-4 py-2 font-mono text-green-400">blue</td>
                  <td className="border border-gray-700 px-4 py-2 text-blue-400">蓝 / 蓝色</td>
                </tr>
                <tr>
                  <td className="border border-gray-700 px-4 py-2 font-mono text-green-400">left</td>
                  <td className="border border-gray-700 px-4 py-2 text-blue-400">左</td>
                </tr>
                <tr className="bg-gray-900">
                  <td className="border border-gray-700 px-4 py-2 font-mono text-green-400">fadeIn</td>
                  <td className="border border-gray-700 px-4 py-2 text-blue-400">淡入</td>
                </tr>
                <tr>
                  <td className="border border-gray-700 px-4 py-2 font-mono text-green-400">bounceIn</td>
                  <td className="border border-gray-700 px-4 py-2 text-blue-400">弹入</td>
                </tr>
                <tr className="bg-gray-900">
                  <td className="border border-gray-700 px-4 py-2 font-mono text-green-400">centerTypewriter</td>
                  <td className="border border-gray-700 px-4 py-2 text-blue-400">居中打字机</td>
                </tr>
                <tr>
                  <td className="border border-gray-700 px-4 py-2 font-mono text-green-400">jumpScale</td>
                  <td className="border border-gray-700 px-4 py-2 text-blue-400">大小跳跃</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )
    },
  };

  // 获取当前激活的内容
  const currentContent = contentData[activeItem];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="样式使用指南"
      size="3xl"
    >
      <div className="flex min-h-[80vh] bg-gray-950">
        {/* 左侧菜单 */}
        <div className="w-56 bg-gray-950 border-r border-gray-800 p-4 flex flex-col">
          <nav className="space-y-2 flex-1 overflow-y-auto">
            {categories.map((category) => (
              <div key={category.id}>
                {/* 分类标题 */}
                <button
                  onClick={() => toggleCategory(category.id)}
                  className="w-full bg-gray-800 text-gray-300 px-4 py-2 rounded-lg text-left cursor-pointer flex items-center justify-between hover:bg-gray-700 transition-colors"
                >
                  <span className="text-sm font-medium flex items-center gap-2">
                    <span className="text-gray-400">{category.icon}</span>
                    {category.label}
                  </span>
                  <svg
                    className={`w-4 h-4 transition-transform ${collapsedCategories[category.id] ? '' : 'rotate-180'}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {/* 子菜单项 */}
                <div
                  className={`overflow-hidden transition-all duration-200 ${
                    collapsedCategories[category.id] ? 'max-h-0' : 'max-h-96'
                  }`}
                >
                  <div className="mt-1 space-y-1">
                    {category.items.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => {
                          setActiveCategory(category.id);
                          setActiveItem(item.id);
                        }}
                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${
                          activeItem === item.id
                            ? 'bg-gray-700 text-white'
                            : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                        }`}
                      >
                        <span className="text-sm font-medium">
                          {item.label}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </nav>
        </div>

        {/* 右侧内容区 */}
        <div className="flex-1 flex flex-col bg-gray-950">
          {/* 顶部 Tab 切换 */}
          <div className="flex items-center justify-between p-4 border-b border-gray-800">
            <div className="flex gap-2">
              <button
                onClick={() => setPreviewTab('manual')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  previewTab === 'manual'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                }`}
              >
                📖 学习手册
              </button>
              <button
                onClick={() => setPreviewTab('preview')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  previewTab === 'preview'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                }`}
              >
                🎬 实时预览
              </button>
            </div>
          </div>

          {/* 内容区域 */}
          <div className="flex-1 overflow-hidden">
            {previewTab === 'manual' ? (
              // 手册模式 - 保持原有滚动行为
              <div className="h-full p-6 overflow-y-auto">
                {currentContent ? (
                  currentContent.zh
                ) : (
                  <p className="text-gray-500">暂无内容</p>
                )}
              </div>
            ) : (
              // 预览模式 - flex布局，上方示例代码，下方Canvas
              <div className="flex flex-col h-full">
                {(() => {
                  const example = getExampleByItemId(activeItem);
                  if (!example || !example.script) {
                    return (
                      <div className="flex-1 flex items-center justify-center text-gray-500">
                        暂无预览，请参考手册
                      </div>
                    );
                  }

                  const hasScriptZh = !!example.scriptZh;
                  const currentScript = previewLang === 'zh' ? (example.scriptZh || example.script) : example.script;

                  return (
                    <>
                      {/* 示例说明 - 固定高度，不压缩 */}
                      <div className="shrink-0 p-4 border-b border-gray-800">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="text-white font-semibold">示例脚本</h4>
                          <div className="flex gap-2">
                            <button
                              onClick={() => setPreviewLang('zh')}
                              disabled={!hasScriptZh}
                              className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                                previewLang === 'zh'
                                  ? 'bg-blue-600 text-white'
                                  : hasScriptZh
                                    ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                                    : 'bg-gray-800 text-gray-500 cursor-not-allowed'
                              }`}
                            >
                              中文脚本
                            </button>
                            <button
                              onClick={() => setPreviewLang('en')}
                              className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                                previewLang === 'en'
                                  ? 'bg-blue-600 text-white'
                                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                              }`}
                            >
                              英文脚本
                            </button>
                          </div>
                        </div>
                        <pre className="text-green-400 text-xs font-mono whitespace-pre-wrap break-all bg-gray-900 p-3 rounded max-h-32 overflow-y-auto">
                          {currentScript}
                        </pre>
                        <p className="text-gray-400 text-sm mt-2">
                          {example.description}
                        </p>
                      </div>
                      
                      {/* Canvas 区域 - 自适应填充剩余空间 */}
                      <div className="flex-1 flex items-center justify-center p-4 bg-black">
                        <canvas
                          ref={previewCanvasRef}
                          width={800}
                          height={450}
                          className="w-full max-h-full object-contain rounded shadow-lg"
                          style={{ aspectRatio: '16/9' }}
                        />
                      </div>
                    </>
                  );
                })()}
              </div>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}
