/**
 * 天气系统：以日期为种子的确定性伪随机——所有玩家同一天看到同一天气（"世界同步"感），
 * 季节影响概率分布（冬季下雪、夏季多雨）。
 */

export type Weather = 'sunny' | 'cloudy' | 'rain' | 'snow';

/** 简单可复现伪随机（[0,1)） */
function seeded(seed: number): number {
  const x = (seed * 9301 + 49297) % 233280;
  return x / 233280;
}

/** 按季节的天气概率表 */
function seasonTable(month: number): [Weather, number][] {
  // 12/1/2 冬，3/4/5 春，6/7/8 夏，9/10/11 秋
  if (month === 12 || month <= 2) {
    return [['sunny', 0.3], ['cloudy', 0.3], ['snow', 0.4]];
  }
  if (month <= 5) return [['sunny', 0.45], ['cloudy', 0.35], ['rain', 0.2]];
  if (month <= 8) return [['sunny', 0.5], ['cloudy', 0.2], ['rain', 0.3]];
  return [['sunny', 0.4], ['cloudy', 0.35], ['rain', 0.25]];
}

/** 某天的天气（本地时区）；同一天结果恒定 */
export function weatherFor(d: Date): Weather {
  const seed = d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
  const roll = seeded(seed);
  const table = seasonTable(d.getMonth() + 1);
  let acc = 0;
  for (const [w, p] of table) {
    acc += p;
    if (roll < acc) return w;
  }
  return 'sunny';
}

export function isBadWeather(w: Weather): boolean {
  return w === 'rain' || w === 'snow';
}
