import type { ExerciseLog, Session } from './types';

export function doneSets(session: Session): number {
  return session.exercises.reduce((n, e) => n + e.sets.filter((s) => s.done).length, 0);
}

export function totalSets(session: Session): number {
  return session.exercises.reduce((n, e) => n + e.sets.length, 0);
}

/** 볼륨 = 완료한 (무게 × 횟수)의 합. 맨몸·시간 종목은 0 */
export function sessionVolume(session: Session): number {
  return session.exercises.reduce(
    (sum, e) =>
      e.kind === 'reps' ? sum + e.sets.reduce((s, set) => (set.done ? s + set.weightKg * set.reps : s), 0) : sum,
    0,
  );
}

function sameName(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

/** history는 최신순. 같은 이름 종목의 가장 최근 기록 */
export function lastLogFor(history: Session[], name: string): ExerciseLog | undefined {
  for (const session of history) {
    const log = session.exercises.find((e) => sameName(e.name, name) && e.sets.some((s) => s.done));
    if (log) return log;
  }
  return undefined;
}

export function describeSets(log: ExerciseLog): string {
  const done = log.sets.filter((s) => s.done);
  if (log.kind === 'time') return done.map((s) => `${s.durationSec}초`).join(', ');
  return done.map((s) => (s.weightKg > 0 ? `${formatKg(s.weightKg)}×${s.reps}` : `${s.reps}회`)).join(', ');
}

export function formatKg(kg: number): string {
  return Number.isInteger(kg) ? `${kg}kg` : `${kg.toFixed(1)}kg`;
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

/** 이번 주(월요일 0시 기준) 운동 횟수 */
export function sessionsThisWeek(history: Session[], now: number): number {
  const d = new Date(now);
  const daysSinceMonday = (d.getDay() + 6) % 7;
  const monday = new Date(d.getFullYear(), d.getMonth(), d.getDate() - daysSinceMonday).getTime();
  return history.filter((s) => s.startedAt >= monday).length;
}

const dateFmt = new Intl.DateTimeFormat('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' });
const timeFmt = new Intl.DateTimeFormat('ko-KR', { hour: 'numeric', minute: '2-digit' });

export function formatDate(ts: number): string {
  return dateFmt.format(ts);
}

export function formatTime(ts: number): string {
  return timeFmt.format(ts);
}
