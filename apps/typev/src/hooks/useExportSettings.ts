import { create } from 'zustand';
import type { ExportSettings } from '@/types/script';

interface ExportSettingsState {
  settings: ExportSettings;
  setSettings: (settings: ExportSettings) => void;
}

/**
 * 导出设置状态管理 Hook
 * 不使用持久化，每次刷新页面恢复默认值
 */
export const useExportSettings = create<ExportSettingsState>((set) => ({
  settings: {
    format: 'webm',
    quality: 0.9,
    frameRate: 30,
    resolution: {
      width: 1920,
      height: 1080
    }
  },
  setSettings: (settings) => set({ settings })
}));
