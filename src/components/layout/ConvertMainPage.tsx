'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useDragDrop } from '@/hooks/useDragDrop';
import { loadImage } from '@/utils/canvas';
import { canvasToBMP, encodeICO } from '@/utils/imageEncoders';
import { downloadFile, formatFileSize } from '@/utils/file';
import {
  FileImage, ArrowLeft, X, Loader2, Download, Trash2,
  PackageCheck, CheckCircle2, XCircle, Circle, Repeat,
} from 'lucide-react';
import JSZip from 'jszip';
import { cn } from '@/lib/utils';

interface ConvertMainPageProps {
  lang: 'en' | 'zh';
}

type TargetFormat = 'jpeg' | 'png' | 'webp' | 'bmp' | 'ico';

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
  { id: 'bmp', ext: '.bmp', quality: false, note: { zh: '无压缩位图，不支持透明', en: 'Uncompressed, no alpha' } },
  { id: 'ico', ext: '.ico', quality: false, note: { zh: '多尺寸图标（16-256px）', en: 'Multi-size icon (16-256px)' } },
];

/** 浏览器可解码的图片扩展名（含原生解码的 avif/svg） */
const SUPPORTED_EXTENSIONS = [
  '.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp',
  '.svg', '.ico', '.avif', '.tif', '.tiff',
];

const isSupportedImage = (file: File): boolean => {
  if (file.type.startsWith('image/')) return true;
  const ext = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
  return SUPPORTED_EXTENSIONS.includes(ext);
};

