import { describe, expect, it } from 'vitest';
import { bestsByExercise } from '../../src/lib/records';
import { reducer, routineChanges } from '../../src/lib/reducer';
import { defaultState } from '../../src/lib/storage';
import { lastLogFor } from '../../src/lib/stats';
import type { AppState, Routine, SetPlan } from '../../src/lib/types';

// 2026-10-15 리뷰 리포트의 필수 회귀 시나리오

const plan = (weightKg: number, reps: number): SetPlan => ({ type: 'normal', weightKg, reps, durationSec: 0 });

const routine: Routine = {
  id: 'r1',
  name: '하체 데이',
  updatedAt: 0,
  exercises: [
    { id: 't1', exerciseId: 'squat', name: '스쿼트', kind: 'reps', restSec: 120, sets: [plan(25, 10), plan(25, 10), plan(25, 10)] },
    { id: 't2', exerciseId: 'leg-curl', name: '레그 컬', kind: 'reps', restSec: 60, sets: [plan(20, 12), plan(20, 12)] },
  ],
};

const legPress = { exerciseId: 'leg-press', name: '레그 프레스', kind: 'reps' as const };
const legPressPlan = [plan(60, 12), plan(60, 12), plan(60, 12)];

function started(): AppState {
  const s = { ...defaultState(), onboarded: true, routines: [routine] };
  return reducer(s, { type: 'session/start', routine, now: 1_000 });
}

function squatOneSetThenReplace(): AppState {
  let s = reducer(started(), { type: 'set/complete', exIdx: 0, setIdx: 0, now: 10_000 });
  s = reducer(s, { type: 'exercise/replace', exIdx: 0, exercise: legPress, plan: legPressPlan });
  return s;
}

describe('P0: 세트를 한 뒤 종목을 바꿔도 완료 기록은 원래 종목에 남는다', () => {
  it('완료한 스쿼트 1세트는 스쿼트로 남고, 남은 2세트만 레그 프레스가 된다', () => {
    const a = squatOneSetThenReplace().active!;
    expect(a.exercises.map((e) => e.name)).toEqual(['스쿼트', '레그 프레스', '레그 컬']);
    expect(a.exercises[0].sets).toHaveLength(1);
    expect(a.exercises[0].sets[0]).toMatchObject({ done: true, weightKg: 25, reps: 10 });
    expect(a.exercises[1].sets).toHaveLength(2);
    expect(a.exercises[1].sets.every((s) => !s.done)).toBe(true);
  });

  it('스쿼트 무게를 레그 프레스로 옮기지 않는다', () => {
    const a = squatOneSetThenReplace().active!;
    expect(a.exercises[1].sets.map((s) => s.weightKg)).toEqual([60, 60]);
  });

  it('종료 후 기록에서도 스쿼트와 레그 프레스가 따로 남는다', () => {
    let s = squatOneSetThenReplace();
    s = reducer(s, { type: 'set/complete', exIdx: 1, setIdx: 0, now: 20_000 });
    s = reducer(s, { type: 'session/finish', now: 600_000, apply: { targets: false, structure: false } });
    const session = s.history[0];
    expect(session.exercises.map((e) => [e.exerciseId, e.sets.length])).toEqual([
      ['squat', 1],
      ['leg-press', 1],
    ]);
    expect(lastLogFor(s.history, { exerciseId: 'squat', name: '스쿼트' })?.sets[0].weightKg).toBe(25);
  });

  it('아직 아무 세트도 안 했으면 그 자리에서 바꾼다', () => {
    const s = reducer(started(), { type: 'exercise/replace', exIdx: 0, exercise: legPress, plan: legPressPlan });
    expect(s.active!.exercises.map((e) => e.name)).toEqual(['레그 프레스', '레그 컬']);
    expect(s.active!.exercises[0].sets).toHaveLength(3);
  });

  it('종목 이름 정정은 교체와 달리 완료 세트까지 함께 고친다', () => {
    let s = reducer(started(), { type: 'set/complete', exIdx: 0, setIdx: 0, now: 10_000 });
    s = reducer(s, { type: 'exercise/relabel', exIdx: 0, exercise: legPress });
    expect(s.active!.exercises[0].name).toBe('레그 프레스');
    expect(s.active!.exercises[0].sets[0]).toMatchObject({ done: true, weightKg: 25 });
  });

  it('오늘은 그만: 완료 세트는 남기고 남은 계획만 뺀다', () => {
    let s = reducer(started(), { type: 'set/complete', exIdx: 0, setIdx: 0, now: 10_000 });
    s = reducer(s, { type: 'exercise/skipRemaining', exIdx: 0 });
    expect(s.active!.exercises[0].sets).toHaveLength(1);
    s = reducer(s, { type: 'exercise/skipRemaining', exIdx: 1 });
    expect(s.active!.exercises.map((e) => e.name)).toEqual(['스쿼트']);
  });
});

