import type { Settings } from './types';

/**
 * tick: 3·2·1 카운트다운
 * go:   운동 시작 (휴식 끝, 인터벌 운동 구간)
 * rest: 휴식 시작
 * end:  타이머·운동 끝
 * pr:   개인 기록 경신
 */
export type CueKind = 'tick' | 'go' | 'rest' | 'end' | 'pr';

type Tone = [freq: number, startMs: number, durMs: number];

const PATTERNS: Record<CueKind, { tones: Tone[]; vibrate: number[] }> = {
  tick: { tones: [[880, 0, 110]], vibrate: [40] },
  go: { tones: [[1320, 0, 450]], vibrate: [250] },
  rest: { tones: [[784, 0, 220], [523, 260, 380]], vibrate: [120, 80, 120] },
  end: { tones: [[880, 0, 160], [1108, 200, 160], [1320, 400, 520]], vibrate: [200, 100, 200, 100, 400] },
  pr: { tones: [[1047, 0, 140], [1319, 150, 140], [1568, 300, 140], [2093, 450, 420]], vibrate: [60, 60, 60, 60, 200] },
};

let ctx: AudioContext | null = null;
let vibrateEnabled = true;

/** 짧은 효과음은 다른 앱 음악을 끊지 않는다 (Web Audio, 볼륨 낮게) */
export function unlockAudio(): void {
  try {
    if (!ctx) {
      const AC =
        window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
    }
    if (ctx.state === 'suspended') void ctx.resume();
  } catch {
    ctx = null;
  }
}

function playTones(tones: Tone[]): void {
  if (!ctx) unlockAudio();
  if (!ctx) return;
  const start = ctx.currentTime + 0.01;
  for (const [freq, startMs, durMs] of tones) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const t0 = start + startMs / 1000;
    const t1 = t0 + durMs / 1000;
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(0.5, t0 + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, t1);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t0);
    osc.stop(t1 + 0.02);
  }
}

export const canVibrate = typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';

export function cue(kind: CueKind, settings: Settings): void {
  const pattern = PATTERNS[kind];
  if (settings.sound) {
    try {
      playTones(pattern.tones);
    } catch {
      // 오디오를 못 쓰는 환경
    }
  }
  if (settings.vibrate && canVibrate) navigator.vibrate(pattern.vibrate);
}

/** 버튼 누를 때 짧은 진동 (지원 기기만) */
export function haptic(ms = 10): void {
  if (vibrateEnabled && canVibrate) navigator.vibrate(ms);
}

export function setHapticsEnabled(on: boolean): void {
  vibrateEnabled = on;
}
