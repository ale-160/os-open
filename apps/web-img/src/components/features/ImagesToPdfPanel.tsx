'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useDragDrop } from '@/hooks/useDragDrop';
import { loadImage } from '@/utils/canvas';
import {
  composePdf,
  type ComposeMode,
  type PagePreset,
  type PageOrientation,
} from '@/utils/pdfCompose';
import { isPdfFile } from '@/utils/pdfToImage';
import { normalizeImageFiles } from '@/utils/heicDecode';
import { downloadFile, formatFileSize } from '@/utils/file';
import { UploadZone } from '@/components/ui/UploadZone';
import { SliderWithInput } from '@/components/ui/SliderWithInput';
import { EmptyState } from '@/components/ui/EmptyState';
import { DragOverlay } from '@/components/ui/DragOverlay';
import {
  FileImage, FileText, X, Loader2, Download, Trash2,
  ChevronUp, ChevronDown, FileOutput,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ImagesToPdfPanelProps {
  lang: 'en' | 'zh';
  /** 选择/拖入了 PDF 文件时，请求父级切换到「PDF → 图片」模式 */
  onPdfFileReceived?: (file: File) => void;
}

interface ComposeItem {
  id: string;
  file: File;
  url: string;
  width: number;
  height: number;
}

/** 边距档位（pt）：无 / 窄(0.25in) / 宽(0.5in) */
const MARGIN_OPTIONS = [0, 18, 36] as const;

let idCounter = 0;

export function ImagesToPdfPanel({ lang, onPdfFileReceived }: ImagesToPdfPanelProps) {
  const [items, setItems] = useState<ComposeItem[]>([]);
  const [mode, setMode] = useState<ComposeMode>('lossless');
  const [jpegQuality, setJpegQuality] = useState(90);
  const [preset, setPreset] = useState<PagePreset>('auto');
  const [orientation, setOrientation] = useState<PageOrientation>('auto');
  const [marginIdx, setMarginIdx] = useState(0);
  const [isBuilding, setIsBuilding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ blob: Blob; url: string; pages: number } | null>(null);
  /** 生成时的参数签名，用于提示"已更改" */
  const [builtSig, setBuiltSig] = useState<string | null>(null);

  const urlsRef = useRef<Set<string>>(new Set());
  const resultUrlRef = useRef<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => () => {
    urlsRef.current.forEach(url => URL.revokeObjectURL(url));
    urlsRef.current.clear();
    if (resultUrlRef.current) URL.revokeObjectURL(resultUrlRef.current);
  }, []);

  // ── 文案 ──
  const t = {
    compression: lang === 'zh' ? '压缩方式' : 'Compression',
    lossless: lang === 'zh' ? '无损' : 'Lossless',
    losslessNote: lang === 'zh' ? 'JPEG 原图直嵌，其余保留透明' : 'JPEG passthrough, alpha kept',
    jpegMode: lang === 'zh' ? 'JPEG' : 'JPEG',
    jpegModeNote: lang === 'zh' ? '统一重编码，体积更小' : 'Re-encode, smaller files',
    quality: lang === 'zh' ? '质量' : 'Quality',
    pageSize: lang === 'zh' ? '页面尺寸' : 'Page Size',
    auto: lang === 'zh' ? '自动（跟随图片）' : 'Auto (fit image)',
    orientation: lang === 'zh' ? '方向' : 'Orientation',
    orientAuto: lang === 'zh' ? '自动' : 'Auto',
    portrait: lang === 'zh' ? '纵向' : 'Portrait',
    landscape: lang === 'zh' ? '横向' : 'Landscape',
    margin: lang === 'zh' ? '页边距' : 'Margin',
    marginNone: lang === 'zh' ? '无' : 'None',
    marginNarrow: lang === 'zh' ? '窄' : 'Narrow',
    marginWide: lang === 'zh' ? '宽' : 'Wide',
    compose: lang === 'zh' ? '生成 PDF' : 'Create PDF',
    composing: lang === 'zh' ? '生成中...' : 'Creating...',
    needImages: lang === 'zh' ? '至少需要 1 张图片' : 'Add at least 1 image',
    result: lang === 'zh' ? '结果' : 'Result',
    download: lang === 'zh' ? '下载 PDF' : 'Download PDF',
    pagesUnit: lang === 'zh' ? '页' : 'pages',
    staleHint: lang === 'zh'
      ? '图片或设置已更改，请重新生成'
      : 'Images or settings changed — create again',
    images: lang === 'zh' ? '图片列表' : 'Images',
    listHint: lang === 'zh' ? '按添加顺序合成，可上下移动排序' : 'Combined in added order, reorder freely',
    emptyTitle: lang === 'zh' ? '拖拽图片到此处' : 'Drag images here',
    emptyDesc: lang === 'zh' ? '或点击选择文件 · 多张图片合成一个 PDF' : 'Or click to select files · combine into one PDF',
    clearAll: lang === 'zh' ? '清空' : 'Clear',
    moveUp: lang === 'zh' ? '上移' : 'Move up',
    moveDown: lang === 'zh' ? '下移' : 'Move down',
    remove: lang === 'zh' ? '移除' : 'Remove',
  };

  const settingsSig =
    `${items.map(i => i.id).join(',')}|${mode}|${jpegQuality}|${preset}|${orientation}|${marginIdx}`;
  const settingsStale = result !== null && builtSig !== settingsSig;

  // ── 添加图片 ──
  const addFiles = useCallback((files: File[]) => {
    void (async () => {
      const pdfFiles = files.filter(isPdfFile);
      if (pdfFiles.length > 0 && onPdfFileReceived) {
        onPdfFileReceived(pdfFiles[0]);
        return;
      }
      const images = files.filter(f => f.type.startsWith('image/') || /\.(png|jpe?g|webp|gif|bmp|svg|avif|ico|hei[cf])$/i.test(f.name));
      // HEIC 先解码为浏览器可处理的 JPEG
      const normalized = await normalizeImageFiles(images, lang);
      const added: ComposeItem[] = [];
      for (const file of normalized) {
        try {
          const img = await loadImage(file);
          added.push({
            id: `p${++idCounter}`,
            file,
            url: URL.createObjectURL(file),
            width: img.naturalWidth || 1,
            height: img.naturalHeight || 1,
          });
        } catch {
          // 跳过无法解码的文件
        }
      }
      if (added.length > 0) {
        added.forEach(i => urlsRef.current.add(i.url));
        setItems(prev => [...prev, ...added]);
        setError(null);
      }
    })();
  }, [onPdfFileReceived, lang]);

  const removeItem = useCallback((id: string) => {
    setItems(prev => {
      const item = prev.find(i => i.id === id);
      if (item && urlsRef.current.delete(item.url)) URL.revokeObjectURL(item.url);
      return prev.filter(i => i.id !== id);
    });
  }, []);

  const moveItem = useCallback((id: string, dir: -1 | 1) => {
    setItems(prev => {
      const idx = prev.findIndex(i => i.id === id);
      const to = idx + dir;
      if (idx < 0 || to < 0 || to >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[to]] = [next[to], next[idx]];
      return next;
    });
  }, []);

  const handleClearAll = useCallback(() => {
    urlsRef.current.forEach(url => URL.revokeObjectURL(url));
    urlsRef.current.clear();
    setItems([]);
  }, []);

  // ── 生成 ──
  const handleCompose = useCallback(async () => {
    if (items.length < 1 || isBuilding) return;
    setIsBuilding(true);
    setError(null);
    try {
      const blob = await composePdf(
        items.map(({ file, width, height }) => ({ file, width, height })),
        {
          mode,
          jpegQuality,
          preset,
          orientation,
          marginPt: MARGIN_OPTIONS[marginIdx],
        }
      );
      if (resultUrlRef.current) {
        URL.revokeObjectURL(resultUrlRef.current);
        resultUrlRef.current = null;
      }
      const url = URL.createObjectURL(blob);
      resultUrlRef.current = url;
      setResult({ blob, url, pages: items.length });
      setBuiltSig(settingsSig);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsBuilding(false);
    }
  }, [items, isBuilding, mode, jpegQuality, preset, orientation, marginIdx, settingsSig]);

  const handleDownload = useCallback(() => {
    if (!result) return;
    downloadFile(result.blob, `images-${Date.now()}.pdf`);
  }, [result]);

  // ── 全页拖拽 ──
  const { isDragging, dragHandlers } = useDragDrop(addFiles);

  const selectClass = 'w-full px-3 py-2 rounded-lg border border-border bg-background text-sm transition-colors focus:border-primary';

  return (
    <div
      className={cn(
        'flex-1 flex flex-col lg:flex-row min-h-0',
        isDragging && 'bg-primary/5'
      )}
      {...dragHandlers}
    >
      {/* 拖拽指示器 */}
      {isDragging && !isBuilding && <DragOverlay icon={<FileImage className="w-14 h-14" />} label={t.emptyTitle} />}

      {/* 控制面板 */}
      <aside className="w-full lg:w-64 shrink-0 border-b lg:border-b-0 lg:border-r border-border bg-card p-4 space-y-5 overflow-y-auto scrollbar-thin">
        {/* 压缩方式 */}
        <div>
          <label className="block text-sm font-medium mb-2">{t.compression}</label>
          <div className="grid grid-cols-2 gap-1.5">
            {(['lossless', 'jpeg'] as const).map(m => (
              <button
                key={m}
                onClick={() => setMode(m)}
                disabled={isBuilding}
                className={cn(
                  'text-left px-3 py-2 rounded-lg transition-all',
                  mode === m
                    ? 'bg-primary text-primary-foreground ring-2 ring-primary/50'
                    : 'bg-muted hover:bg-muted/80',
                  isBuilding && 'opacity-60 cursor-not-allowed'
                )}
              >
                <span className="text-sm font-medium">{m === 'lossless' ? t.lossless : t.jpegMode}</span>
                <div className="text-xs opacity-70 leading-tight mt-0.5">
                  {m === 'lossless' ? t.losslessNote : t.jpegModeNote}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* 质量（仅 JPEG 模式） */}
        {mode === 'jpeg' && (
          <SliderWithInput
            label={t.quality}
            value={jpegQuality}
            onChange={setJpegQuality}
            onChangeEnd={() => {}}
            min={1}
            max={100}
            suffix="%"
          />
        )}

        {/* 页面尺寸 */}
        <div>
          <label className="block text-sm font-medium mb-2">{t.pageSize}</label>
          <select
            value={preset}
            onChange={(e) => setPreset(e.target.value as PagePreset)}
            disabled={isBuilding}
            className={selectClass}
          >
            <option value="auto">{t.auto}</option>
            <option value="a4">A4</option>
            <option value="letter">Letter</option>
          </select>
        </div>

        {/* 方向（固定尺寸时可用） */}
        <div>
          <label className="block text-sm font-medium mb-2">{t.orientation}</label>
          <select
            value={orientation}
            onChange={(e) => setOrientation(e.target.value as PageOrientation)}
            disabled={isBuilding || preset === 'auto'}
            className={cn(selectClass, preset === 'auto' && 'opacity-50 cursor-not-allowed')}
          >
            <option value="auto">{t.orientAuto}</option>
            <option value="portrait">{t.portrait}</option>
            <option value="landscape">{t.landscape}</option>
          </select>
        </div>

        {/* 页边距 */}
        <div>
          <label className="block text-sm font-medium mb-2">{t.margin}</label>
          <select
            value={marginIdx}
            onChange={(e) => setMarginIdx(Number(e.target.value))}
            disabled={isBuilding}
            className={selectClass}
          >
            <option value={0}>{t.marginNone}</option>
            <option value={1}>{t.marginNarrow}</option>
            <option value={2}>{t.marginWide}</option>
          </select>
        </div>

        {/* 生成按钮 */}
        <button
          onClick={() => void handleCompose()}
          disabled={items.length === 0 || isBuilding}
          className={cn(
            'relative overflow-hidden w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-medium transition-all',
            'bg-primary text-primary-foreground hover:bg-primary/90',
            'disabled:opacity-50 disabled:cursor-not-allowed'
          )}
        >
          {isBuilding ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>{t.composing}</span>
              <span aria-hidden="true" className="progress-indeterminate" />
            </>
          ) : (
            <>
              <FileOutput className="w-4 h-4" />
              <span>{items.length > 0 ? t.compose : t.needImages}</span>
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
          <div className="space-y-2 pt-1 animate-in fade-in slide-in-from-bottom-1 duration-300">
            <p className="text-sm font-medium">{t.result}</p>
            {settingsStale && (
              <p className="text-xs text-amber-600 dark:text-amber-400 bg-amber-500/10 rounded-lg px-3 py-2">
                {t.staleHint}
              </p>
            )}
            <div className="rounded-lg border border-border bg-muted/30 p-3 flex items-center gap-3">
              <span className="inline-flex w-10 h-10 rounded-lg bg-primary/10 items-center justify-center shrink-0 animate-in zoom-in-95 fade-in duration-200">
                <FileText className="w-5 h-5 text-primary" />
              </span>
              <div className="min-w-0 text-sm">
                <div className="font-medium">PDF</div>
                <div className="text-xs text-muted-foreground">
                  {result.pages} {t.pagesUnit} · {formatFileSize(result.blob.size)}
                </div>
              </div>
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
        {items.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <div
              className="w-full max-w-xl cursor-pointer border-2 border-dashed rounded-xl transition-all duration-200 py-14 hover:border-primary/50 hover:bg-muted/50"
              onClick={() => fileInputRef.current?.click()}
            >
              <EmptyState variant="image" title={t.emptyTitle} description={t.emptyDesc} />
              <div className="flex flex-wrap justify-center gap-1.5 mt-5 px-4">
                {['JPG', 'PNG', 'WebP', 'GIF', 'BMP', 'SVG', 'AVIF'].map(ext => (
                  <span key={ext} className="px-2 py-0.5 text-xs font-mono rounded-md bg-muted text-muted-foreground transition-colors hover:text-foreground">
                    {ext}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <>
            <UploadZone onFilesSelected={(files) => addFiles(Array.from(files))} compact accept="image/*" />

            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">{t.images}</h2>
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground">{t.listHint}</span>
                <button
                  onClick={handleClearAll}
                  disabled={isBuilding}
                  className="flex items-center gap-1 px-2 py-1 rounded-md bg-muted hover:bg-muted/80 disabled:opacity-50 transition-colors text-xs"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{t.clearAll}</span>
                </button>
              </div>
            </div>

            <ol className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 list-none">
              {items.map((item, i) => (
                <li
                  key={item.id}
                  className="relative group rounded-lg border border-border overflow-hidden bg-card transition-all animate-in fade-in zoom-in-95 duration-200"
                >
                  <span className="absolute top-1.5 left-1.5 z-10 w-6 h-6 rounded-md bg-black/70 text-white text-xs font-bold flex items-center justify-center">
                    {i + 1}
                  </span>
                  <div className="absolute top-1.5 right-1.5 z-10 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => moveItem(item.id, -1)}
                      disabled={i === 0 || isBuilding}
                      aria-label={t.moveUp}
                      className="w-6 h-6 rounded-md bg-black/70 text-white flex items-center justify-center hover:bg-black/90 disabled:opacity-30"
                    >
                      <ChevronUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => moveItem(item.id, 1)}
                      disabled={i === items.length - 1 || isBuilding}
                      aria-label={t.moveDown}
                      className="w-6 h-6 rounded-md bg-black/70 text-white flex items-center justify-center hover:bg-black/90 disabled:opacity-30"
                    >
                      <ChevronDown className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <button
                    onClick={() => removeItem(item.id)}
                    disabled={isBuilding}
                    aria-label={t.remove}
                    className="absolute bottom-9 right-1.5 z-10 w-6 h-6 rounded-md bg-black/70 text-white flex items-center justify-center hover:bg-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                  <img
                    src={item.url}
                    alt={item.file.name}
                    className="w-full aspect-square object-contain bg-[repeating-conic-gradient(#8882_0%_25%,transparent_0%_50%)] bg-[length:12px_12px]"
                  />
                  <div className="px-2 py-1.5 text-[11px] text-muted-foreground truncate">
                    {item.width}×{item.height} · {formatFileSize(item.file.size)}
                  </div>
                </li>
              ))}
            </ol>
          </>
        )}
      </section>

      {/* 共享文件选择器 */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            addFiles(Array.from(e.target.files));
          }
          e.target.value = '';
        }}
        className="hidden"
      />
    </div>
  );
}
