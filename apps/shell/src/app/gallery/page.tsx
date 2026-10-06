'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Trash2, Download, ImageOff, Clipboard } from 'lucide-react';
import { toast } from 'sonner';
import {
  listAssets,
  deleteAsset,
  getClipboardItem,
  setClipboardItem,
  type GalleryAsset
} from '@/utils/osAssets';

/**
 * 系统图库（Gallery App）
 *
 * 浏览与管理 Ale OS 系统资产库（IndexedDB，本机存储）：
 * 图片工具箱等应用的产物保存在这里，可预览、下载、复制到系统剪贴板或删除。
 */
export default function GalleryPage() {
  const [assets, setAssets] = useState<GalleryAsset[]>([]);
  const [clipboardImage, setClipboardImage] = useState<GalleryAsset | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [preview, setPreview] = useState<GalleryAsset | null>(null);

  const refresh = useCallback(async () => {
    try {
      const list = await listAssets();
      setAssets(list);
      const clip = await getClipboardItem();
      if (clip?.type === 'image' && clip.dataUrl) {
        setClipboardImage({
          id: 'clipboard',
          type: 'image',
          name: clip.name ?? '剪贴板图片',
          dataUrl: clip.dataUrl,
          createdAt: clip.updatedAt
        });
      } else {
        setClipboardImage(null);
      }
    } catch {
      // IndexedDB 不可用时展示空态
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    document.documentElement.lang = 'zh-CN';
    void refresh();
  }, [refresh]);

  const handleDelete = useCallback(async (id: string) => {
    await deleteAsset(id);
    setAssets(prev => prev.filter(asset => asset.id !== id));
    setPreview(prev => (prev?.id === id ? null : prev));
    toast.success('已从图库删除');
  }, []);

  const handleDownload = useCallback((asset: GalleryAsset) => {
    const link = document.createElement('a');
    link.href = asset.dataUrl;
    link.download = asset.name || 'image.png';
    link.click();
    toast.success('已开始下载');
  }, []);

  const handleCopyToClipboard = useCallback(async (asset: GalleryAsset) => {
    try {
      await setClipboardItem({ type: 'image', dataUrl: asset.dataUrl, name: asset.name });
      toast.success('已复制到系统剪贴板');
      const clip = await getClipboardItem();
      if (clip?.type === 'image' && clip.dataUrl) {
        setClipboardImage({ id: 'clipboard', type: 'image', name: clip.name ?? '剪贴板图片', dataUrl: clip.dataUrl, createdAt: clip.updatedAt });
      }
    } catch {
      toast.error('复制失败');
    }
  }, []);

  const formatDate = (ts: number) =>
    new Date(ts).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });

  return (
    <main className="min-h-screen os-desktop-bg">
      <div className="mx-auto max-w-4xl px-4 py-8">
        <header className="mb-6 flex items-center gap-3">
          <img src="/apps/gallery.png" alt="" className="h-10 w-10 rounded-xl shadow" />
          <div>
            <h1 className="text-xl font-bold text-foreground">系统图库</h1>
            <p className="text-xs text-muted-foreground">
              Ale OS 共享资产库——应用产物都保存在这里（仅存于你的浏览器本机）
            </p>
          </div>
        </header>

        {clipboardImage && (
          <section className="mb-6 rounded-2xl border border-primary/30 bg-primary/5 p-4">
            <h2 className="mb-3 flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
              <Clipboard className="h-3.5 w-3.5" />
              系统剪贴板
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
                title="下载"
                aria-label="下载剪贴板图片"
              >
                <Download className="h-4 w-4" />
              </button>
            </div>
          </section>
        )}

        <section>
          <h2 className="mb-3 text-sm font-medium text-muted-foreground">图库（{assets.length}）</h2>
          {loaded && assets.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border py-16 text-muted-foreground">
              <ImageOff className="h-10 w-10 opacity-50" />
              <p className="text-sm">图库还是空的</p>
              <p className="text-xs">在「图片工具箱」中处理图片后选择「保存到图库」，就会出现在这里</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              {assets.map(asset => (
                <div
                  key={asset.id}
                  className="group overflow-hidden rounded-2xl border border-border bg-card/60 backdrop-blur transition-shadow hover:shadow-lg"
                >
                  <img
                    src={asset.dataUrl}
                    alt={asset.name}
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
                      <button
                        onClick={() => void handleCopyToClipboard(asset)}
                        className="flex-1 rounded-md bg-muted px-2 py-1 text-[11px] hover:bg-muted/70 transition-colors"
                        title="复制到系统剪贴板"
                      >
                        <Clipboard className="mx-auto h-3 w-3" />
                      </button>
                      <button
                        onClick={() => handleDownload(asset)}
                        className="flex-1 rounded-md bg-muted px-2 py-1 text-[11px] hover:bg-muted/70 transition-colors"
                        title="下载"
                      >
                        <Download className="mx-auto h-3 w-3" />
                      </button>
                      <button
                        onClick={() => void handleDelete(asset.id)}
                        className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                        title="删除"
                        aria-label={`删除 ${asset.name}`}
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
          <img
            src={preview.dataUrl}
            alt={preview.name}
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
              下载
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
