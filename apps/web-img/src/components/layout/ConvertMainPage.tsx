'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useDragDrop } from '@/hooks/useDragDrop';
import { useConversionPool } from '@/hooks/useConversionPool';
import { loadImage } from '@/utils/canvas';
import { canvasToBMP, encodeAVIF, encodeICO, encodeJXL, encodeTIFF } from '@/utils/imageEncoders';
import { encodeGIF } from '@/utils/gifEncoder';
import type { ConvertRequest, ConvertSuccess } from '@/workers/protocol';
import { downloadFile, formatFileSize } from '@/utils/file';
import { saveAsset } from '@/utils/osAssets';
import { normalizeImageFiles } from '@/utils/heicDecode';
import { normalizeTiffFiles } from '@/utils/tiffDecode';
import { normalizeJxlFiles } from '@/utils/jxlDecode';
import { SliderWithInput } from '@/components/ui/SliderWithInput';
import { EmptyState } from '@/components/ui/EmptyState';
import { DragOverlay } from '@/components/ui/DragOverlay';
import {
  FileImage, ArrowLeft, X, Loader2, Download, Trash2,
  PackageCheck, CheckCircle2, XCircle, Circle, Repeat, Film,
  ImagePlus, Check,
} from 'lucide-react';
import JSZip from 'jszip';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/hooks/useLanguage';

interface ConvertMainPageProps {
  lang: 'en' | 'zh';
}

type TargetFormat = 'jpeg' | 'png' | 'webp' | 'avif' | 'jxl' | 'gif' | 'bmp' | 'tiff' | 'ico';

type ItemStatus = 'pending' | 'converting' | 'done' | 'error';

interface ConvertItem {
  id: string;
  file: File;
  url: string;
  width: number;
  height: number;
  status: ItemStatus;
  result?: {
    blob: Blob;
    width: number;
    height: number;
    filename: string;
  };
}

/** 目标格式定义（含中英文描述） */
const FORMATS: { id: TargetFormat; ext: string; quality: boolean; note: { zh: string; en: string } }[] = [
  { id: 'jpeg', ext: '.jpg', quality: true, note: { zh: '有损压缩，体积小', en: 'Lossy, small size' } },
  { id: 'png', ext: '.png', quality: false, note: { zh: '无损，支持透明', en: 'Lossless, transparency' } },
  { id: 'webp', ext: '.webp', quality: true, note: { zh: '比 JPEG 小 25-35%', en: '25-35% smaller than JPEG' } },
  { id: 'avif', ext: '.avif', quality: true, note: { zh: '新一代有损，比 WebP 更小', en: 'Next-gen lossy, smaller than WebP' } },
  { id: 'jxl', ext: '.jxl', quality: true, note: { zh: 'JPEG XL，质量 100 为无损', en: 'JPEG XL, lossless at 100' } },
  { id: 'tiff', ext: '.tiff', quality: false, note: { zh: '无损位图，支持透明', en: 'Lossless, supports alpha' } },
  { id: 'gif', ext: '.gif', quality: false, note: { zh: '索引色，最大 256 色，支持透明', en: 'Indexed ≤256 colors, transparency' } },
  { id: 'bmp', ext: '.bmp', quality: false, note: { zh: '无压缩位图，不支持透明', en: 'Uncompressed, no alpha' } },
  { id: 'ico', ext: '.ico', quality: false, note: { zh: '多尺寸图标（16-256px）', en: 'Multi-size icon (16-256px)' } },
];

/** 浏览器可解码的图片扩展名（含原生解码的 avif/svg；heic 由归一化层转换） */
const SUPPORTED_EXTENSIONS = [
  '.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp',
  '.svg', '.ico', '.avif', '.jxl', '.tif', '.tiff', '.heic', '.heif',
];

const isSupportedImage = (file: File): boolean => {
  if (file.type.startsWith('image/')) return true;
  const ext = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
  return SUPPORTED_EXTENSIONS.includes(ext);
};

