'use client';

import React from 'react';
import { Store, Check } from 'lucide-react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { OS_APPS, type OsApp } from '@/config/apps';

interface AppStoreModalProps {
  isOpen: boolean;
  onClose: () => void;
  language: 'zh' | 'en';
  /** 桌面上已有的应用图标 URL（含 app:// 前缀） */
  installedUrls: readonly string[];
  onAdd: (app: OsApp) => void;
  onRemove: (app: OsApp) => void;
}

/**
 * 系统应用商城：注册表（apps.ts）即上架清单。
 * 从这里添加/移除桌面应用图标——移除只影响桌面入口，应用代码仍在系统中，
 * 随时可以再加回来。这是后续集成第三方开源工具的统一接入面。
 */
export function AppStoreModal({
  isOpen,
  onClose,
  language,
  installedUrls,
  onAdd,
  onRemove
}: AppStoreModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={language === 'zh' ? '应用商城' : 'App Store'}
      description={language === 'zh' ? '管理桌面上的应用入口' : 'Manage app entries on your desktop'}
      size="lg"
    >
      <div className="space-y-3">
        {OS_APPS.map(app => {
          const appUrl = `app://${app.id}`;
          const installed = installedUrls.includes(appUrl);
          return (
            <div
              key={app.id}
              className="flex items-center gap-3 rounded-xl border border-border/60 p-3"
            >
              <img
                src={app.icon}
                alt=""
                className="h-12 w-12 rounded-xl border border-border/50 object-cover"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm truncate">
                    {language === 'zh' ? app.name : app.nameEn}
                  </span>
                  {installed && (
                    <span className="inline-flex items-center gap-0.5 rounded-full bg-primary/10 text-primary px-2 py-0.5 text-[11px] shrink-0">
                      <Check className="w-3 h-3" />
                      {language === 'zh' ? '已添加' : 'Added'}
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                  {language === 'zh' ? app.description : app.descriptionEn}
                </p>
              </div>
              {installed ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onRemove(app)}
                  className="shrink-0"
                >
                  {language === 'zh' ? '移除' : 'Remove'}
                </Button>
              ) : (
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => onAdd(app)}
                  className="shrink-0"
                >
                  <Store className="w-3.5 h-3.5" />
                  {language === 'zh' ? '添加' : 'Add'}
                </Button>
              )}
            </div>
          );
        })}
        <p className="text-xs text-muted-foreground text-center pt-1">
          {language === 'zh' ? '更多应用即将上架——欢迎开源作者接入' : 'More apps coming soon — open-source authors welcome'}
        </p>
      </div>
    </Modal>
  );
}
