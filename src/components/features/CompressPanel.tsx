'use client';

import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useLanguage } from '@/hooks/useLanguage';
import { compressImage, ImageFormat, loadImage, createCanvas } from '@/utils/canvas';
import { sizePresets, exportFormats, ExportFormat, SizePreset, FormatPreset } from '@/data/presets';
import { usePersistentState } from '@/hooks/usePersistentState';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Settings, Crop as CropIcon, Plus } from 'lucide-react';
import { PresetManagerModal } from '@/components/ui/PresetManagerModal';
import { CropModal } from '@/components/ui/CropModal';
import { FormatManagerModal } from '@/components/ui/FormatManagerModal';
import { SliderWithInput } from '@/components/ui/SliderWithInput';

interface AdjustPanelProps {
  imageUrl: string;
  imageWidth: number;
  imageHeight: number;
  onApply: (imageData: string, width: number, height: number) => void;
  resetSignal?: number;
  /** 是否已水平镜像 */
  isFlipped?: boolean;
  /** 旋转角度 (0, 90, 180, 270) */
  rotation?: number;
}

const DEFAULT_VALUES = {
  quality: 100,
  maxWidth: undefined as number | undefined,
  maxHeight: undefined as number | undefined,
  format: 'jpeg' as ExportFormat,
  resizeMode: 'stretch' as const,
  cropX: undefined as number | undefined,
  cropY: undefined as number | undefined,
  brightness: 100,
  contrast: 100,
  saturate: 100,
  blur: 0,
  r: 0,
  g: 0,
  b: 0,
};

