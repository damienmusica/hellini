import { describe, expect, it } from 'vitest';
import { isAvailable, lastLogEntry, markAvailable, markUnavailable, placeKey, unavailableIn } from '../../src/lib/places';
import { reducer } from '../../src/lib/reducer';
import { lastLogAt, lastLogFor } from '../../src/lib/stats';
import { defaultState } from '../../src/lib/storage';
import { rankSubstitutes } from '../../src/lib/substitutes';
import type { AppState, Place, Routine, Session, SetLog, SetPlan } from '../../src/lib/types';

// 리뷰 §2 장소와 장비가 바뀌는 흐름: 호텔 짐에서 등록 없이 조정하고, 돌아오면 원래대로

const plan = (weightKg: number, reps: number): SetPlan => ({ type: 'normal', weightKg, reps, durationSec: 0 });
const done = (weightKg: number, reps: number): SetLog => ({ ...plan(weightKg, reps), done: true });

const routine: Routine = {
  id: 'r1',
  name: '하체',
  updatedAt: 0,
  exercises: [
    { id: 't1', exerciseId: 'squat', name: '스쿼트', kind: 'reps', restSec: 120, sets: [plan(60, 8), plan(60, 8), plan(60, 8)] },
    { id: 't2', exerciseId: 'leg-curl', name: '레그 컬', kind: 'reps', restSec: 60, sets: [plan(30, 12), plan(30, 12)] },
    { id: 't3', exerciseId: 'plank', name: '플랭크', kind: 'time', restSec: 45, sets: [{ type: 'normal', weightKg: 0, reps: 0, durationSec: 30 }] },
  ],
};

const hotel: Place = { id: 'hotel', name: '호텔 짐', equipment: ['덤벨', '머신'], unavailable: [], swaps: {}, temp: true };

function session(id: string, startedAt: number, exerciseId: string, name: string, sets: SetLog[], place?: Session['place']): Session {
  return { id, routineName: 'r', startedAt, endedAt: startedAt + 1, exercises: [{ id: `e-${id}`, exerciseId, name, kind: 'reps', restSec: 90, sets }], place };
}

describe('장비 가용성', () => {
  it('장비 목록에 없는 기구 종목은 못 하고, 맨몸은 항상 된다', () => {
    expect(isAvailable(hotel, { exerciseId: 'squat', name: '스쿼트' })).toBe(false);
    expect(isAvailable(hotel, { exerciseId: 'leg-press', name: '레그 프레스' })).toBe(true);
    expect(isAvailable(hotel, { exerciseId: 'plank', name: '플랭크' })).toBe(true);
    expect(isAvailable(undefined, { exerciseId: 'squat', name: '스쿼트' })).toBe(true);
    expect(isAvailable({ ...hotel, equipment: undefined, unavailable: ['leg-press'] }, { exerciseId: 'leg-press', name: '레그 프레스' })).toBe(false);
    expect(isAvailable(hotel, { name: '내가 만든 운동' })).toBe(true);
  });

  it('루틴에서 못 하는 종목을 미리 알려준다', () => {
    expect(unavailableIn(hotel, routine.exercises).map((e) => e.name)).toEqual(['스쿼트']);
  });

  it('기구 없음 표시와 해제', () => {
    const main: Place = { id: 'main', name: '평소 헬스장', unavailable: [], swaps: {} };
    const marked = markUnavailable(main, 'squat', 'leg-press');
    expect(marked).toMatchObject({ unavailable: ['squat'], swaps: { squat: 'leg-press' } });
    expect(markUnavailable(marked, 'squat', 'leg-press')).toEqual(marked);
    expect(markAvailable(marked, 'squat')).toEqual(main);
  });
});

describe('장소별 기록', () => {
  const h = { id: 'hotel', name: '호텔 짐' };
  const history = [
    session('h', 20, 'leg-press', '레그 프레스', [done(60, 12)], h),
    session('m', 10, 'leg-press', '레그 프레스', [done(140, 12)]),
  ];
  it('같은 장소 기록을 먼저, 없으면 다른 장소 기록 (참고용)', () => {
    const e = { exerciseId: 'leg-press', name: '레그 프레스' };
    expect(lastLogFor(history, e)?.sets[0].weightKg).toBe(60);
    expect(lastLogFor(history, e, 'main')?.sets[0].weightKg).toBe(140);
    expect(lastLogFor(history, e, 'hotel')?.sets[0].weightKg).toBe(60);
    expect(lastLogFor(history, e, 'other')?.sets[0].weightKg).toBe(60);
    expect(lastLogAt(history, e, 'other')).toBeUndefined();
    expect(placeKey(lastLogEntry(history, e, 'main')!.session)).toBe('main');
  });

  it('대체 추천은 없는 기구를 점수 전에 빼고, 이 장소 기록을 보여준다', () => {
    const subs = rankSubstitutes({ exerciseId: 'squat', name: '스쿼트' }, history, { place: hotel });
    expect(subs.length).toBeGreaterThan(0);
    expect(subs.every((x) => x.info.equipment !== '바벨' && x.info.equipment !== '케이블')).toBe(true);
    expect(subs[0]).toMatchObject({ info: { id: 'leg-press' }, match: 3, lastText: '60kg × 12' });
  });
});

