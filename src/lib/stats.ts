import { findExercise, type BodyPart } from '../data/exercises';
import type { ExerciseLog, Routine, Session, SetLog } from './types';

const DAY = 86_400_000;

export function isWorkingSet(s: SetLog): boolean {
  return s.done && s.type !== 'warmup';
}

/** 완료한 본세트 수 (워밍업 제외) */
export function doneSets(session: Session): number {
  return session.exercises.reduce((n, e) => n + e.sets.filter(isWorkingSet).length, 0);
}

export function totalSets(session: Session): number {
  return session.exercises.reduce((n, e) => n + e.sets.filter((s) => s.type !== 'warmup').length, 0);
}

/** 볼륨 = 완료한 본세트의 (무게 × 횟수) 합 */
export function exerciseVolume(e: ExerciseLog): number {
  if (e.kind !== 'reps') return 0;
  return e.sets.reduce((sum, s) => (isWorkingSet(s) ? sum + s.weightKg * s.reps : sum), 0);
}

export function sessionVolume(session: Session): number {
  return session.exercises.reduce((sum, e) => sum + exerciseVolume(e), 0);
}

export function sessionDuration(session: Session): number {
  return (session.endedAt ?? session.startedAt) - session.startedAt;
}

export function logKey(e: { exerciseId?: string; name: string }): string {
  return e.exerciseId ?? e.name.trim().toLowerCase();
}

/** history는 최신순. 같은 종목의 가장 최근 기록 */
export function lastLogFor(history: Session[], e: { exerciseId?: string; name: string }): ExerciseLog | undefined {
  const key = logKey(e);
  for (const session of history) {
    const log = session.exercises.find((x) => logKey(x) === key && x.sets.some((s) => s.done));
    if (log) return log;
  }
  return undefined;
}

export function formatSet(kind: ExerciseLog['kind'], s: Pick<SetLog, 'weightKg' | 'reps' | 'durationSec'>): string {
  if (kind === 'time') return `${s.durationSec}초`;
  return s.weightKg > 0 ? `${trimKg(s.weightKg)}kg × ${s.reps}` : `${s.reps}회`;
}

export function describeSets(log: ExerciseLog): string {
  return log.sets
    .filter(isWorkingSet)
    .map((s) => formatSet(log.kind, s))
    .join(', ');
}

/** 가장 좋은 세트 (무게 → 횟수 순) */
export function bestSet(log: ExerciseLog): SetLog | undefined {
  return log.sets
    .filter(isWorkingSet)
    .reduce<SetLog | undefined>((best, s) => {
      if (!best) return s;
      if (log.kind === 'time') return s.durationSec > best.durationSec ? s : best;
      if (s.weightKg !== best.weightKg) return s.weightKg > best.weightKg ? s : best;
      return s.reps > best.reps ? s : best;
    }, undefined);
}

export function trimKg(kg: number): string {
  return Number.isInteger(kg) ? String(kg) : String(Math.round(kg * 100) / 100);
}

export function formatVolume(kg: number): string {
  return `${Math.round(kg).toLocaleString('ko-KR')}kg`;
}

