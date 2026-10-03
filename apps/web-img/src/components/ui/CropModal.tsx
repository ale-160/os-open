'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useLanguage } from '@/hooks/useLanguage';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CropModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string;
  imageWidth: number;
  imageHeight: number;
  cropWidth: number;
  cropHeight: number;
  onCrop: (x: number, y: number, actualWidth?: number, actualHeight?: number) => void;
  initialX?: number;
  initialY?: number;
}

type HandleType = 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'nw' | 'move';

export function CropModal({
  isOpen,
  onClose,
  imageUrl,
  imageWidth,
  imageHeight,
  cropWidth: targetWidth,
  cropHeight: targetHeight,
  onCrop,
  initialX,
  initialY,
}: CropModalProps) {
  const { language } = useLanguage();

  // 用 scale 把图像坐标 ↔ 显示坐标互转
  const [scale, setScale] = useState(1);
  const [displayImageSize, setDisplayImageSize] = useState({ w: 0, h: 0 });

  // 裁剪框状态（显示坐标）
  const [cropRect, setCropRect] = useState({ x: 0, y: 0, w: 0, h: 0 });

  // 拖拽状态
  const [isDragging, setIsDragging] = useState(false);
  const [activeHandle, setActiveHandle] = useState<HandleType | null>(null);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [startRect, setStartRect] = useState({ x: 0, y: 0, w: 0, h: 0 });

  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  // 是否已手动调整过，避免 scale/size 变化重置用户调整
  const hasManuallyResized = useRef(false);

  // 初始化 —— 仅在 isOpen 首次变为 true，或图像/目标尺寸改变时重算
  useEffect(() => {
    if (!isOpen || !containerRef.current) return;

    // 等 DOM 渲染完毕
    requestAnimationFrame(() => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const s = Math.min(
        rect.width / imageWidth,
        rect.height / imageHeight,
        1
      );

      const dIW = imageWidth * s;
      const dIH = imageHeight * s;
      const dCW = targetWidth * s;
      const dCH = targetHeight * s;

      const maxX = dIW - dCW;
      const maxY = dIH - dCH;

      let ix = initialX !== undefined ? initialX * s : maxX / 2;
      let iy = initialY !== undefined ? initialY * s : maxY / 2;
      ix = Math.max(0, Math.min(ix, maxX));
      iy = Math.max(0, Math.min(iy, maxY));

      setScale(s);
      setDisplayImageSize({ w: dIW, h: dIH });
      setCropRect({ x: ix, y: iy, w: dCW, h: dCH });
      hasManuallyResized.current = false;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, imageWidth, imageHeight, targetWidth, targetHeight]);

  // 鼠标按下
  const handleMouseDown = useCallback((e: React.MouseEvent, handleType: HandleType = 'move') => {
    e.preventDefault();
    e.stopPropagation();
    setActiveHandle(handleType);
    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
    setStartRect({ ...cropRect });
  }, [cropRect]);

  // 鼠标移动（全局）
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging || !activeHandle) return;
    e.preventDefault();

    const dx = e.clientX - dragStart.x;
    const dy = e.clientY - dragStart.y;
    const dIW = displayImageSize.w;
    const dIH = displayImageSize.h;

    let { x, y, w, h } = startRect;
    const minPx = 30; // 最小显示像素

    if (activeHandle === 'move') {
      x = Math.max(0, Math.min(startRect.x + dx, dIW - w));
      y = Math.max(0, Math.min(startRect.y + dy, dIH - h));
    } else {
      // 有宽高比锁定时用 targetWidth/targetHeight 计算
      const aspect = targetWidth / targetHeight;

      switch (activeHandle) {
        case 'e':
          w = Math.max(minPx, startRect.w + dx);
          h = w / aspect;
          break;
        case 'w':
          w = Math.max(minPx, startRect.w - dx);
          h = w / aspect;
          x = startRect.x + startRect.w - w;
          break;
        case 's':
          h = Math.max(minPx, startRect.h + dy);
          w = h * aspect;
          break;
        case 'n':
          h = Math.max(minPx, startRect.h - dy);
          w = h * aspect;
          y = startRect.y + startRect.h - h;
          break;
        case 'se':
          w = Math.max(minPx, startRect.w + dx);
          h = w / aspect;
          break;
        case 'sw':
          w = Math.max(minPx, startRect.w - dx);
          h = w / aspect;
          x = startRect.x + startRect.w - w;
          break;
        case 'ne':
          h = Math.max(minPx, startRect.h - dy);
          w = h * aspect;
          y = startRect.y + startRect.h - h;
          break;
        case 'nw':
          w = Math.max(minPx, startRect.w - dx);
          h = w / aspect;
          x = startRect.x + startRect.w - w;
          y = startRect.y + startRect.h - h;
          break;
      }

      // 边界约束
      if (x < 0) { x = 0; }
      if (y < 0) { y = 0; }
      if (x + w > dIW) { w = dIW - x; h = w / aspect; }
      if (y + h > dIH) { h = dIH - y; w = h * aspect; }
    }

    hasManuallyResized.current = true;
    setCropRect({ x, y, w, h });
  }, [isDragging, activeHandle, dragStart, startRect, displayImageSize, targetWidth, targetHeight]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    setActiveHandle(null);
  }, []);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove as EventListener);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove as EventListener);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  // 确认裁剪 —— 将显示坐标转换为图像坐标
  const handleConfirm = useCallback(() => {
    const realX = Math.round(cropRect.x / scale);
    const realY = Math.round(cropRect.y / scale);
    const realW = Math.round(cropRect.w / scale);
    const realH = Math.round(cropRect.h / scale);
    onCrop(realX, realY, realW, realH);
    onClose();
  }, [cropRect, scale, onCrop, onClose]);

  const handleReset = useCallback(() => {
    hasManuallyResized.current = false;
    const dCW = targetWidth * scale;
    const dCH = targetHeight * scale;
    const maxX = displayImageSize.w - dCW;
    const maxY = displayImageSize.h - dCH;
    setCropRect({ x: Math.max(0, maxX / 2), y: Math.max(0, maxY / 2), w: dCW, h: dCH });
  }, [targetWidth, targetHeight, scale, displayImageSize]);

  if (!isOpen) return null;

  // 当前实际裁剪尺寸（像素）
  const displayW = Math.round(cropRect.w / scale);
  const displayH = Math.round(cropRect.h / scale);

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-xl shadow-xl w-full max-w-4xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* 头部 */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-4">
            <h3 className="font-semibold">
              {language === 'zh' ? '选择裁剪区域' : 'Select Crop Area'}
            </h3>
            <span className="text-sm text-muted-foreground">
              {displayW} × {displayH}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleReset}
              className="px-3 py-1.5 rounded bg-muted hover:bg-muted/80 text-sm"
            >
              {language === 'zh' ? '重置' : 'Reset'}
            </button>
            <button onClick={onClose} className="p-2 rounded hover:bg-muted">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 裁剪区域 */}
        <div className="flex-1 overflow-auto p-4">
          <div
            ref={containerRef}
            className="relative w-full h-full flex items-center justify-center"
            style={{ minHeight: '400px' }}
          >
            <div
              className="relative"
              style={{ width: displayImageSize.w, height: displayImageSize.h }}
            >
              {/* 图像 */}
              <img
                ref={imageRef}
                src={imageUrl}
                alt="Crop Preview"
                className="block"
                style={{ width: displayImageSize.w, height: displayImageSize.h, objectFit: 'contain' }}
                draggable={false}
              />

              {/* 遮罩层 */}
              <div className="absolute inset-0 pointer-events-none">
                {/* 上 */}
                <div className="absolute bg-black/50" style={{ top: 0, left: 0, right: 0, height: cropRect.y }} />
                {/* 下 */}
                <div className="absolute bg-black/50" style={{ bottom: 0, left: 0, right: 0, height: Math.max(0, displayImageSize.h - cropRect.y - cropRect.h) }} />
                {/* 左 */}
                <div className="absolute bg-black/50" style={{ top: cropRect.y, left: 0, width: cropRect.x, height: cropRect.h }} />
                {/* 右 */}
                <div className="absolute bg-black/50" style={{ top: cropRect.y, right: 0, width: Math.max(0, displayImageSize.w - cropRect.x - cropRect.w), height: cropRect.h }} />
              </div>

              {/* 裁剪框 */}
              <div
                className={cn('absolute border-2 border-primary pointer-events-auto', isDragging ? '' : 'cursor-move')}
                style={{ left: cropRect.x, top: cropRect.y, width: cropRect.w, height: cropRect.h }}
                onMouseDown={(e) => handleMouseDown(e, 'move')}
              >
                {/* 角点手柄 */}
                <div className="absolute -top-1.5 -left-1.5 w-4 h-4 bg-primary rounded-full cursor-nw-resize" onMouseDown={(e) => handleMouseDown(e, 'nw')} />
                <div className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-primary rounded-full cursor-ne-resize" onMouseDown={(e) => handleMouseDown(e, 'ne')} />
                <div className="absolute -bottom-1.5 -left-1.5 w-4 h-4 bg-primary rounded-full cursor-sw-resize" onMouseDown={(e) => handleMouseDown(e, 'sw')} />
                <div className="absolute -bottom-1.5 -right-1.5 w-4 h-4 bg-primary rounded-full cursor-se-resize" onMouseDown={(e) => handleMouseDown(e, 'se')} />
                {/* 边中点手柄 */}
                <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-4 h-4 bg-primary rounded-full cursor-n-resize" onMouseDown={(e) => handleMouseDown(e, 'n')} />
                <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-4 h-4 bg-primary rounded-full cursor-s-resize" onMouseDown={(e) => handleMouseDown(e, 's')} />
                <div className="absolute top-1/2 -left-1.5 -translate-y-1/2 w-4 h-4 bg-primary rounded-full cursor-w-resize" onMouseDown={(e) => handleMouseDown(e, 'w')} />
                <div className="absolute top-1/2 -right-1.5 -translate-y-1/2 w-4 h-4 bg-primary rounded-full cursor-e-resize" onMouseDown={(e) => handleMouseDown(e, 'e')} />
                {/* 三等分辅助线 */}
                <div className="absolute inset-0 pointer-events-none">
                  <div className="absolute top-1/3 left-0 right-0 border-t border-dashed border-primary/40" />
                  <div className="absolute top-2/3 left-0 right-0 border-t border-dashed border-primary/40" />
                  <div className="absolute left-1/3 top-0 bottom-0 border-l border-dashed border-primary/40" />
                  <div className="absolute left-2/3 top-0 bottom-0 border-l border-dashed border-primary/40" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 底部操作 */}
        <div className="flex items-center justify-between gap-2 p-4 border-t border-border">
          <div className="text-sm text-muted-foreground">
            {language === 'zh' ? '拖动裁剪框选择区域，拖动手柄调整大小' : 'Drag to move, drag handles to resize'}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="px-4 py-2 rounded-lg bg-muted hover:bg-muted/80">
              {language === 'zh' ? '取消' : 'Cancel'}
            </button>
            <button onClick={handleConfirm} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90">
              {language === 'zh' ? '确认裁剪' : 'Confirm Crop'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
