'use client';

import { useEffect, useRef } from 'react';
import type { ScriptLine } from '@/types/script';
import { AnimationRenderer } from '../preview/AnimationRenderer';

type EffectType = 'centerTypewriter';

interface AnimationPickerProps {
  selectedEffect: string;
  onSelectEffect: (effect: string) => void;
}

const EFFECTS = [
  'centerTypewriter'
];

/**
 * 动画选择器组件
 * 以卡片形式展示所有可用动画效果
 */
export default function AnimationPicker({ selectedEffect, onSelectEffect }: AnimationPickerProps) {
  return (
    <div className="w-full">
      <h3 className="text-white text-lg font-semibold mb-4">选择动画效果</h3>
      
      {/* 水平滚动卡片容器 */}
      <div className="flex gap-4 overflow-x-auto pb-4">
        {EFFECTS.map((effect) => (
          <AnimationCard
            key={effect}
            effect={effect}
            isSelected={selectedEffect === effect}
            onClick={() => onSelectEffect(effect)}
          />
        ))}
      </div>
    </div>
  );
}

interface AnimationCardProps {
  effect: string;
  isSelected: boolean;
  onClick: () => void;
}

/**
 * 单个动画卡片
 */
function AnimationCard({ effect, isSelected, onClick }: AnimationCardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // 在小型 Canvas 上预览动画
  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 设置小尺寸 Canvas
    canvas.width = 200;
    canvas.height = 80;

    // 创建示例脚本行
    const sampleLine: ScriptLine = {
      id: 'sample',
      segments: [{ text: '示例文本', style: { color: '#ffffff' } }],
      effect: effect as EffectType,
      duration: 2
    };

    let startTime: number | null = null;
    let animationId: number | null = null;

    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const elapsed = timestamp - startTime;
      const progress = Math.min(1, elapsed / 2000); // 2秒完成

      // 清空画布
      ctx.fillStyle = '#1e1e2e';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // 设置字体
      ctx.font = '16px monospace';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';

      // 根据效果类型渲染（只支持 centerTypewriter）
      const x = 20;
      const y = 40;

      renderCenterTypewriterPreview(ctx, sampleLine.segments[0]?.text || '', canvas.width / 2, canvas.height / 2, progress);

      if (progress < 1) {
        animationId = requestAnimationFrame(animate);
      }
    };

    animationId = requestAnimationFrame(animate);

    return () => {
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
    };
  }, [effect]);

  return (
    <div
      onClick={onClick}
      className={`flex-shrink-0 w-48 p-3 rounded-lg cursor-pointer transition-all ${
        isSelected
          ? 'bg-blue-900/50 border-2 border-blue-500'
          : 'bg-gray-800 border-2 border-gray-700 hover:border-gray-600'
      }`}
    >
      {/* Canvas 预览 */}
      <canvas
        ref={canvasRef}
        className="w-full h-20 bg-gray-900 rounded mb-2"
      />
      
      {/* 动画名称 */}
      <p className="text-white text-sm text-center font-medium">
        {getEffectDisplayName(effect)}
      </p>
    </div>
  );
}

/**
 * 获取动画效果的显示名称
 */
function getEffectDisplayName(effect: string): string {
  const names: Record<string, string> = {
    centerTypewriter: '居中打字机'
  };
  return names[effect] || effect;
}

// 简化的动画渲染函数（用于小 Canvas 预览）

/**
 * 居中打字机预览
 */
function renderCenterTypewriterPreview(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, progress: number) {
  const displayLength = Math.floor(text.length * progress);
  const displayText = text.substring(0, displayLength);
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '14px monospace';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(displayText, x, y);
  ctx.restore();
}
