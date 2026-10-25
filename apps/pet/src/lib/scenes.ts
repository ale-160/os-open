/**
 * 场景系统：每日轮换的目的地场景背景（AI 生成 1536×1024），玩家也可手动切换/关掉。
 * 场景图与天气粒子、昼夜色调叠加共存（夜/黄昏时叠暗色滤镜）。
 */

import { BASE_PATH } from './skins';
import { assetUrl } from './assetUrl';
import type { Weather } from './weather';

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

/** 场景时态变体（每个场景都有全套图，见 tools/gen-prompts-batch4.mjs） */
export type SceneVariant =
  | 'dawn' | 'day2' | 'dusk' | 'night'
  | 'rain' | 'snow' | 'storm' | 'fog'
  | 'aurora' | 'meteor' | 'full-moon' | 'rainbow-night' | 'rainbow'
  | 'mist-morning' | 'sunset-purple'
  | 'spring' | 'summer' | 'autumn' | 'winter' | 'sakura' | 'festival';

/** 全部可用时态（素材回归测试用） */
export const SCENE_VARIANTS: readonly SceneVariant[] = [
  'dawn', 'day2', 'dusk', 'night',
  'rain', 'snow', 'storm', 'fog',
  'aurora', 'meteor', 'full-moon', 'rainbow-night', 'rainbow',
  'mist-morning', 'sunset-purple',
  'spring', 'summer', 'autumn', 'winter', 'sakura', 'festival',
];

/** 可复现伪随机（与 weather.ts 同款） */
function seeded(seed: number): number {
  const x = (seed * 9301 + 49297) % 233280;
  return x / 233280;
}

function seasonOf(month: number): 'spring' | 'summer' | 'autumn' | 'winter' {
  if (month >= 3 && month <= 5) return 'spring';
  if (month >= 6 && month <= 8) return 'summer';
  if (month >= 9 && month <= 11) return 'autumn';
  return 'winter';
}

/** 节日场景：元旦 / 情人节 / 国庆 / 圣诞（坏天气优先级更高） */
function isFestivalDay(d: Date): boolean {
  const md = (d.getMonth() + 1) * 100 + d.getDate();
  return md === 101 || md === 214 || md === 1001 || md === 1225;
}

/**
 * 按天气 + 时段 + 季节挑场景时态：
 * 雨天/雪天 > 节日 > 夜(含极光/流星/满月/月虹) > 清晨薄雾/黄昏紫霞 > 白天(晴虹) > 季节底色。
 * 同一小时结果稳定，避免每次重渲染换图。
 */
export function sceneVariantFor(d: Date, weather: Weather): SceneVariant {
  const month = d.getMonth() + 1;
  const hour = d.getHours();
  const seed = d.getFullYear() * 1000000 + month * 10000 + d.getDate() * 100 + hour;
  const roll = seeded(seed);

  if (weather === 'rain') return roll < 0.18 ? 'storm' : 'rain';
  if (weather === 'snow') return 'snow';
  if (isFestivalDay(d)) return 'festival';

  if (hour >= 20 || hour < 5) {
    if (roll < 0.1) return 'aurora';
    if (roll < 0.2) return 'meteor';
    if (roll < 0.35) return 'full-moon';
    if (roll < 0.42) return 'rainbow-night';
    return 'night';
  }
  if (hour < 8) return 'mist-morning';
  if (hour >= 17) return roll < 0.3 ? 'sunset-purple' : 'dusk';

  // 白天 8:00-16:59
  if (roll < 0.08) return 'rainbow';
  if (weather === 'cloudy' && roll < 0.3) return 'fog';
  const season = seasonOf(month);
  if (season === 'spring' && roll < 0.45) return 'sakura';
  return season;
}

export function sceneLocalSrc(id: SceneId, variant?: SceneVariant | null): string {
  const def = SCENES.find((s) => s.id === id);
  if (!def) return '';
  const file = variant ? def.file.replace(/\.png$/, `-${variant}.png`) : def.file;
  return `${BASE_PATH}/skins/gugu/${file}`;
}

export function sceneSrc(id: SceneId, variant?: SceneVariant | null): string {
  return assetUrl(sceneLocalSrc(id, variant));
}

/** 每日轮换（'auto' 模式）：按日期种子选场景 */
export function dailyScene(d: Date): SceneId {
  const seed = d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
  return SCENES[seed % SCENES.length].id;
}
