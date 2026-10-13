import { findExercise, type Muscle } from '../data/exercises';
import { logKey } from './stats';
import type { ExerciseLog, Session, SetLog } from './types';

/** Epley 공식 추정 1RM. 1회면 그 무게 그대로 */
export function estimate1RM(weightKg: number, reps: number): number {
  if (weightKg <= 0 || reps <= 0) return 0;
  if (reps === 1) return weightKg;
  return weightKg * (1 + reps / 30);
}

export type PRKind = 'weight' | 'e1rm' | 'reps' | 'volume';

export const PR_LABEL: Record<PRKind, string> = {
  weight: '최고 무게',
  e1rm: '추정 1RM',
  reps: '최다 반복',
  volume: '세트 볼륨',
};

export interface Best {
  weight: number;
  e1rm: number;
  /** 맨몸 종목의 최다 반복 */
  reps: number;
  /** 한 세트 무게×횟수 최고 */
  volume: number;
  duration: number;
}

const emptyBest = (): Best => ({ weight: 0, e1rm: 0, reps: 0, volume: 0, duration: 0 });

function countsForRecord(s: SetLog): boolean {
  return s.done && s.type !== 'warmup';
}

export function accumulate(best: Best, s: SetLog): Best {
  return {
    weight: Math.max(best.weight, s.weightKg),
    e1rm: Math.max(best.e1rm, estimate1RM(s.weightKg, s.reps)),
    reps: Math.max(best.reps, s.reps),
    volume: Math.max(best.volume, s.weightKg * s.reps),
    duration: Math.max(best.duration, s.durationSec),
  };
}

/** 지난 기록 전체에서 종목별 최고 기록 */
export function bestsByExercise(history: Session[]): Map<string, Best> {
  const map = new Map<string, Best>();
  for (const session of history) {
    for (const e of session.exercises) {
      const key = logKey(e);
      let best = map.get(key) ?? emptyBest();
      for (const s of e.sets) if (countsForRecord(s)) best = accumulate(best, s);
      map.set(key, best);
    }
  }
  return map;
}

/** 이 세트가 이전 최고 기록을 넘었는지. 처음 하는 종목은 PR로 치지 않는다 */
export function setPRs(prev: Best | undefined, s: SetLog, kind: ExerciseLog['kind']): PRKind[] {
  if (!prev || !countsForRecord(s)) return [];
  if (kind === 'time') return [];
  const out: PRKind[] = [];
  if (s.weightKg > 0) {
    if (s.weightKg > prev.weight) out.push('weight');
    if (estimate1RM(s.weightKg, s.reps) > prev.e1rm + 0.01) out.push('e1rm');
    if (s.weightKg * s.reps > prev.volume) out.push('volume');
  } else if (s.reps > prev.reps) {
    out.push('reps');
  }
  return out;
}

export interface SessionPR {
  exercise: string;
  kind: PRKind;
  value: string;
}

const PR_PRIORITY: PRKind[] = ['weight', 'e1rm', 'reps', 'volume'];

function prValue(kind: PRKind, s: SetLog): string {
  if (kind === 'e1rm') return `${Math.round(estimate1RM(s.weightKg, s.reps) * 10) / 10}kg`;
  if (kind === 'reps') return `${s.reps}회`;
  if (kind === 'volume') return `${s.weightKg}kg × ${s.reps}`;
  return `${s.weightKg}kg`;
}

/** 세션 안에서 나온 PR — 종목마다 가장 의미 있는 기록 하나 (최고 무게 > 추정 1RM > 최다 반복 > 세트 볼륨) */
export function sessionPRs(session: Session, history: Session[]): SessionPR[] {
  const bests = bestsByExercise(history.filter((h) => h.id !== session.id && h.startedAt < session.startedAt));
  const out: SessionPR[] = [];
  for (const e of session.exercises) {
    let running = bests.get(logKey(e));
    if (!running) continue;
    running = { ...running };
    const found = new Map<PRKind, string>();
    for (const s of e.sets) {
      for (const k of setPRs(running, s, e.kind)) found.set(k, prValue(k, s));
      if (countsForRecord(s)) running = accumulate(running, s);
    }
    const kind = PR_PRIORITY.find((k) => found.has(k));
    if (kind) out.push({ exercise: e.name, kind, value: found.get(kind)! });
  }
  return out;
}

/** 부위별 완료 세트 수 (주동근 1, 협응근 0.5) — 근육 지도·부위 분포에 쓴다 */
export function muscleSets(sessions: Session[]): Map<Muscle, number> {
  const map = new Map<Muscle, number>();
  const add = (m: Muscle, n: number) => map.set(m, (map.get(m) ?? 0) + n);
  for (const session of sessions) {
    for (const e of session.exercises) {
      const info = findExercise(e.exerciseId ?? e.name);
      if (!info) continue;
      const n = e.sets.filter(countsForRecord).length;
      if (n === 0) continue;
      info.primary.forEach((m) => add(m, n));
      info.secondary.forEach((m) => add(m, n * 0.5));
    }
  }
  return map;
}

/** 지난 최고 기록에 이번 세션의 다른 완료 세트를 더한 기준 */
export function runningBest(prev: Best | undefined, sets: SetLog[]): Best | undefined {
  if (!prev) return undefined;
  return sets.filter(countsForRecord).reduce(accumulate, { ...prev });
}

/** 세션 안에서 PR이었던 세트 위치 (순서대로 비교) */
export function prSetIndexes(prev: Best | undefined, log: ExerciseLog): Set<number> {
  const out = new Set<number>();
  if (!prev) return out;
  let running = { ...prev };
  const order = log.sets
    .map((s, i) => ({ s, i }))
    .filter(({ s }) => countsForRecord(s))
    .sort((x, y) => (x.s.completedAt ?? 0) - (y.s.completedAt ?? 0));
  for (const { s, i } of order) {
    if (setPRs(running, s, log.kind).length > 0) out.add(i);
    running = accumulate(running, s);
  }
  return out;
}
