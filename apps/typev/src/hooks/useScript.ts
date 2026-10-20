import { create } from 'zustand';
import type { Script } from '@/types/script';

interface ScriptState {
  script: Script | null;
  setScript: (script: Script) => void;
  clearScript: () => void;
}

/**
 * 脚本状态管理 Hook
 * 使用 zustand 实现简单的状态管理（不持久化）
 */
export const useScript = create<ScriptState>()((set) => ({
  script: null,
  setScript: (script) => set({ script }),
  clearScript: () => set({ script: null })
}));
