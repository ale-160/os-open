'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface ScriptTextState {
  /** 编辑器文本（脚本源码），刷新不丢失 */
  text: string;
  setText: (text: string) => void;
}

/**
 * 脚本文本持久化：与解析后的 Script 分开存储——
 * 文本是编辑的唯一事实来源，Script 由解析器派生。
 */
export const useScriptText = create<ScriptTextState>()(
  persist(
    (set) => ({
      text: '',
      setText: (text) => set({ text }),
    }),
    { name: 'typev-script-text' }
  )
);

/** 首次访问的演示脚本（语法见样式指南） */
export const DEMO_SCRIPT = `[global-style mode=centerTypewriter; color=#ffffff; fontSize=40px]
在 Ale OS 里，让文字动起来
[style color=#38bdf8; fontSize=44px]TypeV[/style] [style color=#ffffff; fontSize=40px]文字动画制作器[/style]
[global-style mode=fadeIn; fontSize=32px; color=#e2e8f0]
写一段脚本，点击解析，播放预览
[style color=#fbbf24; effect=colorWave]满意后一键录制导出视频[/style]`;
