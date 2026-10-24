/**
 * 日记系统：以事件 token（locale 无关）记录每天的关键事件，渲染时生成咕咕口吻文本。
 * token 形如 "feed:3"（聚合次数）、"trip:onsen"（带参数）、"hatch"（单发）。
 */

import type { Locale } from './types';
import { destById } from './travel';

export type Diary = Record<string, string[]>;

const DAY_CAP = 30; // 保留最近天数

/** 记录一个事件 token（同 kind 聚合计数：feed → feed:N+1） */
export function addDiaryEvent(diary: Diary, today: string, token: string): Diary {
  const day = diary[today] ? [...diary[today]] : [];
  const [kind, ...rest] = token.split(':');
  if (rest.length === 0) {
    // 无参事件：若同类带计数则 +1，否则追加
    const countedIdx = day.findIndex((t) => t.startsWith(`${kind}:`));
    if (/^(feed|wash|play|work|study|chat|game)$/.test(kind)) {
      if (countedIdx >= 0) {
        const n = Number(day[countedIdx].split(':')[1] ?? 0) + 1;
        day[countedIdx] = `${kind}:${n}`;
      } else {
        day.push(`${kind}:1`);
      }
    } else if (!day.includes(kind)) {
      day.push(kind);
    }
  } else {
    // 带参事件（trip:dest / best:game:score）：直接追加
    day.push(token);
  }
  const next: Diary = { ...diary, [today]: day };
  // 淘汰最旧
  const keys = Object.keys(next);
  if (keys.length > DAY_CAP) {
    keys.sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
    for (const k of keys.slice(0, keys.length - DAY_CAP)) delete next[k];
  }
  return next;
}

/** 单条 token → 咕咕口吻句子 */
export function diaryLine(token: string, locale: Locale): string {
  const [kind, a, b] = token.split(':');
  const zh = locale === 'zh';
  switch (kind) {
    case 'hatch':
      return zh ? '今天我破壳而出，第一次见到你！' : 'Today I hatched and met you for the first time!';
    case 'feed': {
      const n = Number(a ?? 1);
      return zh ? `你喂了我 ${n} 次好吃的` : `You fed me ${n} time(s)`;
    }
    case 'wash': {
      const n = Number(a ?? 1);
      return zh ? `洗了 ${n} 次香香的澡` : `${n} nice bath(s)`;
    }
    case 'play': {
      const n = Number(a ?? 1);
      return zh ? `一起玩了 ${n} 回` : `We played ${n} time(s)`;
    }
    case 'work': {
      const n = Number(a ?? 1);
      return zh ? `打工 ${n} 次，赚了养老钱` : `Worked ${n} time(s) for my savings`;
    }
    case 'study': {
      const n = Number(a ?? 1);
      return zh ? `学习 ${n} 次，变聪明了一点点` : `Studied ${n} time(s), a bit smarter`;
    }
    case 'chat': {
      const n = Number(a ?? 1);
      return zh ? `和你聊了 ${n} 次天` : `We chatted ${n} time(s)`;
    }
    case 'game': {
      const n = Number(a ?? 1);
      return zh ? `玩了 ${n} 局小游戏` : `Played ${n} mini game(s)`;
    }
    case 'trip': {
      const d = destById(a as never);
      return zh ? `我自己去${d.zh}旅行啦，${d.souvenirZh}送你` : `I traveled to ${d.en} and brought you a ${d.souvenirEn}`;
    }
    case 'checkin':
      return zh ? '签到领了元宝' : 'Checked in for coins';
    case 'sick':
      return zh ? '呜…今天生病了' : 'I got sick today...';
    case 'recover':
      return zh ? '病好啦，又是活蹦乱跳的咕咕' : 'All recovered and bouncy again!';
    case 'best': {
      const game = a ?? '';
      const score = b ?? '';
      return zh ? `玩${game}拿了 ${score} 分的新纪录！` : `New record ${score} in ${game}!`;
    }
    case 'ach': {
      return zh ? `解锁了成就「${a ?? ''}」` : `Unlocked "${a ?? ''}"`;
    }
    case 'stageUp':
      return zh ? '我感觉自己长大了！' : 'I feel like I grew up!';
    case 'dead':
      return zh ? '……' : '...';
    default:
      return token;
  }
}

/** 某天的完整日记句子列表（保持记录顺序） */
export function diaryDayLines(diary: Diary, date: string, locale: Locale): string[] {
  return (diary[date] ?? []).map((t) => diaryLine(t, locale));
}
