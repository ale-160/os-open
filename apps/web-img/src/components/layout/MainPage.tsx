'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Moon, Sun, Download, Trash2, Globe, Edit2, Check, X, RotateCcw, Maximize, Minimize, Eye, EyeOff, RotateCw, FlipHorizontal, Upload, Heart, ArrowLeftRight, Film } from 'lucide-react';
import { toast } from 'sonner';
import { useLanguage, zhStrings, enStrings } from '@/hooks/useLanguage';
import { useTheme } from '@/hooks/useTheme';
import { useImageEditor } from '@/hooks/useImageEditor';
import { useDragDrop } from '@/hooks/useDragDrop';
import { UploadZone } from '@/components/ui/UploadZone';
import { ToolPanel } from '@/components/ui/ToolPanel';
import { SmallSidebar } from '@/components/ui/SmallSidebar';
import { UnderDevelopmentModal } from '@/components/ui/UnderDevelopmentModal';
import { EmptyState } from '@/components/ui/EmptyState';
import { DragOverlay } from '@/components/ui/DragOverlay';
import { AdjustPanel } from '@/components/features/CompressPanel';
import { WatermarkPanel } from '@/components/features/WatermarkPanel';
import { MergePanel } from '@/components/features/MergePanel';
import { downloadFile, formatFileSize } from '@/utils/file';
import { isPdfFile } from '@/utils/pdfToImage';
import { normalizeImageFiles } from '@/utils/heicDecode';
import type { ToolTab } from '@/data/presets';
import { cn } from '@/lib/utils';

interface MainPageProps {
  lang: 'en' | 'zh';
}

