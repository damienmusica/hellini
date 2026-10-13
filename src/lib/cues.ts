import type { Settings } from './types';

/**
 * tick: 3·2·1 카운트다운
 * go:   운동 시작 (휴식 끝, 인터벌 운동 구간)
 * rest: 휴식 시작
 * end:  타이머·운동 끝
 */
export type CueKind = 'tick' | 'go' | 'rest' | 'end';

type Tone = [freq: number, startMs: number, durMs: number];

const PATTERNS: Record<CueKind, { tones: Tone[]; vibrate: number[] }> = {
  tick: { tones: [[880, 0, 110]], vibrate: [60] },
  go: { tones: [[1320, 0, 450]], vibrate: [300] },
  rest: { tones: [[784, 0, 220], [523, 260, 380]], vibrate: [150, 100, 150] },
  end: { tones: [[880, 0, 160], [1108, 200, 160], [1320, 400, 520]], vibrate: [200, 100, 200, 100, 400] },
};

let ctx: AudioContext | null = null;

/** iOS는 사용자 터치 안에서 AudioContext를 만들고 resume해야 소리가 난다 */
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
    gain.gain.exponentialRampToValueAtTime(0.6, t0 + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, t1);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t0);
    osc.stop(t1 + 0.02);
  }
}

export function cue(kind: CueKind, settings: Settings): void {
  const pattern = PATTERNS[kind];
  if (settings.sound) {
    try {
      playTones(pattern.tones);
    } catch {
      // 오디오를 못 쓰는 환경
    }
  }
  if (settings.vibrate && typeof navigator.vibrate === 'function') {
    navigator.vibrate(pattern.vibrate);
  }
}

export const canVibrate = typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
