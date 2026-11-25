'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Trash2, Download, ImageOff, Clipboard } from 'lucide-react';
import { toast } from 'sonner';
import {
  listAssets,
  deleteAsset,
  getClipboardItem,
  setClipboardItem,
  type GalleryAsset
} from '@os/shared/os-assets';
import { useOsLanguage } from '@os/shared/os-language';
import { getStrings } from '@/data/i18n';

/**
 * 系统图库（Gallery App）
 *
 * 浏览与管理 Ale OS 系统资产库（IndexedDB，本机存储）：
 * 图片工具箱、文字动画（GIF/视频）、P2P 聊天室等应用的产物保存在这里，可预览、下载、复制到系统剪贴板或删除。
 * 资产以 data URL 存储；视频（如文字动画导出的 WebM）以 <video> 呈现，且不进系统剪贴板（剪贴板仅承载图片）。
 *
 * 文案跟随系统共享语言（ale-os-language，见 @os/shared/os-language）：
 * 壳内嵌（iframe）时通过 storage 事件、直接访问时通过同帧事件/存储事件实时切换。
 */

/** data URL 是否为视频资产 */
function isVideoAsset(asset: GalleryAsset): boolean {
  return asset.dataUrl.startsWith('data:video/');
}

interface AssetMediaProps {
  asset: GalleryAsset;
  className: string;
  /** 预览大图时显示播放控件；缩略图静音循环自动播放 */
  controls?: boolean;
  onClick?: (e: React.MouseEvent) => void;
}

function AssetMedia({ asset, className, controls = false, onClick }: AssetMediaProps) {
  if (isVideoAsset(asset)) {
    return (
      <video
        src={asset.dataUrl}
        aria-label={asset.name}
        className={className}
        onClick={onClick}
        controls={controls}
        autoPlay={!controls}
        muted={!controls}
        loop
        playsInline
      />
    );
  }
  return <img src={asset.dataUrl} alt={asset.name} className={className} onClick={onClick} />;
}

/** 系统剪贴板里的图片（原始记录；未命名时的显示名按当前语言在渲染时补齐） */
interface ClipboardImage {
  name?: string;
  dataUrl: string;
  updatedAt: number;
}

