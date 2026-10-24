/**
 * 关怀功能：咕咕反过来关心用户。
 * 判定为纯函数（输入当前时刻与用户活动状态），去重记录存 localStorage `ale-pet-care`。
 */

export type CareKind = 'mealBreakfast' | 'mealLunch' | 'mealDinner' | 'rest' | 'night' | 'fatigue';

export interface CareContext {
  hour: number;
  date: string;
  /** 本次会话已活跃毫秒数（页面可见且有过交互） */
  sessionActiveMs: number;
  /** 最近一次用户交互距今毫秒 */
  sinceInteractionMs: number;
  /** 已发送过的关怀 key 集合 */
  sent: Set<string>;
}

export interface CareDecision {
  kind: CareKind;
  /** 台词变量（餐名，中英各一） */
  mealZh?: string;
  mealEn?: string;
  dedupeKey: string;
}

const MEALS: { start: number; end: number; kind: CareKind; zh: string; en: string }[] = [
  { start: 7, end: 9, kind: 'mealBreakfast', zh: '早餐', en: 'breakfast' },
  { start: 11, end: 13, kind: 'mealLunch', zh: '午餐', en: 'lunch' },
  { start: 17, end: 19, kind: 'mealDinner', zh: '晚餐', en: 'dinner' },
];

/** 关怀判定：一次 tick 最多命中一条；去重 key 按 天/窗口 切分 */
export function checkCare(ctx: CareContext): CareDecision | null {
  // 1) 按时吃饭（饭点窗口内，每天每餐一次）
  const meal = MEALS.find((m) => ctx.hour >= m.start && ctx.hour < m.end);
  const mealKey = `${meal?.kind ?? ''}-${ctx.date}`;
  if (meal && !ctx.sent.has(mealKey)) {
    return { kind: meal.kind, mealZh: meal.zh, mealEn: meal.en, dedupeKey: mealKey };
  }

  const sessionMin = ctx.sessionActiveMs / 60_000;

  // 2) 熬夜关心（23~5 点且用户还在）
  const nightKey = `night-${ctx.date}`;
  if ((ctx.hour >= 23 || ctx.hour < 5) && ctx.sinceInteractionMs < 10 * 60_000 && !ctx.sent.has(nightKey)) {
    return { kind: 'night', dedupeKey: nightKey };
  }

  // 3) 该休息了（连续活跃 45 分钟，每 45 分钟一次）
  if (sessionMin >= 45 && ctx.sinceInteractionMs < 10 * 60_000) {
    const restKey = `rest-${ctx.date}-${Math.floor(sessionMin / 45)}`;
    if (!ctx.sent.has(restKey)) {
      return { kind: 'rest', dedupeKey: restKey };
    }
  }

  // 4) 关心疲劳（连续活跃 2 小时，每 2 小时一次）
  if (sessionMin >= 120 && ctx.sinceInteractionMs < 10 * 60_000) {
    const fatigueKey = `fatigue-${ctx.date}-${Math.floor(sessionMin / 120)}`;
    if (!ctx.sent.has(fatigueKey)) {
      return { kind: 'fatigue', dedupeKey: fatigueKey };
    }
  }

  return null;
}
