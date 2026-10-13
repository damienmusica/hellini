import { describe, expect, it } from 'vitest';
import { estimate1RM, sessionPRs, setPRs, bestsByExercise, muscleSets } from '../../src/lib/records';
import { platesPerSide, suggestProgression, warmupSets } from '../../src/lib/progression';
import { nextRoutine, weekStreak, weekStart } from '../../src/lib/stats';
import type { ExerciseLog, Routine, Session, SetLog } from '../../src/lib/types';

const s = (weightKg: number, reps: number, done = true, type: SetLog['type'] = 'normal'): SetLog => ({ type, weightKg, reps, durationSec: 0, done });

function session(id: string, startedAt: number, sets: SetLog[], routineId?: string): Session {
  return {
    id,
    routineId,
    routineName: 'r',
    startedAt,
    endedAt: startedAt + 3_600_000,
    exercises: [{ id: `e-${id}`, exerciseId: 'bench-press', name: '벤치프레스', kind: 'reps', restSec: 90, sets }],
  };
}

describe('기록', () => {
  it('추정 1RM (Epley)', () => {
    expect(estimate1RM(100, 1)).toBe(100);
    expect(estimate1RM(60, 10)).toBe(80);
  });

  it('지난 최고 기록을 넘으면 PR, 워밍업과 첫 기록은 제외', () => {
    const history = [session('a', 1, [s(60, 5), s(20, 10, true, 'warmup')])];
    const best = bestsByExercise(history).get('bench-press');
    expect(setPRs(best, s(62.5, 5), 'reps')).toEqual(['weight', 'e1rm', 'volume']);
    expect(setPRs(best, s(60, 5), 'reps')).toEqual([]);
    expect(setPRs(best, s(80, 1, true, 'warmup'), 'reps')).toEqual([]);
    expect(setPRs(undefined, s(100, 1), 'reps')).toEqual([]);
  });

  it('세션 PR 목록은 종목·종류별로 하나씩', () => {
    const old = session('a', 1, [s(60, 5)]);
    const today = session('b', 2, [s(62.5, 5), s(65, 3)]);
    const prs = sessionPRs(today, [today, old]);
    expect(prs.find((p) => p.kind === 'weight')?.value).toBe('65kg');
  });

  it('근육별 세트 수: 주동근 1, 협응근 0.5', () => {
    const m = muscleSets([session('a', 1, [s(60, 5), s(60, 5)])]);
    expect(m.get('chest')).toBe(2);
    expect(m.get('triceps')).toBe(1);
  });
});

describe('증량 제안', () => {
  const current = (weight: number): ExerciseLog => ({
    id: 'x',
    exerciseId: 'bench-press',
    name: '벤치프레스',
    kind: 'reps',
    restSec: 90,
    sets: [s(weight, 8, false), s(weight, 8, false)],
  });

  it('지난번 목표 횟수를 다 채웠으면 무게를 올리자고 한다', () => {
    const last = { ...current(40), sets: [s(40, 8), s(40, 9)] };
    expect(suggestProgression(current(40), last)).toMatchObject({ field: 'weightKg', value: 42.5 });
  });

  it('계획이 지난번보다 가벼우면 지난번 무게 기준으로 제안한다', () => {
    const last = { ...current(40), sets: [s(40, 8), s(40, 8)] };
    expect(suggestProgression(current(20), last)).toMatchObject({ value: 42.5 });
  });

  it('이미 첫 세트를 했으면 제안하지 않는다', () => {
    const cur = current(40);
    cur.sets[0] = { ...cur.sets[0], done: true };
    expect(suggestProgression(cur, { ...current(40), sets: [s(40, 8), s(40, 8)] })).toBeNull();
  });

  it('하나라도 못 채웠거나 이미 올렸으면 제안하지 않는다', () => {
    expect(suggestProgression(current(40), { ...current(40), sets: [s(40, 8), s(40, 6)] })).toBeNull();
    expect(suggestProgression(current(42.5), { ...current(40), sets: [s(40, 8), s(40, 8)] })).toBeNull();
  });

  it('맨몸 종목은 횟수를 올리자고 한다', () => {
    const last = { ...current(0), sets: [s(0, 8), s(0, 8)] };
    expect(suggestProgression(current(0), last)).toMatchObject({ field: 'reps', value: 9 });
  });
});

describe('원판·워밍업', () => {
  it('한쪽 원판을 큰 것부터', () => {
    expect(platesPerSide(100, 20)).toEqual({ plates: [25, 15], remainder: 0 });
    expect(platesPerSide(62.5, 20)).toEqual({ plates: [20, 1.25], remainder: 0 });
    expect(platesPerSide(21, 20).remainder).toBe(1);
  });

  it('워밍업은 빈 봉부터, 본세트보다 가볍게', () => {
    const w = warmupSets(100, 20, true);
    expect(w.map((x) => x.weightKg)).toEqual([20, 40, 60, 80]);
    expect(w.every((x) => x.type === 'warmup')).toBe(true);
    expect(warmupSets(25, 20, true)).toEqual([]);
  });
});

describe('주간·루틴 순환', () => {
  const DAY = 86_400_000;
  const now = new Date(2026, 9, 15, 12).getTime(); // 목요일

  it('연속 주: 이번 주에 아직 안 했어도 지난주까지 이어지면 유지', () => {
    const lastWeek = weekStart(now) - 3 * DAY;
    const twoWeeks = lastWeek - 7 * DAY;
    expect(weekStreak([session('a', lastWeek, [s(1, 1)]), session('b', twoWeeks, [s(1, 1)])], now)).toBe(2);
    expect(weekStreak([session('c', now, [s(1, 1)]), session('a', lastWeek, [s(1, 1)])], now)).toBe(2);
    expect(weekStreak([session('d', twoWeeks, [s(1, 1)])], now)).toBe(0);
  });

  it('오늘의 루틴은 마지막으로 한 루틴의 다음 차례', () => {
    const routines = ['A', 'B', 'C'].map((id) => ({ id, name: id, exercises: [], updatedAt: 0 }) as Routine);
    expect(nextRoutine(routines, [])?.id).toBe('A');
    expect(nextRoutine(routines, [session('x', 1, [s(1, 1)], 'B')])?.id).toBe('C');
    expect(nextRoutine(routines, [session('x', 1, [s(1, 1)], 'C')])?.id).toBe('A');
  });
});
