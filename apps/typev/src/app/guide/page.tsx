'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useScript } from '@/hooks/useScript';
import type { Script } from '@/types/script';
import { parseTextToScriptAdvanced } from '@/components/editor/ScriptParser';
import AnimationRendererComponent from '@/components/preview/AnimationRendererComponent';

// 示例数据
const EXAMPLES = [
  {
    title: '基础文本',
    description: '最简单的纯文本，不带任何样式',
    script: '[clear-style]\nHello World\n这是一行普通文本',
    tags: ['基础', 'clear-style']
  },
  {
    title: '样式应用',
    description: '使用 [style] 标签为文本片段添加样式',
    script: '[clear-style]\n[style color=red; fontSize=48px]红色文字[/style] 和 [style color=blue; fontSize=64px]蓝色大字[/style]',
    tags: ['style', '颜色', '字号', 'clear-style']
  },
  {
    title: '行样式',
    description: '使用 [row-style] 为整行设置基础样式',
    script: '[clear-style]\n[row-style fontSize=24px; color=green]整行绿色小字',
    tags: ['row-style', '行样式', 'clear-style']
  },
  {
    title: '命名样式',
    description: '定义可复用的命名样式，通过 name 属性引用',
    script: '[clear-style]\n[def-style name=强调; color=red; fontSize=64px]\n[style name=强调]这是强调文字[/style]',
    tags: ['def-style', '命名样式', '复用', 'clear-style']
  },
  {
    title: '全局样式+居中打字机',
    description: '使用 [global-style] 设置全局样式和布局模式',
    script: '[clear-style]\n[global-style mode=centerTypewriter]\n第一句\n第二句',
    tags: ['global-style', 'mode', 'centerTypewriter', 'clear-style']
  },
  {
    title: '超长文本自动缩放',
    description: '超长文本自动缩放以适应屏幕宽度',
    script: '[clear-style]\n这是一个非常长的文本行它超过了三十个字符的限制应该会被自动缩放来显示',
    tags: ['自动缩放', '长文本', '自适应', 'clear-style']
  },
  {
    title: '混合使用',
    description: '结合多种标签实现复杂效果',
    script: '[clear-style]\n[global-style color=white; fontSize=36px]\n[def-style name=高亮; color=yellow; fontSize=48px]\n[row-style color=cyan]\n普通文本和 [style name=高亮]高亮文字[/style] 以及 [style color=red]红色文字[/style] 的组合',
    tags: ['global-style', 'def-style', 'row-style', 'style', '混合', 'clear-style']
  }
];

export default function GuidePage() {
  const { setScript } = useScript();
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [currentScript, setCurrentScript] = useState<Script | null>(null);

  // 预览示例时解析脚本（事件驱动，不走 effect）

  // 复制脚本到剪贴板
  const handleCopy = async (index: number, script: string) => {
    try {
      await navigator.clipboard.writeText(script);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    } catch (err) {
      console.error('复制失败:', err);
    }
  };

  // 预览示例：解析脚本并写入全局 store
  const handlePreview = (index: number) => {
    setPreviewIndex(index);
    const parsedScript = parseTextToScriptAdvanced(EXAMPLES[index].script, 'centerTypewriter');
    setCurrentScript(parsedScript);
    setScript(parsedScript);
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* 顶部导航 */}
      <header className="border-b border-gray-800 bg-gray-900 px-6 py-4">
        <div className="mx-auto max-w-7xl flex items-center justify-between">
          <h1 className="text-2xl font-bold">样式使用指南</h1>
          <Link 
            href="/"
            className="text-gray-400 hover:text-white transition-colors"
          >
            返回首页
          </Link>
        </div>
      </header>

      {/* 主内容区 */}
      <main className="mx-auto max-w-7xl px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* 左侧：示例列表 */}
          <div className="space-y-6">
            {EXAMPLES.map((example, index) => (
              <div
                key={index}
                className={`bg-gray-900 border rounded-lg p-4 transition-all ${
                  previewIndex === index
                    ? 'border-blue-500 shadow-lg shadow-blue-500/20'
                    : 'border-gray-800 hover:border-gray-700'
                }`}
              >
                {/* 标题和标签 */}
                <div className="mb-3">
                  <h2 className="text-lg font-semibold mb-2">{example.title}</h2>
                  <div className="flex flex-wrap gap-2">
                    {example.tags.map((tag, tagIndex) => (
                      <span
                        key={tagIndex}
                        className="px-2 py-1 text-xs bg-gray-800 text-gray-300 rounded"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>

                {/* 描述 */}
                <p className="text-gray-400 text-sm mb-3">{example.description}</p>

                {/* 脚本预览 */}
                <div className="bg-gray-950 border border-gray-800 rounded p-3 mb-4 font-mono text-sm overflow-x-auto">
                  <pre className="whitespace-pre-wrap text-gray-300">
                    {example.script}
                  </pre>
                </div>

                {/* 操作按钮 */}
                <div className="flex gap-3">
                  <button
                    onClick={() => handlePreview(index)}
                    className={`px-4 py-2 rounded-md font-medium transition-all ${
                      previewIndex === index
                        ? 'bg-blue-600 hover:bg-blue-700 text-white'
                        : 'bg-gray-800 hover:bg-gray-700 text-gray-300'
                    }`}
                  >
                    {previewIndex === index ? '正在预览' : '预览'}
                  </button>
                  <button
                    onClick={() => handleCopy(index, example.script)}
                    className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-md font-medium transition-all"
                  >
                    复制脚本
                  </button>
                </div>

                {/* 复制成功提示 */}
                {copiedIndex === index && (
                  <div className="mt-3 px-3 py-2 bg-green-900/50 border border-green-700 text-green-400 rounded text-sm animate-pulse">
                    ✓ 已复制到剪贴板
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* 右侧：预览区 */}
          <div className="lg:sticky lg:top-8 h-fit">
            <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
              <h2 className="text-lg font-semibold mb-4">实时预览</h2>
              
              {currentScript ? (
                <div className="w-full aspect-video max-h-[400px] bg-black rounded-lg overflow-hidden">
                  <AnimationRendererComponent
                    script={currentScript}
                    autoPlay={true}
                    loop={false}
                  />
                </div>
              ) : (
                <div className="w-full aspect-video max-h-[400px] bg-gray-950 rounded-lg flex items-center justify-center border border-gray-800">
                  <div className="text-center text-gray-500">
                    <svg
                      className="w-16 h-16 mx-auto mb-4 opacity-50"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    <p>点击左侧示例的「预览」按钮开始播放</p>
                  </div>
                </div>
              )}

              {/* 提示信息 */}
              <div className="mt-4 text-sm text-gray-400">
                <p>💡 提示：预览会自动播放，展示当前选中示例的效果</p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
