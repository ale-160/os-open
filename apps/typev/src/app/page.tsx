'use client';

import { useRef, useState, useEffect } from 'react';
import Header from '@/components/layout/Header';
import ScriptEditor from '@/components/editor/ScriptEditor';
import PreviewCanvas from '@/components/preview/PreviewCanvas';
import PlaybackControls from '@/components/preview/PlaybackControls';
import ExportControls from '@/components/export/ExportControls';
import SettingsModal from '@/components/ui/SettingsModal';
import StyleGuideModal from '@/components/guide/StyleGuideModal';
import { useScript } from '@/hooks/useScript';

/**
 * 主页面组件
 */
export default function Home() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isCanvasReady, setIsCanvasReady] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const { script } = useScript();

  // 可见行数上限：渲染期派生（1-10，默认 2）
  const parsedMaxVisible = parseInt(script?.globalStyle?.maxVisible ?? '', 10);
  const maxVisibleLines =
    !isNaN(parsedMaxVisible) && parsedMaxVisible >= 1 && parsedMaxVisible <= 10 ? parsedMaxVisible : 2;

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* 头部 */}
      <Header 
        onOpenSettings={() => setIsSettingsOpen(true)} 
        onOpenGuide={() => setIsGuideOpen(true)}
      />

      {/* 主要内容区域 */}
      <main className="max-w-7xl mx-auto p-6">
        {/* 编辑器和预览区 */}
        <div className="flex gap-6 mb-6">
          {/* 左侧：脚本编辑器 */}
          <div className="w-2/5">
            <ScriptEditor onOpenGuide={() => setIsGuideOpen(true)} />
          </div>

          {/* 右侧：预览画布 + 工具栏 */}
          <div className="w-3/5">
            <PreviewCanvas 
              externalCanvasRef={canvasRef}
              onCanvasReady={setIsCanvasReady}
            />
            
            {/* 工具栏 */}
            <div className="mt-4 flex items-center gap-2">
              {/* 播放控制 */}
              <PlaybackControls
                canvasRef={canvasRef}
                isCanvasReady={isCanvasReady}
                maxVisibleLines={maxVisibleLines}
              />
              
              {/* 录制控制 */}
              <ExportControls 
                canvasRef={canvasRef} 
                isCanvasReady={isCanvasReady}
                isSettingsOpen={isSettingsOpen}
              />
            </div>
          </div>
        </div>

        {/* 设置模态框 */}
        <SettingsModal
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
        />
        
        {/* 样式指南模态框 */}
        <StyleGuideModal
          isOpen={isGuideOpen}
          onClose={() => setIsGuideOpen(false)}
          initialCategory="basic"
        />
      </main>
    </div>
  );
}
