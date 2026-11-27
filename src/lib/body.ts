import type { BodyLog, Goal, Profile } from './types';

/**
 * 체성분·프로필로 계산하는 것들. 전부 결정 규칙이고 수치는 보수적인 초안이다.
 * 세트·무게 제안(progression)은 체성분을 쓰지 않는다. 체중은 영양 목표, 추세 판단, 체중 대비 근력에만 쓴다.
 */

const DAY = 86_400_000;

export const GOAL_LABEL: Record<Goal, string> = { recomp: '리컴프', bulk: '린벌크', cut: '감량', maintain: '유지' };

export const GOAL_DESC: Record<Goal, string> = {
  recomp: '유지 열량으로 근육은 늘리고 지방은 빼요. 운동 경력이 짧을수록 잘 돼요.',
  bulk: '하루 +250kcal, 체중은 주당 +0.25~0.5%만. 더 빠르면 지방이 붙어요.',
  cut: '하루 −400kcal, 체중은 주당 −0.5~1%. 단백질은 더 챙겨요.',
  maintain: '지금 체중을 지키면서 기록을 늘려요.',
};

/** 가장 최근 기록 (at 이전) */
export function latestBody(logs: BodyLog[], at = Infinity): BodyLog | undefined {
  return logs.find((b) => b.date <= at);
}

/** 체지방률로 보는 지금 단계 추천. 남 20% / 여 28% 넘으면 벌크를 미루자고 한다 */
export function recommendGoal(sex: Profile['sex'], bodyFatPct: number | undefined): { goal: Goal; reason: string } | null {
  if (bodyFatPct === undefined) return null;
  const high = sex === 'female' ? 28 : 20;
  const lean = sex === 'female' ? 22 : 15;
  if (bodyFatPct >= high + 5) return { goal: 'cut', reason: `체지방 ${bodyFatPct}%면 먼저 빼는 게 효율이 좋아요.` };
  if (bodyFatPct >= high) return { goal: 'recomp', reason: `체지방 ${bodyFatPct}%에서 열량을 더 넣으면 지방이 먼저 붙어요. 유지 열량으로 리컴프부터.` };
  if (bodyFatPct <= lean) return { goal: 'bulk', reason: `체지방 ${bodyFatPct}%면 린벌크 시작하기 좋은 상태예요.` };
  return { goal: 'recomp', reason: `체지방 ${bodyFatPct}%. 리컴프로 ${lean}% 근처까지 간 뒤 린벌크가 깔끔해요.` };
}

export interface Nutrition {
  bmr: number;
  tdee: number;
  /** 목표 열량 */
  kcal: number;
  proteinG: number;
  /** 어떤 식으로 계산했는지 */
  method: 'katch' | 'mifflin';
}

/** 주당 운동 횟수 → 활동 계수 (보수적으로) */
function activityFactor(weeklyGoal: number): number {
  if (weeklyGoal <= 2) return 1.3;
  if (weeklyGoal <= 3) return 1.375;
  if (weeklyGoal <= 5) return 1.5;
  return 1.6;
}

const GOAL_OFFSET: Record<Goal, number> = { recomp: 0, bulk: 250, cut: -400, maintain: 0 };

/**
 * 영양 목표. 체지방률이 있으면 Katch-McArdle(제지방량 기준), 없으면 Mifflin-St Jeor(성별·나이·키 필요).
 * 단백질은 체중 kg당 1.8g (감량은 2.0g). 계산이 안 되면 null
 */
export function nutritionTargets(profile: Profile, body: BodyLog | undefined, weeklyGoal: number, now = Date.now()): Nutrition | null {
  if (!body) return null;
  const goal = profile.goal ?? 'maintain';
  let bmr: number;
  let method: Nutrition['method'];
  if (body.bodyFatPct !== undefined) {
    const lbm = body.weightKg * (1 - body.bodyFatPct / 100);
    bmr = 370 + 21.6 * lbm;
    method = 'katch';
  } else if (profile.sex && profile.birthYear && profile.heightCm) {
    const age = new Date(now).getFullYear() - profile.birthYear;
    bmr = 10 * body.weightKg + 6.25 * profile.heightCm - 5 * age + (profile.sex === 'male' ? 5 : -161);
    method = 'mifflin';
  } else return null;
  const tdee = bmr * activityFactor(weeklyGoal);
  const kcal = Math.round((tdee + GOAL_OFFSET[goal]) / 10) * 10;
  const proteinG = Math.round(body.weightKg * (goal === 'cut' ? 2.0 : 1.8) / 5) * 5;
  return { bmr: Math.round(bmr), tdee: Math.round(tdee / 10) * 10, kcal, proteinG, method };
}