describe('P1: 루틴 반영은 목표와 구성을 나누고, 기본은 오늘만', () => {
  function finishedAfterSwap(apply: { targets: boolean; structure: boolean }) {
    let s = squatOneSetThenReplace();
    s = reducer(s, { type: 'set/complete', exIdx: 1, setIdx: 0, now: 20_000 });
    s = reducer(s, { type: 'set/complete', exIdx: 2, setIdx: 0, now: 30_000 });
    s = reducer(s, { type: 'set/update', exIdx: 2, setIdx: 1, patch: { weightKg: 25 } });
    s = reducer(s, { type: 'set/complete', exIdx: 2, setIdx: 1, now: 40_000 });
    return reducer(s, { type: 'session/finish', now: 600_000, apply });
  }

  it('아무것도 반영하지 않으면 기본 루틴은 그대로', () => {
    const s = finishedAfterSwap({ targets: false, structure: false });
    expect(s.routines[0]).toEqual(routine);
  });

  it('목표만 반영하면 같은 종목의 무게만 바뀌고 종목 구성은 그대로', () => {
    const s = finishedAfterSwap({ targets: true, structure: false });
    const r = s.routines[0];
    expect(r.exercises.map((e) => e.name)).toEqual(['스쿼트', '레그 컬']);
    expect(r.exercises[0].sets).toHaveLength(3);
    expect(r.exercises[1].sets.map((x) => x.weightKg)).toEqual([20, 25]);
  });

  it('구성까지 반영하면 스쿼트 자리가 레그 프레스로 바뀐다', () => {
    const s = finishedAfterSwap({ targets: true, structure: true });
    expect(s.routines[0].exercises.map((e) => e.name)).toEqual(['레그 프레스', '레그 컬']);
  });

  it('바뀐 내용을 목표와 구성으로 나눠서 알려준다', () => {
    let s = squatOneSetThenReplace();
    s = reducer(s, { type: 'set/complete', exIdx: 1, setIdx: 0, now: 20_000 });
    s = reducer(s, { type: 'set/update', exIdx: 2, setIdx: 0, patch: { weightKg: 25 } });
    s = reducer(s, { type: 'set/complete', exIdx: 2, setIdx: 0, now: 30_000 });
    const changes = routineChanges(routine, s.active!);
    expect(changes.structure).toEqual(['스쿼트 → 레그 프레스']);
    expect(changes.targets).toEqual(['레그 컬 20 → 25kg']);
  });
});

