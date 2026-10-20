'use client';

import { useEffect, useRef } from 'react';
import type { Script } from '@/types/script';
import { AnimationRenderer } from './AnimationRenderer';

interface AnimationRendererComponentProps {
  script: Script;
  autoPlay?: boolean;
  loop?: boolean;
}

/**
 * AnimationRenderer React 组件包装器
 */
export default function AnimationRendererComponent({
  script,
  autoPlay = true,
  loop = false
}: AnimationRendererComponentProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<AnimationRenderer | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    // 创建渲染器实例
    const renderer = new AnimationRenderer(canvasRef.current, script);
    rendererRef.current = renderer;

    // 如果自动播放，则开始播放
    if (autoPlay) {
      renderer.play();
    }

    // 清理函数
    return () => {
      renderer.stop();
      rendererRef.current = null;
    };
  }, [script, autoPlay]);

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full"
      style={{ display: 'block' }}
    />
  );
}
