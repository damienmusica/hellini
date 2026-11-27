import { roleOf, type Role } from '../data/exercises';
import { bodyTrend } from './body';
import { sessionPRs } from './records';
import { formatVolume, isWorkingSet, nextRoutine, sessionVolume, weekStart, weekStreak } from './stats';
import type { BodyLog, Goal, Routine, Session } from './types';

/**
 * 주간 리뷰 (규칙 기반, 결정적). 실제로 충족한 조건만 문장으로 만들고, 쉰 날을 처벌하지 않는다.
 * 근거는 기록(세션·세트·PR)과 체중 추세뿐이다. 센서나 점수를 지어내지 않는다.
 */
export const REVIEW_VERSION = 1;

const DAY = 86_400_000;
const WEEK = 7 * DAY;

export type Group = 'push' | 'pull' | 'legs' | 'core';
export const GROUP_LABEL: Record<Group, string> = { push: '밀기', pull: '당기기', legs: '하체', core: '코어' };

const GROUP_OF: Partial<Record<Role, Group>> = {
  'horizontal-press': 'push',
  'incline-press': 'push',
  'chest-fly': 'push',
  dip: 'push',
  'vertical-press': 'push',
  'lateral-raise': 'push',
  'front-raise': 'push',
  'elbow-extension': 'push',
  'vertical-pull': 'pull',
  'horizontal-pull': 'pull',
  'rear-delt': 'pull',
  shrug: 'pull',
  'elbow-flexion': 'pull',
  squat: 'legs',
  'single-leg': 'legs',
  'knee-extension': 'legs',
  'knee-flexion': 'legs',
  hinge: 'legs',
  'hip-thrust': 'legs',
  'hip-abduction': 'legs',
  'hip-adduction': 'legs',
  calf: 'legs',
  'core-stability': 'core',
  'core-flexion': 'core',
  'core-rotation': 'core',
};

/** 밀기·당기기·하체·코어별 완료 본세트 수 */
export function groupSets(sessions: Session[]): Record<Group, number> {
  const out: Record<Group, number> = { push: 0, pull: 0, legs: 0, core: 0 };
  for (const s of sessions) {
    for (const e of s.exercises) {
      const role = roleOf(e.exerciseId);
      const g = role ? GROUP_OF[role] : undefined;
      if (!g) continue;
      out[g] += e.sets.filter(isWorkingSet).length;
    }
  }
  return out;
}

export type ReviewCode = 'goal-met' | 'goal-short' | 'no-session' | 'volume' | 'prs' | 'balance' | 'streak' | 'body' | 'next';

export interface ReviewLine {
  code: ReviewCode;
  tone: 'ok' | 'warn' | 'info';
  text: string;
}

export interface WeeklyReview {
  v: number;
  /** 리뷰 대상 주의 월요일 0시 */
  weekStart: number;
  weekEnd: number;
  sessions: number;
  prevSessions: number;
  goal: number;
  volume: number;
  prevVolume: number;
  prs: number;
  sets: Record<Group, number>;
  lines: ReviewLine[];
}

interface Input {
  history: Session[];
  routines: Routine[];
  goal: number;
  body?: BodyLog[];
  bodyGoal?: Goal;
  now: number;
  /** last: 지난 주(기본), this: 이번 주 지금까지 */
  week?: 'last' | 'this';
}

/** 밀기·당기기·하체 중 하나가 가장 많은 쪽의 절반 아래면 알려준다 (총 15세트 이상일 때만) */
function balanceLine(sets: Record<Group, number>): ReviewLine | null {
  const main: Group[] = ['push', 'pull', 'legs'];
  const total = main.reduce((n, g) => n + sets[g], 0);
  if (total < 15) return null;
  const max = main.reduce((a, b) => (sets[a] >= sets[b] ? a : b));
  const min = main.reduce((a, b) => (sets[a] <= sets[b] ? a : b));
  if (sets[min] * 2 >= sets[max]) return null;
  return {
    code: 'balance',
    tone: 'warn',
    text: `${GROUP_LABEL[min]} ${sets[min]}세트 vs ${GROUP_LABEL[max]} ${sets[max]}세트. 다음 주엔 ${GROUP_LABEL[min]} 날을 먼저 잡으면 균형이 맞아요.`,
  };
}