export interface Trend {
  /** 주당 체중 변화율 (%) */
  weeklyPct: number;
  /** 비교한 기간 (일) */
  days: number;
  tone: 'ok' | 'warn' | 'info';
  message: string;
}

/**
 * 최근 체중 추세와 목표 비교. 7일 이상 떨어진 기록 둘이 있어야 하고, 최근 6주 안의 기록만 본다.
 * 린벌크 +0.25~0.5%/주, 감량 −0.5~1%/주, 리컴프·유지 ±0.25%/주를 정상으로 본다.
 */
export function bodyTrend(logs: BodyLog[], goal: Goal | undefined, now = Date.now()): Trend | null {
  const recent = logs.filter((b) => b.date >= now - 42 * DAY);
  if (recent.length < 2) return null;
  const latest = recent[0];
  const base = recent.find((b) => latest.date - b.date >= 7 * DAY);
  if (!base) return null;
  const days = Math.round((latest.date - base.date) / DAY);
  const weeklyPct = ((latest.weightKg - base.weightKg) / base.weightKg) * 100 * (7 / days);
  const r = Math.round(weeklyPct * 100) / 100;
  const sign = r > 0 ? '+' : '';
  const head = `최근 ${days}일 주당 ${sign}${r}%`;
  const g = goal ?? 'maintain';
  if (g === 'bulk') {
    if (r < 0.15) return { weeklyPct: r, days, tone: 'warn', message: `${head}. 체중이 안 늘어요. 하루 100~150kcal 더 먹어 봐요.` };
    if (r > 0.75) return { weeklyPct: r, days, tone: 'warn', message: `${head}. 너무 빨라요. 지방이 같이 붙고 있을 가능성이 커요. 하루 150kcal쯤 줄여요.` };
    return { weeklyPct: r, days, tone: 'ok', message: `${head}. 린벌크 속도로 딱 좋아요.` };
  }
  if (g === 'cut') {
    if (r > -0.25) return { weeklyPct: r, days, tone: 'warn', message: `${head}. 안 빠지고 있어요. 하루 150kcal 줄이거나 걷기를 더해요.` };
    if (r < -1.2) return { weeklyPct: r, days, tone: 'warn', message: `${head}. 너무 빨라요. 근육도 같이 빠져요. 조금 더 먹어요.` };
    return { weeklyPct: r, days, tone: 'ok', message: `${head}. 감량 속도가 좋아요.` };
  }
  if (Math.abs(r) > 0.35) {
    return {
      weeklyPct: r,
      days,
      tone: 'warn',
      message: r > 0 ? `${head}. 리컴프 중엔 체중이 거의 그대로여야 해요. 조금 줄여요.` : `${head}. 너무 빠지면 근육이 안 붙어요. 조금 더 먹어요.`,
    };
  }
  return { weeklyPct: r, days, tone: 'ok', message: `${head}. 체중은 그대로, 기록이 오르면 리컴프가 되고 있는 거예요.` };
}

/** 체중 대비 추정 1RM 배수 기준 (남 / 여). 대략적인 근력 표준이고, 자세·체급 따라 다르다 */
const STANDARDS: Record<string, { male: number[]; female: number[] }> = {
  // [초급, 중급, 상급] 경계
  'bench-press': { male: [0.75, 1.25, 1.75], female: [0.5, 0.75, 1.0] },
  squat: { male: [1.0, 1.5, 2.25], female: [0.75, 1.0, 1.5] },
  deadlift: { male: [1.25, 1.75, 2.5], female: [0.75, 1.25, 1.75] },
  'overhead-press': { male: [0.5, 0.75, 1.1], female: [0.35, 0.5, 0.7] },
  'barbell-row': { male: [0.75, 1.0, 1.5], female: [0.5, 0.7, 1.0] },
};

export const LEVEL_LABEL = ['입문', '초급', '중급', '상급'] as const;

/** 체중 대비 배수와 단계. 기준이 없는 종목은 null */
export function strengthLevel(exerciseId: string | undefined, e1rm: number, bodyweightKg: number, sex: Profile['sex']): { ratio: number; level: number; next: number | null } | null {
  if (!exerciseId || !STANDARDS[exerciseId] || e1rm <= 0 || bodyweightKg <= 0) return null;
  const bounds = STANDARDS[exerciseId][sex === 'female' ? 'female' : 'male'];
  const ratio = Math.round((e1rm / bodyweightKg) * 100) / 100;
  const level = bounds.filter((b) => ratio >= b).length;
  const next = level < bounds.length ? Math.round(bounds[level] * bodyweightKg) : null;
  return { ratio, level, next };
}

/** 체성분을 잰 지 오래됐는지 (90일) */
export function needsBodyCheck(logs: BodyLog[], now = Date.now()): boolean {
  const latest = latestBody(logs);
  return !!latest && now - latest.date > 90 * DAY;
}
