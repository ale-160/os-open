/**
 * 极简 WebAudio 音效：无素材、合成短音。
 * AudioContext 在首次用户手势（摸摸等）时懒创建；开关存 localStorage `ale-pet-sfx`。
 */

const SFX_KEY = 'ale-pet-sfx';

let ctx: AudioContext | null = null;
let muted = false;

if (typeof window !== 'undefined') {
  muted = localStorage.getItem(SFX_KEY) === 'off';
}

export function isSfxMuted(): boolean {
  return muted;
}

export function setSfxMuted(value: boolean) {
  muted = value;
  try {
    localStorage.setItem(SFX_KEY, value ? 'off' : 'on');
  } catch {
    /* ignore */
  }
}

function ensureCtx(): AudioContext | null {
  if (muted) return null;
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

/** 单音（带包络），delay 秒后起播 */
function tone(freq: number, duration: number, opts: { delay?: number; type?: OscillatorType; gain?: number; slideTo?: number } = {}) {
  const ac = ensureCtx();
  if (!ac) return;
  const { delay = 0, type = 'sine', gain = 0.06, slideTo } = opts;
  const t0 = ac.currentTime + delay;
  const osc = ac.createOscillator();
  const amp = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + duration);
  amp.gain.setValueAtTime(0, t0);
  amp.gain.linearRampToValueAtTime(gain, t0 + 0.015);
  amp.gain.exponentialRampToValueAtTime(0.0008, t0 + duration);
  osc.connect(amp).connect(ac.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.05);
}

export const sfx = {
  /** 摸摸/点按：轻快双啾 */
  chirp() {
    tone(920, 0.09, { type: 'triangle', gain: 0.05 });
    tone(1380, 0.12, { type: 'triangle', gain: 0.045, delay: 0.09 });
  },
  /** 成就解锁：三音号角 */
  fanfare() {
    tone(660, 0.14, { type: 'triangle', gain: 0.06 });
    tone(880, 0.14, { type: 'triangle', gain: 0.06, delay: 0.13 });
    tone(1320, 0.24, { type: 'triangle', gain: 0.07, delay: 0.26 });
  },
  /** 破壳：上滑滑音 + 终止高音 */
  hatch() {
    tone(420, 0.38, { type: 'sine', gain: 0.07, slideTo: 1150 });
    tone(1560, 0.2, { type: 'triangle', gain: 0.05, delay: 0.4 });
  },
  /** 吃到点心：短促确认音 */
  pop() {
    tone(1180, 0.07, { type: 'square', gain: 0.03 });
  },
  /** 音符（跟我唱/音感玩法用） */
  note(freq: number, duration = 0.32, delay = 0) {
    tone(freq, duration, { type: 'triangle', gain: 0.07, delay });
  },
};