export function AdjustPanel({
  imageUrl,
  imageWidth,
  imageHeight,
  onApply,
  resetSignal = 0,
  isFlipped = false,
  rotation = 0,
}: AdjustPanelProps) {
  const { language, t } = useLanguage();

  // 压缩相关
  const [quality, setQuality] = useState(DEFAULT_VALUES.quality);
  const [maxWidth, setMaxWidth] = useState<number | undefined>(DEFAULT_VALUES.maxWidth);
  const [maxHeight, setMaxHeight] = useState<number | undefined>(DEFAULT_VALUES.maxHeight);
  const [format, setFormat] = useState<ExportFormat>(DEFAULT_VALUES.format);
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);
  const [resizeMode, setResizeMode] = useState<'stretch' | 'crop'>(DEFAULT_VALUES.resizeMode);
  const [cropX, setCropX] = useState<number | undefined>(DEFAULT_VALUES.cropX);
  const [cropY, setCropY] = useState<number | undefined>(DEFAULT_VALUES.cropY);

  // 图像效果相关
  const [brightness, setBrightness] = useState(DEFAULT_VALUES.brightness);
  const [contrast, setContrast] = useState(DEFAULT_VALUES.contrast);
  const [saturate, setSaturate] = useState(DEFAULT_VALUES.saturate);
  const [blur, setBlur] = useState(DEFAULT_VALUES.blur);

  // RGB调整
  const [r, setR] = useState(DEFAULT_VALUES.r);
  const [g, setG] = useState(DEFAULT_VALUES.g);
  const [b, setB] = useState(DEFAULT_VALUES.b);

  // 同步镜像/旋转状态（由父组件控制）
  const isFlippedRef = useRef(isFlipped);
  const rotationRef = useRef(rotation);
  useEffect(() => { isFlippedRef.current = isFlipped; }, [isFlipped]);
  useEffect(() => { rotationRef.current = rotation; }, [rotation]);

  // 模态框状态
  const [showPresetManager, setShowPresetManager] = useState(false);
  const [showFormatManager, setShowFormatManager] = useState(false);
  const [showCropModal, setShowCropModal] = useState(false);
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customWidth, setCustomWidth] = useState('');
  const [customHeight, setCustomHeight] = useState('');

  // 本地预设管理（持久化到 localStorage，刷新不丢失）
  const isValidPresetList = (v: unknown): boolean =>
    Array.isArray(v) && v.every(p =>
      typeof p === 'object' && p !== null &&
      typeof (p as SizePreset).id === 'string' &&
      typeof (p as SizePreset).name === 'string' &&
      typeof (p as SizePreset).fixed === 'boolean'
    );
  const isValidFormatList = (v: unknown): boolean =>
    Array.isArray(v) && v.every(f =>
      typeof f === 'object' && f !== null &&
      typeof (f as FormatPreset).id === 'string' &&
      typeof (f as FormatPreset).mimeType === 'string' &&
      typeof (f as FormatPreset).fixed === 'boolean'
    );

  const [localPresets, setLocalPresets] = usePersistentState<SizePreset[]>(
    'web-img-size-presets',
    sizePresets,
    isValidPresetList
  );
  const [localFormats, setLocalFormats] = usePersistentState<FormatPreset[]>(
    'web-img-export-formats',
    exportFormats,
    isValidFormatList
  );

  // 获取固定的预设
  const fixedPresets = useMemo(() => {
    return localPresets.filter(p => p.fixed);
  }, [localPresets]);

  // 获取固定的格式
  const fixedFormats = useMemo(() => {
    return localFormats.filter(f => f.fixed);
  }, [localFormats]);

  // 使用ref存储最新值
  const maxWidthRef = useRef<number | undefined>(undefined);
  const maxHeightRef = useRef<number | undefined>(undefined);
  const formatRef = useRef<ExportFormat>('jpeg');
  const qualityRef = useRef<number>(100);
  const resizeModeRef = useRef<'stretch' | 'crop'>('stretch');
  const cropXRef = useRef<number | undefined>(undefined);
  const cropYRef = useRef<number | undefined>(undefined);
  const originalImageRef = useRef<{ url: string; width: number; height: number } | null>(null);

  // 监听resetSignal来重置所有设置
  useEffect(() => {
    if (resetSignal > 0) {
      setQuality(DEFAULT_VALUES.quality);
      setMaxWidth(DEFAULT_VALUES.maxWidth);
      setMaxHeight(DEFAULT_VALUES.maxHeight);
      setFormat(DEFAULT_VALUES.format);
      setSelectedPreset(null);
      setResizeMode(DEFAULT_VALUES.resizeMode);
      setCropX(DEFAULT_VALUES.cropX);
      setCropY(DEFAULT_VALUES.cropY);
      setBrightness(DEFAULT_VALUES.brightness);
      setContrast(DEFAULT_VALUES.contrast);
      setSaturate(DEFAULT_VALUES.saturate);
      setBlur(DEFAULT_VALUES.blur);
      setR(DEFAULT_VALUES.r);
      setG(DEFAULT_VALUES.g);
      setB(DEFAULT_VALUES.b);
      setShowCustomInput(false);
    }
  }, [resetSignal]);

  // 同步ref值
  useEffect(() => {
    maxWidthRef.current = maxWidth;
  }, [maxWidth]);
  useEffect(() => {
    maxHeightRef.current = maxHeight;
  }, [maxHeight]);
  useEffect(() => {
    formatRef.current = format;
  }, [format]);
  useEffect(() => {
    qualityRef.current = quality;
  }, [quality]);
  useEffect(() => {
    resizeModeRef.current = resizeMode;
  }, [resizeMode]);
  useEffect(() => {
    cropXRef.current = cropX;
  }, [cropX]);
  useEffect(() => {
    cropYRef.current = cropY;
  }, [cropY]);

  useEffect(() => {
    originalImageRef.current = { url: imageUrl, width: imageWidth, height: imageHeight };
  }, [imageUrl, imageWidth, imageHeight]);

  // 处理效果函数（含 RGB 调整、镜像、旋转）
  const applyEffects = useCallback(async (img: HTMLImageElement) => {
    const rot = rotationRef.current;
    // 旋转 90/270 时需要交换宽高
    const isRot90 = rot === 90 || rot === 270;
    const cw = isRot90 ? img.height : img.width;
    const ch = isRot90 ? img.width : img.height;
    const { canvas, ctx } = createCanvas(cw, ch);

    // 应用镜像 + 旋转
    ctx.save();
    ctx.translate(cw / 2, ch / 2);
    if (isFlippedRef.current) {
      ctx.scale(-1, 1);
    }
    if (rot) {
      ctx.rotate((rot * Math.PI) / 180);
    }
    // 先绘制原图
    ctx.drawImage(img, -img.width / 2, -img.height / 2);
    ctx.restore();

    // 应用滤镜效果
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = cw;
    tempCanvas.height = ch;
    const tempCtx = tempCanvas.getContext('2d')!;
    tempCtx.filter = `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturate}%) blur(${blur}px)`;
    tempCtx.drawImage(canvas, 0, 0);
    ctx.clearRect(0, 0, cw, ch);
    ctx.filter = 'none';
    ctx.drawImage(tempCanvas, 0, 0);

    // RGB 通道微调：加法模式（-100 ~ +100），0 = 无变化
    if (r !== 0 || g !== 0 || b !== 0) {
      const imageData = ctx.getImageData(0, 0, cw, ch);
      const data = imageData.data;
      for (let i = 0; i < data.length; i += 4) {
        data[i]     = Math.min(255, Math.max(0, data[i]     + r));
        data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + g));
        data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + b));
      }
      ctx.putImageData(imageData, 0, 0);
    }

    return canvas;
  }, [brightness, contrast, saturate, blur, r, g, b]);

  const handleApply = useCallback(async () => {
    if (!originalImageRef.current) return;

    try {
      const response = await fetch(originalImageRef.current.url);
      const blob = await response.blob();

      // 先应用图像效果
      const img = await loadImage(blob);
      const effectCanvas = await applyEffects(img);

      // 从效果画布创建Blob进行压缩
      const effectBlob = await new Promise<Blob>(resolve => {
        effectCanvas.toBlob((blob) => resolve(blob!), 'image/png');
      });
      const effectFile = new File([effectBlob!], 'effect.png', { type: 'image/png' });

      // 应用压缩（所有格式均为 Canvas 原生支持：jpeg/png/webp）
      const imageFormat: ImageFormat = (formatRef.current as ImageFormat) ?? 'jpeg';
      const compressed = await compressImage(
        effectFile,
        qualityRef.current,
        maxWidthRef.current,
        maxHeightRef.current,
        imageFormat,
        resizeModeRef.current,
        cropXRef.current,
        cropYRef.current
      );

      const dataUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(compressed);
      });

      const finalImg = await loadImage(compressed);
      onApply(dataUrl, finalImg.width, finalImg.height);
      toast.success(t('processSuccess'));
    } catch {
      toast.error(t('processFailed'));
    }
  }, [onApply, applyEffects, t]);

  const handleFormatClick = useCallback((newFormat: ExportFormat) => {
    setFormat(newFormat);
    setTimeout(() => handleApply(), 0);
  }, [handleApply]);

  const handlePresetClick = useCallback((preset: SizePreset) => {
    setSelectedPreset(preset.id);
    setMaxWidth(preset.width);
    setMaxHeight(preset.height);
    setCropX(undefined);
    setCropY(undefined);
    setShowCustomInput(false);
    setTimeout(() => handleApply(), 0);
  }, [handleApply]);
  const handleQualityChangeEnd = useCallback(() => {
    setTimeout(() => handleApply(), 0);
  }, [handleApply]);

  const handleSliderChangeEnd = useCallback(() => {
    setTimeout(() => handleApply(), 150);
  }, [handleApply]);

  const handleCustomClick = useCallback(() => {
    setShowCustomInput(true);
    setSelectedPreset(null);
    setCustomWidth('');
    setCustomHeight('');
  }, []);

  const handleCustomApply = useCallback(() => {
    setMaxWidth(customWidth ? Number(customWidth) : undefined);
    setMaxHeight(customHeight ? Number(customHeight) : undefined);
    setTimeout(() => handleApply(), 0);
  }, [customWidth, customHeight, handleApply]);

  const handleResizeModeClick = useCallback((mode: 'stretch' | 'crop') => {
    setResizeMode(mode);
    if (mode === 'crop' && maxWidth && maxHeight) {
      setShowCropModal(true);
    } else {
      setTimeout(() => handleApply(), 0);
    }
  }, [handleApply, maxWidth, maxHeight]);

  // 裁剪回调
  const handleCropConfirm = useCallback((x: number, y: number, actualWidth?: number, actualHeight?: number) => {
    setCropX(x);
    setCropY(y);
    if (actualWidth && actualHeight) {
      setMaxWidth(actualWidth);
      setMaxHeight(actualHeight);
      setSelectedPreset(null);
    }
    setTimeout(() => handleApply(), 0);
  }, [handleApply]);

  return (
    <div className="flex flex-col gap-4">
      {/* 目标格式 */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium">{t('targetFormat')}</label>
          <button
            onClick={() => setShowFormatManager(true)}
            className="p-1 rounded hover:bg-muted"
            title={t('manageFormats')}
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {fixedFormats.map((f) => (
            <button
              key={f.id}
              onClick={() => handleFormatClick(f.id as ExportFormat)}
              className={cn(
                'px-3 py-2 rounded-lg text-sm transition-all relative',
                format === f.id
                  ? 'bg-primary text-primary-foreground ring-2 ring-primary/50'
                  : 'bg-muted hover:bg-muted/80'
              )}
            >
              <div className="font-medium">{f.name}</div>
              <div className="text-xs opacity-70">{f.extension}</div>
            </button>
          ))}
        </div>
      </div>

      {/* 预设尺寸 */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium">{t('presetSize')}</label>
          <button
            onClick={() => setShowPresetManager(true)}
            className="p-1 rounded hover:bg-muted"
            title={t('managePresets')}
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
        <div className="flex flex-wrap gap-2 mb-3">
          {fixedPresets.map((preset) => (
            <button
              key={preset.id}
              onClick={() => handlePresetClick(preset)}
              className={cn(
                'px-3 py-2 rounded-lg text-sm transition-all relative',
                selectedPreset === preset.id
                  ? 'bg-primary text-primary-foreground ring-2 ring-primary/50'
                  : 'bg-muted hover:bg-muted/80'
              )}
            >
              <div className="font-medium">
                {language === 'zh' ? preset.name : preset.nameEn}
              </div>
              {preset.width && preset.height && (
                <div className="text-xs opacity-70">
                  {preset.width} × {preset.height}
                </div>
              )}
            </button>
          ))}
          {/* 自定义按钮 */}
          <button
            onClick={handleCustomClick}
            className={cn(
              'px-3 py-2 rounded-lg text-sm transition-all relative flex items-center gap-1',
              showCustomInput
                ? 'bg-primary text-primary-foreground ring-2 ring-primary/50'
                : 'bg-muted hover:bg-muted/80'
            )}
          >
            <Plus className="w-4 h-4" />
            {t('custom')}
          </button>
        </div>

        {/* 自定义尺寸输入框 */}
        {showCustomInput && (
          <div className="space-y-3 mb-3">
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground w-12 shrink-0">
                  {t('width')}
                </span>
                <input
                  type="number"
                  placeholder="1920"
                  value={customWidth}
                  onChange={(e) => setCustomWidth(e.target.value)}
                  className="flex-1 px-3 py-2 rounded-lg bg-background border border-border text-sm"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground w-12 shrink-0">
                  {t('height')}
                </span>
                <input
                  type="number"
                  placeholder="1080"
                  value={customHeight}
                  onChange={(e) => setCustomHeight(e.target.value)}
                  className="flex-1 px-3 py-2 rounded-lg bg-background border border-border text-sm"
                />
              </div>
            </div>
            <button
              onClick={handleCustomApply}
              className="w-full px-3 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 text-sm"
            >
              {t('applyCustomSize')}
            </button>
          </div>
        )}

        {/* 调整方式 */}
        <div className="flex items-center justify-between mb-2 mt-4">
          <label className="text-sm font-medium">{t('resizeMode')}</label>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => handleResizeModeClick('stretch')}
            className={cn(
              'flex-1 px-3 py-2 rounded-lg text-sm transition-all relative',
              resizeMode === 'stretch'
                ? 'bg-primary text-primary-foreground ring-2 ring-primary/50'
                : 'bg-muted hover:bg-muted/80'
            )}
          >
            {t('stretchMode')}
          </button>
          <button
            onClick={() => handleResizeModeClick('crop')}
            className={cn(
              'flex-1 px-3 py-2 rounded-lg text-sm transition-all relative flex items-center justify-center gap-1',
              resizeMode === 'crop'
                ? 'bg-primary text-primary-foreground ring-2 ring-primary/50'
                : 'bg-muted hover:bg-muted/80'
            )}
          >
            <CropIcon className="w-4 h-4" />
            {t('cropMode')}
          </button>
        </div>
      </div>

      {/* 压缩质量 */}
      <div>
        <SliderWithInput
          label={t('compressQuality')}
          value={quality}
          onChange={setQuality}
          onChangeEnd={handleQualityChangeEnd}
          min={1}
          max={100}
          suffix="%"
        />
      </div>

      {/* 分割线 */}
      <div className="border-t border-border my-2"></div>

      {/* 图像效果 */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium">{t('imageEffects')}</h3>

        {/* 亮度 */}
        <SliderWithInput
          label={t('brightness')}
          value={brightness}
          onChange={setBrightness}
          onChangeEnd={handleSliderChangeEnd}
          min={0}
          max={200}
          suffix="%"
        />

        {/* 对比度 */}
        <SliderWithInput
          label={t('contrast')}
          value={contrast}
          onChange={setContrast}
          onChangeEnd={handleSliderChangeEnd}
          min={0}
          max={200}
          suffix="%"
        />

        {/* 饱和度 */}
        <SliderWithInput
          label={t('saturate')}
          value={saturate}
          onChange={setSaturate}
          onChangeEnd={handleSliderChangeEnd}
          min={0}
          max={200}
          suffix="%"
        />

        {/* 模糊 */}
        <SliderWithInput
          label={t('blur')}
          value={blur}
          onChange={setBlur}
          onChangeEnd={handleSliderChangeEnd}
          min={0}
          max={20}
          suffix="px"
        />
      </div>

      {/* 分割线 */}
      <div className="border-t border-border my-2"></div>

      {/* RGB通道微调 */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium">{t('rgbAdjustments')}</h3>

        {/* 红色通道 */}
        <SliderWithInput
          label="R"
          value={r}
          onChange={setR}
          onChangeEnd={handleSliderChangeEnd}
          min={-100}
          max={100}
          suffix=""
          labelClass="text-red-500"
        />

        {/* 绿色通道 */}
        <SliderWithInput
          label="G"
          value={g}
          onChange={setG}
          onChangeEnd={handleSliderChangeEnd}
          min={-100}
          max={100}
          suffix=""
          labelClass="text-green-500"
        />

        {/* 蓝色通道 */}
        <SliderWithInput
          label="B"
          value={b}
          onChange={setB}
          onChangeEnd={handleSliderChangeEnd}
          min={-100}
          max={100}
          suffix=""
          labelClass="text-blue-500"
        />
      </div>

      {/* 预设管理模态框 */}
      <PresetManagerModal
        isOpen={showPresetManager}
        onClose={() => setShowPresetManager(false)}
        presets={localPresets}
        onPresetsChange={setLocalPresets}
      />

      {/* 格式管理模态框 */}
      <FormatManagerModal
        isOpen={showFormatManager}
        onClose={() => setShowFormatManager(false)}
        formats={localFormats}
        onFormatsChange={setLocalFormats}
      />

      {/* 裁剪模态框 */}
      {showCropModal && maxWidth && maxHeight && (
        <CropModal
          isOpen={showCropModal}
          onClose={() => setShowCropModal(false)}
          imageUrl={imageUrl}
          imageWidth={imageWidth}
          imageHeight={imageHeight}
          cropWidth={maxWidth}
          cropHeight={maxHeight}
          onCrop={handleCropConfirm}
          initialX={cropX}
          initialY={cropY}
        />
      )}
    </div>
  );
}