export default function MainPage({ lang }: MainPageProps) {
  // 动态设置 <html lang> 属性
  useEffect(() => {
    document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
  }, [lang]);

  const router = useRouter();
  const { language, t, toggleLanguage, isMounted: langMounted } = useLanguage();
  const { theme, toggleTheme, isMounted: themeMounted } = useTheme();
  const {
    originalImages,
    previewImage,
    addImages,
    clearImages,
    updatePreview,
    updatePreviewName,
    resetPreview,
    getOriginalFormat,
  } = useImageEditor();
  const [activeTab, setActiveTab] = useState<ToolTab | null>(null);
  const [isEditingFileName, setIsEditingFileName] = useState(false);
  const [editedFileName, setEditedFileName] = useState('');
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<FileList | File[] | null>(null);
  const [hideOriginal, setHideOriginal] = useState(false);
  const [showFullscreenImage, setShowFullscreenImage] = useState(false);
  const [resetSignal, setResetSignal] = useState(0);
  const [sidebarPinned, setSidebarPinned] = useState(false);
  const [isFlipped, setIsFlipped] = useState(false);
  const [rotation, setRotation] = useState(0);

  // 功能开发中弹窗
  const [devModalOpen, setDevModalOpen] = useState(false);
  const [devFeatureName, setDevFeatureName] = useState('');

  const isMounted = langMounted && themeMounted;

  // 暗色类名由 useTheme 内部统一维护，此处不再重复操作 DOM

  // 侧边栏：有 tab 选中时自动展开
  const sidebarOpen = sidebarPinned || activeTab !== null;

  // 处理PDF文件 - 跳转到 /pdf 页面
  const processFilesWithPdf = useCallback(async (files: FileList | File[]) => {
    const fileArray = Array.from(files);

    // 检查是否有 PDF 文件
    const hasPdf = fileArray.some(isPdfFile);

    if (hasPdf) {
      // 根据当前语言跳转到对应的 PDF 处理页面
      const pdfPath = lang === 'zh' ? '/zh/pdf' : '/pdf';
      router.push(pdfPath);
    } else {
      // 普通图片文件；HEIC 先解码为浏览器可处理的 JPEG
      const normalized = await normalizeImageFiles(fileArray, lang);
      addImages(normalized);
      setActiveTab('adjust');
    }
  }, [addImages, router, lang]);

  // 添加图片后设置默认格式和添加到历史
  const handleFilesSelected = useCallback((files: FileList | File[]) => {
    if (previewImage) {
      setPendingFiles(files);
      setShowConfirmDialog(true);
    } else {
      void processFilesWithPdf(files);
    }
  }, [previewImage, processFilesWithPdf]);

  const handleConfirmUpload = useCallback(() => {
    if (pendingFiles) {
      clearImages();
      void processFilesWithPdf(pendingFiles);
    }
    setShowConfirmDialog(false);
    setPendingFiles(null);
  }, [pendingFiles, clearImages, processFilesWithPdf]);

  const handleCancelUpload = useCallback(() => {
    setShowConfirmDialog(false);
    setPendingFiles(null);
  }, []);

  // ESC 关闭全屏预览
  useEffect(() => {
    if (!showFullscreenImage) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowFullscreenImage(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showFullscreenImage]);

  // ESC 取消替换确认弹窗
  useEffect(() => {
    if (!showConfirmDialog) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleCancelUpload();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showConfirmDialog, handleCancelUpload]);

  const handleClearAll = useCallback(() => {
    clearImages();
    setIsFlipped(false);
    setRotation(0);
    setActiveTab(null);
  }, [clearImages]);

  const handleReset = useCallback(() => {
    resetPreview();
    setResetSignal(prev => prev + 1);
    setIsFlipped(false);
    setRotation(0);
  }, [resetPreview]);

  const getFileNameWithoutExtension = (filename: string) => {
    const lastDotIndex = filename.lastIndexOf('.');
    return lastDotIndex > 0 ? filename.substring(0, lastDotIndex) : filename;
  };

  /** 从 dataURL 或文件名中提取格式扩展名（如 .jpg） */
  const getFormatExtension = (url: string, filename: string): string => {
    if (url.startsWith('data:')) {
      const mime = url.split(';')[0].split(':')[1];
      const mimeMap: Record<string, string> = {
        'image/jpeg': '.jpg',
        'image/png': '.png',
        'image/webp': '.webp',
        'image/gif': '.gif',
        'image/bmp': '.bmp',
        'image/tiff': '.tiff',
      };
      return mimeMap[mime] ?? '.jpg';
    }
    const lastDot = filename.lastIndexOf('.');
    return lastDot > 0 ? filename.substring(lastDot).toLowerCase() : '';
  };

  const getDataUrlSize = (dataUrl: string) => {
    const base64 = dataUrl.split(',')[1];
    return base64 ? Math.ceil(base64.length * 0.75) : 0;
  };

  const handleDownload = useCallback(() => {
    if (!previewImage) return;
    const baseName = getFileNameWithoutExtension(previewImage.name);
    downloadFile(previewImage.url, baseName);
    toast.success(t('download'));
  }, [previewImage, t]);

  const handleApply = useCallback((imageData: string, width: number, height: number) => {
    updatePreview(imageData, width, height);
  }, [updatePreview]);

  const handleToggleLanguage = useCallback(() => {
    // toggleLanguage 在下一帧生效，当前帧 t() 读到的是旧语言
    // 所以用目标语言（即当前语言的相反值）读取翻译
    const targetLang = language === 'zh' ? 'en' : 'zh';
    const msg = targetLang === 'zh' ? zhStrings.languageSwitched : enStrings.languageSwitched;
    toggleLanguage();
    toast.success(msg);
  }, [toggleLanguage, language]);

  const handleStartEditFileName = useCallback(() => {
    if (previewImage) {
      setEditedFileName(getFileNameWithoutExtension(previewImage.name));
      setIsEditingFileName(true);
    }
  }, [previewImage]);

  const handleSaveFileName = useCallback(() => {
    if (editedFileName.trim()) {
      updatePreviewName(editedFileName.trim());
    }
    setIsEditingFileName(false);
  }, [editedFileName, updatePreviewName]);

  const handleCancelEditFileName = useCallback(() => {
    setIsEditingFileName(false);
    if (previewImage) {
      setEditedFileName(getFileNameWithoutExtension(previewImage.name));
    }
  }, [previewImage]);

  /** 从 dataURL 或 ObjectURL 加载图片，失败时抛错而不是永久挂起 */
  const loadImageFromUrl = useCallback(async (url: string): Promise<HTMLImageElement> => {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = url;
    });
    return img;
  }, []);

  /** 根据原始格式将 canvas 导出为 dataURL */
  const canvasToOriginalDataUrl = useCallback((canvas: HTMLCanvasElement): string => {
    const origFmt = getOriginalFormat() ?? 'jpeg';
    const mimeType = origFmt === 'png' ? 'image/png' : origFmt === 'webp' ? 'image/webp' : 'image/jpeg';
    const quality = mimeType === 'image/jpeg' ? 0.95 : undefined;
    return quality !== undefined ? canvas.toDataURL(mimeType, quality) : canvas.toDataURL(mimeType);
  }, [getOriginalFormat]);

  const handleRotate = useCallback(async (angle: number) => {
    if (!previewImage) return;
    try {
      const img = await loadImageFromUrl(previewImage.url);
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      if (angle === 90 || angle === 270) {
        const [w, h] = [img.height, img.width];
        canvas.width = w;
        canvas.height = h;
      } else {
        canvas.width = img.width;
        canvas.height = img.height;
      }

      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate((angle * Math.PI) / 180);
      ctx.drawImage(img, -img.width / 2, -img.height / 2);

      updatePreview(canvasToOriginalDataUrl(canvas), canvas.width, canvas.height);
      setRotation(prev => ((prev + angle) % 360 + 360) % 360);
      toast.success(t('rotateSuccess'));
    } catch {
      toast.error(t('processFailed'));
    }
  }, [previewImage, updatePreview, canvasToOriginalDataUrl, t, loadImageFromUrl]);

  const handleFlip = useCallback(async () => {
    if (!previewImage) return;
    try {
      const img = await loadImageFromUrl(previewImage.url);
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      canvas.width = img.width;
      canvas.height = img.height;
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(img, 0, 0);

      updatePreview(canvasToOriginalDataUrl(canvas), canvas.width, canvas.height);
      setIsFlipped(prev => !prev);
      toast.success(t('flipSuccess'));
    } catch {
      toast.error(t('processFailed'));
    }
  }, [previewImage, updatePreview, canvasToOriginalDataUrl, t, loadImageFromUrl]);

  const handleToggleHideOriginal = useCallback(() => {
    setHideOriginal(prev => !prev);
  }, []);

  const handleToggleFullscreen = useCallback(() => {
    setShowFullscreenImage(prev => !prev);
  }, []);

  // 点击弹窗中的"试用 Beta"后，直接进入功能面板
  const pendingDevTab = useRef<ToolTab | null>(null);

  const handleBypassDev = useCallback(() => {
    setDevModalOpen(false);
    if (pendingDevTab.current) {
      setActiveTab(pendingDevTab.current);
      pendingDevTab.current = null;
    }
  }, []);

  const handleTabChange = useCallback((tab: ToolTab | null) => {
    if (tab === 'watermark' || tab === 'merge') {
      setDevFeatureName(tab === 'watermark' ? t('watermark') : t('merge'));
      pendingDevTab.current = tab;
      setDevModalOpen(true);
      return;
    }
    setActiveTab(tab);
  }, [t]);

  // 使用通用的拖拽处理 Hook
  const { isDragging, dragHandlers } = useDragDrop(handleFilesSelected);

  if (!isMounted) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background text-foreground">
        <div className="animate-pulse">Loading...</div>
      </div>
    );
  }

  const currentOriginal = originalImages[0];
  const hasImages = !!previewImage;

  // 预览与原图的体积变化（正数=更小，负数=更大）；未处理时不显示
  const sizeDeltaPct = (() => {
    if (!currentOriginal || !previewImage) return null;
    if (previewImage.url === currentOriginal.url) return null;
    const origSize = currentOriginal.size;
    const prevSize = getDataUrlSize(previewImage.url);
    if (origSize <= 0 || prevSize <= 0) return null;
    return Math.round((1 - prevSize / origSize) * 100);
  })();

  // 面板标题
  const panelTitle = activeTab === 'adjust'
    ? t('imageAdjust')
    : activeTab === 'watermark'
      ? t('watermarkProcess')
      : activeTab === 'merge'
        ? t('imageMerge')
        : t('toolPanel');

  return (
    <div
      className={cn(
        "flex flex-col h-screen bg-background text-foreground transition-colors duration-200",
        isDragging && "bg-primary/5"
      )}
      {...dragHandlers}
    >
      {/* 拖拽指示覆盖层 */}
      {isDragging && <DragOverlay icon={<Upload className="w-14 h-14" />} label={t('dropHere')} />}

      {/* 顶部导航栏 */}
      <header className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-card shrink-0 z-10">
        <div className="flex items-center gap-3">
          <a href="https://ale160.com" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <img src="https://ale160.com/images/logo-icon.png" alt="Logo" className="w-8 h-8 rounded" />
            <span className="text-lg font-bold text-primary tracking-tight">{t('appName')}</span>
          </a>
        </div>
        <div className="flex items-center gap-1">
          <a
            href={lang === 'zh' ? '/zh/gif' : '/gif'}
            className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
            title={t('gifMaker')}
            aria-label={t('gifMaker')}
          >
            <Film className="w-4.5 h-4.5" />
          </a>
          <a
            href={lang === 'zh' ? '/zh/convert' : '/convert'}
            className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
            title={t('convert')}
            aria-label={t('convert')}
          >
            <ArrowLeftRight className="w-4.5 h-4.5" />
          </a>
          <button
            onClick={handleToggleLanguage}
            className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
            title={t('language')}
            aria-label={t('language')}
          >
            <Globe className="w-4.5 h-4.5" />
          </button>
          <button
            onClick={toggleTheme}
            className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
            title={t('theme')}
            aria-label={t('theme')}
          >
            {theme === 'dark' ? <Sun className="w-4.5 h-4.5" /> : <Moon className="w-4.5 h-4.5" />}
          </button>
        </div>
      </header>

      {/* 主内容区：双侧边栏 + 内容 */}
      <div className="flex flex-1 min-h-0">
        {/* 小型图标侧边栏 */}
        <SmallSidebar activeTab={activeTab} onTabChange={handleTabChange} />

        {/* 工具面板侧边栏 */}
        {sidebarOpen && (
          <aside className="w-56 shrink-0 border-r border-border bg-card flex flex-col animate-in fade-in slide-in-from-left-2 duration-200 ease-out">
            <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-muted/30 shrink-0">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                {panelTitle}
              </span>
              <div className="flex items-center gap-0.5">
                <button
                  onClick={() => setSidebarPinned(!sidebarPinned)}
                  className={cn(
                    'p-1 rounded transition-colors',
                    sidebarPinned
                      ? 'text-primary hover:bg-primary/10'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                  )}
                  title={sidebarPinned ? t('unpinPanel') : t('pinPanel')}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="17" x2="12" y2="22" />
                    <path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z" />
                  </svg>
                </button>
                <button
                  onClick={() => { setActiveTab(null); setSidebarPinned(false); }}
                  className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  title={t('closePanel')}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <ToolPanel>
              {activeTab === 'adjust' && currentOriginal && (
                <AdjustPanel
                  imageUrl={currentOriginal.url}
                  imageWidth={currentOriginal.width}
                  imageHeight={currentOriginal.height}
                  onApply={handleApply}
                  resetSignal={resetSignal}
                  isFlipped={isFlipped}
                  rotation={rotation}
                />
              )}
              {activeTab === 'watermark' && currentOriginal && (
                <WatermarkPanel
                  imageUrl={currentOriginal.url}
                  imageWidth={currentOriginal.width}
                  imageHeight={currentOriginal.height}
                  onApply={handleApply}
                />
              )}
              {activeTab === 'merge' && currentOriginal && (
                <MergePanel
                  imageUrl={currentOriginal.url}
                  onApply={handleApply}
                />
              )}
              {activeTab && !currentOriginal && (
                <div className="flex flex-col items-center justify-center h-32 text-center text-muted-foreground text-sm gap-2">
                  <UploadZone onFilesSelected={handleFilesSelected} compact />
                </div>
              )}
            </ToolPanel>
          </aside>
        )}

        {/* 主内容区：移动端上下堆叠，桌面端左右分栏 */}
        <main className="flex-1 flex flex-col md:flex-row min-h-0">
          {/* 原图区域 */}
          {!hideOriginal && (
            <>
              <div className="flex-1 flex flex-col border-b md:border-b-0 md:border-r border-border min-w-0">
                <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-muted/20 shrink-0">
                  <span className="text-sm font-semibold tracking-tight">{t('original')}</span>
                </div>
                <div className="flex-1 overflow-auto bg-muted/5 scrollbar-thin">
                  {currentOriginal ? (
                    <div className="flex flex-col h-full p-4">
                      <div className="h-96 flex items-center justify-center">
                        <img
                          src={currentOriginal.url}
                          alt="Original"
                          className="max-w-full max-h-full object-contain rounded-lg shadow-sm"
                        />
                      </div>
                      <div className="pt-4 flex items-center justify-center">
                        <div className="space-y-2 text-left">
                          <div className="text-sm font-medium">
                            {t('originalName')}：{currentOriginal.name}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {t('originalSize')}：{formatFileSize(currentOriginal.size)}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {t('originalDimensions')}：{currentOriginal.width} × {currentOriginal.height}
                          </div>
                          <div className="mt-3">
                            <button
                              onClick={handleClearAll}
                              disabled={!hasImages}
                              className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-muted hover:bg-muted/80 disabled:opacity-50 disabled:cursor-not-allowed text-sm transition-colors"
                              title={t('clearAll')}
                            >
                              <Trash2 className="w-4 h-4" />
                              <span>{t('clearAll')}</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-full p-4">
                      <div className="w-full max-w-md">
                        <UploadZone onFilesSelected={handleFilesSelected} />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="hidden md:block w-px bg-border self-stretch" />
            </>
          )}

          {/* 预览区域 */}
          <div className={`flex flex-col min-w-0 ${hideOriginal ? 'flex-2' : 'flex-1'}`}>
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-muted/20 shrink-0">
              <span className="text-sm font-semibold tracking-tight">{t('preview')}</span>
              <div className="flex items-center gap-0.5">
                <button
                  onClick={handleToggleHideOriginal}
                  disabled={!hasImages}
                  className="p-1.5 rounded-lg hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-muted-foreground hover:text-foreground"
                  title={hideOriginal ? t('showOriginal') : t('hideOriginal')}
                >
                  {hideOriginal ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                </button>
                <button
                  onClick={handleToggleFullscreen}
                  disabled={!hasImages}
                  className="p-1.5 rounded-lg hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-muted-foreground hover:text-foreground"
                  title={t('fullscreenPreview')}
                >
                  {showFullscreenImage ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto bg-muted/5 scrollbar-thin">
              {previewImage ? (
                <div className="flex flex-col h-full p-4">
                  <div className={`flex items-center justify-center ${hideOriginal ? 'h-192' : 'h-96'}`}>
                    <img
                      src={previewImage.url}
                      alt="Preview"
                      className="max-w-full max-h-full object-contain rounded-lg shadow-sm"
                    />
                  </div>
                  <div className="pt-4 flex items-center justify-center">
                    <div className="space-y-2 text-left">
                      {isEditingFileName ? (
                        <div className="flex items-center gap-1">
                          <span className="text-sm font-medium">{t('previewName')}：</span>
                          <input
                            type="text"
                            value={editedFileName}
                            onChange={(e) => setEditedFileName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveFileName();
                              if (e.key === 'Escape') handleCancelEditFileName();
                            }}
                            className="px-2 py-1 border border-border rounded-lg text-sm bg-background w-32 focus:outline-none focus:ring-2 focus:ring-ring/50 focus:border-primary"
                            autoFocus
                          />
                          <button
                            onClick={handleSaveFileName}
                            className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                            title={t('save')}
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={handleCancelEditFileName}
                            className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                            title={t('cancel')}
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1">
                          <span className="text-sm font-medium">{t('previewName')}：</span>
                          <span className="text-sm truncate max-w-50">
                            {getFileNameWithoutExtension(previewImage.name)}
                          </span>
                          <span className="text-xs font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground shrink-0">
                            {getFormatExtension(previewImage.url, previewImage.name)}
                          </span>
                          <button
                            onClick={handleStartEditFileName}
                            className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                            title={t('editFileName')}
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                      <div className="text-sm text-muted-foreground flex items-center gap-2">
                        <span>
                          {t('previewSize')}：{formatFileSize(getDataUrlSize(previewImage.url))}
                        </span>
                        {sizeDeltaPct !== null && sizeDeltaPct !== 0 && (
                          <span
                            className={cn(
                              'text-xs font-medium px-1.5 py-0.5 rounded-full animate-in zoom-in-95 fade-in duration-200',
                              sizeDeltaPct > 0
                                ? 'bg-green-500/10 text-green-600 dark:text-green-400'
                                : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                            )}
                            title={
                              sizeDeltaPct > 0
                                ? lang === 'zh' ? '相比原图更小' : 'Smaller than original'
                                : lang === 'zh' ? '相比原图更大' : 'Larger than original'
                            }
                          >
                            {sizeDeltaPct > 0 ? '-' : '+'}{Math.abs(sizeDeltaPct)}%
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {t('previewDimensions')}：{previewImage.width} × {previewImage.height}
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2 justify-center">
                        <button
                          onClick={() => handleRotate(90)}
                          disabled={!hasImages}
                          className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-muted hover:bg-muted/80 disabled:opacity-50 disabled:cursor-not-allowed text-sm transition-colors"
                          title={t('rotate')}
                        >
                          <RotateCw className="w-4 h-4" />
                          <span>{t('rotate')}</span>
                        </button>
                        <button
                          onClick={handleFlip}
                          disabled={!hasImages}
                          className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-muted hover:bg-muted/80 disabled:opacity-50 disabled:cursor-not-allowed text-sm transition-colors"
                          title={t('flipH')}
                        >
                          <FlipHorizontal className="w-4 h-4" />
                          <span>{t('flip')}</span>
                        </button>
                        <button
                          onClick={handleReset}
                          disabled={!hasImages}
                          className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-muted hover:bg-muted/80 disabled:opacity-50 disabled:cursor-not-allowed text-sm transition-colors"
                          title={t('reset')}
                        >
                          <RotateCcw className="w-4 h-4" />
                          {t('reset')}
                        </button>
                        <button
                          onClick={handleDownload}
                          disabled={!hasImages}
                          className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed text-sm transition-colors shadow-sm"
                          title={t('download')}
                        >
                          <Download className="w-4 h-4" />
                          <span>{t('download')}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-full p-4">
                  <EmptyState variant="image" title={t('noImage')} description={t('uploadHint')} />
                </div>
              )}
            </div>
          </div>
        </main>
      </div>

      <footer className="flex items-center justify-center gap-4 px-4 py-2 border-t border-gray-200 dark:border-border bg-background/50 text-xs text-muted-foreground shrink-0">
        <a
          href="https://github.com/ale-160"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 hover:text-foreground transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
          </svg>
          <span>{t('githubRepo')}</span>
        </a>
        <span className="text-border">|</span>
        <a
          href="https://ale160.com/sponsor"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 hover:text-foreground transition-colors text-pink-600 dark:text-pink-400"
        >
          <Heart className="w-3.5 h-3.5" />
          <span>{t('sponsor')}</span>
        </a>
        <span className="text-border">|</span>
        <a
          href="https://ale160.com"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 hover:text-foreground transition-colors"
        >
          <img src="https://ale160.com/images/Avatar-SVG.png" alt="" className="w-3.5 h-3.5" />
          <span>{t('ale160Link')}</span>
        </a>
      </footer>

      {/* 确认弹窗 */}
      {showConfirmDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-card border border-border rounded-xl p-6 max-w-sm mx-4 shadow-xl animate-in fade-in zoom-in-95 duration-200">
            <h3 className="text-lg font-bold mb-2">{t('confirmReplace')}</h3>
            <p className="text-sm text-muted-foreground mb-4">
              {t('confirmReplaceDesc')}
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={handleCancelUpload}
                className="px-4 py-2 rounded-lg bg-muted hover:bg-muted/80 text-sm transition-colors"
              >
                {t('cancel')}
              </button>
              <button
                onClick={handleConfirmUpload}
                className="px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 text-sm transition-colors shadow-sm"
              >
                {t('confirmReplace')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 全屏图片预览 */}
      {showFullscreenImage && previewImage && (
        <div
          className="fixed inset-0 z-1000 bg-black/95 flex items-center justify-center cursor-pointer animate-in fade-in duration-200"
          onClick={() => setShowFullscreenImage(false)}
        >
          <img
            src={previewImage.url}
            alt="Fullscreen Preview"
            className="max-w-full max-h-full object-contain animate-in fade-in zoom-in-95 duration-200"
          />
          <button
            onClick={() => setShowFullscreenImage(false)}
            className="absolute top-4 right-4 p-2 bg-black/40 text-white rounded-full hover:bg-black/60 transition-colors"
            title={t('close')}
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* 功能开发中弹窗 */}
      <UnderDevelopmentModal
        isOpen={devModalOpen}
        onClose={() => setDevModalOpen(false)}
        onUseAnyway={handleBypassDev}
        featureName={devFeatureName}
      />


    </div>
  );
}
