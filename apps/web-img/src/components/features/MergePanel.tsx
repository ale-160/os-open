'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useLanguage } from '@/hooks/useLanguage';
import { loadImage, mergeImages, canvasToDataUrl } from '@/utils/canvas';
import { X, ImagePlus } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface MergePanelProps {
  imageUrl: string;
  onApply: (imageData: string, width: number, height: number) => void;
}

export function MergePanel({ imageUrl, onApply }: MergePanelProps) {
  const { t } = useLanguage();
  const [images, setImages] = useState<string[]>([imageUrl]);
  const [layout, setLayout] = useState<'horizontal' | 'vertical' | 'grid'>('horizontal');
  const [gridCols, setGridCols] = useState(2);
  const [gap, setGap] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const originalImagesRef = useRef<string[]>([imageUrl]);
  // 同步最新 images 列表，供卸载清理使用
  const imagesRef = useRef<string[]>([imageUrl]);

  useEffect(() => {
    // 原图更换时，释放旧列表中追加图片的 blob: URL（首张原图 URL 归父组件管理）
    imagesRef.current.forEach((url, i) => {
      if (url.startsWith('blob:') && i !== 0) URL.revokeObjectURL(url);
    });
    originalImagesRef.current = [imageUrl];
    setImages([imageUrl]);
  }, [imageUrl]);

  useEffect(() => {
    imagesRef.current = images;
  }, [images]);

  const handleMerge = useCallback(async () => {
    if (images.length < 2) {
      toast.error(t('noImagesToMerge'));
      return;
    }

    setIsProcessing(true);
    try {
      const loadedImages: HTMLImageElement[] = [];
      for (const url of images) {
        const response = await fetch(url);
        const blob = await response.blob();
        const img = await loadImage(blob);
        loadedImages.push(img);
      }

      const { canvas, width, height } = mergeImages(loadedImages, layout, {
        gridCols: layout === 'grid' ? gridCols : undefined,
        gap,
      });

      const dataUrl = canvasToDataUrl(canvas);
      onApply(dataUrl, width, height);
      toast.success(t('processSuccess'));
    } catch {
      toast.error(t('mergeFailed'));
    } finally {
      setIsProcessing(false);
    }
  }, [images, layout, gridCols, gap, onApply, t]);

  const handleLayoutClick = useCallback((newLayout: 'horizontal' | 'vertical' | 'grid') => {
    setLayout(newLayout);
    if (images.length >= 2) {
      setTimeout(handleMerge, 50);
    }
  }, [images, handleMerge]);

  const handleSliderChange = useCallback(() => {
    if (images.length >= 2) {
      setTimeout(handleMerge, 100);
    }
  }, [images, handleMerge]);

  const handleAddMore = useCallback((files: FileList | File[]) => {
    const newImages: string[] = [];
    Array.from(files).forEach(file => {
      if (file.type.startsWith('image/')) {
        newImages.push(URL.createObjectURL(file));
      }
    });
    if (newImages.length > 0) {
      setImages((prev) => [...prev, ...newImages]);
      if (images.length + newImages.length >= 2) {
        setTimeout(handleMerge, 150);
      }
    }
  }, [images, handleMerge]);

  const handleRemoveImage = useCallback((index: number) => {
    // 首张为原图 URL（由父组件管理），仅释放后续追加的 blob: URL
    const removed = imagesRef.current[index];
    if (removed && removed.startsWith('blob:') && index !== 0) {
      URL.revokeObjectURL(removed);
    }
    setImages((prev) => prev.filter((_, i) => i !== index));
    if (images.length - 1 >= 2) {
      setTimeout(handleMerge, 100);
    }
  }, [images, handleMerge]);

  // 卸载时释放追加图片的 ObjectURL（首张原图 URL 归父组件管理）
  useEffect(() => {
    const ref = imagesRef;
    return () => {
      ref.current.forEach((url, i) => {
        if (url.startsWith('blob:') && i !== 0) URL.revokeObjectURL(url);
      });
    };
  }, []);

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-2">{t('layout')}</label>
        <div className="flex gap-1">
          {(['horizontal', 'vertical', 'grid'] as const).map((l) => (
            <button
              key={l}
              onClick={() => handleLayoutClick(l)}
              disabled={isProcessing}
              className={cn(
                'flex-1 py-1.5 rounded text-xs transition-colors',
                layout === l ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted/80',
                isProcessing && 'opacity-50 cursor-not-allowed'
              )}
            >
              {t(l)}
            </button>
          ))}
        </div>
      </div>

      {layout === 'grid' && (
        <div>
          <label className="block text-sm font-medium mb-2">{t('gridCols')}: {gridCols}</label>
          <input
            type="range"
            min="2"
            max="4"
            value={gridCols}
            onChange={(e) => setGridCols(Number(e.target.value))}
            onInput={handleSliderChange}
            className="w-full"
          />
        </div>
      )}

      <div>
        <label className="block text-sm font-medium mb-2">{t('gap')}: {gap}px</label>
        <input
          type="range"
          min="0"
          max="50"
          value={gap}
          onChange={(e) => setGap(Number(e.target.value))}
          onInput={handleSliderChange}
          className="w-full"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">{t('imagesAdded')} ({images.length})</label>
        <div className="grid grid-cols-3 gap-2 max-h-30 overflow-auto">
          {images.map((url, index) => (
            <div key={index} className="relative group">
              <img
                src={url}
                alt={`Image ${index + 1}`}
                className="w-full h-16 object-cover rounded"
              />
              {images.length > 2 && (
                <button
                  onClick={() => handleRemoveImage(index)}
                  className="absolute -top-1 -right-1 p-0.5 rounded-full bg-destructive text-destructive-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          ))}
          {images.length < 6 && (
            <label className="flex items-center justify-center h-16 border border-dashed border-input rounded cursor-pointer hover:border-primary/50">
              <ImagePlus className="w-5 h-5 text-muted-foreground" />
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={(e) => e.target.files && handleAddMore(e.target.files)}
                className="hidden"
              />
            </label>
          )}
        </div>
      </div>
    </div>
  );
}