describe('P1: 끝난 기록을 고칠 수 있고, 통계와 다음 추천이 따라 바뀐다', () => {
  it('기록을 수정하면 최고 기록과 증량 제안이 새 값으로 계산된다', () => {
    let s = reducer(started(), { type: 'set/complete', exIdx: 0, setIdx: 0, now: 10_000 });
    s = reducer(s, { type: 'set/complete', exIdx: 0, setIdx: 1, now: 20_000 });
    s = reducer(s, { type: 'set/complete', exIdx: 0, setIdx: 2, now: 30_000 });
    s = reducer(s, { type: 'session/finish', now: 600_000, apply: { targets: false, structure: false } });
    expect(bestsByExercise(s.history).get('squat')?.weight).toBe(25);

    // 실제로는 30kg였다고 정정
    const fixed = structuredClone(s.history[0]);
    fixed.exercises[0].sets = fixed.exercises[0].sets.map((x) => ({ ...x, weightKg: 30 }));
    s = reducer(s, { type: 'history/replace', session: fixed });
    expect(s.history[0].id).toBe(fixed.id);
    expect(bestsByExercise(s.history).get('squat')?.weight).toBe(30);

    // 다음 세션의 제안은 고친 30kg 기준: 목표 10~13회라 같은 무게(30kg)로 한 번씩 더
    const next = reducer(s, { type: 'session/start', routine, now: 700_000 }).active!;
    expect(next.exercises[0].suggested).toMatchObject({ code: 'add-reps', apply: { field: 'reps', values: [11, 11, 11], weightKg: 30 }, basedOn: fixed.id });
  });

  it('세트를 다 지운 종목은 기록에서 빠진다', () => {
    let s = reducer(started(), { type: 'set/complete', exIdx: 0, setIdx: 0, now: 10_000 });
    s = reducer(s, { type: 'set/complete', exIdx: 1, setIdx: 0, now: 20_000 });
    s = reducer(s, { type: 'session/finish', now: 600_000, apply: { targets: false, structure: false } });
    const edited = { ...s.history[0], exercises: s.history[0].exercises.map((e, i) => (i === 0 ? { ...e, sets: [] } : e)) };
    s = reducer(s, { type: 'history/replace', session: edited });
    expect(s.history[0].exercises.map((e) => e.name)).toEqual(['레그 컬']);
  });
});

describe('목표 반영은 올리기만 한다', () => {
  it('가볍게 한 날(다른 장소·컨디션)은 기본 루틴 목표를 낮추지 않는다', () => {
    let s = started();
    s = reducer(s, { type: 'set/update', exIdx: 0, setIdx: 0, patch: { weightKg: 15, reps: 12 } });
    for (const i of [0, 1, 2]) s = reducer(s, { type: 'set/complete', exIdx: 0, setIdx: i, now: 10_000 + i });
    s = reducer(s, { type: 'session/finish', now: 600_000, apply: { targets: true, structure: false } });
    expect(s.routines[0].exercises[0].sets.map((x) => [x.weightKg, x.reps])).toEqual([
      [25, 10],
      [25, 10],
      [25, 10],
    ]);
  });

  it('같은 무게로 횟수를 더 했으면 횟수 목표가 오른다', () => {
    let s = started();
    s = reducer(s, { type: 'set/update', exIdx: 0, setIdx: 0, patch: { reps: 12 } });
    s = reducer(s, { type: 'set/complete', exIdx: 0, setIdx: 0, now: 10_000 });
    s = reducer(s, { type: 'session/finish', now: 600_000, apply: { targets: true, structure: false } });
    expect(s.routines[0].exercises[0].sets.map((x) => x.reps)).toEqual([12, 12, 12].map((r, i) => (i === 0 ? r : 10)));
  });
});

describe('시간이 없어 중간에 끝낸 날은 실패로 보지 않는다', () => {
  it('세트를 덜 했으면 증량도 감량도 제안하지 않는다', () => {
    let s = reducer(started(), { type: 'set/complete', exIdx: 0, setIdx: 0, now: 10_000 });
    s = reducer(s, { type: 'session/finish', now: 600_000, apply: { targets: true, structure: false } });
    // 목표 반영을 켜도 덜 한 세트 때문에 계획 무게가 깎이지 않는다
    expect(s.routines[0].exercises[0].sets.map((x) => x.weightKg)).toEqual([25, 25, 25]);
    const next = reducer(s, { type: 'session/start', routine: s.routines[0], now: 700_000 }).active!;
    expect(next.exercises[0].suggested).toBeUndefined();
  });
});
