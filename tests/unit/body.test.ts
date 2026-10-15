import { describe, expect, it } from 'vitest';
import { bodyTrend, needsBodyCheck, nutritionTargets, recommendGoal, strengthLevel } from '../../src/lib/body';
import { reducer } from '../../src/lib/reducer';
import { defaultState, parseState } from '../../src/lib/storage';
import type { BodyLog } from '../../src/lib/types';

const DAY = 86_400_000;
const NOW = 200 * DAY;
const log = (daysAgo: number, weightKg: number, bodyFatPct?: number): BodyLog => ({ id: `b${daysAgo}`, date: NOW - daysAgo * DAY, weightKg, bodyFatPct });

describe('체성분 → 단계 추천', () => {
  it('남 20% 이상이면 리컴프, 25% 이상이면 감량, 15% 이하면 린벌크', () => {
    expect(recommendGoal('male', 21)?.goal).toBe('recomp');
    expect(recommendGoal('male', 26)?.goal).toBe('cut');
    expect(recommendGoal('male', 14)?.goal).toBe('bulk');
    expect(recommendGoal('male', 17)?.goal).toBe('recomp');
    expect(recommendGoal('female', 25)?.goal).toBe('recomp');
    expect(recommendGoal('female', 30)?.goal).toBe('recomp');
    expect(recommendGoal(undefined, undefined)).toBeNull();
  });
});

describe('영양 목표', () => {
  it('체지방률이 있으면 제지방량 기준(Katch-McArdle), 목표별 가감, 단백질 1.8g/kg', () => {
    const n = nutritionTargets({ goal: 'recomp' }, log(1, 73.3, 21), 6, NOW)!;
    expect(n.method).toBe('katch');
    expect(n.bmr).toBe(1621); // 370 + 21.6 × 57.9
    expect(n.tdee).toBe(2590);
    expect(n.kcal).toBe(2590);
    expect(n.proteinG).toBe(130);
    expect(nutritionTargets({ goal: 'bulk' }, log(1, 73.3, 21), 6, NOW)!.kcal).toBe(2840);
    expect(nutritionTargets({ goal: 'cut' }, log(1, 73.3, 21), 6, NOW)).toMatchObject({ kcal: 2190, proteinG: 145 });
  });

  it('체지방률이 없으면 성별·나이·키로(Mifflin), 그것도 없으면 null', () => {
    const now = new Date(2026, 9, 15).getTime();
    const n = nutritionTargets({ sex: 'male', birthYear: 1994, heightCm: 175.8 }, { id: 'x', date: now, weightKg: 73.3 }, 3, now)!;
    expect(n.method).toBe('mifflin');
    expect(n.bmr).toBe(1677); // 733 + 1098.75 − 160 + 5
    expect(nutritionTargets({ sex: 'male' }, { id: 'x', date: now, weightKg: 73.3 }, 3, now)).toBeNull();
    expect(nutritionTargets({}, undefined, 3, now)).toBeNull();
  });
});

describe('체중 추세', () => {
  it('7일 이상 떨어진 기록 둘이 있어야 하고, 목표에 따라 판단한다', () => {
    expect(bodyTrend([log(1, 73)], 'bulk', NOW)).toBeNull();
    expect(bodyTrend([log(1, 73), log(3, 73)], 'bulk', NOW)).toBeNull();
    const flat = [log(0, 73.3), log(14, 73.2)];
    expect(bodyTrend(flat, 'bulk', NOW)).toMatchObject({ tone: 'warn', days: 14 });
    expect(bodyTrend(flat, 'recomp', NOW)?.tone).toBe('ok');
    expect(bodyTrend(flat, 'cut', NOW)?.tone).toBe('warn');
    const up = [log(0, 74.0), log(14, 73.3)]; // +0.48%/주
    expect(bodyTrend(up, 'bulk', NOW)?.tone).toBe('ok');
    expect(bodyTrend(up, 'recomp', NOW)?.tone).toBe('warn');
    const fast = [log(0, 75.0), log(7, 73.3)];
    expect(bodyTrend(fast, 'bulk', NOW)?.message).toContain('너무 빨라요');
  });

  it('6주보다 오래된 기록은 보지 않는다', () => {
    expect(bodyTrend([log(1, 73), log(50, 70)], 'cut', NOW)).toBeNull();
  });
});

describe('체중 대비 근력', () => {
  it('벤치 1RM 80kg / 73kg → 1.1배 초급, 다음 단계 1.25배', () => {
    expect(strengthLevel('bench-press', 80, 73, 'male')).toEqual({ ratio: 1.1, level: 1, next: 91 });
    expect(strengthLevel('squat', 170, 73, 'male')).toMatchObject({ level: 3, next: null });
    expect(strengthLevel('lateral-raise', 20, 73, 'male')).toBeNull();
    expect(strengthLevel('bench-press', 40, 60, 'female')?.level).toBe(1);
  });
});

describe('저장과 알림', () => {
  it('체성분 기록은 날짜순으로 정렬되고, 같은 id는 덮어쓴다', () => {
    let s = reducer(defaultState(), { type: 'body/save', log: log(10, 74) });
    s = reducer(s, { type: 'body/save', log: log(1, 73.3, 21) });
    s = reducer(s, { type: 'body/save', log: { ...log(10, 74), bodyFatPct: 22 } });
    expect(s.body.map((b) => [b.weightKg, b.bodyFatPct])).toEqual([
      [73.3, 21],
      [74, 22],
    ]);
    s = reducer(s, { type: 'profile/update', patch: { goal: 'recomp', sex: 'male' } });
    expect(s.profile).toEqual({ goal: 'recomp', sex: 'male' });
    expect(s.version).toBe(4);
  });

  it('v3 백업은 body·profile을 비워서 v4로 올린다', () => {
    const s = parseState({ version: 3, routines: [], history: [], places: [{ id: 'main', name: '평소 헬스장', unavailable: [], swaps: {} }] })!;
    expect(s.version).toBe(4);
    expect(s.body).toEqual([]);
    expect(s.profile).toEqual({});
  });

  it('90일 넘게 안 쟀으면 다시 재자고 한다. 기록이 없으면 조용히', () => {
    expect(needsBodyCheck([log(100, 73)], NOW)).toBe(true);
    expect(needsBodyCheck([log(30, 73)], NOW)).toBe(false);
    expect(needsBodyCheck([], NOW)).toBe(false);
  });
});
