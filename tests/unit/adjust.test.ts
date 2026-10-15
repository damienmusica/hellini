import { describe, expect, it } from 'vitest';
import { PROGRAMS, instantiateProgram } from '../../src/data/programs';
import { EXERCISES, findExercise, requiresOf } from '../../src/data/exercises';
import { GUIDES, guideOf } from '../../src/data/guides';
import { proposeSwaps } from '../../src/lib/adjust';
import { reducer, type ExerciseRef } from '../../src/lib/reducer';
import { defaultState } from '../../src/lib/storage';
import { rankSubstitutes } from '../../src/lib/substitutes';
import type { AppState, Place } from '../../src/lib/types';

// 2026-10-15 3차 리뷰 P0: 덤벨만 있는 Pull A에서 백익스텐션 11세트가 나오면 안 된다

const dumbbellOnly: Place = { id: 'db', name: '덤벨만', equipment: ['덤벨'], features: [], unavailable: [], swaps: {}, temp: true };
const pullA = instantiateProgram(PROGRAMS.find((p) => p.id === 'ppl-ab')!, 0)[1];

describe('대체 적격성', () => {
  it('같은 부위라는 이유만으로는 후보가 되지 않는다 (strict)', () => {
    const noBench: Place = { ...dumbbellOnly };
    const subs = rankSubstitutes({ exerciseId: 'lat-pulldown', name: '랫풀다운' }, [], { place: noBench, strict: true });
    expect(subs.every((s) => s.match >= 2)).toBe(true);
    expect(subs.some((s) => s.info.id === 'back-extension')).toBe(false);
    // 덤벨 두 손 로우(벤치 불필요)는 비슷한 역할로 적격
    expect(subs[0]?.info.id).toBe('dumbbell-bent-over-row');
  });

  it('페이스풀은 밀기(숄더 프레스)로 바뀌지 않는다', () => {
    const subs = rankSubstitutes({ exerciseId: 'face-pull', name: '페이스풀' }, [], { place: dumbbellOnly, strict: true });
    expect(subs.some((s) => s.info.id === 'dumbbell-shoulder-press')).toBe(false);
    expect(subs[0]?.info.id).toBe('dumbbell-rear-delt-raise');
  });

  it('후보 카드에는 필요한 장비·보조 장비가 붙는다', () => {
    const subs = rankSubstitutes({ exerciseId: 'bench-press', name: '벤치프레스' }, [], { strict: true });
    const db = subs.find((s) => s.info.id === 'dumbbell-bench-press')!;
    expect(db.needs).toEqual(['덤벨', '벤치']);
  });
});

describe('시작 전 조정 (세션 전체 검토)', () => {
  it('Pull A + 덤벨만: 같은 종목이 두 자리에 제안되지 않고, 역할이 다른 운동은 제안하지 않는다', () => {
    const proposals = proposeSwaps(pullA, dumbbellOnly, []);
    const targets = proposals.map((p) => p.to?.exerciseId).filter(Boolean) as string[];
    expect(new Set(targets).size).toBe(targets.length);
    expect(targets).not.toContain('back-extension');
    expect(targets).not.toContain('dumbbell-shoulder-press');
    const byName = Object.fromEntries(proposals.map((p) => [p.slot.exerciseId, p.to?.exerciseId ?? null]));
    expect(byName['face-pull']).toBe('dumbbell-rear-delt-raise');
    expect(byName['barbell-curl']).toBe('dumbbell-curl');
    // 당기기 둘 중 하나는 덤벨 로우, 나머지는 적격 후보가 없어 멈춘다
    const pulls = ['lat-pulldown', 'barbell-row', 'seated-cable-row'].map((id) => byName[id]);
    expect(pulls.filter((x) => x === 'dumbbell-bent-over-row')).toHaveLength(1);
    expect(pulls.filter((x) => x === null).length).toBeGreaterThanOrEqual(1);
    for (const p of proposals) if (!p.to) expect(p.note).toContain('어려워요');
  });

  it('세션에 이미 있는 종목은 다시 제안하지 않는다', () => {
    // Pull A에 해머 컬(덤벨)이 있으므로 바벨 컬의 대체로 해머 컬이 아니라 덤벨 컬이 온다
    const proposals = proposeSwaps(pullA, dumbbellOnly, []);
    const curl = proposals.find((p) => p.slot.exerciseId === 'barbell-curl')!;
    expect(curl.to?.exerciseId).not.toBe('hammer-curl');
  });

  it('오늘 제외(skips)는 세션에서 빠지고, 조정 교체는 사유 adjust로 남는다', () => {
    const proposals = proposeSwaps(pullA, dumbbellOnly, []);
    const swaps: Record<string, ExerciseRef> = {};
    const skips: string[] = [];
    for (const p of proposals) {
      if (p.to) swaps[p.slot.id] = p.to;
      else skips.push(p.slot.id);
    }
    let s: AppState = { ...defaultState(), onboarded: true, routines: [pullA] };
    s = reducer(s, { type: 'place/save', place: dumbbellOnly });
    s = reducer(s, { type: 'place/select', id: 'db' });
    s = reducer(s, { type: 'session/start', routine: pullA, now: 1, swaps, skips });
    const names = s.active!.exercises.map((e) => e.exerciseId);
    expect(names).toHaveLength(pullA.exercises.length - skips.length);
    expect(names).not.toContain('back-extension');
    expect(new Set(names).size).toBe(names.length);
    const swapped = s.active!.exercises.find((e) => e.swap);
    expect(swapped?.swap?.reason).toBe('adjust');
  });

  it('사유를 고르지 않은 교체는 사유 없이 기록된다', () => {
    let s: AppState = { ...defaultState(), onboarded: true, routines: [pullA] };
    s = reducer(s, { type: 'session/start', routine: pullA, now: 1 });
    s = reducer(s, {
      type: 'exercise/replace',
      exIdx: 0,
      exercise: { exerciseId: 'pull-up', name: '풀업', kind: 'reps' },
      plan: [{ type: 'normal', reps: 8, weightKg: 0, durationSec: 0 }],
    });
    expect(s.active!.exercises[0].swap).toEqual({ from: '랫풀다운' });
  });
});

describe('운동 설명 콘텐츠', () => {
  it('라이브러리의 모든 종목에 설명(목적·3단계·기록 기준)이 있다', () => {
    const ids = new Set([...PROGRAMS.flatMap((p) => p.routines.flatMap((r) => r.rows.map(([id]) => id))), ...EXERCISES.map((e) => e.id)]);
    for (const id of ids) {
      const g = guideOf(id);
      expect(g, id).toBeDefined();
      expect(g!.steps).toHaveLength(3);
      expect(g!.purpose.length).toBeGreaterThanOrEqual(6);
    }
  });

  it('설명이 있는 종목은 라이브러리에 있고, 벤치가 필요한 종목은 준비 항목에 벤치가 적혀 있다', () => {
    for (const [id, g] of Object.entries(GUIDES)) {
      expect(findExercise(id), id).toBeDefined();
      if (requiresOf(id).includes('벤치') || requiresOf(id).includes('인클라인 벤치')) expect(g.setup ?? '', id).toMatch(/벤치/);
      expect(['draft', 'edited', 'expert']).toContain(g.review); // 검토 상태를 분명히 둔다
      if (g.review !== 'draft') expect(g.reviewedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });
});
