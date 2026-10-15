import { findExercise } from '../data/exercises';
import { lastLogEntry, placeKey } from './places';
import { bestSet, trimKg } from './stats';
import type { ExerciseLog, Session, SetLog, SetPlan, Suggested } from './types';

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

export const PROGRESSION_VERSION = 1;

/** 제안 이유 코드. 문장은 템플릿으로 만든다 */
export type SuggestCode = 'add-weight' | 'add-reps' | 'hold-missed' | 'hold-hard' | 'deload' | 'long-gap';

export const SUGGEST_CODE_LABEL: Record<SuggestCode, string> = {
  'add-weight': '증량',
  'add-reps': '횟수 늘리기',
  'hold-missed': '같은 무게로 한 번 더',
  'hold-hard': '같은 무게로 한 번 더 (힘들었음)',
  deload: '감량',
  'long-gap': '오랜만 · 확인 세트',
};

/** 목표 횟수 범위: 계획 횟수가 아래 끝. 5회 이하는 그 횟수만 채우면 되고, 8회까지는 +2, 그 위는 +3 */
export function repRange(lo: number): { lo: number; hi: number } {
  if (lo <= 5) return { lo, hi: lo };
  if (lo <= 8) return { lo, hi: lo + 2 };
  return { lo, hi: lo + 3 };
}

export function formatRepRange(lo: number): string {
  const r = repRange(lo);
  return r.hi === r.lo ? `${lo}회` : `${r.lo}~${r.hi}회`;
}

const DAY = 86_400_000;
/** 이만큼 쉬었으면 올리지 않고 지난 무게로 확인부터 */
export const LONG_GAP_DAYS = 21;
/** 두 번 연속 목표 아래면 이만큼 줄인다 */
export const DELOAD_RATIO = 0.9;

function roundTo(n: number, step: number): number {
  return Math.round(Math.round(n / step) * step * 100) / 100;
}

function working(log: ExerciseLog): SetLog[] {
  return log.sets.filter((s) => s.done && s.type === 'normal');
}

/** 지난 기록에서 목표 아래로 끝난 세트가 있는지 (덜 한 세트는 세지 않는다: 시간 부족은 실패가 아니다) */
function missedAny(done: SetLog[], plan: SetPlan[]): boolean {
  return plan.some((p, i) => done[i] !== undefined && done[i].reps < p.reps);
}

/**
 * 다음 목표 제안 (규칙 기반, 결정적: 같은 기록·같은 버전이면 같은 제안).
 * 같은 장소에서 한 지난 기록만 근거로 쓴다. 자동으로 바꾸지 않고 사용자가 눌러야 적용된다.
 *
 * 1. 같은 장소 기록이 없거나, 지난번에 세트를 덜 했거나, 이미 오늘 세트를 했거나, 이미 더 무겁게 계획했으면 제안 없음
 * 2. 3주 넘게 쉬었으면 지난 무게로 확인 세트 (long-gap)
 * 3. 목표 아래로 끝난 세트가 있으면: 직전에도 같은 무게 이상에서 그랬으면 10% 감량 (deload), 아니면 같은 무게로 한 번 더 (hold-missed)
 * 4. 모든 세트가 범위 위쪽 끝에 닿았으면: 힘들었다고 했으면 한 번 더 (hold-hard), 아니면 최소 증량 단위만큼 올리기 (add-weight)
 * 5. 범위 안이면 같은 무게로 약한 세트부터 한 번씩 더 (add-reps)
 */
