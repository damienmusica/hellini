import { findExercise } from '../data/exercises';
import type { ExerciseLog, SetPlan } from './types';

export interface Suggestion {
  field: 'weightKg' | 'reps';
  /** 남은 본세트에 넣을 값 */
  value: number;
  label: string;
}

/** 장비·부위별로 한 번에 올리기 좋은 무게 */
export function weightIncrement(e: Pick<ExerciseLog, 'exerciseId' | 'name'>): number {
  const info = findExercise(e.exerciseId ?? e.name);
  if (!info) return 2.5;
  switch (info.equipment) {
    case '바벨':
      return info.part === '하체' || info.id === 'deadlift' ? 5 : 2.5;
    case '덤벨':
      return 2;
    case '머신':
    case '스미스':
      return 5;
    case '케틀벨':
      return 4;
    default:
      return 2.5;
  }
}

/**
 * 이중 진행(double progression): 지난번에 계획한 횟수를 모든 세트에서 채웠으면 무게(맨몸이면 횟수)를 조금 올리자고 제안한다.
 * 자동으로 바꾸지 않고, 사용자가 눌러야 적용된다. 이미 이 종목을 시작했으면 제안하지 않는다.
 */
export function suggestProgression(current: ExerciseLog, last: ExerciseLog | undefined): Suggestion | null {
  if (!last || current.kind !== 'reps') return null;
  const normal = current.sets.filter((s) => s.type === 'normal');
  if (normal.length === 0 || normal.some((s) => s.done)) return null;
  const done = last.sets.filter((s) => s.done && s.type === 'normal');
  if (done.length < normal.length) return null;

  const plannedWeight = Math.max(...normal.map((s) => s.weightKg));
  const lastWeight = Math.min(...done.map((s) => s.weightKg));
  // 이미 지난번보다 무겁게 계획했으면 제안하지 않는다
  if (plannedWeight > lastWeight) return null;
  const hitAll = normal.every((p, i) => done[i].reps >= p.reps);
  if (!hitAll) return null;

  const lastReps = Math.min(...done.map((s) => s.reps));
  if (lastWeight > 0) {
    const value = Math.round((lastWeight + weightIncrement(current)) * 100) / 100;
    return { field: 'weightKg', value, label: `지난번 ${lastWeight}kg × ${lastReps} 성공! 오늘은 ${value}kg 어때요?` };
  }
  return { field: 'reps', value: lastReps + 1, label: `지난번 ${lastReps}회 성공! 오늘은 ${lastReps + 1}회 어때요?` };
}

export const PLATES = [25, 20, 15, 10, 5, 2.5, 1.25];

/** 한쪽에 끼울 원판 (큰 것부터). 딱 맞지 않으면 남는 무게도 알려준다 */
export function platesPerSide(totalKg: number, barKg: number): { plates: number[]; remainder: number } {
  let side = Math.max(0, (totalKg - barKg) / 2);
  const plates: number[] = [];
  for (const p of PLATES) {
    while (side + 1e-9 >= p) {
      plates.push(p);
      side -= p;
    }
  }
  return { plates, remainder: Math.round(side * 2 * 100) / 100 };
}

function roundTo(n: number, step: number): number {
  return Math.round(n / step) * step;
}

/** 본세트 무게 기준 워밍업: 빈 봉 → 40% → 60% → 80% (겹치거나 너무 가벼운 단계는 뺀다) */
export function warmupSets(workKg: number, barKg: number, isBarbell: boolean): SetPlan[] {
  if (workKg <= 0) return [];
  const steps: [number, number][] = [
    [0.4, 5],
    [0.6, 5],
    [0.8, 3],
  ];
  const out: SetPlan[] = [];
  if (isBarbell && workKg > barKg * 1.5) out.push({ type: 'warmup', weightKg: barKg, reps: 10, durationSec: 0 });
  for (const [pct, reps] of steps) {
    const w = roundTo(workKg * pct, 2.5);
    const floor = isBarbell ? barKg : 0;
    if (w <= floor || w >= workKg) continue;
    if (out.some((s) => s.weightKg === w)) continue;
    out.push({ type: 'warmup', weightKg: w, reps, durationSec: 0 });
  }
  return out;
}
