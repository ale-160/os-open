'use client';

import { useCallback } from 'react';
import { useLanguage } from '@/hooks/useLanguage';
import { X, Pin, PinOff, ChevronUp, ChevronDown, ExternalLink } from 'lucide-react';
import { FormatPreset } from '@/data/presets';

interface FormatManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  formats: FormatPreset[];
  onFormatsChange: (formats: FormatPreset[]) => void;
}

export function FormatManagerModal({ isOpen, onClose, formats, onFormatsChange }: FormatManagerModalProps) {
  const { language } = useLanguage();

  const handleToggleFixed = useCallback((id: string) => {
    const idx = formats.findIndex(f => f.id === id);
    if (idx === -1) return;
    const item = formats[idx];
    const newFixed = !item.fixed;
    const updated = [...formats];
    updated.splice(idx, 1);

    if (newFixed) {
      const lastFixedIdx = updated.reduce((acc, f, i) => f.fixed ? i : acc, -1);
      updated.splice(lastFixedIdx + 1, 0, { ...item, fixed: true });
    } else {
      const lastFixedIdx = updated.reduce((acc, f, i) => f.fixed ? i : acc, -1);
      updated.splice(lastFixedIdx + 1, 0, { ...item, fixed: false });
    }
    onFormatsChange(updated);
  }, [formats, onFormatsChange]);

  const handleMoveUp = useCallback((id: string) => {
    const idx = formats.findIndex(f => f.id === id);
    if (idx <= 0) return;
    const updated = [...formats];
    [updated[idx - 1], updated[idx]] = [updated[idx], updated[idx - 1]];
    onFormatsChange(updated);
  }, [formats, onFormatsChange]);

  const handleMoveDown = useCallback((id: string) => {
    const idx = formats.findIndex(f => f.id === id);
    if (idx === -1 || idx >= formats.length - 1) return;
    const updated = [...formats];
    [updated[idx], updated[idx + 1]] = [updated[idx + 1], updated[idx]];
    onFormatsChange(updated);
  }, [formats, onFormatsChange]);

  if (!isOpen) return null;

  const sortedFormats = [...formats].sort((a, b) => {
    if (a.fixed && !b.fixed) return -1;
    if (!a.fixed && b.fixed) return 1;
    return 0;
  });

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
          <h3 className="font-semibold text-sm">
            {language === 'zh' ? '目标格式管理' : 'Format Manager'}
          </h3>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-muted">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-4 py-2 text-xs text-muted-foreground bg-muted/30 border-b border-border shrink-0">
          {language === 'zh'
            ? '浏览器原生支持的格式（JPEG / PNG / WebP）'
            : 'Only browser-native formats shown (JPEG / PNG / WebP) — free to use commercially, no extra dependencies'}
        </div>

        <div className="overflow-y-auto p-4 flex-1 min-h-0">
          <div className="space-y-2">
            {sortedFormats.map((format, idx) => (
              <div
                key={format.id}
                className="flex items-center gap-2 p-3 rounded-lg bg-muted/50"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-medium text-sm">{format.name}</span>
                    <span className="text-xs font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                      {format.extension}
                    </span>
                    {format.hasQuality && (
                      <span className="text-xs text-muted-foreground/70">
                        {language === 'zh' ? '支持质量调节' : 'Quality control'}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground truncate mt-0.5">
                    {language === 'zh' ? format.description : format.descriptionEn}
                  </div>
                </div>
                {/* 上移 */}
                <button
                  onClick={() => handleMoveUp(format.id)}
                  disabled={idx === 0}
                  className="p-1.5 rounded hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed shrink-0"
                  title={language === 'zh' ? '上移' : 'Move Up'}
                >
                  <ChevronUp className="w-4 h-4" />
                </button>
                {/* 下移 */}
                <button
                  onClick={() => handleMoveDown(format.id)}
                  disabled={idx === sortedFormats.length - 1}
                  className="p-1.5 rounded hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed shrink-0"
                  title={language === 'zh' ? '下移' : 'Move Down'}
                >
                  <ChevronDown className="w-4 h-4" />
                </button>
                {/* 固定 */}
                <button
                  onClick={() => handleToggleFixed(format.id)}
                  className={`p-1.5 rounded hover:bg-muted/70 shrink-0 ${format.fixed ? 'text-amber-500' : 'text-muted-foreground'}`}
                  title={language === 'zh' ? (format.fixed ? '取消固定' : '固定到顶部') : (format.fixed ? 'Unpin' : 'Pin to top')}
                >
                  {format.fixed ? <Pin className="w-4 h-4" /> : <PinOff className="w-4 h-4" />}
                </button>
              </div>
            ))}
          </div>

          {/* 更多格式支持 — 外链 */}
          <div className="pt-3 mt-2 border-t border-border/60">
            <a
              href="https://ale160.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              {language === 'zh' ? '更多格式支持 →' : 'More format support →'}
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
