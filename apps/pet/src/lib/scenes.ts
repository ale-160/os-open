/**
 * 场景系统：每日轮换的目的地场景背景（AI 生成 1536×1024），玩家也可手动切换/关掉。
 * 场景图与天气粒子、昼夜色调叠加共存（夜/黄昏时叠暗色滤镜）。
 */

import { BASE_PATH } from './skins';
import { assetUrl } from './assetUrl';

export type SceneId =
  | 'garden' | 'lake' | 'bamboo' | 'roof' | 'meadow' | 'courtyard'
  | 'starry-hill' | 'riverside' | 'sakura-park' | 'autumn-lane' | 'snow-town' | 'seaside-cliff'
  | 'greenhouse' | 'windmill' | 'library-nook' | 'lantern-street' | 'sunflower-field'
  | 'desert-oasis' | 'alpine' | 'night-market' | 'pond' | 'maple-bridge' | 'cloud-deck' | 'terrace-cafe';

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
  { id: 'greenhouse', file: 'scene/greenhouse.png', zh: '小温室', en: 'Greenhouse' },
  { id: 'windmill', file: 'scene/windmill.png', zh: '风车田野', en: 'Windmill Field' },
  { id: 'library-nook', file: 'scene/library-nook.png', zh: '花园书角', en: 'Garden Nook' },
  { id: 'lantern-street', file: 'scene/lantern-street.png', zh: '灯笼街', en: 'Lantern Street' },
  { id: 'sunflower-field', file: 'scene/sunflower-field.png', zh: '向日葵田', en: 'Sunflower Field' },
  { id: 'desert-oasis', file: 'scene/desert-oasis.png', zh: '沙漠绿洲', en: 'Desert Oasis' },
  { id: 'alpine', file: 'scene/alpine.png', zh: '高山草甸', en: 'Alpine Meadow' },
  { id: 'night-market', file: 'scene/night-market.png', zh: '夜市', en: 'Night Market' },
  { id: 'pond', file: 'scene/pond.png', zh: '青蛙池塘', en: 'Frog Pond' },
  { id: 'maple-bridge', file: 'scene/maple-bridge.png', zh: '枫桥', en: 'Maple Bridge' },
  { id: 'cloud-deck', file: 'scene/cloud-deck.png', zh: '云上观景台', en: 'Cloud Deck' },
  { id: 'terrace-cafe', file: 'scene/terrace-cafe.png', zh: '露台咖啡馆', en: 'Terrace Cafe' },
];

export function sceneSrc(id: SceneId): string {
  return assetUrl(`${BASE_PATH}/skins/gugu/${SCENES.find((s) => s.id === id)?.file ?? ''}`);
}

/** 每日轮换（'auto' 模式）：按日期种子选场景 */
export function dailyScene(d: Date): SceneId {
  const seed = d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
  return SCENES[seed % SCENES.length].id;
}
