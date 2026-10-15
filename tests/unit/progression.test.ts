import { describe, expect, it } from 'vitest';
import { plateauSessions, PROGRESSION_VERSION, repRange, suggest } from '../../src/lib/progression';
import type { ExerciseLog, Session, SessionPlace, SetLog } from '../../src/lib/types';

// 리뷰 §4 목표 조정: 결정 규칙, 최소 증량 단위, 이유 코드, 버전. 수치는 보수적인 초안이다.

const DAY = 86_400_000;
const NOW = 100 * DAY;

const s = (weightKg: number, reps: number, done = true): SetLog => ({ type: 'normal', weightKg, reps, durationSec: 0, done });
const log = (sets: SetLog[], extra: Partial<ExerciseLog> = {}, id = 'bench-press', name = '벤치프레스'): ExerciseLog => ({
  id: 'l',
  exerciseId: id,
  name,
  kind: 'reps',
  restSec: 90,
  sets,
  ...extra,
});
const session = (id: string, daysAgo: number, sets: SetLog[], extra: Partial<ExerciseLog> = {}, place?: SessionPlace): Session => ({
  id,
  routineName: 'r',
  startedAt: NOW - daysAgo * DAY,
  endedAt: NOW - daysAgo * DAY + 3_600_000,
  exercises: [log(sets, extra)],
  place,
});
/** 오늘 계획: 8회 × 3세트 (목표 범위 8~10) */
const plan = (weightKg: number, reps = 8, n = 3) => log(Array.from({ length: n }, () => s(weightKg, reps, false)));

describe('목표 횟수 범위', () => {
  it('5회 이하는 그 횟수, 8회까지 +2, 그 위는 +3', () => {
    expect(repRange(5)).toEqual({ lo: 5, hi: 5 });
    expect(repRange(8)).toEqual({ lo: 8, hi: 10 });
    expect(repRange(10)).toEqual({ lo: 10, hi: 13 });
    expect(repRange(12)).toEqual({ lo: 12, hi: 15 });
  });
});

