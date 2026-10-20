'use client';

import { useEffect, useRef } from 'react';
import { useScript } from '@/hooks/useScript';
import { AnimationRenderer } from './AnimationRenderer';

interface PreviewCanvasProps {
  externalCanvasRef?: React.RefObject<HTMLCanvasElement | null>;
  onCanvasReady?: (ready: boolean) => void;
}

/**
 * 预览画布组件
 * 用于渲染和播放脚本动画
 */
export default function PreviewCanvas({ externalCanvasRef, onCanvasReady }: PreviewCanvasProps) {
  // 使用外部传入的 ref 或内部创建的 ref
  const internalCanvasRef = useRef<HTMLCanvasElement>(null);
  const canvasRef = externalCanvasRef || internalCanvasRef;
  const { script } = useScript();

  // 当 script 变化时，创建新的渲染器实例
  useEffect(() => {
    if (!script || !canvasRef.current) {
      return;
    }

    // 通知父组件 canvas 已就绪
    if (onCanvasReady) {
      onCanvasReady(true);
    }

    // 清理函数
    return () => {
      if (onCanvasReady) {
        onCanvasReady(false);
      }
    };
  }, [script]);

  return (
    <div className="w-full max-w-4xl mx-auto">
      {/* Canvas 容器 */}
      <div className="aspect-video w-full bg-black rounded-lg overflow-hidden">
        <canvas
          ref={canvasRef}
          className="w-full h-full"
        />
      </div>

      {/* 提示信息 */}
      {!script && (
        <div className="mt-4 p-4 bg-gray-800 rounded-lg border border-gray-700 text-center">
          <p className="text-gray-400">请先在编辑器中创建脚本</p>
        </div>
      )}
    </div>
  );
}
