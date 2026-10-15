import { describe, expect, it } from 'vitest';
import { EXERCISES, roleOf } from '../../src/data/exercises';
import { rankSubstitutes } from '../../src/lib/substitutes';
import type { Session } from '../../src/lib/types';

describe('대체 운동 추천', () => {
  it('모든 종목에 운동 역할이 있다', () => {
    expect(EXERCISES.filter((e) => !roleOf(e.id)).map((e) => e.id)).toEqual([]);
  });

  it('스쿼트 대신: 같은 역할(스쿼트 패턴)이 먼저, 레그 컬·카프 레이즈는 상위에 없다', () => {
    const subs = rankSubstitutes({ exerciseId: 'squat', name: '스쿼트' }, []);
    const top = subs.slice(0, 6);
    expect(top.every((s) => s.match === 3)).toBe(true);
    expect(top.map((s) => s.info.id)).toContain('leg-press');
    expect(subs.map((s) => s.info.id)).not.toContain('leg-curl');
    expect(subs.map((s) => s.info.id)).not.toContain('calf-raise');
    expect(subs[0].reason).toBe('같은 역할 · 스쿼트 패턴');
  });

  it('같은 역할 안에서는 해 본 종목이 먼저, 지난 기록을 보여준다', () => {
    const history: Session[] = [
      {
        id: 'h',
        routineName: 'x',
        startedAt: 1,
        endedAt: 2,
        exercises: [
          {
            id: 'e',
            exerciseId: 'hack-squat',
            name: '핵 스쿼트',
            kind: 'reps',
            restSec: 90,
            sets: [{ type: 'normal', weightKg: 40, reps: 10, durationSec: 0, done: true }],
          },
        ],
      },
    ];
    const subs = rankSubstitutes({ exerciseId: 'squat', name: '스쿼트' }, history);
    expect(subs[0].info.id).toBe('hack-squat');
    expect(subs[0].lastText).toBe('40kg × 10');
    expect(subs[1].lastText).toBeNull();
  });

  it('같은 입력이면 같은 순서 (결정 규칙)', () => {
    const a = rankSubstitutes({ exerciseId: 'bench-press', name: '벤치프레스' }, []).map((s) => s.info.id);
    const b = rankSubstitutes({ exerciseId: 'bench-press', name: '벤치프레스' }, []).map((s) => s.info.id);
    expect(a).toEqual(b);
    expect(a.slice(0, 3)).toEqual(['dumbbell-bench-press', 'chest-press-machine', 'push-up']);
  });
});