export default function GalleryPage() {
  // 系统共享语言：无记录时与其他内嵌应用一致默认 zh（静态导出的预渲染也是 zh，避免水合不一致）
  const { language } = useOsLanguage({ defaultLanguage: 'zh' });
  const t = getStrings(language).gallery;

  const [assets, setAssets] = useState<GalleryAsset[]>([]);
  const [clipboardRaw, setClipboardRaw] = useState<ClipboardImage | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [preview, setPreview] = useState<GalleryAsset | null>(null);

  const clipboardImage = useMemo<GalleryAsset | null>(
    () =>
      clipboardRaw
        ? {
            id: 'clipboard',
            type: 'image',
            name: clipboardRaw.name ?? t.clipboardImageName,
            dataUrl: clipboardRaw.dataUrl,
            createdAt: clipboardRaw.updatedAt
          }
        : null,
    [clipboardRaw, t.clipboardImageName]
  );

  const loadClipboard = useCallback(async () => {
    const clip = await getClipboardItem();
    if (clip?.type === 'image' && clip.dataUrl) {
      setClipboardRaw({ name: clip.name, dataUrl: clip.dataUrl, updatedAt: clip.updatedAt });
    } else {
      setClipboardRaw(null);
    }
  }, []);

  const refresh = useCallback(async () => {
    try {
      const list = await listAssets();
      setAssets(list);
      await loadClipboard();
    } catch {
      // IndexedDB 不可用时展示空态
    }
    setLoaded(true);
  }, [loadClipboard]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // <html lang> 跟随当前语言
  useEffect(() => {
    document.documentElement.lang = t.htmlLang;
  }, [t.htmlLang]);

  const handleDelete = useCallback(async (id: string) => {
    await deleteAsset(id);
    setAssets(prev => prev.filter(asset => asset.id !== id));
    setPreview(prev => (prev?.id === id ? null : prev));
    toast.success(t.deleted);
  }, [t.deleted]);

  const handleDownload = useCallback((asset: GalleryAsset) => {
    const link = document.createElement('a');
    link.href = asset.dataUrl;
    link.download = asset.name || (isVideoAsset(asset) ? 'video.webm' : 'image.png');
    link.click();
    toast.success(t.downloadStarted);
  }, [t.downloadStarted]);

  const handleCopyToClipboard = useCallback(async (asset: GalleryAsset) => {
    try {
      await setClipboardItem({ type: 'image', dataUrl: asset.dataUrl, name: asset.name });
      toast.success(t.copied);
      await loadClipboard();
    } catch {
      toast.error(t.copyFailed);
    }
  }, [t.copied, t.copyFailed, loadClipboard]);

  const formatDate = (ts: number) =>
    new Date(ts).toLocaleDateString(t.dateLocale, { month: 'short', day: 'numeric' });

  return (
    <main className="min-h-screen os-desktop-bg">
      <div className="mx-auto max-w-4xl px-4 py-8">
        <header className="mb-6 flex items-center gap-3">
          <img src="/apps/gallery.png" alt="" className="h-10 w-10 rounded-xl shadow" />
          <div>
            <h1 className="text-xl font-bold text-foreground">{t.title}</h1>
            <p className="text-xs text-muted-foreground">{t.subtitle}</p>
          </div>
        </header>

        {clipboardImage && (
          <section className="mb-6 rounded-2xl border border-primary/30 bg-primary/5 p-4">
            <h2 className="mb-3 flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
              <Clipboard className="h-3.5 w-3.5" />
              {t.clipboardSection}
            </h2>
            <div className="flex items-center gap-3">
              <img
                src={clipboardImage.dataUrl}
                alt={clipboardImage.name}
                onClick={() => setPreview(clipboardImage)}
                className="h-16 w-24 cursor-zoom-in rounded-lg border border-border object-cover"
              />
              <span className="flex-1 truncate text-sm">{clipboardImage.name}</span>
              <button
                onClick={() => handleDownload(clipboardImage)}
                className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                title={t.download}
                aria-label={t.downloadClipboardImage}
              >
                <Download className="h-4 w-4" />
              </button>
            </div>
          </section>
        )}

        <section>
          <h2 className="mb-3 text-sm font-medium text-muted-foreground">
            {t.libraryCount.replace('{count}', String(assets.length))}
          </h2>
          {loaded && assets.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border px-4 py-16 text-muted-foreground">
              <ImageOff className="h-10 w-10 opacity-50" />
              <p className="text-sm">{t.emptyTitle}</p>
              <p className="text-xs">{t.emptyHint}</p>
              <ul className="space-y-1 text-xs">
                <li>{t.emptySourceImageToolbox}</li>
                <li>{t.emptySourceTypeV}</li>
                <li>{t.emptySourceChat}</li>
              </ul>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              {assets.map(asset => (
                <div
                  key={asset.id}
                  className="group overflow-hidden rounded-2xl border border-border bg-card/60 backdrop-blur transition-shadow hover:shadow-lg"
                >
                  <AssetMedia
                    asset={asset}
                    onClick={() => setPreview(asset)}
                    className="h-36 w-full cursor-zoom-in object-cover"
                  />
                  <div className="p-2.5">
                    <div className="flex items-center gap-1">
                      <span className="flex-1 truncate text-xs font-medium" title={asset.name}>
                        {asset.name}
                      </span>
                      <span className="text-[10px] text-muted-foreground">{formatDate(asset.createdAt)}</span>
                    </div>
                    <div className="mt-2 flex items-center gap-1">
                      {!isVideoAsset(asset) && (
                        <button
                          onClick={() => void handleCopyToClipboard(asset)}
                          className="flex-1 rounded-md bg-muted px-2 py-1 text-[11px] hover:bg-muted/70 transition-colors"
                          title={t.copyToClipboard}
                          aria-label={t.copyToClipboard}
                        >
                          <Clipboard className="mx-auto h-3 w-3" />
                        </button>
                      )}
                      <button
                        onClick={() => handleDownload(asset)}
                        className="flex-1 rounded-md bg-muted px-2 py-1 text-[11px] hover:bg-muted/70 transition-colors"
                        title={t.download}
                        aria-label={t.download}
                      >
                        <Download className="mx-auto h-3 w-3" />
                      </button>
                      <button
                        onClick={() => void handleDelete(asset.id)}
                        className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                        title={t.delete}
                        aria-label={t.deleteAsset.replace('{name}', asset.name)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* 大图预览 */}
      {preview && (
        <div
          className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-black/80 p-6 backdrop-blur-sm"
          onClick={() => setPreview(null)}
        >
          <AssetMedia
            asset={preview}
            controls
            className="max-h-[75vh] max-w-full rounded-xl shadow-2xl"
            onClick={e => e.stopPropagation()}
          />
          <div className="flex items-center gap-3 text-white">
            <span className="text-sm">{preview.name}</span>
            <button
              onClick={e => {
                e.stopPropagation();
                void handleDownload(preview);
              }}
              className="flex items-center gap-1.5 rounded-lg bg-white/15 px-3 py-1.5 text-sm hover:bg-white/25 transition-colors"
            >
              <Download className="h-4 w-4" />
              {t.download}
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
