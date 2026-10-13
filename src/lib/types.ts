export type ExerciseKind = 'reps' | 'time';

/** 루틴에 저장되는 종목 계획 */
export interface ExerciseTemplate {
  id: string;
  name: string;
  kind: ExerciseKind;
  sets: number;
  /** kind === 'reps'일 때 목표 횟수 */
  reps: number;
  /** kind === 'time'일 때 목표 시간(초) */
  durationSec: number;
  /** 0이면 맨몸 */
  weightKg: number;
  restSec: number;
}

export interface Routine {
  id: string;
  name: string;
  exercises: ExerciseTemplate[];
  updatedAt: number;
}

export interface SetLog {
  reps: number;
  weightKg: number;
  durationSec: number;
  done: boolean;
  completedAt?: number;
}

export interface ExerciseLog {
  id: string;
  templateId?: string;
  name: string;
  kind: ExerciseKind;
  restSec: number;
  sets: SetLog[];
}

export interface Countdown {
  endsAt: number;
  totalSec: number;
}

export interface Session {
  id: string;
  routineId?: string;
  routineName: string;
  startedAt: number;
  endedAt?: number;
  exercises: ExerciseLog[];
}

export interface ActiveSession extends Session {
  /** 지금 진행 중인 종목 인덱스 */
  focus: number;
  /** 세트 사이 휴식 타이머 */
  rest: Countdown | null;
  /** 시간 기반 세트(플랭크 등) 진행 타이머 */
  work: (Countdown & { exIdx: number; setIdx: number }) | null;
}

export interface Settings {
  sound: boolean;
  vibrate: boolean;
}

export interface AppState {
  version: 1;
  routines: Routine[];
  history: Session[];
  active: ActiveSession | null;
  settings: Settings;
}
