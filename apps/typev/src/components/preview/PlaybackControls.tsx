'use client';

import { useEffect, useRef, useState } from 'react';
import { useScript } from '@/hooks/useScript';
import { AnimationRenderer } from './AnimationRenderer';

interface PlaybackControlsProps {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  isCanvasReady: boolean;
  maxVisibleLines?: number;
}

/**
 * 播放控制按钮组件
 */
export default function PlaybackControls({ canvasRef, isCanvasReady, maxVisibleLines }: PlaybackControlsProps) {
  const rendererRef = useRef<AnimationRenderer | null>(null);
  const { script } = useScript();
  const [isPlaying, setIsPlaying] = useState(false);

  // 当 script 变化时，创建新的渲染器实例
  useEffect(() => {
    if (!script || !canvasRef.current) {
      return;
    }

    // 销毁前一个实例
    if (rendererRef.current) {
      rendererRef.current.stop();
      rendererRef.current = null;
    }

    // 创建新的渲染器实例
    rendererRef.current = new AnimationRenderer(canvasRef.current, script);
    
    // 设置最大可见行数
    if (maxVisibleLines !== undefined) {
      rendererRef.current.setMaxVisibleLines(maxVisibleLines);
    }
    
    // 自动开始播放
    rendererRef.current.play();
    setIsPlaying(true);

    // 清理函数
    return () => {
      if (rendererRef.current) {
        rendererRef.current.stop();
        rendererRef.current = null;
      }
    };
  }, [script]);

  // 当 maxVisibleLines 变化时，更新渲染器设置
  useEffect(() => {
    if (rendererRef.current && maxVisibleLines !== undefined) {
      rendererRef.current.setMaxVisibleLines(maxVisibleLines);
    }
  }, [maxVisibleLines]);

  /**
   * 处理播放/暂停切换
   */
  const handleTogglePlay = () => {
    if (!rendererRef.current) return;
    
    if (isPlaying) {
      rendererRef.current.pause();
      setIsPlaying(false);
    } else {
      rendererRef.current.play();
      setIsPlaying(true);
    }
  };

  /**
   * 处理停止
   */
  const handleStop = () => {
    if (rendererRef.current) {
      rendererRef.current.stop();
      setIsPlaying(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      {/* 播放/暂停切换按钮 */}
      <button
        onClick={handleTogglePlay}
        disabled={!script}
        className="p-2 rounded transition-colors hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
        title={isPlaying ? '暂停' : '播放'}
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="currentColor"
          className="text-white"
        >
          {isPlaying ? (
            // 暂停图标
            <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
          ) : (
            // 播放图标
            <path d="M8 5v14l11-7z" />
          )}
        </svg>
      </button>

      {/* 停止按钮 */}
      <button
        onClick={handleStop}
        disabled={!script}
        className="p-2 rounded transition-colors hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
        title="停止"
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="currentColor"
          className="text-white"
        >
          <path d="M6 6h12v12H6z" />
        </svg>
      </button>
    </div>
  );
}
