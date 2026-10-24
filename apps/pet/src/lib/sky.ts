/** 昼夜天色主题（页面头部/状态条与舞台共用） */

export type SkyId = 'dawn' | 'day' | 'dusk' | 'night';

export interface SkyTheme {
  id: SkyId;
  /** 夜晚/黄昏 = true：悬浮 UI 切浅色文字与半透明白底 */
  dark: boolean;
  sky: string;
  orb: 'sun' | 'dusk' | 'moon';
  floor: string;
  floorDeep: string;
  stars: boolean;
}

export function skyTheme(hour: number): SkyTheme {
  if (hour >= 5 && hour < 8) {
    return {
      id: 'dawn',
      dark: false,
      sky: 'from-[#ffe0d1] via-[#fff3e0] to-[#ffeccb]',
      orb: 'sun',
      floor: '#f7dcae',
      floorDeep: '#f2d19a',
      stars: false,
    };
  }
  if (hour >= 8 && hour < 17) {
    return {
      id: 'day',
      dark: false,
      sky: 'from-[#ffedd0] via-[#fff8ea] to-[#ffedcb]',
      orb: 'sun',
      floor: '#f7dcae',
      floorDeep: '#f2d19a',
      stars: false,
    };
  }
  if (hour >= 17 && hour < 20) {
    return {
      id: 'dusk',
      dark: true,
      sky: 'from-[#ffd9c2] via-[#ffe8d6] to-[#f7c9a2]',
      orb: 'dusk',
      floor: '#eec394',
      floorDeep: '#e0b183',
      stars: false,
    };
  }
  return {
    id: 'night',
    dark: true,
    sky: 'from-[#3d4a7a] via-[#5d6ba0] to-[#8a7fae]',
    orb: 'moon',
    floor: '#a9987d',
    floorDeep: '#93866c',
    stars: true,
  };
}