export default function ConvertMainPage({ lang }: ConvertMainPageProps) {
  useEffect(() => {
    document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
  }, [lang]);

  const router = useRouter();
  const [items, setItems] = useState<ConvertItem[]>([]);
  const [format, setFormat] = useState<TargetFormat>('png');
  const [quality, setQuality] = useState(90);
  const [limitSize, setLimitSize] = useState(false);
  const [maxWidth, setMaxWidth] = useState('1920');
  const [maxHeight, setMaxHeight] = useState('1080');
  const [isConverting, setIsConverting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      setError(lang === 'zh' ? '仅支持图片文件' : 'Only image files are supported');
      return;
    }
    setError(null);

    for (const file of valid) {
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
  }, [lang, measureImage, trackUrl]);

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

  // ── 转换核心 ──
  const convertOne = useCallback(async (item: ConvertItem): Promise<ConvertItem['result']> => {
    const img = await loadImage(item.file);
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

    const baseName = item.file.name.replace(/\.[^/.]+$/, '');
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

  const handleConvertAll = useCallback(async () => {
    const pending = items.filter(i => i.status !== 'converting');
    if (pending.length === 0) return;

    setIsConverting(true);
    setError(null);
    const ids = new Set(pending.map(i => i.id));
    setItems(prev => prev.map(i => (ids.has(i.id) ? { ...i, status: 'converting', result: undefined } : i)));

    for (const item of pending) {
      try {
        const result = await convertOne(item);
        setItems(prev => prev.map(i => (i.id === item.id ? { ...i, status: 'done', result } : i)));
      } catch {
        setItems(prev => prev.map(i => (i.id === item.id ? { ...i, status: 'error' } : i)));
      }
    }

    setIsConverting(false);
  }, [items, convertOne]);

  const doneItems = items.filter(i => i.status === 'done' && i.result);

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
    back: lang === 'zh' ? '返回' : 'Back',
    title: lang === 'zh' ? '图片格式转换' : 'Image Converter',
    uploadTitle: lang === 'zh' ? '拖拽图片到此处' : 'Drag images here',
    uploadHint: lang === 'zh' ? '或点击选择文件 · 支持批量' : 'Or click to select files · batch supported',
    supported: lang === 'zh'
      ? '支持 JPG / PNG / WebP / GIF / BMP / SVG / ICO / AVIF 输入'
      : 'Accepts JPG / PNG / WebP / GIF / BMP / SVG / ICO / AVIF input',
    targetFormat: lang === 'zh' ? '目标格式' : 'Target Format',
    quality: lang === 'zh' ? '质量' : 'Quality',
    limitSize: lang === 'zh' ? '限制最大尺寸（等比缩小）' : 'Limit max size (downscale)',
    width: lang === 'zh' ? '宽' : 'W',
    height: lang === 'zh' ? '高' : 'H',
    convertAll: lang === 'zh' ? '开始转换' : 'Convert All',
    converting: lang === 'zh' ? '转换中...' : 'Converting...',
    downloadAll: lang === 'zh' ? '打包下载' : 'Download All',
    clearAll: lang === 'zh' ? '清空' : 'Clear',
    files: lang === 'zh' ? '个文件' : 'files',
    original: lang === 'zh' ? '原图' : 'Original',
    result: lang === 'zh' ? '结果' : 'Result',
    pending: lang === 'zh' ? '待转换' : 'Pending',
    failed: lang === 'zh' ? '转换失败' : 'Failed',
    privacyNote: lang === 'zh'
      ? '所有转换在浏览器本地完成，文件不会上传到服务器'
      : 'All conversions run locally in your browser — files never leave your device',
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
      {isDragging && !isConverting && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/50 z-50 pointer-events-none">
          <div className="bg-card p-8 rounded-xl shadow-2xl border-2 border-dashed border-primary flex flex-col items-center gap-4">
            <FileImage className="w-16 h-16 text-primary" />
            <p className="text-lg font-semibold">{t.uploadTitle}</p>
          </div>
        </div>
      )}

      {/* 顶部导航 */}
      <header className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-card shrink-0 z-10">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push(lang === 'zh' ? '/zh' : '/')}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted hover:bg-muted/80 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>{t.back}</span>
          </button>
          <h1 className="text-lg font-bold text-primary">{t.title}</h1>
        </div>
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
      </header>

      {/* 主内容 */}
      <main className="flex-1 flex min-h-0">
        {/* 左侧：设置面板 */}
        <aside className="w-64 shrink-0 border-r border-border bg-card p-4 space-y-5 overflow-y-auto scrollbar-thin">
          {/* 目标格式 */}
          <div>
            <label className="block text-sm font-medium mb-2">{t.targetFormat}</label>
            <div className="space-y-1.5">
              {FORMATS.map((f) => (
                <button
                  key={f.id}
                  onClick={() => setFormat(f.id)}
                  disabled={isConverting}
                  className={cn(
                    'w-full text-left px-3 py-2 rounded-lg transition-all',
                    format === f.id
                      ? 'bg-primary text-primary-foreground ring-2 ring-primary/50'
                      : 'bg-muted hover:bg-muted/80',
                    isConverting && 'opacity-60 cursor-not-allowed'
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium uppercase">{f.id}</span>
                    <span className="text-xs opacity-70 font-mono">{f.ext}</span>
                  </div>
                  <div className="text-xs opacity-70">
                    {lang === 'zh' ? f.note.zh : f.note.en}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* 质量（仅 jpeg/webp） */}
          {FORMATS.find(f => f.id === format)?.quality && (
            <div>
              <label className="block text-sm font-medium mb-2">
                {t.quality}: {quality}%
              </label>
              <input
                type="range"
                min={1}
                max={100}
                value={quality}
                onChange={(e) => setQuality(Number(e.target.value))}
                disabled={isConverting}
                className="w-full"
              />
            </div>
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
              <span>{doneCount > 1 ? t.downloadAll : t.downloadAll}( {doneCount} )</span>
            </button>
          </div>

          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded-lg text-red-600 dark:text-red-400 text-xs">
              {error}
            </div>
          )}
        </aside>

        {/* 右侧：文件列表 */}
        <main className="flex-1 overflow-y-auto scrollbar-thin">
          {items.length === 0 ? (
            <div className="h-full flex items-center justify-center p-8">
              <div className="w-full max-w-xl">
                <div
                  className="relative flex flex-col items-center justify-center w-full border-2 border-dashed rounded-lg cursor-pointer transition-colors duration-200 h-56 hover:border-primary/50 hover:bg-muted/50"
                  onClick={() => fileInputRef.current?.click()}
                >
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
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <FileImage className="w-14 h-14 mb-4 text-muted-foreground" />
                  <p className="text-lg font-semibold mb-1">{t.uploadTitle}</p>
                  <p className="text-sm text-muted-foreground">{t.uploadHint}</p>
                  <p className="text-xs text-muted-foreground/70 mt-3">{t.supported}</p>
                </div>
                <p className="text-center text-xs text-muted-foreground mt-6">🔒 {t.privacyNote}</p>
              </div>
            </div>
          ) : (
            <div className="p-4 space-y-2">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-3 p-3 rounded-lg bg-card border border-border"
                >
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
                  {/* 状态 */}
                  <div className="shrink-0">
                    {item.status === 'pending' && <Circle className="w-4 h-4 text-muted-foreground/40" />}
                    {item.status === 'converting' && <Loader2 className="w-4 h-4 animate-spin text-primary" />}
                    {item.status === 'done' && <CheckCircle2 className="w-4 h-4 text-green-500" />}
                    {item.status === 'error' && <XCircle className="w-4 h-4 text-destructive" />}
                  </div>
                  {/* 操作 */}
                  <div className="flex items-center gap-1 shrink-0">
                    {item.status === 'done' && item.result && (
                      <button
                        onClick={() => downloadFile(item.result!.blob, item.result!.filename)}
                        className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                        title={t.downloadAll}
                      >
                        <Download className="w-4 h-4" />
                      </button>
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
            </div>
          )}
        </main>
      </main>

      {/* 底部说明 */}
      <footer className="px-4 py-2 border-t border-border bg-muted/10 text-xs text-muted-foreground text-center shrink-0">
        🔒 {t.privacyNote}
      </footer>
    </div>
  );
}