export function weeklyReview(input: Input): WeeklyReview | null {
  const { history, routines, goal, body = [], bodyGoal, now } = input;
  if (history.length === 0) return null;
  const thisStart = weekStart(now);
  const start = input.week === 'this' ? thisStart : weekStart(thisStart - DAY);
  const end = start + WEEK;
  const inWeek = history.filter((s) => s.startedAt >= start && s.startedAt < end);
  const prev = history.filter((s) => s.startedAt >= start - WEEK && s.startedAt < start);
  const sessions = inWeek.length;
  const volume = inWeek.reduce((n, s) => n + sessionVolume(s), 0);
  const prevVolume = prev.reduce((n, s) => n + sessionVolume(s), 0);
  const prs = inWeek.reduce((n, s) => n + sessionPRs(s, history).length, 0);
  const sets = groupSets(inWeek);
  const lines: ReviewLine[] = [];

  if (sessions === 0) {
    lines.push({
      code: 'no-session',
      tone: 'info',
      text: input.week === 'this' ? '이번 주는 아직 기록이 없어요.' : '지난 주는 기록이 없어요. 이번 주는 1회부터 시작해요.',
    });
  } else if (sessions >= goal) {
    lines.push({ code: 'goal-met', tone: 'ok', text: `주 ${goal}회 목표를 채웠어요 (${sessions}회).` });
  } else {
    lines.push({
      code: 'goal-short',
      tone: 'info',
      text: input.week === 'this' ? `목표 ${goal}회 중 ${sessions}회 했어요.` : `목표 ${goal}회 중 ${sessions}회 했어요. 빠진 날은 실패가 아니라 다음 주 첫 운동 자리예요.`,
    });
  }

  if (sessions > 0) {
    if (prev.length > 0 && prevVolume > 0) {
      const pct = Math.round(((volume - prevVolume) / prevVolume) * 100);
      if (pct >= 15) lines.push({ code: 'volume', tone: 'ok', text: `볼륨 ${formatVolume(volume)} · 전주 대비 +${pct}%` });
      else if (pct <= -15)
        lines.push({
          code: 'volume',
          tone: 'info',
          text: `볼륨 ${formatVolume(volume)} · 전주 대비 ${pct}%${sessions < prev.length ? ` (운동 ${sessions}회 vs ${prev.length}회)` : ''}`,
        });
      else lines.push({ code: 'volume', tone: 'info', text: `볼륨 ${formatVolume(volume)} · 전주와 비슷해요 (${pct >= 0 ? '+' : ''}${pct}%)` });
    }
    // 전주 기록이 없으면 볼륨은 위 숫자 행만으로 충분하다 (같은 숫자를 두 번 보여주지 않는다)
    if (prs > 0) lines.push({ code: 'prs', tone: 'ok', text: `새 기록 ${prs}개` });
    const bal = balanceLine(sets);
    if (bal) lines.push(bal);
  }

  const streak = weekStreak(history, input.week === 'this' ? now : end - 1);
  if (streak >= 2) lines.push({ code: 'streak', tone: 'ok', text: `${streak}주 연속 운동 중` });

  const trend = bodyTrend(body, bodyGoal, now);
  if (trend) lines.push({ code: 'body', tone: trend.tone, text: trend.message });

  const next = nextRoutine(routines, history);
  if (next) lines.push({ code: 'next', tone: 'info', text: `다음 차례 · ${next.name}` });

  return { v: REVIEW_VERSION, weekStart: start, weekEnd: end, sessions, prevSessions: prev.length, goal, volume, prevVolume, prs, sets, lines };
}

/** 홈에 지난 주 리뷰를 띄울지: 지난 주나 그 전주에 기록이 있고(첫 주부터 "기록 없음"을 보여주지 않게), 이번 주에 아직 안 봤을 때 */
export function shouldShowReview(review: WeeklyReview | null, seenWeek: number | undefined): boolean {
  if (!review) return false;
  if (seenWeek === review.weekStart) return false;
  return review.sessions > 0 || review.prevSessions > 0;
}