describe('호텔 짐 흐름', () => {
  function atHotel(): AppState {
    let s: AppState = { ...defaultState(), onboarded: true, routines: [routine] };
    s = reducer(s, { type: 'place/save', place: hotel });
    s = reducer(s, { type: 'place/select', id: 'hotel' });
    return reducer(s, { type: 'session/start', routine, now: 1_000 });
  }

  it('세션에 장소가 남고, 끝나면 임시 장소는 지워지고 평소 헬스장으로 돌아온다', () => {
    let s = atHotel();
    expect(s.active?.place).toEqual({ id: 'hotel', name: '호텔 짐', equipment: ['덤벨', '머신'] });
    s = reducer(s, { type: 'set/complete', exIdx: 1, setIdx: 0, now: 2_000 });
    s = reducer(s, { type: 'session/finish', now: 3_000, apply: { targets: false, structure: false } });
    expect(s.history[0].place?.id).toBe('hotel');
    expect(s.places.map((p) => p.id)).toEqual(['main']);
    expect(s.settings.placeId).toBe('main');
    expect(s.routines[0]).toEqual(routine);
  });

  it('기구 없음으로 바꾼 종목은 이유가 남고, 원래 종목 무게는 옮기지 않는다', () => {
    let s = atHotel();
    s = reducer(s, { type: 'exercise/replace', exIdx: 0, exercise: { exerciseId: 'leg-press', name: '레그 프레스', kind: 'reps' }, plan: [plan(10, 10)], reason: 'missing' });
    expect(s.active!.exercises[0]).toMatchObject({ name: '레그 프레스', swap: { from: '스쿼트', reason: 'missing' } });
    expect(s.active!.exercises[0].sets.map((x) => x.weightKg)).toEqual([10, 10, 10]);
  });

  it('장소 프로필에 교체가 있으면 시작할 때 자동으로 바꾸고, 무게는 그 종목의 이 장소 기록', () => {
    const gym2: Place = { id: 'gym2', name: '동네 헬스장', equipment: ['머신', '덤벨'], unavailable: ['squat'], swaps: { squat: 'leg-press' } };
    let s: AppState = {
      ...defaultState(),
      onboarded: true,
      routines: [routine],
      history: [
        session('h', 20, 'leg-press', '레그 프레스', [done(80, 12), done(80, 12)], { id: 'gym2', name: '동네 헬스장' }),
        session('m', 10, 'leg-press', '레그 프레스', [done(140, 12)]),
      ],
    };
    s = reducer(s, { type: 'place/save', place: gym2 });
    s = reducer(s, { type: 'place/select', id: 'gym2' });
    s = reducer(s, { type: 'session/start', routine, now: 100 * 86_400_000 });
    const first = s.active!.exercises[0];
    expect(first).toMatchObject({ exerciseId: 'leg-press', templateId: 't1', swap: { from: '스쿼트', reason: 'place' } });
    expect(first.sets.map((x) => x.weightKg)).toEqual([80, 80, 80]);
    // 저장한 장소는 끝나도 남고, 선택도 유지된다
    s = reducer(s, { type: 'set/complete', exIdx: 0, setIdx: 0, now: 100 * 86_400_000 + 1 });
    s = reducer(s, { type: 'session/finish', now: 100 * 86_400_000 + 2, apply: { targets: false, structure: false } });
    expect(s.places.map((p) => p.id)).toEqual(['main', 'gym2']);
    expect(s.settings.placeId).toBe('gym2');
  });

  it('누가 쓰고 있으면 맨 뒤로 미룬다', () => {
    const s = reducer(atHotel(), { type: 'exercise/defer', exIdx: 0 });
    expect(s.active!.exercises.map((e) => e.name)).toEqual(['레그 컬', '플랭크', '스쿼트']);
  });
});

describe('제안 적용 이력', () => {
  it('횟수 제안은 세트별로 들어가고, 적용·닫기가 기록에 남는다', () => {
    let s: AppState = {
      ...defaultState(),
      onboarded: true,
      routines: [routine],
      history: [session('m', 10, 'squat', '스쿼트', [done(60, 10), done(60, 9), done(60, 8)])],
    };
    s = reducer(s, { type: 'session/start', routine, now: 2 * 86_400_000 });
    expect(s.active!.exercises[0].suggested).toMatchObject({ code: 'add-reps', apply: { values: [10, 10, 9] } });
    s = reducer(s, { type: 'exercise/applySuggestion', exIdx: 0 });
    expect(s.active!.exercises[0].sets.map((x) => x.reps)).toEqual([10, 10, 9]);
    expect(s.active!.exercises[0].suggested?.applied).toBe(true);
    s = reducer(s, { type: 'exercise/dismissSuggestion', exIdx: 1 });
    expect(s.active!.exercises[1].suggested).toBeUndefined();
    // 끝난 기록에도 제안 이력이 그대로 남는다 (정정해도 원래 제안값·버전 보존)
    s = reducer(s, { type: 'set/complete', exIdx: 0, setIdx: 0, now: 3 * 86_400_000 });
    s = reducer(s, { type: 'session/finish', now: 3 * 86_400_000 + 1, apply: { targets: false, structure: false } });
    expect(s.history[0].exercises[0].suggested).toMatchObject({ v: 1, code: 'add-reps', applied: true, basedOn: 'm' });
  });
});
