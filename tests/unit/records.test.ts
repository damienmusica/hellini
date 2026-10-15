import { describe, expect, it } from 'vitest';
import { instantiateProgram, PROGRAMS, recommendProgram } from '../../src/data/programs';
import { estimate1RM, sessionPRs, setPRs, bestsByExercise, muscleSets } from '../../src/lib/records';
import { platesPerSide, warmupSets } from '../../src/lib/progression';
import { nextRoutine, weekStreak, weekStart } from '../../src/lib/stats';
import type { Routine, Session, SetLog } from '../../src/lib/types';

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

  it('같은 프로그램 루틴끼리 순서대로 돈다', () => {
    const r = (id: string, note?: string) => ({ id, name: id, note, exercises: [], updatedAt: 0 }) as Routine;
    const routines = [r('old'), r('PA', 'PPL'), r('QA', 'PPL'), r('LA', 'PPL'), r('mine')];
    expect(nextRoutine(routines, [session('x', 1, [s(1, 1)], 'LA')])?.id).toBe('PA');
    expect(nextRoutine(routines, [session('x', 1, [s(1, 1)], 'PA')])?.id).toBe('QA');
    expect(nextRoutine(routines, [session('x', 1, [s(1, 1)], 'mine')])?.id).toBe('old');
  });
});

describe('추천 프로그램', () => {
  it('모든 프로그램 종목이 라이브러리에 있다', () => {
    for (const p of PROGRAMS) expect(() => instantiateProgram(p, 0)).not.toThrow();
  });

  it('거의 매일 하면 PPL A/B, 6개 루틴이 한 프로그램으로 묶인다', () => {
    const p = recommendProgram('some', 6, 'gym');
    expect(p.id).toBe('ppl-ab');
    expect(recommendProgram('regular', 5, 'gym').id).toBe('ppl-ab');
    expect(recommendProgram('some', 5, 'gym').id).toBe('upper-lower');
    const routines = instantiateProgram(p, 0);
    expect(routines).toHaveLength(6);
    let r = nextRoutine(routines, [])!;
    const order = [r.name];
    for (let i = 0; i < 6; i++) {
      r = nextRoutine(routines, [session(`s${i}`, i, [s(1, 1)], r.id)])!;
      order.push(r.name);
    }
    expect(order[6]).toBe(order[0]);
    expect(new Set(order).size).toBe(6);
  });
});

// 3차 리뷰 §5: 보조 중량 종목은 무게가 클수록 쉬우므로 무게·1RM·볼륨 PR을 세지 않는다
describe('보조 중량 종목의 기록', () => {
  const ap = (id: string, startedAt: number, sets: SetLog[]): Session => ({
    id,
    routineName: 'r',
    startedAt,
    endedAt: startedAt + 1,
    exercises: [{ id: `e-${id}`, exerciseId: 'assisted-pull-up', name: '어시스트 풀업', kind: 'reps', restSec: 90, sets }],
  });

  it('어시스트 풀업은 보조가 커져도 PR이 아니고 횟수만 센다', () => {
    const history = [ap('a', 1, [s(30, 8)])];
    const best = bestsByExercise(history).get('assisted-pull-up')!;
    expect(best).toMatchObject({ weight: 0, e1rm: 0, volume: 0, reps: 8 });
    expect(setPRs(best, s(40, 8), 'reps', true)).toEqual([]);
    expect(setPRs(best, s(25, 9), 'reps', true)).toEqual(['reps']);
    const today = ap('b', 2, [s(40, 8), s(25, 9)]);
    expect(sessionPRs(today, [today, ...history])).toEqual([{ exercise: '어시스트 풀업', kind: 'reps', value: '9회' }]);
  });
});
