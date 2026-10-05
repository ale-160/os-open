'use client';

import { useCallback, useEffect, useState } from 'react';
import { ImagePlus, Trash2, Clipboard } from 'lucide-react';
import { toast } from 'sonner';
import { useLanguage } from '@/hooks/useLanguage';
import {
  listAssets,
  deleteAsset,
  getClipboardItem,
  type GalleryAsset,
  type ClipboardItemData
} from '@/utils/osAssets';

interface GalleryPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInsert: (dataUrl: string, name: string) => void;
}

/**
 * 系统图库选择器：从系统图库或系统剪贴板挑选图片插入当前文档。
 * 拉模型——图片由其他应用（如图片工具箱）预先存入系统资产库。
 */
export function GalleryPickerModal({ isOpen, onClose, onInsert }: GalleryPickerModalProps) {
  const { t } = useLanguage();
  const [assets, setAssets] = useState<GalleryAsset[]>([]);
  const [clipboard, setClipboard] = useState<ClipboardItemData | null>(null);
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setAssets(await listAssets());
      setClipboard(await getClipboardItem());
    } catch {
      // IndexedDB 不可用时展示空态
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (isOpen) {
      void refresh();
    }
  }, [isOpen, refresh]);

  const handleDelete = useCallback(async (id: string) => {
    await deleteAsset(id);
    setAssets(prev => prev.filter(asset => asset.id !== id));
    toast.success(t.galleryDeleted);
  }, [t.galleryDeleted]);

  if (!isOpen) return null;

  const clipboardImage = clipboard?.type === 'image' && clipboard.dataUrl ? clipboard : null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="glass-strong rounded-2xl shadow-2xl max-w-2xl w-full max-h-[85vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-border shrink-0">
          <h3 className="font-semibold">{t.systemGallery}</h3>
          <button
            onClick={onClose}
            className="p-2 rounded hover:bg-muted"
            aria-label={t.close}
          >
            ✕
          </button>
        </div>

        <div className="overflow-y-auto p-4 space-y-5">
          {/* 系统剪贴板 */}
          {clipboardImage && (
            <section>
              <h4 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
                <Clipboard className="w-3.5 h-3.5" />
                {t.systemClipboard}
              </h4>
              <div className="flex items-center gap-3 p-2 rounded-xl border border-border bg-muted/30">
                <img
                  src={clipboardImage.dataUrl}
                  alt={clipboardImage.name ?? 'clipboard'}
                  className="h-16 w-24 rounded-lg object-cover border border-border"
                />
                <span className="text-sm truncate flex-1">{clipboardImage.name ?? t.galleryImageName}</span>
                <button
                  onClick={() => onInsert(clipboardImage.dataUrl!, clipboardImage.name ?? 'clipboard')}
                  className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-sm hover:bg-primary/90 transition-colors shrink-0"
                >
                  {t.insert}
                </button>
              </div>
            </section>
          )}

          {/* 系统图库 */}
          <section>
            <h4 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
              <ImagePlus className="w-3.5 h-3.5" />
              {t.systemGallery}
            </h4>
            {loaded && assets.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">{t.galleryEmptyHint}</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {assets.map(asset => (
                  <div
                    key={asset.id}
                    className="group rounded-xl border border-border overflow-hidden bg-muted/30"
                  >
                    <img
                      src={asset.dataUrl}
                      alt={asset.name}
                      className="h-24 w-full object-cover"
                    />
                    <div className="p-2 flex items-center gap-1.5">
                      <span className="text-xs truncate flex-1" title={asset.name}>
                        {asset.name}
                      </span>
                      <button
                        onClick={() => {
                          onInsert(asset.dataUrl, asset.name);
                        }}
                        className="px-2 py-1 rounded-md bg-primary text-primary-foreground text-xs hover:bg-primary/90 transition-colors shrink-0"
                      >
                        {t.insert}
                      </button>
                      <button
                        onClick={() => void handleDelete(asset.id)}
                        className="p-1 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors shrink-0"
                        aria-label={t.galleryDelete}
                        title={t.galleryDelete}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
