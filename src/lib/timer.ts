/**
 * 모든 타이머는 setInterval 횟수를 세지 않고 시각(timestamp)으로 계산한다.
 * 폰 화면이 잠기거나 탭이 백그라운드로 가서 tick이 밀려도 돌아오면 정확한 값이 나온다.
 */

/** 일시정지할 수 있는 경과 시간 시계 */
export interface Clock {
  running: boolean;
  /** 마지막 일시정지까지 누적된 ms */
  base: number;
  /** running일 때 마지막으로 시작한 시각 */
  since: number;
}

export const idleClock: Clock = { running: false, base: 0, since: 0 };

export function clockElapsed(c: Clock, now: number): number {
  return c.base + (c.running ? now - c.since : 0);
}

export function clockStart(c: Clock, now: number): Clock {
  return c.running ? c : { running: true, base: c.base, since: now };
}

export function clockPause(c: Clock, now: number): Clock {
  return c.running ? { running: false, base: clockElapsed(c, now), since: 0 } : c;
}

export interface IntervalConfig {
  prepareSec: number;
  workSec: number;
  restSec: number;
  rounds: number;
}

export type IntervalPhase = 'prepare' | 'work' | 'rest' | 'done';

export interface PhaseState {
  phase: IntervalPhase;
  /** 1부터 시작 */
  round: number;
  remainingMs: number;
  phaseTotalMs: number;
}

export function intervalTotalMs(cfg: IntervalConfig): number {
  const rounds = Math.max(1, cfg.rounds);
  return (cfg.prepareSec + rounds * cfg.workSec + (rounds - 1) * cfg.restSec) * 1000;
}

/** 준비 → (운동 → 휴식) × 라운드, 마지막 라운드 뒤에는 휴식 없음 */
export function intervalPhaseAt(cfg: IntervalConfig, elapsedMs: number): PhaseState {
  const rounds = Math.max(1, cfg.rounds);
  const prepare = cfg.prepareSec * 1000;
  const work = cfg.workSec * 1000;
  const rest = cfg.restSec * 1000;
  let t = Math.max(0, elapsedMs);

  if (t < prepare) return { phase: 'prepare', round: 1, remainingMs: prepare - t, phaseTotalMs: prepare };
  t -= prepare;

  for (let round = 1; round <= rounds; round++) {
    if (t < work) return { phase: 'work', round, remainingMs: work - t, phaseTotalMs: work };
    t -= work;
    if (round < rounds) {
      if (t < rest) return { phase: 'rest', round, remainingMs: rest - t, phaseTotalMs: rest };
      t -= rest;
    }
  }
  return { phase: 'done', round: rounds, remainingMs: 0, phaseTotalMs: 0 };
}

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

function hms(totalSec: number): string {
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

/** 남은 시간 표시: 0.2초 남았으면 0:01 (올림) */
export function formatCountdown(ms: number): string {
  return hms(Math.max(0, Math.ceil(ms / 1000)));
}

/** 경과 시간 표시 (내림), tenths면 0.1초 단위까지 */
export function formatElapsed(ms: number, tenths = false): string {
  const safe = Math.max(0, ms);
  const base = hms(Math.floor(safe / 1000));
  return tenths ? `${base}.${Math.floor((safe % 1000) / 100)}` : base;
}

/** 90 → "1분 30초", 45 → "45초" */
export function formatSeconds(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m === 0) return `${s}초`;
  return s === 0 ? `${m}분` : `${m}분 ${s}초`;
}
