export type ExerciseKind = 'reps' | 'time';

/** normal: 본세트, warmup: 워밍업(기록·PR에서 제외), drop: 드롭세트, failure: 실패지점까지 */
export type SetType = 'normal' | 'warmup' | 'drop' | 'failure';

export interface SetPlan {
  type: SetType;
  reps: number;
  weightKg: number;
  durationSec: number;
}

/** 루틴에 저장되는 종목 계획 */
export interface RoutineExercise {
  id: string;
  /** 라이브러리 종목 id 또는 사용자 정의 종목 id */
  exerciseId?: string;
  name: string;
  kind: ExerciseKind;
  restSec: number;
  note?: string;
  sets: SetPlan[];
}

export interface Routine {
  id: string;
  name: string;
  note?: string;
  exercises: RoutineExercise[];
  updatedAt: number;
}

export interface SetLog extends SetPlan {
  done: boolean;
  completedAt?: number;
  /** 체감 난이도 6~10 (선택) */
  rpe?: number;
}

export interface ExerciseLog {
  id: string;
  exerciseId?: string;
  /** 어느 루틴 종목에서 왔는지 */
  templateId?: string;
  name: string;
  kind: ExerciseKind;
  restSec: number;
  note?: string;
  sets: SetLog[];
}

export interface RestTimer {
  endsAt: number;
  totalSec: number;
  /** 방금 끝낸 세트 위치 — 다음 세트 미리보기에 쓴다 */
  exIdx: number;
  setIdx: number;
}

export interface WorkTimer {
  endsAt: number;
  totalSec: number;
  exIdx: number;
  setIdx: number;
}

export interface Session {
  id: string;
  routineId?: string;
  routineName: string;
  startedAt: number;
  endedAt?: number;
  note?: string;
  exercises: ExerciseLog[];
}

export interface ActiveSession extends Session {
  rest: RestTimer | null;
  work: WorkTimer | null;
}

export interface CustomExercise {
  id: string;
  name: string;
  part: string;
  kind: ExerciseKind;
}

export interface Settings {
  sound: boolean;
  vibrate: boolean;
  /** 라이브러리에서 종목을 추가할 때 기본 휴식 시간 */
  defaultRestSec: number;
  /** 바벨 무게 (원판 계산기) */
  barKg: number;
  /** 주간 목표 운동 횟수 */
  weeklyGoal: number;
  /** 마지막으로 백업(내보내기)한 시각 */
  lastBackupAt?: number;
}

export interface AppState {
  version: 2;
  /** 첫 실행 질문(온보딩)을 마쳤는지 */
  onboarded: boolean;
  routines: Routine[];
  history: Session[];
  active: ActiveSession | null;
  customExercises: CustomExercise[];
  settings: Settings;
}