describe('다음 목표 제안', () => {
  it('모든 세트가 범위 위쪽 끝이면 최소 증량 단위만큼 올린다 (add-weight)', () => {
    const out = suggest(plan(40), [session('a', 2, [s(40, 10), s(40, 10), s(40, 10)])], 'main', NOW);
    expect(out).toMatchObject({ v: PROGRESSION_VERSION, code: 'add-weight', apply: { field: 'weightKg', value: 42.5 }, basedOn: 'a' });
    expect(out!.label).toContain('42.5kg');
  });

  it('범위 안이면 같은 무게로 약한 세트부터 한 번씩 더 (add-reps)', () => {
    const out = suggest(plan(40), [session('a', 2, [s(40, 10), s(40, 9), s(40, 8)])], 'main', NOW);
    expect(out).toMatchObject({ code: 'add-reps', apply: { field: 'reps', values: [10, 10, 9] } });
    expect(out!.label).toContain('같은 무게로 10·10·9회');
  });

  it('범위 아래로 끝난 세트가 있으면 같은 무게로 한 번 더 (hold-missed)', () => {
    const history = [session('a', 2, [s(40, 8), s(40, 7), s(40, 8)])];
    expect(suggest(plan(40), history, 'main', NOW)).toMatchObject({ code: 'hold-missed' });
    expect(suggest(plan(40), history, 'main', NOW)!.apply).toBeUndefined();
    // 계획이 지난 무게보다 가벼우면 지난 무게로 되돌리는 것만 제안
    expect(suggest(plan(20), history, 'main', NOW)).toMatchObject({ code: 'hold-missed', apply: { field: 'weightKg', value: 40 } });
  });

  it('두 번 연속 같은 무게 이상에서 못 채우면 10% 감량, 증량 단위로 내림 (deload)', () => {
    const history = [session('a', 2, [s(40, 8), s(40, 7), s(40, 8)]), session('b', 5, [s(40, 8), s(40, 6), s(40, 8)])];
    expect(suggest(plan(40), history, 'main', NOW)).toMatchObject({ code: 'deload', apply: { field: 'weightKg', value: 35 } });
  });

  it('직전 실패가 더 가벼운 무게였으면 감량이 아니라 한 번 더', () => {
    const history = [session('a', 2, [s(40, 8), s(40, 7), s(40, 8)]), session('b', 5, [s(37.5, 8), s(37.5, 6), s(37.5, 8)])];
    expect(suggest(plan(40), history, 'main', NOW)).toMatchObject({ code: 'hold-missed' });
  });

  it('세트를 덜 한 날(시간 부족)은 실패가 아니다: 제안 없음', () => {
    expect(suggest(plan(40), [session('a', 2, [s(40, 10), s(40, 10)])], 'main', NOW)).toBeNull();
    // 덜 한 세트는 실패 판정에도 세지 않는다 (감량 근거 X)
    const history = [session('a', 2, [s(40, 8), s(40, 7), s(40, 8)]), session('b', 5, [s(40, 6)])];
    expect(suggest(plan(40), history, 'main', NOW)).toMatchObject({ code: 'hold-missed' });
  });

  it('3주 넘게 쉬었으면 올리지 않고 지난 무게로 확인 세트 (long-gap)', () => {
    const out = suggest(plan(40), [session('a', 22, [s(40, 10), s(40, 10), s(40, 10)])], 'main', NOW);
    expect(out).toMatchObject({ code: 'long-gap' });
    expect(out!.apply).toBeUndefined();
    expect(out!.label).toContain('3주');
  });

  it('다 채웠어도 "거의 한계였어요"면 한 번 더 같은 무게 (hold-hard)', () => {
    const out = suggest(plan(40), [session('a', 2, [s(40, 10), s(40, 10), s(40, 10)], { effort: 'hard' })], 'main', NOW);
    expect(out).toMatchObject({ code: 'hold-hard' });
    expect(out!.apply).toBeUndefined();
  });

  it('같은 장소 기록만 근거로 쓴다', () => {
    const hotel: SessionPlace = { id: 'hotel', name: '호텔 짐', equipment: ['덤벨'] };
    const history = [session('h', 1, [s(20, 10), s(20, 10), s(20, 10)], {}, hotel), session('m', 3, [s(40, 10), s(40, 10), s(40, 10)])];
    expect(suggest(plan(40), history, 'main', NOW)).toMatchObject({ code: 'add-weight', basedOn: 'm' });
    expect(suggest(plan(20), history, 'hotel', NOW)).toMatchObject({ code: 'add-weight', basedOn: 'h', apply: { value: 22.5 } });
    expect(suggest(plan(40), history, 'other', NOW)).toBeNull();
  });

  it('이미 더 무겁게 계획했거나 오늘 세트를 시작했으면 제안 없음', () => {
    const history = [session('a', 2, [s(40, 10), s(40, 10), s(40, 10)])];
    expect(suggest(plan(45), history, 'main', NOW)).toBeNull();
    const begun = plan(40);
    begun.sets[0] = { ...begun.sets[0], done: true };
    expect(suggest(begun, history, 'main', NOW)).toBeNull();
    expect(suggest(plan(40), [], 'main', NOW)).toBeNull();
  });

  it('맨몸 종목은 횟수를 올린다', () => {
    const out = suggest(plan(0, 10), [session('a', 2, [s(0, 13), s(0, 13), s(0, 13)])], 'main', NOW);
    expect(out).toMatchObject({ code: 'add-reps', apply: { field: 'reps', values: [14, 14, 14] } });
  });

  it('증량 단위: 바벨 상체 2.5, 덤벨 2 — 지금 무게에 단위를 더한다', () => {
    expect(suggest(plan(21), [session('a', 2, [s(21, 10), s(21, 10), s(21, 10)])], 'main', NOW)).toMatchObject({ apply: { value: 23.5 } });
    const db = (w: number, reps: number, done = true) => log([s(w, reps, done), s(w, reps, done), s(w, reps, done)], {}, 'dumbbell-curl', '덤벨 컬');
    const history: Session[] = [{ ...session('a', 2, []), exercises: [db(7, 15)] }];
    expect(suggest(db(7, 12, false), history, 'main', NOW)).toMatchObject({ code: 'add-weight', apply: { value: 9 } });
  });

  it('같은 입력·같은 버전이면 같은 결과', () => {
    const history = [session('a', 2, [s(40, 10), s(40, 9), s(40, 8)])];
    expect(suggest(plan(40), history, 'main', NOW)).toEqual(suggest(plan(40), history, 'main', NOW));
  });
});

describe('정체 감지 (여러 세션 근거)', () => {
  const same = [s(40, 10), s(40, 10), s(40, 10)];
  it('같은 장소에서 3번 연속 최고 세트가 같으면 3', () => {
    const history = [session('a', 1, same), session('b', 3, same), session('c', 5, same)];
    expect(plateauSessions(history, { exerciseId: 'bench-press', name: '벤치프레스' }, 'main')).toBe(3);
  });
  it('두 번뿐이거나 하나라도 다르면 0', () => {
    expect(plateauSessions([session('a', 1, same), session('b', 3, same)], { exerciseId: 'bench-press', name: '벤치프레스' }, 'main')).toBe(0);
    const history = [session('a', 1, same), session('b', 3, [s(40, 11)]), session('c', 5, same)];
    expect(plateauSessions(history, { exerciseId: 'bench-press', name: '벤치프레스' }, 'main')).toBe(0);
  });
});
