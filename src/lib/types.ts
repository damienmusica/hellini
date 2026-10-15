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

/** 마지막 세트 뒤에 고르는 체감: 여유 있었음 / 적당했음 / 거의 한계였음 */
export type Effort = 'easy' | 'ok' | 'hard';

/** 종목을 바꾼 이유. place: 장소 프로필에 따라 시작할 때 자동으로 바뀜 */
export type SwapReason = 'missing' | 'busy' | 'prefer' | 'place';

/** 추천 엔진이 남긴 제안 이력 (같은 입력·버전이면 같은 결과) */
export interface Suggested {
  /** 알고리즘 버전 */
  v: number;
  code: string;
  label: string;
  /** 눌렀을 때 남은 본세트에 넣을 값. 없으면 안내만 */
  apply?: { field: 'weightKg'; value: number } | { field: 'reps'; values: number[]; weightKg?: number };
  /** 근거로 쓴 지난 기록의 세션 id */
  basedOn: string;
  applied?: boolean;
  dismissed?: boolean;
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
  effort?: Effort;
  suggested?: Suggested;
  /** 다른 종목 대신 들어왔으면 어디서 왔는지 */
  swap?: { from: string; reason: SwapReason };
}

export type Equipment = '바벨' | '덤벨' | '머신' | '케이블' | '맨몸' | '케틀벨' | '스미스' | '기타';

/** 장비 종류만으로는 모자란 필수 보조 장비 (벤치, 인클라인 벤치, 랙, 풀업바) */
export type Feature = '벤치' | '인클라인 벤치' | '랙' | '풀업바';

/** 운동하는 장소. 기본 장소(main)는 장비 제한이 없다 */
export interface Place {
  id: string;
  name: string;
  /** 있는 장비. 없으면 전부 있는 것으로 본다. 맨몸·기타는 항상 가능 */
  equipment?: Equipment[];
  /** 있는 보조 장비. 없으면 전부 있는 것으로 본다 (v3 이전 장소와 호환) */
  features?: Feature[];
  /** 이 장소에 기구가 없는 종목 id */
  unavailable: string[];
  /** 이 장소에서 시작할 때 자동으로 바꿀 종목: 원래 id → 대신할 id */
  swaps: Record<string, string>;
  /** 등록 없이 오늘만 쓰는 장소. 운동을 마치면 지운다 */
  temp?: boolean;
}

/** 세션에 남기는 장소 사본 (장소를 지우거나 이름을 바꿔도 기록은 그대로) */
export type SessionPlace = Pick<Place, 'id' | 'name' | 'equipment' | 'features'>;

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
  /** 없으면 기본 장소 */
  place?: SessionPlace;
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

/** 체성분 기록 (인바디 등). 날짜는 그날 0시 */
export interface BodyLog {
  id: string;
  date: number;
  weightKg: number;
  bodyFatPct?: number;
  skeletalMuscleKg?: number;
  waistCm?: number;
  note?: string;
}

/** 지금 단계의 목표. 영양 목표와 체중 추세 판단에 쓴다 (세트·무게 규칙은 바꾸지 않는다) */
export type Goal = 'recomp' | 'bulk' | 'cut' | 'maintain';

/** 모두 선택. 비어 있으면 그 기능만 꺼진다 */
export interface Profile {
  sex?: 'male' | 'female';
  birthYear?: number;
  heightCm?: number;
  goal?: Goal;
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
  /** 지금 고른 장소 id (places 중 하나) */
  placeId: string;
}

export interface AppState {
  version: 4;
  /** 첫 실행 질문(온보딩)을 마쳤는지 */
  onboarded: boolean;
  routines: Routine[];
  history: Session[];
  active: ActiveSession | null;
  customExercises: CustomExercise[];
  places: Place[];
  /** 최신순 */
  body: BodyLog[];
  profile: Profile;
  settings: Settings;
}