/** 52분, 1시간 5분 */
export function formatDuration(ms: number): string {
  const min = Math.max(0, Math.round(ms / 60000));
  if (min < 60) return `${min}분`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h}시간` : `${h}시간 ${m}분`;
}

/** 월요일 0시 */
export function weekStart(ts: number): number {
  const d = new Date(ts);
  const daysSinceMonday = (d.getDay() + 6) % 7;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - daysSinceMonday).getTime();
}

export function dayStart(ts: number): number {
  const d = new Date(ts);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

export function sessionsThisWeek(history: Session[], now: number): number {
  const start = weekStart(now);
  return history.filter((s) => s.startedAt >= start).length;
}

/** 이번 주 월~일 각 날짜에 운동했는지 */
export function weekDays(history: Session[], now: number): { date: number; done: boolean; today: boolean }[] {
  const start = weekStart(now);
  const today = dayStart(now);
  const days = new Set(history.map((s) => dayStart(s.startedAt)));
  return Array.from({ length: 7 }, (_, i) => {
    const date = new Date(start).setDate(new Date(start).getDate() + i);
    return { date, done: days.has(date), today: date === today };
  });
}

/** 연속 운동 주: 매주 1회 이상. 이번 주는 아직 진행 중이라 안 했어도 끊긴 걸로 보지 않는다 */
export function weekStreak(history: Session[], now: number): number {
  const weeks = new Set(history.map((s) => weekStart(s.startedAt)));
  let cursor = weekStart(now);
  let streak = 0;
  if (!weeks.has(cursor)) cursor = weekStart(cursor - DAY);
  while (weeks.has(cursor)) {
    streak++;
    cursor = weekStart(cursor - DAY);
  }
  return streak;
}

/** 마지막으로 한 루틴의 다음 루틴 (루틴 목록 순서대로 돌아가며) */
export function nextRoutine(routines: Routine[], history: Session[]): Routine | undefined {
  if (routines.length === 0) return undefined;
  const last = history.find((s) => s.routineId && routines.some((r) => r.id === s.routineId));
  if (!last) return routines[0];
  const i = routines.findIndex((r) => r.id === last.routineId);
  return routines[(i + 1) % routines.length];
}

/** 부위별 마지막 운동일로부터 지난 날 수 */
export function daysSinceByPart(history: Session[], now: number): Map<BodyPart, number> {
  const map = new Map<BodyPart, number>();
  const today = dayStart(now);
  for (const session of history) {
    for (const e of session.exercises) {
      const info = findExercise(e.exerciseId ?? e.name);
      if (!info || !e.sets.some(isWorkingSet)) continue;
      const days = Math.round((today - dayStart(session.startedAt)) / DAY);
      const prev = map.get(info.part);
      if (prev === undefined || days < prev) map.set(info.part, days);
    }
  }
  return map;
}

/** 최근 n주 주별 볼륨·운동 횟수 (오래된 주부터) */
export function weeklySeries(history: Session[], weeks: number, now: number): { start: number; volume: number; sessions: number; sets: number }[] {
  const current = weekStart(now);
  const out = Array.from({ length: weeks }, (_, i) => {
    const start = weekStart(current - (weeks - 1 - i) * 7 * DAY + DAY);
    return { start, volume: 0, sessions: 0, sets: 0 };
  });
  const index = new Map(out.map((w, i) => [w.start, i]));
  for (const s of history) {
    const i = index.get(weekStart(s.startedAt));
    if (i === undefined) continue;
    out[i].volume += sessionVolume(s);
    out[i].sessions += 1;
    out[i].sets += doneSets(s);
  }
  return out;
}

/** 날짜(0시 기준)별 운동 횟수 */
export function sessionsByDay(history: Session[]): Map<number, number> {
  const map = new Map<number, number>();
  for (const s of history) {
    const d = dayStart(s.startedAt);
    map.set(d, (map.get(d) ?? 0) + 1);
  }
  return map;
}

const dateFmt = new Intl.DateTimeFormat('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' });
const timeFmt = new Intl.DateTimeFormat('ko-KR', { hour: 'numeric', minute: '2-digit' });

export function formatDate(ts: number): string {
  return dateFmt.format(ts);
}

export function formatTime(ts: number): string {
  return timeFmt.format(ts);
}

/** 10/12 */
export function formatShortDate(ts: number): string {
  const d = new Date(ts);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export function relativeDay(ts: number, now: number): string {
  const days = Math.round((dayStart(now) - dayStart(ts)) / DAY);
  if (days === 0) return '오늘';
  if (days === 1) return '어제';
  if (days < 7) return `${days}일 전`;
  return formatShortDate(ts);
}
