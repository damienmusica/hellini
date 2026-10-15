import { describe, expect, it } from 'vitest';
import { groupSets, shouldShowReview, weeklyReview } from '../../src/lib/review';
import { weekStart } from '../../src/lib/stats';
import type { Routine, Session, SetLog } from '../../src/lib/types';

// v0.4 자기관리: 주간 리뷰는 충족한 조건만 문장으로 만들고, 쉰 날을 처벌하지 않는다

const DAY = 86_400_000;
// 2026-10-15 (목) 저녁
const NOW = new Date('2026-10-15T20:00:00+09:00').getTime();
const THIS = weekStart(NOW);
const LAST = THIS - 7 * DAY;

const s = (weightKg: number, reps: number): SetLog => ({ type: 'normal', weightKg, reps, durationSec: 0, done: true });
function session(id: string, at: number, exercises: [string, string, SetLog[]][], routineId?: string): Session {
  return {
    id,
    routineId,
    routineName: 'r',
    startedAt: at,
    endedAt: at + 3_600_000,
    exercises: exercises.map(([exerciseId, name, sets], i) => ({ id: `${id}-${i}`, exerciseId, name, kind: 'reps', restSec: 90, sets })),
  };
}
const routines: Routine[] = [
  { id: 'a', name: '무분할 A', note: 'p', updatedAt: 0, exercises: [] },
  { id: 'b', name: '무분할 B', note: 'p', updatedAt: 0, exercises: [] },
];

describe('주간 리뷰', () => {
  it('목표 달성·볼륨 증가·새 기록·다음 차례를 문장으로 만든다', () => {
    const history = [
      session('3', LAST + 4 * DAY, [['bench-press', '벤치프레스', [s(60, 8), s(60, 8), s(60, 8)]]], 'b'),
      session('2', LAST + 2 * DAY, [['squat', '스쿼트', [s(80, 5), s(80, 5), s(80, 5)]]], 'a'),
      session('1', LAST - 3 * DAY, [['squat', '스쿼트', [s(60, 5), s(60, 5)]]], 'b'),
    ];
    const r = weeklyReview({ history, routines, goal: 2, now: NOW })!;
    expect(r.sessions).toBe(2);
    expect(r.prevSessions).toBe(1);
    expect(r.prs).toBeGreaterThan(0);
    const codes = r.lines.map((l) => l.code);
    expect(codes).toContain('goal-met');
    expect(r.lines.find((l) => l.code === 'volume')!.text).toMatch(/\+\d+%/);
    expect(codes).toContain('prs');
    expect(r.lines.find((l) => l.code === 'next')!.text).toContain('무분할 A');
    expect(codes).not.toContain('balance'); // 15세트 미만이면 균형 판단 안 함
  });

  it('목표 미달은 실패로 쓰지 않고, 기록 없는 주는 1회부터로 안내한다', () => {
    const history = [session('1', LAST + DAY, [['squat', '스쿼트', [s(60, 5)]]], 'a')];
    const short = weeklyReview({ history, routines, goal: 3, now: NOW })!;
    expect(short.lines[0]).toMatchObject({ code: 'goal-short', tone: 'info' });
    expect(short.lines[0].text).not.toContain('실패했');
    const none = weeklyReview({ history: [session('1', LAST - 10 * DAY, [['squat', '스쿼트', [s(60, 5)]]], 'a')], routines, goal: 3, now: NOW })!;
    expect(none.lines[0].code).toBe('no-session');
  });

  it('밀기·당기기·하체 중 하나가 가장 많은 쪽의 절반 아래면 균형을 알려준다 (총 15세트 이상)', () => {
    const push = Array.from({ length: 8 }, () => s(60, 8));
    const legs = Array.from({ length: 8 }, () => s(80, 8));
    const history = [
      session('1', LAST + DAY, [['bench-press', '벤치프레스', push], ['squat', '스쿼트', legs], ['lat-pulldown', '랫풀다운', [s(40, 10), s(40, 10)]]], 'a'),
    ];
    const r = weeklyReview({ history, routines, goal: 1, now: NOW })!;
    expect(groupSets(history)).toEqual({ push: 8, pull: 2, legs: 8, core: 0 });
    const bal = r.lines.find((l) => l.code === 'balance')!;
    expect(bal.tone).toBe('warn');
    expect(bal.text).toContain('당기기 2세트');
  });

  it('이번 주 모드는 지금까지만 보고, 홈 노출은 같은 주에 한 번이다', () => {
    const history = [session('1', THIS + DAY, [['squat', '스쿼트', [s(60, 5)]]], 'a')];
    const r = weeklyReview({ history, routines, goal: 3, now: NOW, week: 'this' })!;
    expect(r.weekStart).toBe(THIS);
    expect(r.lines[0].text).toBe('목표 3회 중 1회 했어요.');
    // 첫 주(지난 주·그 전주 기록 없음)에는 "기록 없음" 리뷰를 띄우지 않는다
    const firstWeek = weeklyReview({ history, routines, goal: 3, now: NOW })!;
    expect(shouldShowReview(firstWeek, undefined)).toBe(false);
    const withLast = weeklyReview({ history: [...history, session('0', LAST + DAY, [['squat', '스쿼트', [s(60, 5)]]], 'a')], routines, goal: 3, now: NOW })!;
    expect(shouldShowReview(withLast, undefined)).toBe(true);
    expect(shouldShowReview(withLast, withLast.weekStart)).toBe(false);
    expect(shouldShowReview(null, undefined)).toBe(false);
  });
});
