'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useLanguage } from '@/hooks/useLanguage';
import { loadImage, createCanvas, addTextWatermark, addImageWatermark, embedInvisibleWatermark, canvasToDataUrl } from '@/utils/canvas';
import { watermarkPresets } from '@/data/presets';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface WatermarkPanelProps {
  imageUrl: string;
  imageWidth: number;
  imageHeight: number;
  onApply: (imageData: string, width: number, height: number) => void;
}

export function WatermarkPanel({ imageUrl, imageWidth, imageHeight, onApply }: WatermarkPanelProps) {
  const { t } = useLanguage();
  const [watermarkText, setWatermarkText] = useState('');
  const [opacity, setOpacity] = useState(0.5);
  const [fontSize, setFontSize] = useState(20);
  const [rotation, setRotation] = useState(0);
  const [pattern, setPattern] = useState<'tile' | 'single' | 'diagonal'>('single');
  const [watermarkImageName, setWatermarkImageName] = useState<string | null>(null);
  const [watermarkImageUrl, setWatermarkImageUrl] = useState<string | null>(null);
  const [invisibleText, setInvisibleText] = useState('');
  const [mode, setMode] = useState<'text' | 'image' | 'invisible'>('text');
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const originalImageRef = useRef<{ url: string; width: number; height: number } | null>(null);

  useEffect(() => {
    originalImageRef.current = { url: imageUrl, width: imageWidth, height: imageHeight };
  }, [imageUrl, imageWidth, imageHeight]);

  const handleApply = useCallback(async () => {
    if (!originalImageRef.current) return;

    if (mode === 'invisible' && !invisibleText) {
      toast.error(t('enterWatermarkText'));
      return;
    }
    if (mode === 'text' && !watermarkText) {
      toast.error(t('enterWatermarkText'));
      return;
    }

    setIsProcessing(true);
    try {
      const response = await fetch(originalImageRef.current.url);
      const blob = await response.blob();
      const img = await loadImage(blob);

      const { canvas, ctx } = createCanvas(img.width, img.height);
      ctx.drawImage(img, 0, 0);

      if (mode === 'text') {
        addTextWatermark(ctx, watermarkText, {
          fontSize,
          opacity,
          rotation,
          pattern,
        });
      } else if (mode === 'image' && watermarkImageUrl) {
        const wmResponse = await fetch(watermarkImageUrl);
        const wmBlob = await wmResponse.blob();
        const wmImg = await loadImage(wmBlob);
        addImageWatermark(ctx, wmImg, { opacity, pattern });
      } else if (mode === 'invisible') {
        embedInvisibleWatermark(ctx, invisibleText);
      }

      const dataUrl = canvasToDataUrl(canvas);
      onApply(dataUrl, img.width, img.height);
      toast.success(t('processSuccess'));
    } catch {
      toast.error(t('watermarkFailed'));
    } finally {
      setIsProcessing(false);
    }
  }, [mode, watermarkText, watermarkImageUrl, invisibleText, fontSize, opacity, rotation, pattern, onApply, t]);

  const handleModeClick = useCallback((newMode: 'text' | 'image' | 'invisible') => {
    setMode(newMode);
  }, []);

  const handlePatternClick = useCallback((newPattern: 'tile' | 'single' | 'diagonal') => {
    setPattern(newPattern);
    if (mode === 'text' && watermarkText) {
      setTimeout(handleApply, 50);
    } else if (mode === 'image' && watermarkImageUrl) {
      setTimeout(handleApply, 50);
    }
  }, [mode, watermarkText, watermarkImageUrl, handleApply]);

  const handlePresetClick = useCallback((preset: typeof watermarkPresets[0]) => {
    setWatermarkText(preset.text);
    setPattern(preset.pattern);
    setOpacity(preset.opacity);
    if (mode === 'text') {
      setTimeout(handleApply, 50);
    }
  }, [mode, handleApply]);

  const handleImageSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setWatermarkImageName(file.name);
      // 释放被替换的旧水印图 ObjectURL
      setWatermarkImageUrl(prev => {
        if (prev) URL.revokeObjectURL(prev);
        return URL.createObjectURL(file);
      });
      if (mode === 'image') {
        setTimeout(handleApply, 100);
      }
    }
  }, [mode, handleApply]);

  // 卸载时释放水印图 ObjectURL
  useEffect(() => {
    return () => {
      if (watermarkImageUrl) URL.revokeObjectURL(watermarkImageUrl);
    };
  }, [watermarkImageUrl]);

  const handleSliderChange = useCallback(() => {
    if (mode === 'text' && watermarkText) {
      setTimeout(handleApply, 150);
    } else if (mode === 'image' && watermarkImageUrl) {
      setTimeout(handleApply, 150);
    }
  }, [mode, watermarkText, watermarkImageUrl, handleApply]);

  const patternModes = ['tile', 'single', 'diagonal'] as const;

  const renderPatternSelector = () => (
    <div>
      <label className="block text-sm font-medium mb-2">{t('pattern')}</label>
      <div className="flex gap-1">
        {patternModes.map((p) => (
          <button
            key={p}
            onClick={() => handlePatternClick(p)}
            className={cn(
              'flex-1 py-1.5 rounded text-xs transition-colors',
              pattern === p ? 'bg-primary text-primary-foreground' : 'bg-muted'
            )}
          >
            {t(`pattern${p.charAt(0).toUpperCase() + p.slice(1) as 'Tile' | 'Single' | 'Diagonal'}`)}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex gap-1 p-1 rounded-lg bg-muted/50">
        {(['text', 'image', 'invisible'] as const).map((m) => (
          <button
            key={m}
            onClick={() => handleModeClick(m)}
            className={cn(
              'flex-1 py-1.5 rounded text-xs font-medium transition-colors',
              mode === m ? 'bg-background shadow' : ''
            )}
          >
            {t(m === 'text' ? 'textWatermark' : m === 'image' ? 'imageWatermark' : 'invisibleWatermark')}
          </button>
        ))}
      </div>

      {mode === 'text' && (
        <>
          <div>
            <label className="block text-sm font-medium mb-2">{t('watermarkText')}</label>
            <input
              type="text"
              value={watermarkText}
              onChange={(e) => setWatermarkText(e.target.value)}
              onBlur={() => watermarkText && handleApply()}
              placeholder={t('enterWatermarkText')}
              className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">{t('preset')}</label>
            <div className="flex flex-wrap gap-1">
              {watermarkPresets.map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => handlePresetClick(preset)}
                  className="px-2 py-1 text-xs rounded bg-muted hover:bg-muted/80"
                >
                  {preset.text.slice(0, 10)}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">{t('opacity')}: {Math.round(opacity * 100)}%</label>
            <input
              type="range"
              min="0.1"
              max="1"
              step="0.1"
              value={opacity}
              onChange={(e) => setOpacity(Number(e.target.value))}
              onInput={handleSliderChange}
              className="w-full"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">{t('fontSize')}: {fontSize}px</label>
            <input
              type="range"
              min="10"
              max="100"
              value={fontSize}
              onChange={(e) => setFontSize(Number(e.target.value))}
              onInput={handleSliderChange}
              className="w-full"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">{t('rotation')}: {rotation}°</label>
            <input
              type="range"
              min="0"
              max="360"
              value={rotation}
              onChange={(e) => setRotation(Number(e.target.value))}
              onInput={handleSliderChange}
              className="w-full"
            />
          </div>

          {renderPatternSelector()}
        </>
      )}

      {mode === 'image' && (
        <>
          <div>
            <label className="block text-sm font-medium mb-2">{t('imageWatermark')}</label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageSelect}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full py-2 rounded-lg border border-dashed border-input hover:border-primary/50 text-sm"
            >
              {watermarkImageName ? watermarkImageName : t('addImage')}
            </button>
            {watermarkImageUrl && (
              <img src={watermarkImageUrl} alt="Watermark" className="mt-2 max-h-20 mx-auto" />
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">{t('opacity')}: {Math.round(opacity * 100)}%</label>
            <input
              type="range"
              min="0.1"
              max="1"
              step="0.1"
              value={opacity}
              onChange={(e) => setOpacity(Number(e.target.value))}
              onInput={handleSliderChange}
              className="w-full"
            />
          </div>

          {renderPatternSelector()}
        </>
      )}

      {mode === 'invisible' && (
        <>
          <div>
            <label className="block text-sm font-medium mb-2">{t('embedData')}</label>
            <textarea
              value={invisibleText}
              onChange={(e) => setInvisibleText(e.target.value)}
              onBlur={() => invisibleText && handleApply()}
              placeholder={t('enterWatermarkText')}
              className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm h-20 resize-none"
            />
            <button
              onClick={handleApply}
              disabled={isProcessing || !invisibleText}
              className="w-full mt-2 py-2 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 disabled:opacity-50 text-sm"
            >
              {isProcessing ? t('processing') : t('apply')}
            </button>
          </div>
          <div className="p-3 rounded-lg bg-muted/50 text-sm text-muted-foreground">
            💡 {t('invisibleHelpText')}
          </div>
        </>
      )}
    </div>
  );
}
