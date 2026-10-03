'use client';

import { cn } from '@/lib/utils';
import { ToolTab } from '@/data/presets';
import { Sliders, Droplets, Images } from 'lucide-react';
import { useLanguage } from '@/hooks/useLanguage';
import React from "react";

interface SmallSidebarProps {
  activeTab: ToolTab | null;
  onTabChange: (tab: ToolTab | null) => void;
}

export function SmallSidebar({ activeTab, onTabChange }: SmallSidebarProps) {
  const { t } = useLanguage();

  const toolItems: { id: ToolTab; key: 'adjust' | 'watermark' | 'merge'; icon: React.ReactNode }[] = [
    { id: 'adjust', key: 'adjust', icon: <Sliders className="w-5 h-5" /> },
    { id: 'watermark', key: 'watermark', icon: <Droplets className="w-5 h-5" /> },
    { id: 'merge', key: 'merge', icon: <Images className="w-5 h-5" /> },
  ];

  const handleClick = (tabId: ToolTab) => {
    if (activeTab === tabId) {
      onTabChange(null);
    } else {
      onTabChange(tabId);
    }
  };

  return (
    <div className="flex flex-col items-center w-12 shrink-0 border-r border-border bg-muted/30 py-1 gap-0.5">
      {toolItems.map((item) => (
        <button
          key={item.id}
          onClick={() => handleClick(item.id)}
          title={t(item.key)}
          className={cn(
            'relative flex items-center justify-center w-10 h-10 rounded-lg transition-all duration-200',
            'hover:bg-muted hover:text-foreground',
            activeTab === item.id
              ? [
                  'bg-primary text-primary-foreground shadow-sm',
                  'before:absolute before:left-0 before:top-1.5 before:bottom-1.5 before:w-0.5 before:rounded-r before:bg-primary-foreground',
                ]
              : 'text-muted-foreground'
          )}
        >
          {item.icon}
        </button>
      ))}
    </div>
  );
}
