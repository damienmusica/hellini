import { describe, expect, it } from 'vitest';
import { EXERCISES, ROLE_LABEL, roleOf } from '../../src/data/exercises';
import { isAvailable, PLACE_PRESETS } from '../../src/lib/places';
import { rankSubstitutes } from '../../src/lib/substitutes';
import type { Place, Session } from '../../src/lib/types';

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

// 3차 리뷰 §3·§6: 후보 카드는 "무엇이 달라지는지"를 데이터로 계산해 보여주고, 동등성을 주장하지 않는다
describe('후보 차이', () => {
  it('벤치프레스 → 덤벨·머신: 장비와 기록 기준이 바뀐다고 적는다', () => {
    const subs = rankSubstitutes({ exerciseId: 'bench-press', name: '벤치프레스' }, [], { strict: true });
    expect(subs.find((x) => x.info.id === 'dumbbell-bench-press')!.diff).toEqual(['기록 기준 한 손 덤벨 무게', '바벨 → 덤벨']);
    expect(subs.find((x) => x.info.id === 'chest-press-machine')!.diff).toEqual(['기록 기준 기구 표시 무게', '바벨 → 머신']);
  });

  it('비슷한 역할 후보에는 역할 변화가 먼저 적히고, 보조 장비가 더 필요하면 그것도 적는다', () => {
    const dumbbellOnly: Place = { id: 'db', name: '덤벨만', equipment: ['덤벨'], features: ['벤치'], unavailable: [], swaps: {}, temp: true };
    const subs = rankSubstitutes({ exerciseId: 'lat-pulldown', name: '랫풀다운' }, [], { place: dumbbellOnly, strict: true });
    const row = subs.find((x) => x.info.id === 'dumbbell-row')!;
    expect(row.match).toBe(2);
    expect(row.diff).toEqual([`${ROLE_LABEL['vertical-pull']} → ${ROLE_LABEL['horizontal-pull']}`, '벤치 필요', '기록 기준 한 손 덤벨 무게']);
  });

  it('백 익스텐션은 전용 벤치가 있어야 하고, 없으면 바닥 변형이 같은 역할 후보로 온다', () => {
    const noBench: Place = { id: 'p', name: 'p', equipment: ['덤벨'], features: [], unavailable: [], swaps: {} };
    expect(isAvailable(noBench, { exerciseId: 'back-extension', name: '백 익스텐션' })).toBe(false);
    expect(isAvailable(noBench, { exerciseId: 'floor-back-extension', name: '바닥 백 익스텐션' })).toBe(true);
    expect(isAvailable({ ...noBench, features: ['백익스텐션 벤치'] }, { exerciseId: 'back-extension', name: '백 익스텐션' })).toBe(true);
    const subs = rankSubstitutes({ exerciseId: 'back-extension', name: '백 익스텐션' }, [], { place: noBench, strict: true });
    const floor = subs.find((x) => x.info.id === 'floor-back-extension')!;
    expect(floor.match).toBe(3);
    expect(floor.diff).toEqual([]);
    expect(PLACE_PRESETS.find((p) => p.id === 'gym')!.features).toContain('백익스텐션 벤치');
  });
});
