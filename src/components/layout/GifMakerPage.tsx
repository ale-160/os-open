'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useDragDrop } from '@/hooks/useDragDrop';
import { loadImage } from '@/utils/canvas';
import { encodeAnimatedGIF } from '@/utils/gifEncoder';
import { downloadFile, formatFileSize } from '@/utils/file';
import { UploadZone } from '@/components/ui/UploadZone';
import { SliderWithInput } from '@/components/ui/SliderWithInput';
import {
  FileImage, ArrowLeft, X, Loader2, Download, Trash2,
  ChevronUp, ChevronDown, Play,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface GifMakerPageProps {
  lang: 'en' | 'zh';
}

interface FrameItem {
  id: string;
  file: File;
  url: string;
  width: number;
  height: number;
}

/** 帧画布最长边上限（控制量化与内存开销） */
const MAX_DIM = 1280;
/** 最大帧数 */
const MAX_FRAMES = 30;

let idCounter = 0;

export default function GifMakerPage({ lang }: GifMakerPageProps) {
  const router = useRouter();
  const [frames, setFrames] = useState<FrameItem[]>([]);
  const [delayMs, setDelayMs] = useState(500);
  const [loop, setLoop] = useState(true);
  const [isEncoding, setIsEncoding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    blob: Blob; url: string; width: number; height: number;
  } | null>(null);
  /** 生成时的参数签名，用于提示"参数已更改" */
  const [encodedSig, setEncodedSig] = useState<string | null>(null);
  const [previewIdx, setPreviewIdx] = useState(0);

  const urlsRef = useRef<Set<string>>(new Set());
  const resultUrlRef = useRef<string | null>(null);

  const trackUrl = useCallback((url: string) => {
    urlsRef.current.add(url);
    return url;
  }, []);

  const revokeUrl = useCallback((url: string) => {
    if (urlsRef.current.delete(url)) URL.revokeObjectURL(url);
  }, []);

  useEffect(() => () => {
    urlsRef.current.forEach(url => URL.revokeObjectURL(url));
    urlsRef.current.clear();
    if (resultUrlRef.current) URL.revokeObjectURL(resultUrlRef.current);
  }, []);

  // ── 添加帧 ──
  const addFiles = useCallback((files: File[]) => {
    void (async () => {
      const room = MAX_FRAMES - frames.length;
      if (room <= 0) return;
      const accepted = files.slice(0, room);
      const items: FrameItem[] = [];
      for (const file of accepted) {
        try {
          const img = await loadImage(file);
          items.push({
            id: `f${++idCounter}`,
            file,
            url: trackUrl(URL.createObjectURL(file)),
            width: img.naturalWidth || 1,
            height: img.naturalHeight || 1,
          });
        } catch {
          // 跳过无法解码的文件
        }
      }
      if (items.length > 0) {
        setFrames(prev => [...prev, ...items]);
        setError(null);
      }
    })();
  }, [frames.length, trackUrl]);

  const removeFrame = useCallback((id: string) => {
    setFrames(prev => {
      const item = prev.find(f => f.id === id);
      if (item) revokeUrl(item.url);
      return prev.filter(f => f.id !== id);
    });
  }, [revokeUrl]);

  const moveFrame = useCallback((id: string, dir: -1 | 1) => {
    setFrames(prev => {
      const idx = prev.findIndex(f => f.id === id);
      const to = idx + dir;
      if (idx < 0 || to < 0 || to >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[to]] = [next[to], next[idx]];
      return next;
    });
  }, []);

  const handleClearAll = useCallback(() => {
    frames.forEach(f => revokeUrl(f.url));
    setFrames([]);
    setResult(null);
  }, [frames, revokeUrl]);

  // ── 合成 ──
  const handleEncode = useCallback(async () => {
    if (frames.length < 1 || isEncoding) return;
    setIsEncoding(true);
    setError(null);
    try {
      const imgs = await Promise.all(frames.map(f => loadImage(f.file)));
      const srcW = imgs.map(m => m.naturalWidth || 1);
      const srcH = imgs.map(m => m.naturalHeight || 1);
      const maxW = Math.max(...srcW);
      const maxH = Math.max(...srcH);
      const scale = Math.min(1, MAX_DIM / maxW, MAX_DIM / maxH);
      const canvasW = Math.max(1, Math.round(maxW * scale));
      const canvasH = Math.max(1, Math.round(maxH * scale));

      const frameData = imgs.map((img, i) => {
        const canvas = document.createElement('canvas');
        canvas.width = canvasW;
        canvas.height = canvasH;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Canvas unavailable');
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        // 等比缩放并居中（contain），四周留透明边距
        const w = Math.max(1, Math.round(srcW[i] * scale));
        const h = Math.max(1, Math.round(srcH[i] * scale));
        ctx.drawImage(img, Math.floor((canvasW - w) / 2), Math.floor((canvasH - h) / 2), w, h);
        return { imageData: ctx.getImageData(0, 0, canvasW, canvasH), delayMs };
      });

      const blob = encodeAnimatedGIF(frameData, { loop });

      // 释放上一次结果
      if (resultUrlRef.current) {
        URL.revokeObjectURL(resultUrlRef.current);
        resultUrlRef.current = null;
      }
      const url = URL.createObjectURL(blob);
      resultUrlRef.current = url;
      setResult({ blob, url, width: canvasW, height: canvasH });
      setEncodedSig(`${frames.length}|${delayMs}|${loop}`);
      setPreviewIdx(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsEncoding(false);
    }
  }, [frames, delayMs, loop, isEncoding]);

  const handleDownload = useCallback(() => {
    if (!result) return;
    downloadFile(result.blob, `animation-${Date.now()}.gif`);
  }, [result]);

  // ── 预览动画循环 ──
  useEffect(() => {
    if (!result || frames.length < 2) return;
    const id = setInterval(
      () => setPreviewIdx(i => (i + 1) % frames.length),
      Math.max(60, delayMs)
    );
    return () => clearInterval(id);
  }, [result, frames.length, delayMs]);

  // ── 全页拖拽 ──
  const handleDragFiles = useCallback((files: File[]) => {
    addFiles(files);
  }, [addFiles]);
  const { isDragging, dragHandlers } = useDragDrop(handleDragFiles);
  const handleUploadFiles = useCallback((files: FileList | File[]) => {
    addFiles(Array.from(files));
  }, [addFiles]);

  // ── 文案 ──
  const t = {
    back: lang === 'zh' ? '返回' : 'Back',
    title: lang === 'zh' ? 'GIF 动画合成' : 'GIF Maker',
    clearAll: lang === 'zh' ? '清空' : 'Clear',
    frames: lang === 'zh' ? '帧序列' : 'Frames',
    framesHint: lang === 'zh'
      ? `拖拽图片到此处，按添加顺序合成 · 最多 ${MAX_FRAMES} 帧`
      : `Drag images here, combined in added order · up to ${MAX_FRAMES} frames`,
    delay: lang === 'zh' ? '帧延时' : 'Frame Delay',
    loop: lang === 'zh' ? '循环播放' : 'Loop',
    encode: lang === 'zh' ? '生成 GIF' : 'Create GIF',
    encoding: lang === 'zh' ? '合成中...' : 'Creating...',
    needTwo: lang === 'zh' ? '至少需要 1 张图片' : 'Add at least 1 image',
    result: lang === 'zh' ? '结果预览' : 'Result Preview',
    download: lang === 'zh' ? '下载 GIF' : 'Download GIF',
    reencodeHint: lang === 'zh'
      ? '帧或参数已更改，请重新生成'
      : 'Frames or settings changed — create again',
    privacyNote: lang === 'zh'
      ? '所有处理在浏览器本地完成，图片不会上传到服务器'
      : 'All processing runs locally in your browser — images never leave your device',
    ms: 'ms',
  };

  const settingsStale = result !== null &&
    encodedSig !== `${frames.length}|${delayMs}|${loop}`;

  return (
    <div
      className={cn(
        'flex flex-col min-h-screen bg-background text-foreground transition-colors duration-200',
        isDragging && !isEncoding && 'bg-primary/5'
      )}
      {...dragHandlers}
    >
      {/* 拖拽指示器 */}
      {isDragging && !isEncoding && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/50 z-50 pointer-events-none">
          <div className="bg-card p-8 rounded-xl shadow-2xl border-2 border-dashed border-primary flex flex-col items-center gap-4">
            <FileImage className="w-16 h-16 text-primary" />
            <p className="text-lg font-semibold">{t.frames}</p>
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
        {frames.length > 0 && (
          <button
            onClick={handleClearAll}
            disabled={isEncoding}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted hover:bg-muted/80 disabled:opacity-50 transition-colors text-sm"
          >
            <Trash2 className="w-4 h-4" />
            <span>{t.clearAll}</span>
          </button>
        )}
      </header>

      <main className="flex-1 flex flex-col lg:flex-row min-h-0">
        {/* 控制面板 */}
        <aside className="w-full lg:w-64 shrink-0 border-b lg:border-b-0 lg:border-r border-border bg-card p-4 space-y-5 overflow-y-auto scrollbar-thin">
          {/* 帧延时 */}
          <SliderWithInput
            label={t.delay}
            value={delayMs}
            min={50}
            max={3000}
            suffix={t.ms}
            onChange={setDelayMs}
            onChangeEnd={() => {}}
          />

          {/* 循环播放 */}
          <label className="flex items-center justify-between cursor-pointer select-none">
            <span className="text-sm font-medium">{t.loop}</span>
            <button
              type="button"
              role="switch"
              aria-checked={loop}
              disabled={isEncoding}
              onClick={() => setLoop(v => !v)}
              className={cn(
                'relative w-10 h-5 rounded-full transition-colors',
                loop ? 'bg-primary' : 'bg-muted-foreground/30',
                isEncoding && 'opacity-60 cursor-not-allowed'
              )}
            >
              <span
                className={cn(
                  'absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-background shadow transition-transform',
                  loop && 'translate-x-5'
                )}
              />
            </button>
          </label>

          {/* 生成按钮 */}
          <button
            onClick={handleEncode}
            disabled={frames.length === 0 || isEncoding}
            className={cn(
              'w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-medium transition-all',
              'bg-primary text-primary-foreground hover:bg-primary/90',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
          >
            {isEncoding ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>{t.encoding}</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                <span>{frames.length > 0 ? t.encode : t.needTwo}</span>
              </>
            )}
          </button>

          {error && (
            <p className="text-xs text-destructive bg-destructive/10 rounded-lg px-3 py-2 break-all">
              {error}
            </p>
          )}

          {/* 结果卡片 */}
          {result && (
            <div className="space-y-2 pt-1">
              <p className="text-sm font-medium">{t.result}</p>
              {settingsStale && (
                <p className="text-xs text-amber-600 dark:text-amber-400 bg-amber-500/10 rounded-lg px-3 py-2">
                  {t.reencodeHint}
                </p>
              )}
              <img
                src={frames.length >= 2 ? frames[previewIdx]?.url ?? result.url : result.url}
                alt="GIF preview"
                className="w-full rounded-lg border border-border bg-[repeating-conic-gradient(#8882_0%_25%,transparent_0%_50%)] bg-[length:16px_16px]"
              />
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{result.width}×{result.height}</span>
                <span>{formatFileSize(result.blob.size)}</span>
              </div>
              <button
                onClick={handleDownload}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-muted hover:bg-muted/80 transition-colors text-sm font-medium"
              >
                <Download className="w-4 h-4" />
                <span>{t.download}</span>
              </button>
            </div>
          )}
        </aside>

        {/* 内容区 */}
        <section className="flex-1 p-4 space-y-4 overflow-y-auto scrollbar-thin min-w-0">
          <UploadZone onFilesSelected={handleUploadFiles} compact={frames.length > 0} accept="image/*" />

          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">{t.frames}</h2>
            <span className="text-xs text-muted-foreground">{t.framesHint}</span>
          </div>

          {frames.length === 0 ? (
            <div className="h-40 rounded-lg border border-dashed border-border/60 flex items-center justify-center text-sm text-muted-foreground">
              {lang === 'zh' ? '尚未添加帧' : 'No frames yet'}
            </div>
          ) : (
            <ol className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 list-none">
              {frames.map((frame, i) => (
                <li
                  key={frame.id}
                  className={cn(
                    'relative group rounded-lg border overflow-hidden bg-card transition-all',
                    result && previewIdx === i && frames.length >= 2
                      ? 'border-primary ring-2 ring-primary/40'
                      : 'border-border'
                  )}
                >
                  <span className="absolute top-1.5 left-1.5 z-10 w-6 h-6 rounded-md bg-black/70 text-white text-xs font-bold flex items-center justify-center">
                    {i + 1}
                  </span>
                  {/* 操作按钮 */}
                  <div className="absolute top-1.5 right-1.5 z-10 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => moveFrame(frame.id, -1)}
                      disabled={i === 0 || isEncoding}
                      aria-label={lang === 'zh' ? '上移' : 'Move up'}
                      className="w-6 h-6 rounded-md bg-black/70 text-white flex items-center justify-center hover:bg-black/90 disabled:opacity-30"
                    >
                      <ChevronUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => moveFrame(frame.id, 1)}
                      disabled={i === frames.length - 1 || isEncoding}
                      aria-label={lang === 'zh' ? '下移' : 'Move down'}
                      className="w-6 h-6 rounded-md bg-black/70 text-white flex items-center justify-center hover:bg-black/90 disabled:opacity-30"
                    >
                      <ChevronDown className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <button
                    onClick={() => removeFrame(frame.id)}
                    disabled={isEncoding}
                    aria-label={lang === 'zh' ? '移除' : 'Remove'}
                    className="absolute bottom-1.5 right-1.5 z-10 w-6 h-6 rounded-md bg-black/70 text-white flex items-center justify-center hover:bg-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
              {/* 缩略图 */}
              <img
                src={frame.url}
                alt={`frame ${i + 1}`}
                className="w-full aspect-square object-contain bg-[repeating-conic-gradient(#8882_0%_25%,transparent_0%_50%)] bg-[length:12px_12px]"
              />
                  <div className="px-2 py-1.5 text-[11px] text-muted-foreground truncate">
                    {frame.width}×{frame.height}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>
      </main>

      {/* 底部隐私说明 */}
      <footer className="px-4 py-2 border-t border-border bg-card text-center text-xs text-muted-foreground shrink-0">
        {t.privacyNote}
      </footer>
    </div>
  );
}