export default function ConvertMainPage({ lang: _lang }: ConvertMainPageProps) {
  // 界面语言实时跟随系统共享语言（ale-os-language），服务端 lang 仅作 SEO/兜底
  const { language } = useLanguage();
  useEffect(() => {
    document.documentElement.lang = language === 'zh' ? 'zh-CN' : 'en';
  }, [language]);

  const router = useRouter();
  const [items, setItems] = useState<ConvertItem[]>([]);
  const [format, setFormat] = useState<TargetFormat>('png');
  const [quality, setQuality] = useState(90);
  const [limitSize, setLimitSize] = useState(false);
  const [maxWidth, setMaxWidth] = useState('1920');
  const [maxHeight, setMaxHeight] = useState('1080');
  const [isConverting, setIsConverting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastConvertSettings, setLastConvertSettings] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 转换设置快照，用于判断已有结果是否过期
  const settingsKey = `${format}|${quality}|${limitSize}|${maxWidth}|${maxHeight}`;

  // SliderWithInput 要求 onChangeEnd；转换页为手动触发，无需回调
  const noop = useCallback(() => {}, []);

  // 追踪缩略图 ObjectURL，卸载时统一释放
  const urlsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const tracked = urlsRef.current;
    return () => {
      tracked.forEach(url => URL.revokeObjectURL(url));
      tracked.clear();
    };
  }, []);

  const trackUrl = useCallback((url: string) => {
    urlsRef.current.add(url);
  }, []);

  /** 加载图片尺寸；SVG 无固有尺寸时回退到 1024×1024 */
  const measureImage = useCallback(async (file: File): Promise<{ width: number; height: number }> => {
    const img = await loadImage(file);
    const width = img.naturalWidth || 1024;
    const height = img.naturalHeight || 1024;
    return { width, height };
  }, []);

  const addFiles = useCallback(async (files: File[]) => {
    const valid = files.filter(isSupportedImage);
    if (valid.length === 0) {
      setError(language === 'zh' ? '仅支持图片文件' : 'Only image files are supported');
      return;
    }
    setError(null);

    // HEIC→JPEG、TIFF→PNG、JXL→PNG（浏览器原生无法解码），保证后续转换路径可用
    const normalizedHeic = await normalizeImageFiles(valid, language);
    const normalizedTiff = await normalizeTiffFiles(normalizedHeic, language);
    const normalized = await normalizeJxlFiles(normalizedTiff, language);

    for (const file of normalized) {
      try {
        const { width, height } = await measureImage(file);
        const url = URL.createObjectURL(file);
        trackUrl(url);
        setItems(prev => [...prev, {
          id: `${file.name}-${file.size}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          file,
          url,
          width,
          height,
          status: 'pending',
        }]);
      } catch {
        // 跳过无法解码的文件
      }
    }
  }, [language, measureImage, trackUrl]);

  const handleRemoveItem = useCallback((id: string) => {
    setItems(prev => {
      const item = prev.find(i => i.id === id);
      if (item && urlsRef.current.delete(item.url)) {
        URL.revokeObjectURL(item.url);
      }
      return prev.filter(i => i.id !== id);
    });
  }, []);

  const handleClearAll = useCallback(() => {
    urlsRef.current.forEach(url => URL.revokeObjectURL(url));
    urlsRef.current.clear();
    setItems([]);
  }, []);

  // ── 转换核心（主线程实现，同时作为 Worker 池的兜底路径）──
  const convertOne = useCallback(async (file: File): Promise<ConvertItem['result']> => {
    const img = await loadImage(file);
    const srcW = img.naturalWidth || 1024;
    const srcH = img.naturalHeight || 1024;

    // 可选：限制最大尺寸（等比缩小，只缩不放）
    let targetW = srcW;
    let targetH = srcH;
    if (limitSize) {
      const mw = parseInt(maxWidth) || 0;
      const mh = parseInt(maxHeight) || 0;
      if (mw > 0 && mh > 0) {
        const scale = Math.min(1, mw / srcW, mh / srcH);
        targetW = Math.max(1, Math.round(srcW * scale));
        targetH = Math.max(1, Math.round(srcH * scale));
      }
    }

    const baseName = file.name.replace(/\.[^/.]+$/, '');
    const formatDef = FORMATS.find(f => f.id === format)!;
    const filename = `${baseName}${formatDef.ext}`;

    if (format === 'ico') {
      // ICO：以原始分辨率为源，内部自行生成多尺寸
      const blob = await encodeICO(img, srcW, srcH);
      return { blob, width: 256, height: 256, filename };
    }

    const canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas unavailable');

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    if (format === 'bmp') {
      // BMP 无透明通道，先合成白色背景
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, targetW, targetH);
    }
    ctx.drawImage(img, 0, 0, targetW, targetH);

    if (format === 'gif') {
      // GIF 支持索引透明，不做白底合成
      const imageData = ctx.getImageData(0, 0, targetW, targetH);
      return { blob: encodeGIF(imageData), width: targetW, height: targetH, filename };
    }

    if (format === 'tiff') {
      // TIFF 支持 alpha 透明，不做白底合成
      const imageData = ctx.getImageData(0, 0, targetW, targetH);
      return { blob: encodeTIFF(imageData), width: targetW, height: targetH, filename };
    }

    if (format === 'avif') {
      // AVIF：原生 canvas 不支持编码，走 libavif WASM（懒加载）
      const imageData = ctx.getImageData(0, 0, targetW, targetH);
      return {
        blob: await encodeAVIF(imageData, quality),
        width: targetW,
        height: targetH,
        filename,
      };
    }

    if (format === 'jxl') {
      // JPEG XL：原生 canvas 不支持编码，走 libjxl WASM（懒加载）
      const imageData = ctx.getImageData(0, 0, targetW, targetH);
      return {
        blob: await encodeJXL(imageData, quality),
        width: targetW,
        height: targetH,
        filename,
      };
    }

    if (format === 'bmp') {
      const blob = canvasToBMP(canvas);
      if (!blob) throw new Error('BMP encode failed');
      return { blob, width: targetW, height: targetH, filename };
    }

    const q = formatDef.quality ? quality / 100 : undefined;
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error(`${format} encode failed`))),
        `image/${format}`,
        q
      );
    });
    return { blob, width: targetW, height: targetH, filename };
  }, [format, quality, limitSize, maxWidth, maxHeight]);

  // Worker 线程池并发转换；不可用时自动回退上面的主线程实现
  const convertViaPool = useConversionPool(
    useCallback(async (req: ConvertRequest): Promise<ConvertSuccess> => {
      const result = await convertOne(req.file);
      if (!result) throw new Error('convert failed');
      return { id: req.id, ok: true, ...result };
    }, [convertOne])
  );

  const handleConvertAll = useCallback(async () => {
    const pending = items.filter(i => i.status !== 'converting');
    if (pending.length === 0) return;

    setIsConverting(true);
    setError(null);
    setLastConvertSettings(settingsKey);
    const ids = new Set(pending.map(i => i.id));
    setItems(prev => prev.map(i => (ids.has(i.id) ? { ...i, status: 'converting', result: undefined } : i)));

    const convertItem = async (item: ConvertItem): Promise<ConvertSuccess> => {
      const req: ConvertRequest = {
        id: item.id,
        file: item.file,
        format,
        quality,
        maxWidth: limitSize && parseInt(maxWidth) > 0 ? parseInt(maxWidth) : null,
        maxHeight: limitSize && parseInt(maxHeight) > 0 ? parseInt(maxHeight) : null,
      };
      if (format === 'avif' || format === 'jxl') {
        // AVIF/JXL 编码器为 WASM 懒加载，固定在主线程执行（避免 Worker 打包 WASM 资产）
        const result = await convertOne(item.file);
        if (!result) throw new Error('convert failed');
        return { id: req.id, ok: true, ...result };
      }
      return convertViaPool.run(req);
    };

    // 并发派发：Worker 池内多线程并行，结果逐个返回时更新对应条目
    await Promise.all(pending.map(async item => {
      try {
        const res = await convertItem(item);
        setItems(prev =>
          prev.map(i =>
            i.id === item.id
              ? { ...i, status: 'done', result: { blob: res.blob, width: res.width, height: res.height, filename: res.filename } }
              : i
          )
        );
      } catch {
        setItems(prev => prev.map(i => (i.id === item.id ? { ...i, status: 'error' } : i)));
      }
    }));

    setIsConverting(false);
  }, [items, convertViaPool, convertOne, format, quality, limitSize, maxWidth, maxHeight, settingsKey]);

  const doneItems = items.filter(i => i.status === 'done' && i.result);

  // ── 系统图库：转换产物一键入库（ale-os-assets，供系统图库 App 与其他应用取用）──
  const [gallerySavedIds, setGallerySavedIds] = useState<Set<string>>(new Set());
  const [gallerySavingIds, setGallerySavingIds] = useState<Set<string>>(new Set());

  const blobToDataUrl = useCallback(async (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  }, []);

  const handleSaveToGallery = useCallback(async (item: ConvertItem) => {
    if (!item.result) return;
    try {
      setGallerySavingIds(prev => new Set(prev).add(item.id));
      const dataUrl = await blobToDataUrl(item.result.blob);
      await saveAsset({ name: item.result.filename, dataUrl });
      setGallerySavedIds(prev => new Set(prev).add(item.id));
    } catch {
      // 存储不可用（如隐私模式）时静默失败，按钮保持未保存态
    } finally {
      setGallerySavingIds(prev => {
        const next = new Set(prev);
        next.delete(item.id);
        return next;
      });
    }
  }, [blobToDataUrl]);

  // 设置在转换后发生变更 → 已有结果视为过期
  const hasStaleResults = doneItems.length > 0 && settingsKey !== lastConvertSettings;

  const handleDownloadAll = useCallback(async () => {
    if (doneItems.length === 0) return;

    if (doneItems.length === 1) {
      downloadFile(doneItems[0].result!.blob, doneItems[0].result!.filename);
      return;
    }

    // 多文件打包 ZIP；重名文件追加序号
    const zip = new JSZip();
    const usedNames = new Set<string>();
    for (const item of doneItems) {
      let name = item.result!.filename;
      let n = 1;
      while (usedNames.has(name.toLowerCase())) {
        const dot = item.result!.filename.lastIndexOf('.');
        name = `${item.result!.filename.slice(0, dot)}(${n})${item.result!.filename.slice(dot)}`;
        n++;
      }
      usedNames.add(name.toLowerCase());
      zip.file(name, item.result!.blob);
    }
    const zipBlob = await zip.generateAsync({ type: 'blob' });
    downloadFile(zipBlob, `web-img-convert-${Date.now()}.zip`);
  }, [doneItems]);

  // ── 拖拽 ──
  const handleDragFiles = useCallback((files: File[]) => {
    void addFiles(files);
  }, [addFiles]);
  const { isDragging, dragHandlers } = useDragDrop(handleDragFiles);

  // ── 文案 ──
  const t = {
    back: language === 'zh' ? '返回' : 'Back',
    title: language === 'zh' ? '图片格式转换' : 'Image Converter',
    uploadTitle: language === 'zh' ? '拖拽图片到此处' : 'Drag images here',
    uploadHint: language === 'zh' ? '或点击选择文件 · 支持批量' : 'Or click to select files · batch supported',
    targetFormat: language === 'zh' ? '目标格式' : 'Target Format',
    quality: language === 'zh' ? '质量' : 'Quality',
    limitSize: language === 'zh' ? '限制最大尺寸（等比缩小）' : 'Limit max size (downscale)',
    width: language === 'zh' ? '宽' : 'W',
    height: language === 'zh' ? '高' : 'H',
    convertAll: language === 'zh' ? '开始转换' : 'Convert All',
    converting: language === 'zh' ? '转换中...' : 'Converting...',
    downloadAll: language === 'zh' ? '打包下载' : 'Download All',
    clearAll: language === 'zh' ? '清空' : 'Clear',
    gifMaker: language === 'zh' ? 'GIF 合成' : 'GIF Maker',
    files: language === 'zh' ? '个文件' : 'files',
    original: language === 'zh' ? '原图' : 'Original',
    result: language === 'zh' ? '结果' : 'Result',
    pending: language === 'zh' ? '待转换' : 'Pending',
    failed: language === 'zh' ? '转换失败' : 'Failed',
    staleHint: language === 'zh'
      ? '设置已更改，重新转换以更新结果'
      : 'Settings changed — convert again to update results',
    privacyNote: language === 'zh'
      ? '所有转换在浏览器本地完成，文件不会上传到服务器'
      : 'All conversions run locally in your browser — files never leave your device',
    saveGallery: language === 'zh' ? '存入系统图库' : 'Save to system gallery',
    savedGallery: language === 'zh' ? '已存入系统图库' : 'Saved to system gallery',
    savingGallery: language === 'zh' ? '正在存入图库…' : 'Saving to gallery…',
  };

  const doneCount = doneItems.length;

  return (
    <div
      className={cn(
        'flex flex-col min-h-screen bg-background text-foreground transition-colors duration-200',
        isDragging && !isConverting && 'bg-primary/5'
      )}
      {...dragHandlers}
    >
      {/* 拖拽指示器 */}
      {isDragging && !isConverting && <DragOverlay icon={<FileImage className="w-14 h-14" />} label={t.uploadTitle} />}

      {/* 顶部导航 */}
      <header className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-card shrink-0 z-10">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/')}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted hover:bg-muted/80 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>{t.back}</span>
          </button>
          <h1 className="text-lg font-bold text-primary">{t.title}</h1>
        </div>
        <div className="flex items-center gap-1.5">
          <a
            href={language === 'zh' ? '/zh/gif' : '/gif'}
            className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
            title={t.gifMaker}
            aria-label={t.gifMaker}
          >
            <Film className="w-4.5 h-4.5" />
          </a>
          {items.length > 0 && (
            <button
              onClick={handleClearAll}
              disabled={isConverting}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted hover:bg-muted/80 disabled:opacity-50 transition-colors text-sm"
            >
              <Trash2 className="w-4 h-4" />
              <span>{t.clearAll}</span>
            </button>
          )}
        </div>
      </header>

      {/* 主内容：移动端上下堆叠，桌面端左右分栏 */}
      <main className="flex-1 flex flex-col lg:flex-row min-h-0">
        {/* 设置面板 */}
        <aside className="w-full lg:w-64 shrink-0 border-b lg:border-b-0 lg:border-r border-border bg-card p-4 space-y-5 overflow-y-auto scrollbar-thin">
          {/* 目标格式 */}
          <div>
            <label className="block text-sm font-medium mb-2">{t.targetFormat}</label>
            <div className="grid grid-cols-2 gap-1.5">
              {FORMATS.map((f) => (
                <button
                  key={f.id}
                  onClick={() => setFormat(f.id)}
                  disabled={isConverting}
                  className={cn(
                    'text-left px-3 py-2 rounded-lg transition-all',
                    format === f.id
                      ? 'bg-primary text-primary-foreground ring-2 ring-primary/50'
                      : 'bg-muted hover:bg-muted/80',
                    isConverting && 'opacity-60 cursor-not-allowed'
                  )}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-sm font-medium uppercase">{f.id}</span>
                    <span className="text-xs opacity-70 font-mono">{f.ext}</span>
                  </div>
                  <div className="text-xs opacity-70 leading-tight mt-0.5">
                    {language === 'zh' ? f.note.zh : f.note.en}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* 质量（仅 jpeg/webp） */}
          {FORMATS.find(f => f.id === format)?.quality && (
            <SliderWithInput
              label={t.quality}
              value={quality}
              onChange={setQuality}
              onChangeEnd={noop}
              min={1}
              max={100}
              suffix="%"
            />
          )}

          {/* 尺寸限制 */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium mb-2 cursor-pointer">
              <input
                type="checkbox"
                checked={limitSize}
                onChange={(e) => setLimitSize(e.target.checked)}
                disabled={isConverting}
                className="accent-[var(--primary)]"
              />
              {t.limitSize}
            </label>
            {limitSize && (
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={maxWidth}
                  onChange={(e) => setMaxWidth(e.target.value)}
                  placeholder="1920"
                  disabled={isConverting}
                  className="w-full px-2 py-1.5 rounded-lg bg-background border border-border text-sm"
                />
                <span className="text-muted-foreground">×</span>
                <input
                  type="number"
                  value={maxHeight}
                  onChange={(e) => setMaxHeight(e.target.value)}
                  placeholder="1080"
                  disabled={isConverting}
                  className="w-full px-2 py-1.5 rounded-lg bg-background border border-border text-sm"
                />
              </div>
            )}
          </div>

          {/* 操作按钮 */}
          <div className="space-y-2 pt-2 border-t border-border">
            <button
              onClick={() => void handleConvertAll()}
              disabled={items.length === 0 || isConverting}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm text-sm font-medium"
            >
              {isConverting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Repeat className="w-4 h-4" />}
              <span>{isConverting ? t.converting : t.convertAll}</span>
            </button>
            <button
              onClick={() => void handleDownloadAll()}
              disabled={doneCount === 0 || isConverting}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-muted hover:bg-muted/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
            >
              {doneCount > 1 ? <PackageCheck className="w-4 h-4" /> : <Download className="w-4 h-4" />}
              <span>{t.downloadAll}{doneCount > 0 ? ` (${doneCount})` : ''}</span>
            </button>
            {hasStaleResults && (
              <p className="text-xs text-amber-600 dark:text-amber-400 text-center">⚠ {t.staleHint}</p>
            )}
          </div>

          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded-lg text-red-600 dark:text-red-400 text-xs">
              {error}
            </div>
          )}
        </aside>

        {/* 文件列表 */}
        <div className="flex-1 overflow-y-auto scrollbar-thin min-h-0">
          {items.length === 0 ? (
            <div className="h-full flex items-center justify-center p-8">
              <div className="w-full max-w-xl">
                <div
                  className="relative flex flex-col items-center justify-center w-full border-2 border-dashed rounded-xl cursor-pointer transition-all duration-200 py-14 hover:border-primary/50 hover:bg-muted/50"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <EmptyState variant="convert" title={t.uploadTitle} description={t.uploadHint} />
                  <div className="flex flex-wrap justify-center gap-1.5 mt-5 px-4">
                    {['JPG', 'PNG', 'WebP', 'GIF', 'BMP', 'SVG', 'ICO', 'AVIF', 'JXL', 'TIFF'].map((ext) => (
                      <span
                        key={ext}
                        className="px-2 py-0.5 text-xs font-mono rounded-md bg-muted text-muted-foreground transition-colors hover:text-foreground"
                      >
                        {ext}
                      </span>
                    ))}
                  </div>
                </div>
                <p className="text-center text-xs text-muted-foreground mt-6">🔒 {t.privacyNote}</p>
              </div>
            </div>
          ) : (
            <div className="p-4 space-y-2">
              {items.map((item, idx) => (
                <div
                  key={item.id}
                  style={{ animationDelay: `${Math.min(idx * 35, 280)}ms` }}
                  className="relative overflow-hidden flex items-center gap-3 p-3 rounded-lg bg-card border border-border animate-in fade-in slide-in-from-bottom-1 anim-fill-backwards duration-300"
                >
                  {/* 转换中：行内不确定进度条 */}
                  {item.status === 'converting' && <span aria-hidden="true" className="progress-indeterminate" />}
                  {/* 缩略图 */}
                  <img
                    src={item.url}
                    alt={item.file.name}
                    className="w-12 h-12 object-cover rounded shrink-0"
                  />
                  {/* 信息 */}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{item.file.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {item.width} × {item.height} · {formatFileSize(item.file.size)}
                      {item.status === 'done' && item.result && (
                        <>
                          {' → '}
                          <span className={
                            item.result.blob.size <= item.file.size
                              ? 'text-green-600 dark:text-green-400'
                              : 'text-amber-600 dark:text-amber-400'
                          }>
                            {formatFileSize(item.result.blob.size)}
                          </span>
                          {' · '}
                          {item.result.width} × {item.result.height}
                        </>
                      )}
                    </div>
                  </div>
                  {/* 状态（不同图标类型切换时重挂载，入场动画自动重放） */}
                  <div className="shrink-0">
                    {item.status === 'pending' && <Circle className="w-4 h-4 text-muted-foreground/40" />}
                    {item.status === 'converting' && <Loader2 className="w-4 h-4 animate-spin text-primary" />}
                    {item.status === 'done' && (
                      <span className="inline-flex animate-in zoom-in-95 fade-in duration-200">
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                      </span>
                    )}
                    {item.status === 'error' && (
                      <span className="inline-flex animate-shake">
                        <XCircle className="w-4 h-4 text-destructive" />
                      </span>
                    )}
                  </div>
                  {/* 操作 */}
                  <div className="flex items-center gap-1 shrink-0">
                    {item.status === 'done' && item.result && (
                      <>
                        <button
                          onClick={() => void handleSaveToGallery(item)}
                          disabled={gallerySavingIds.has(item.id)}
                          className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors disabled:opacity-60"
                          title={
                            gallerySavedIds.has(item.id)
                              ? t.savedGallery
                              : gallerySavingIds.has(item.id)
                                ? t.savingGallery
                                : t.saveGallery
                          }
                        >
                          {gallerySavedIds.has(item.id) ? (
                            <Check className="w-4 h-4 text-green-500" />
                          ) : (
                            <ImagePlus className="w-4 h-4" />
                          )}
                        </button>
                        <button
                          onClick={() => downloadFile(item.result!.blob, item.result!.filename)}
                          className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                          title={t.downloadAll}
                        >
                          <Download className="w-4 h-4" />
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => handleRemoveItem(item.id)}
                      disabled={isConverting}
                      className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50"
                      title={t.clearAll}
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
              {/* 追加更多 */}
              {!isConverting && (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full py-3 rounded-lg border border-dashed border-border hover:border-primary/50 hover:bg-muted/50 text-sm text-muted-foreground transition-colors"
                >
                  + {t.uploadHint}
                </button>
              )}
            </div>
          )}
        </div>
      </main>

      {/* 共享文件选择器（空状态与追加按钮共用） */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            void addFiles(Array.from(e.target.files));
          }
          e.target.value = '';
        }}
        className="hidden"
      />

      {/* 底部说明 */}
      <footer className="px-4 py-2 border-t border-border bg-muted/10 text-xs text-muted-foreground text-center shrink-0">
        🔒 {t.privacyNote}
      </footer>
    </div>
  );
}
