/**
 * 小游戏季节棋盘背景（bg2 素材：春/夏/秋/冬 白天四款）。
 * 叠一层浅色渐变保证棋盘与文字可读；缺图时退化为纯色渐变（与原先一致）。
 */

import { BASE_PATH } from './skins';
import { assetUrl } from './assetUrl';

export type GameSeason = 'spring' | 'summer' | 'autumn' | 'winter';

export function gameSeason(d: Date = new Date()): GameSeason {
  const m = d.getMonth() + 1;
  if (m >= 3 && m <= 5) return 'spring';
  if (m >= 6 && m <= 8) return 'summer';
  if (m >= 9 && m <= 11) return 'autumn';
  return 'winter';
}

export function gameBgUrl(d: Date = new Date()): string {
  return assetUrl(`${BASE_PATH}/skins/gugu/game/bg2-${gameSeason(d)}-day.png`);
}

/** 棋盘容器样式：季节插画 + 半透明 tint（tint 为 rgba 颜色） */
export function gameBgStyle(tint: string, d: Date = new Date()): { backgroundImage: string; backgroundSize: string; backgroundPosition: string } {
  return {
    backgroundImage: `linear-gradient(${tint}, ${tint}), url(${gameBgUrl(d)})`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
  };
}