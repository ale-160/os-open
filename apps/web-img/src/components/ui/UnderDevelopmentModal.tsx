'use client';

import { useLanguage } from '@/hooks/useLanguage';
import { Wrench, FlaskConical } from 'lucide-react';

interface UnderDevelopmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUseAnyway: () => void;
  featureName?: string;
}

export function UnderDevelopmentModal({ isOpen, onClose, onUseAnyway, featureName }: UnderDevelopmentModalProps) {
  const { t } = useLanguage();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="bg-card border border-border rounded-xl p-6 max-w-sm mx-4 shadow-xl text-center animate-in fade-in zoom-in-95 duration-200">
        <div className="flex justify-center mb-4">
          <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
            <Wrench className="w-7 h-7 text-primary" />
          </div>
        </div>
        <h3 className="text-lg font-semibold mb-2">
          {featureName}
        </h3>
        <p className="text-sm text-muted-foreground mb-2">
          {t('underDevelopment')}
        </p>
        <p className="text-xs text-muted-foreground/70 mb-5">
          {t('betaWarning')}
        </p>
        <div className="flex gap-2 justify-center">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-muted hover:bg-muted/80 text-sm transition-colors"
          >
            {t('gotIt')}
          </button>
          <button
            onClick={onUseAnyway}
            className="px-4 py-2 rounded-lg bg-primary/10 border border-primary/30 text-primary hover:bg-primary/20 text-sm transition-colors flex items-center gap-1.5"
          >
            <FlaskConical className="w-4 h-4" />
            {t('tryBeta')}
          </button>
        </div>
      </div>
    </div>
  );
}
