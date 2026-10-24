/**
 * 场景系统：每日轮换的目的地场景背景（AI 生成 1536×1024），玩家也可手动切换/关掉。
 * 场景图与天气粒子、昼夜色调叠加共存（夜/黄昏时叠暗色滤镜）。
 */

import { BASE_PATH } from './skins';

export type SceneId =
  | 'garden' | 'lake' | 'bamboo' | 'roof' | 'meadow' | 'courtyard'
  | 'starry-hill' | 'riverside' | 'sakura-park' | 'autumn-lane' | 'snow-town' | 'seaside-cliff';

export interface SceneDef {
  id: SceneId;
  file: string;
  zh: string;
  en: string;
}

export const SCENES: SceneDef[] = [
  { id: 'garden', file: 'scene/garden.png', zh: '花园', en: 'Garden' },
  { id: 'lake', file: 'scene/lake.png', zh: '湖畔', en: 'Lakeside' },
  { id: 'bamboo', file: 'scene/bamboo.png', zh: '竹林', en: 'Bamboo Grove' },
  { id: 'roof', file: 'scene/roof.png', zh: '屋顶露台', en: 'Rooftop' },
  { id: 'meadow', file: 'scene/meadow.png', zh: '草原', en: 'Meadow' },
  { id: 'courtyard', file: 'scene/courtyard.png', zh: '小院', en: 'Courtyard' },
  { id: 'starry-hill', file: 'scene/starry-hill.png', zh: '星丘', en: 'Starry Hill' },
  { id: 'riverside', file: 'scene/riverside.png', zh: '溪边', en: 'Riverside' },
  { id: 'sakura-park', file: 'scene/sakura-park.png', zh: '樱花公园', en: 'Sakura Park' },
  { id: 'autumn-lane', file: 'scene/autumn-lane.png', zh: '银杏小径', en: 'Autumn Lane' },
  { id: 'snow-town', file: 'scene/snow-town.png', zh: '雪镇', en: 'Snow Town' },
  { id: 'seaside-cliff', file: 'scene/seaside-cliff.png', zh: '海边悬崖', en: 'Seaside Cliff' },
];

export function sceneSrc(id: SceneId): string {
  return `${BASE_PATH}/skins/gugu/${SCENES.find((s) => s.id === id)?.file ?? ''}`;
}

/** 每日轮换（'auto' 模式）：按日期种子选场景 */
export function dailyScene(d: Date): SceneId {
  const seed = d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
  return SCENES[seed % SCENES.length].id;
}