export function suggest(current: ExerciseLog, history: Session[], place: string, now: number): Suggested | null {
  if (current.kind !== 'reps') return null;
  const normal = current.sets.filter((s) => s.type === 'normal');
  if (normal.length === 0 || normal.some((s) => s.done)) return null;

  const entry = lastLogEntry(history, current, place, true);
  if (!entry) return null;
  const done = working(entry.log);
  if (done.length < normal.length) return null;
  const v = PROGRESSION_VERSION;
  const basedOn = entry.session.id;

  const plannedWeight = Math.max(...normal.map((s) => s.weightKg));
  const lastWeight = Math.min(...done.map((s) => s.weightKg));
  if (plannedWeight > lastWeight) return null;
  const kg = trimKg(lastWeight);
  const restore = plannedWeight !== lastWeight && lastWeight > 0 ? ({ field: 'weightKg', value: lastWeight } as const) : undefined;

  const gapDays = (now - entry.session.startedAt) / DAY;
  if (gapDays >= LONG_GAP_DAYS) {
    return {
      v,
      code: 'long-gap',
      label: `${Math.floor(gapDays / 7)}주 만이에요. 올리기 전에 지난번 ${lastWeight > 0 ? `${kg}kg로` : '그대로'} 확인 세트부터 해봐요.`,
      apply: restore,
      basedOn,
    };
  }

  const inc = weightIncrement(current);
  if (missedAny(done, normal)) {
    const minReps = Math.min(...normal.map((_, i) => done[i].reps));
    const idx = history.indexOf(entry.session);
    const prev = lastLogEntry(history.slice(idx + 1), current, place, true);
    const prevDone = prev ? working(prev.log) : [];
    const prevMissed =
      prevDone.length >= normal.length && Math.min(...prevDone.map((s) => s.weightKg)) >= lastWeight && missedAny(prevDone, normal);
    if (prevMissed && lastWeight > 0) {
      const value = Math.max(inc, roundTo(Math.floor((lastWeight * DELOAD_RATIO) / inc) * inc, inc));
      return {
        v,
        code: 'deload',
        label: `두 번 연속 목표 아래였어요. ${trimKg(value)}kg로 줄여서 자세부터 다시 다져요.`,
        apply: { field: 'weightKg', value },
        basedOn,
      };
    }
    return {
      v,
      code: 'hold-missed',
      label: `지난번 ${lastWeight > 0 ? `${kg}kg × ` : ''}${minReps}회에서 멈췄어요. 같은 무게로 한 번 더 해봐요.`,
      apply: restore,
      basedOn,
    };
  }

  const allHi = normal.every((p, i) => done[i].reps >= repRange(p.reps).hi);
  if (allHi) {
    const minReps = Math.min(...normal.map((_, i) => done[i].reps));
    if (entry.log.effort === 'hard') {
      return {
        v,
        code: 'hold-hard',
        label: `지난번 ${kg}kg × ${minReps} 다 채웠지만 한계였다고 했죠. 오늘 한 번 더 같은 무게로 하고 올려요.`,
        apply: restore,
        basedOn,
      };
    }
    if (lastWeight > 0) {
      // 지금 무게에 최소 단위를 더한다 (7kg 덤벨 → 9kg처럼, 단위 배수로 반올림하지 않는다)
      const value = Math.round((lastWeight + inc) * 100) / 100;
      return {
        v,
        code: 'add-weight',
        label: `지난번 ${kg}kg × ${minReps} 성공! 오늘은 ${trimKg(value)}kg 어때요?`,
        apply: { field: 'weightKg', value },
        basedOn,
      };
    }
    const values = normal.map((_, i) => done[i].reps + 1);
    return {
      v,
      code: 'add-reps',
      label: `지난번 ${minReps}회 성공! 오늘은 ${values.join('·')}회 어때요?`,
      apply: { field: 'reps', values },
      basedOn,
    };
  }

  const values = normal.map((p, i) => {
    const r = repRange(p.reps);
    return Math.min(r.hi, Math.max(r.lo, done[i].reps + 1));
  });
  const lastReps = normal.map((_, i) => done[i].reps);
  const weightText = lastWeight > 0 ? `${kg}kg × ` : '';
  return {
    v,
    code: 'add-reps',
    label: `지난번 ${weightText}${lastReps.join('·')}. 오늘은 같은 무게로 ${values.join('·')}회 어때요?`,
    apply: { field: 'reps', values, weightKg: restore?.value },
    basedOn,
  };
}

/** 같은 장소에서 최근 n번 연속 최고 세트가 제자리면 정체 (여러 세션 근거로만 알려주고, 바꾸는 건 사용자가) */
export function plateauSessions(history: Session[], e: { exerciseId?: string; name: string }, place: string, n = 3): number {
  const logs: ExerciseLog[] = [];
  for (const session of history) {
    if (placeKey(session) !== place) continue;
    const log = session.exercises.find((x) => sameKey(x, e) && working(x).length > 0);
    if (log) logs.push(log);
    if (logs.length >= n) break;
  }
  if (logs.length < n) return 0;
  const bests = logs.map((l) => bestSet(l)!);
  const same = bests.every((b) => b.weightKg === bests[0].weightKg && b.reps === bests[0].reps);
  return same ? n : 0;
}

function sameKey(a: { exerciseId?: string; name: string }, b: { exerciseId?: string; name: string }): boolean {
  return (a.exerciseId ?? a.name.trim().toLowerCase()) === (b.exerciseId ?? b.name.trim().toLowerCase());
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
