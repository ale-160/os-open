'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { useScript } from '@/hooks/useScript';
import { useScriptText, DEMO_SCRIPT } from '@/hooks/useScriptText';
import { parseTextToScript } from './ScriptParser';
import { useLocale } from '@/hooks/useLocale';

type EditorMode = 'text' | 'json';

/**
 * 脚本编辑器组件
 * 支持文本模式和 JSON 模式切换
 */
interface ScriptEditorProps {
  onOpenGuide?: () => void;
}

export default function ScriptEditor({ onOpenGuide }: ScriptEditorProps) {
  const [mode, setMode] = useState<EditorMode>('text');
  const [jsonContent, setJsonContent] = useState('');
  const [jsonError, setJsonError] = useState<string | null>(null);
  
  const { script, setScript } = useScript();
  const { locale } = useLocale();
  const storedText = useScriptText((s) => s.text);
  const setStoredText = useScriptText((s) => s.setText);

  // 编辑文本：初始为持久化文本（首次访问为演示脚本）
  const [textContent, setTextContent] = useState(storedText || DEMO_SCRIPT);
  const [prevStored, setPrevStored] = useState(storedText);
  if (prevStored !== storedText) {
    setPrevStored(storedText);
    setTextContent(storedText);
  }

  // 切换编辑模式：进入 JSON 模式时从当前脚本序列化（事件驱动，不走 effect）
  const switchMode = (next: EditorMode) => {
    setMode(next);
    if (next === 'json' && script) {
      setJsonContent(JSON.stringify(script, null, 2));
      setJsonError(null);
    }
  };

  /**
   * 处理文本模式下的解析按钮点击
   */
  const handleParseText = () => {
    if (!textContent.trim()) {
      return;
    }

    try {
      const parsedScript = parseTextToScript(textContent);
      setScript(parsedScript);
    } catch (error) {
      console.error('解析脚本失败:', error);
    }
  };

  // 首次访问（无已解析脚本）自动解析演示脚本，让预览首开即有内容
  useEffect(() => {
    if (!script) {
      handleParseText();
    }
    // 仅挂载期执行一次
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * 处理 JSON 内容的实时校验和更新
   */
  const handleJsonChange = (value: string) => {
    setJsonContent(value);
    
    if (!value.trim()) {
      setJsonError(null);
      return;
    }

    try {
      const parsed = JSON.parse(value);
      setJsonError(null);
      setScript(parsed);
    } catch (error) {
      setJsonError(error instanceof Error ? error.message : 'JSON 格式错误');
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto p-6 bg-gray-900 rounded-lg">
      {/* 模式切换按钮 */}
      <div className="flex items-center justify-between gap-4 mb-6">
        <div className="flex gap-4">
          <Button
            variant={mode === 'text' ? 'primary' : 'secondary'}
            onClick={() => switchMode('text')}
            size="md"
          >
            文本模式
          </Button>
          <Button
            variant={mode === 'json' ? 'primary' : 'secondary'}
            onClick={() => switchMode('json')}
            size="md"
          >
            JSON 模式
          </Button>
        </div>
        {onOpenGuide && (
          <button
            onClick={onOpenGuide}
            className="text-sm text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-1"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17h-2v-2h2v2zm2.07-7.75l-.9.92C13.45 12.9 13 13.5 13 15h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H8c0-2.21 1.79-4 4-4s4 1.79 4 4c0 .88-.36 1.68-.93 2.25z" />
            </svg>
            {locale === 'zh' ? '语法指南' : 'Syntax Guide'}
          </button>
        )}
      </div>

      {/* 文本模式 */}
      {mode === 'text' && (
        <div className="space-y-4">
          <textarea
            value={textContent}
            onChange={(e) => {
              setTextContent(e.target.value);
              setStoredText(e.target.value);
            }}
            placeholder={locale === 'zh'
              ? `【全局样式 模式=居中打字机】 设置动画效果\n【样式 颜色=红, 字号=大, 效果=淡入】文本【/样式】 为片段设置样式和动画\n支持所有中英文标签混用\n\n在此输入文案，每行将成为一个脚本行...\n\n示例：\n【全局样式 模式：居中打字机】\n第一句打字机效果\n【全局样式 模式：淡入】\n第二句淡入效果`
              : `[global-style mode=centerTypewriter] Set animation effect\n[style color=red, fontSize=large, effect=fadeIn]Text[/style] Set style and animation for segments\nSupports mixed Chinese and English tags\n\nEnter your text here, each line becomes a script line...\n\nExample:\n[global-style mode=centerTypewriter]\nFirst line typewriter effect\n[global-style mode=fadeIn]\nSecond line fade-in effect`
            }
            className="w-full h-96 p-4 bg-gray-800 text-white font-mono text-sm rounded-lg border border-gray-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 outline-none resize-none"
          />
          <Button
            variant="primary"
            onClick={handleParseText}
            disabled={!textContent.trim()}
            size="md"
          >
            {locale === 'zh' ? '解析为脚本' : 'Parse to Script'}
          </Button>
        </div>
      )}

      {/* JSON 模式 */}
      {mode === 'json' && (
        <div className="space-y-4">
          <textarea
            value={jsonContent}
            onChange={(e) => handleJsonChange(e.target.value)}
            placeholder={locale === 'zh' ? '在此编辑 JSON 格式的脚本...' : 'Edit JSON format script here...'}
            className={`w-full h-96 p-4 bg-gray-800 text-white font-mono text-sm rounded-lg border ${
              jsonError ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : 'border-gray-700 focus:border-blue-500 focus:ring-blue-500'
            } focus:ring-2 outline-none resize-none`}
          />
          
          {/* 错误提示 */}
          {jsonError && (
            <div className="p-3 bg-red-900/30 border border-red-500 rounded-lg">
              <p className="text-red-400 text-sm font-medium">
                {locale === 'zh' ? 'JSON 解析错误' : 'JSON Parse Error'}: {jsonError}
              </p>
            </div>
          )}

          {/* 成功提示 */}
          {!jsonError && jsonContent.trim() && (
            <div className="p-3 bg-green-900/30 border border-green-500 rounded-lg">
              <p className="text-green-400 text-sm font-medium">
                {locale === 'zh' ? '✓ JSON 格式正确，已自动更新脚本' : '✓ JSON format correct, script updated'}
              </p>
            </div>
          )}
        </div>
      )}

      {/* 当前脚本信息 */}
      {script && (
        <div className="mt-6 p-4 bg-gray-800 rounded-lg border border-gray-700">
          <h3 className="text-white font-semibold mb-2">
            {locale === 'zh' ? '当前脚本信息' : 'Current Script Info'}
          </h3>
          <div className="text-gray-300 text-sm space-y-1">
            <p>{locale === 'zh' ? '行数' : 'Lines'}: {script.lines.length}</p>
            <p>{locale === 'zh' ? '背景' : 'Background'}: {script.background}</p>
            <p>{locale === 'zh' ? '分辨率' : 'Resolution'}: {script.resolution.width} x {script.resolution.height}</p>
            <p>{locale === 'zh' ? '帧率' : 'Frame Rate'}: {script.frameRate} fps</p>
          </div>
        </div>
      )}
    </div>
  );
}
