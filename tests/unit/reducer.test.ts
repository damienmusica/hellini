import { describe, expect, it } from 'vitest';
import { applySessionToRoutine, nextPendingSet, reducer } from '../../src/lib/reducer';
import { defaultState } from '../../src/lib/storage';
import { sessionVolume } from '../../src/lib/stats';
import type { AppState, Routine, SetPlan } from '../../src/lib/types';

const set = (weightKg: number, reps: number, type: SetPlan['type'] = 'normal'): SetPlan => ({ type, weightKg, reps, durationSec: 0 });

const routine: Routine = {
  id: 'r1',
  name: '테스트 루틴',
  updatedAt: 0,
  exercises: [
    { id: 't1', exerciseId: 'squat', name: '스쿼트', kind: 'reps', restSec: 90, sets: [set(40, 10), set(40, 10)] },
    { id: 't2', exerciseId: 'plank', name: '플랭크', kind: 'time', restSec: 45, sets: [{ type: 'normal', reps: 0, weightKg: 0, durationSec: 30 }] },
  ],
};

function initial(): AppState {
  return { ...defaultState(), onboarded: true, routines: [routine] };
}

function started(now = 1_000): AppState {
  return reducer(initial(), { type: 'session/start', routine, now });
}

describe('운동 세션', () => {
  it('루틴 계획대로 세트를 만든다', () => {
    const a = started().active!;
    expect(a.exercises).toHaveLength(2);
    expect(a.exercises[0].sets).toHaveLength(2);
    expect(a.exercises[0].sets[0]).toMatchObject({ reps: 10, weightKg: 40, done: false, type: 'normal' });
    expect(a.exercises[0].templateId).toBe('t1');
  });

  it('루틴 없이 자유 운동을 시작할 수 있다', () => {
    const a = reducer(initial(), { type: 'session/start', routine: null, now: 0 }).active!;
    expect(a.routineName).toBe('자유 운동');
    expect(a.exercises).toHaveLength(0);
  });

  it('세트를 완료하면 그 세트 위치와 함께 휴식 타이머가 시작된다', () => {
    const s = reducer(started(), { type: 'set/complete', exIdx: 0, setIdx: 0, now: 10_000 });
    expect(s.active!.exercises[0].sets[0].done).toBe(true);
    expect(s.active!.rest).toEqual({ endsAt: 100_000, totalSec: 90, exIdx: 0, setIdx: 0 });
  });

  it('마지막 세트 뒤에는 휴식이 없다', () => {
    let s = reducer(started(), { type: 'set/complete', exIdx: 0, setIdx: 0, now: 10_000 });
    s = reducer(s, { type: 'set/complete', exIdx: 0, setIdx: 1, now: 20_000 });
    s = reducer(s, { type: 'set/complete', exIdx: 1, setIdx: 0, now: 30_000 });
    expect(s.active!.rest).toBeNull();
  });

  it('드롭세트 직전에는 쉬지 않는다', () => {
    let s = started();
    s = reducer(s, { type: 'set/update', exIdx: 0, setIdx: 1, patch: { type: 'drop' } });
    s = reducer(s, { type: 'set/complete', exIdx: 0, setIdx: 0, now: 10_000 });
    expect(s.active!.rest).toBeNull();
  });

  it('무게를 바꾸면 뒤에 남은 같은 값의 세트도 따라 바뀐다', () => {
    let s = started();
    s = reducer(s, { type: 'set/update', exIdx: 0, setIdx: 0, patch: { weightKg: 45 } });
    expect(s.active!.exercises[0].sets.map((x) => x.weightKg)).toEqual([45, 45]);
    s = reducer(s, { type: 'set/update', exIdx: 0, setIdx: 1, patch: { weightKg: 50 } });
    expect(s.active!.exercises[0].sets.map((x) => x.weightKg)).toEqual([45, 50]);
  });

  it('끝낸 세트는 뒤 세트 값 변경에 끌려가지 않는다', () => {
    let s = reducer(started(), { type: 'set/complete', exIdx: 0, setIdx: 1, now: 10_000 });
    s = reducer(s, { type: 'set/update', exIdx: 0, setIdx: 0, patch: { reps: 8 } });
    expect(s.active!.exercises[0].sets.map((x) => x.reps)).toEqual([8, 10]);
  });

  it('증량 제안을 적용하면 남은 본세트 전체가 그 무게가 된다', () => {
    let s = reducer(started(), { type: 'set/complete', exIdx: 0, setIdx: 0, now: 10_000 });
    s = reducer(s, { type: 'exercise/setAll', exIdx: 0, field: 'weightKg', value: 42.5 });
    expect(s.active!.exercises[0].sets.map((x) => x.weightKg)).toEqual([40, 42.5]);
  });

  it('워밍업 세트를 앞에 넣는다 (기존 워밍업은 교체)', () => {
    let s = reducer(started(), { type: 'set/insertWarmups', exIdx: 0, sets: [set(20, 10, 'warmup')] });
    s = reducer(s, { type: 'set/insertWarmups', exIdx: 0, sets: [set(20, 10, 'warmup'), set(30, 5, 'warmup')] });
    expect(s.active!.exercises[0].sets.map((x) => x.type)).toEqual(['warmup', 'warmup', 'normal', 'normal']);
  });

  it('휴식 시간을 줄여서 0이 되면 휴식이 끝난다', () => {
    let s = reducer(started(), { type: 'set/complete', exIdx: 0, setIdx: 0, now: 10_000 });
    s = reducer(s, { type: 'rest/adjust', deltaSec: 15, now: 20_000 });
    expect(s.active!.rest).toMatchObject({ endsAt: 115_000, totalSec: 105 });
    s = reducer(s, { type: 'rest/adjust', deltaSec: -15, now: 110_000 });
    expect(s.active!.rest).toBeNull();
  });

  it('시간 세트는 지정한 시간만큼 운동 타이머를 건다', () => {
    const s = reducer(started(), { type: 'work/start', exIdx: 1, setIdx: 0, now: 5_000 });
    expect(s.active!.work).toEqual({ exIdx: 1, setIdx: 0, endsAt: 35_000, totalSec: 30 });
  });

  it('다음 할 세트는 같은 종목 먼저, 그다음 종목 순서', () => {
    const a = started().active!;
    expect(nextPendingSet(a.exercises, 0, 0)).toEqual({ exIdx: 0, setIdx: 1 });
    expect(nextPendingSet(a.exercises, 0, 1)).toEqual({ exIdx: 1, setIdx: 0 });
  });
});

