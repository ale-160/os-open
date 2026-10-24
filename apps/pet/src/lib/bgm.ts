/**
 * 程序化 BGM（WebAudio 音乐盒）：无素材、按情境生成旋律循环。
 * 情境：day（明快五声音阶）/ night（缓慢摇篮曲）/ rain（低回 lofi）/ celebration（欢快号角）。
 * 开关存 localStorage `ale-pet-bgm`；首次用户手势后启动（自动播放策略）。
 */

const BGM_KEY = 'ale-pet-bgm';

export type BgmMood = 'day' | 'night' | 'rain' | 'celebration';

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let timer: number | null = null;
let step = 0;
let mood: BgmMood = 'day';
let muted = false;

if (typeof window !== 'undefined') {
  muted = localStorage.getItem(BGM_KEY) === 'off';
}

export function isBgmMuted(): boolean {
  return muted;
}

export function setBgmMuted(value: boolean) {
  muted = value;
  try {
    localStorage.setItem(BGM_KEY, value ? 'off' : 'on');
  } catch {
    /* ignore */
  }
  if (muted) stopBgm();
  else ensureStarted();
}

// 五声音阶（C 大调宫商角徵羽跨两个八度）
const SCALE = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5, 1174.66, 1318.51];

interface Pattern {
  bpm: number;
  /** 步进序列：null=休止，数字=SCALE 下标 */
  seq: (number | null)[];
  wave: OscillatorType;
  gain: number;
  /** 每步低八度垫音的概率 */
  bassChance: number;
}

const PATTERNS: Record<BgmMood, Pattern> = {
  day: {
    bpm: 96,
    seq: [0, 2, 4, null, 5, 4, 2, null, 1, 3, 5, null, 4, 2, 0, null],
    wave: 'triangle',
    gain: 0.05,
    bassChance: 0.35,
  },
  night: {
    bpm: 60,
    seq: [0, null, 2, null, 4, null, 3, null, 2, null, 0, null, 1, null, null, null],
    wave: 'sine',
    gain: 0.045,
    bassChance: 0.5,
  },
  rain: {
    bpm: 72,
    seq: [2, null, 3, null, 1, null, 2, null, 4, null, 2, null, 0, null, null, null],
    wave: 'sine',
    gain: 0.04,
    bassChance: 0.45,
  },
  celebration: {
    bpm: 120,
    seq: [0, 4, 5, 7, 5, 4, 2, 0, 2, 4, 7, 5, 4, 2, 1, 0],
    wave: 'triangle',
    gain: 0.055,
    bassChance: 0.3,
  },
};

function ensureCtx(): boolean {
  if (typeof window === 'undefined') return false;
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.9;
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return !!ctx && !!master;
}

function note(freq: number, dur: number, p: Pattern, when = 0) {
  if (!ctx || !master) return;
  const t0 = ctx.currentTime + when;
  const osc = ctx.createOscillator();
  const amp = ctx.createGain();
  osc.type = p.wave;
  osc.frequency.setValueAtTime(freq, t0);
  amp.gain.setValueAtTime(0, t0);
  amp.gain.linearRampToValueAtTime(p.gain, t0 + 0.02);
  amp.gain.exponentialRampToValueAtTime(0.0008, t0 + dur);
  osc.connect(amp).connect(master);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

function scheduleStep() {
  const p = PATTERNS[mood];
  const idx = p.seq[step % p.seq.length];
  const beat = 60 / p.bpm;
  if (idx !== null) {
    note(SCALE[idx], beat * 0.9, p);
    if (Math.random() < p.bassChance) {
      note(SCALE[idx % 5] / 2, beat * 1.6, p, beat * 0.5);
    }
  }
  step += 1;
}

function loop() {
  if (timer !== null) return;
  scheduleStep();
  const p = PATTERNS[mood];
  timer = window.setInterval(scheduleStep, (60 / p.bpm) * 1000);
}

function stopBgm() {
  if (timer !== null) {
    clearInterval(timer);
    timer = null;
  }
}

/** 情境切换（重启序列） */
export function setBgmMood(m: BgmMood) {
  if (mood === m) return;
  mood = m;
  step = 0;
  if (!muted && timer !== null) {
    stopBgm();
    loop();
  }
}

/** 首次用户手势后调用（自动播放策略）；已启动则幂等 */
export function ensureStarted() {
  if (muted || timer !== null) return;
  if (!ensureCtx()) return;
  loop();
}
