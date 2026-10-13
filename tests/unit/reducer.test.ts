import { describe, expect, it } from 'vitest';
import { reducer } from '../../src/lib/reducer';
import { sessionVolume } from '../../src/lib/stats';
import type { AppState, Routine } from '../../src/lib/types';

const routine: Routine = {
  id: 'r1',
  name: '테스트 루틴',
  updatedAt: 0,
  exercises: [
    { id: 't1', name: '스쿼트', kind: 'reps', sets: 2, reps: 10, durationSec: 0, weightKg: 40, restSec: 90 },
    { id: 't2', name: '플랭크', kind: 'time', sets: 1, reps: 0, durationSec: 30, weightKg: 0, restSec: 45 },
  ],
};

function initial(): AppState {
  return { version: 1, routines: [routine], history: [], active: null, settings: { sound: true, vibrate: true } };
}

function started(now = 1_000): AppState {
  return reducer(initial(), { type: 'session/start', routine, now });
}

describe('운동 세션', () => {
  it('루틴 계획대로 세트를 만든다', () => {
    const a = started().active!;
    expect(a.exercises).toHaveLength(2);
    expect(a.exercises[0].sets).toHaveLength(2);
    expect(a.exercises[0].sets[0]).toMatchObject({ reps: 10, weightKg: 40, done: false });
    expect(a.focus).toBe(0);
  });

  it('세트를 완료하면 휴식 타이머가 시작된다', () => {
    const s = reducer(started(), { type: 'set/complete', exIdx: 0, setIdx: 0, now: 10_000 });
    expect(s.active!.exercises[0].sets[0].done).toBe(true);
    expect(s.active!.rest).toEqual({ endsAt: 100_000, totalSec: 90 });
    expect(s.active!.focus).toBe(0);
  });

  it('종목의 마지막 세트를 끝내면 다음 종목으로 넘어간다', () => {
    let s = reducer(started(), { type: 'set/complete', exIdx: 0, setIdx: 0, now: 10_000 });
    s = reducer(s, { type: 'set/complete', exIdx: 0, setIdx: 1, now: 20_000 });
    expect(s.active!.focus).toBe(1);
  });

  it('마지막 세트 뒤에는 휴식이 없다', () => {
    let s = reducer(started(), { type: 'set/complete', exIdx: 0, setIdx: 0, now: 10_000 });
    s = reducer(s, { type: 'set/complete', exIdx: 0, setIdx: 1, now: 20_000 });
    s = reducer(s, { type: 'set/complete', exIdx: 1, setIdx: 0, now: 30_000 });
    expect(s.active!.rest).toBeNull();
  });

  it('무게를 바꾸면 뒤에 남은 세트에도 적용된다 (끝난 세트는 그대로)', () => {
    let s = reducer(started(), { type: 'set/complete', exIdx: 0, setIdx: 0, now: 10_000 });
    s = reducer(s, { type: 'set/update', exIdx: 0, setIdx: 1, patch: { weightKg: 45 }, cascade: true });
    expect(s.active!.exercises[0].sets.map((x) => x.weightKg)).toEqual([40, 45]);
  });

  it('휴식 시간을 줄여서 0이 되면 휴식이 끝난다', () => {
    let s = reducer(started(), { type: 'set/complete', exIdx: 0, setIdx: 0, now: 10_000 });
    s = reducer(s, { type: 'rest/adjust', deltaSec: 15, now: 20_000 });
    expect(s.active!.rest).toEqual({ endsAt: 115_000, totalSec: 105 });
    s = reducer(s, { type: 'rest/adjust', deltaSec: -15, now: 110_000 });
    expect(s.active!.rest).toBeNull();
  });

  it('시간 세트는 지정한 시간만큼 운동 타이머를 건다', () => {
    const s = reducer(started(), { type: 'work/start', exIdx: 1, setIdx: 0, now: 5_000 });
    expect(s.active!.work).toEqual({ exIdx: 1, setIdx: 0, endsAt: 35_000, totalSec: 30 });
    expect(s.active!.focus).toBe(1);
  });

  it('완료한 세트는 지울 수 없고 남은 세트만 지운다', () => {
    let s = reducer(started(), { type: 'set/complete', exIdx: 0, setIdx: 0, now: 10_000 });
    s = reducer(s, { type: 'set/add', exIdx: 0 });
    expect(s.active!.exercises[0].sets).toHaveLength(3);
    s = reducer(s, { type: 'set/remove', exIdx: 0 });
    s = reducer(s, { type: 'set/remove', exIdx: 0 });
    expect(s.active!.exercises[0].sets).toHaveLength(1);
    expect(s.active!.exercises[0].sets[0].done).toBe(true);
  });
});

describe('운동 종료', () => {
  it('완료한 세트만 기록에 남기고 볼륨을 계산한다', () => {
    let s = reducer(started(), { type: 'set/complete', exIdx: 0, setIdx: 0, now: 10_000 });
    s = reducer(s, { type: 'session/finish', now: 600_000, updateRoutine: false });
    expect(s.active).toBeNull();
    expect(s.history).toHaveLength(1);
    const session = s.history[0];
    expect(session.exercises).toHaveLength(1);
    expect(session.exercises[0].sets).toHaveLength(1);
    expect(session.endedAt).toBe(600_000);
    expect(sessionVolume(session)).toBe(400);
  });

  it('완료한 세트가 없으면 기록하지 않는다', () => {
    const s = reducer(started(), { type: 'session/finish', now: 600_000, updateRoutine: false });
    expect(s.active).toBeNull();
    expect(s.history).toHaveLength(0);
  });

  it('원하면 오늘 무게를 루틴 기본값으로 저장한다', () => {
    let s = started();
    s = reducer(s, { type: 'set/update', exIdx: 0, setIdx: 0, patch: { weightKg: 50 }, cascade: true });
    s = reducer(s, { type: 'set/complete', exIdx: 0, setIdx: 0, now: 10_000 });
    s = reducer(s, { type: 'set/complete', exIdx: 0, setIdx: 1, now: 20_000 });
    s = reducer(s, { type: 'session/finish', now: 600_000, updateRoutine: true });
    expect(s.routines[0].exercises[0].weightKg).toBe(50);
    expect(s.routines[0].exercises[1].durationSec).toBe(30);
  });
});