describe('운동 종료', () => {
  it('완료한 세트만 기록에 남기고 볼륨은 워밍업을 빼고 계산한다', () => {
    let s = reducer(started(), { type: 'set/insertWarmups', exIdx: 0, sets: [set(20, 10, 'warmup')] });
    s = reducer(s, { type: 'set/complete', exIdx: 0, setIdx: 0, now: 5_000 });
    s = reducer(s, { type: 'set/complete', exIdx: 0, setIdx: 1, now: 10_000 });
    s = reducer(s, { type: 'session/finish', now: 600_000, updateRoutine: false });
    expect(s.active).toBeNull();
    expect(s.history).toHaveLength(1);
    expect(s.history[0].exercises[0].sets).toHaveLength(2);
    expect(sessionVolume(s.history[0])).toBe(400);
  });

  it('완료한 세트가 없으면 기록하지 않는다', () => {
    const s = reducer(started(), { type: 'session/finish', now: 600_000, updateRoutine: false });
    expect(s.history).toHaveLength(0);
  });

  it('루틴에 반영하면 오늘 한 세트 구성·무게가 다음 계획이 된다', () => {
    let s = started();
    s = reducer(s, { type: 'set/update', exIdx: 0, setIdx: 0, patch: { weightKg: 50 } });
    s = reducer(s, { type: 'set/add', exIdx: 0 });
    for (const i of [0, 1, 2]) s = reducer(s, { type: 'set/complete', exIdx: 0, setIdx: i, now: 10_000 + i });
    s = reducer(s, { type: 'session/finish', now: 600_000, updateRoutine: true });
    const r = s.routines[0];
    expect(r.exercises[0].sets.map((x) => x.weightKg)).toEqual([50, 50, 50]);
    expect(r.exercises[0].id).toBe('t1');
    // 안 한 종목은 원래 계획 유지
    expect(r.exercises[1]).toEqual(routine.exercises[1]);
  });

  it('계획보다 세트를 덜 했으면 남은 세트는 오늘 무게로 남긴다', () => {
    let s = started();
    s = reducer(s, { type: 'set/update', exIdx: 0, setIdx: 0, patch: { weightKg: 45 } });
    s = reducer(s, { type: 'set/complete', exIdx: 0, setIdx: 0, now: 10_000 });
    s = reducer(s, { type: 'session/finish', now: 600_000, updateRoutine: true });
    expect(s.routines[0].exercises[0].sets.map((x) => x.weightKg)).toEqual([45, 45]);
  });

  it('시간 종목으로 바꾸면 기본 시간이 채워진다', () => {
    let s = started();
    s = reducer(s, { type: 'exercise/replace', exIdx: 0, exercise: { exerciseId: 'plank', name: '플랭크', kind: 'time' } });
    expect(s.active!.exercises[0].sets[0].durationSec).toBe(30);
  });

  it('applySessionToRoutine은 루틴 이름과 id를 유지한다', () => {
    const a = started().active!;
    const r = applySessionToRoutine(routine, a, 99);
    expect(r.id).toBe('r1');
    expect(r.name).toBe('테스트 루틴');
    expect(r.updatedAt).toBe(99);
  });
});

describe('온보딩', () => {
  it('추천 루틴과 주간 목표를 저장한다', () => {
    const s = reducer(defaultState(), { type: 'onboarding/complete', routines: [routine], weeklyGoal: 4 });
    expect(s.onboarded).toBe(true);
    expect(s.routines).toHaveLength(1);
    expect(s.settings.weeklyGoal).toBe(4);
  });
});
