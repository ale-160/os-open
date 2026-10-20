import { useState, useCallback } from 'react';
import { useScript } from './useScript';
import type { ScriptLine } from '@/types/script';

type EffectType = ScriptLine['effect'];

/**
 * 全局动画效果管理 Hook
 */
export function useGlobalEffect() {
  const [globalEffect, setGlobalEffect] = useState<string>('centerTypewriter');
  const { script, setScript } = useScript();

  /**
   * 设置全局动画效果，并应用到所有脚本行
   */
  const applyGlobalEffect = useCallback((effect: string) => {
    setGlobalEffect(effect);
    
    if (script) {
      // 更新所有行的 effect（除非该行已有自定义 animation）
      const updatedLines = script.lines.map(line => ({
        ...line,
        effect: line.animation ? line.effect : (effect as EffectType)
      }));
      
      setScript({
        ...script,
        lines: updatedLines
      });
    }
  }, [script, setScript]);

  return {
    globalEffect,
    setGlobalEffect: applyGlobalEffect
  };
}
