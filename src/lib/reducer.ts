import { uid } from './id';
import type {
  ActiveSession,
  AppState,
  CustomExercise,
  ExerciseKind,
  ExerciseLog,
  Routine,
  RoutineExercise,
  Session,
  SetLog,
  SetPlan,
  Settings,
} from './types';

export type SetPatch = Partial<Pick<SetLog, 'type' | 'reps' | 'weightKg' | 'durationSec' | 'rpe'>>;

export interface NewExercise {
  exerciseId?: string;
  name: string;
  kind: ExerciseKind;
  restSec: number;
  sets: SetPlan[];
}

export type Action =
  | { type: 'routine/save'; routine: Routine }
  | { type: 'routine/delete'; id: string }
  | { type: 'routine/addMany'; routines: Routine[] }
  | { type: 'onboarding/complete'; routines: Routine[]; weeklyGoal: number }
  | { type: 'session/start'; routine: Routine | null; now: number }
  | { type: 'session/finish'; now: number; updateRoutine: boolean }
  | { type: 'session/discard' }
  | { type: 'exercise/add'; exercise: NewExercise }
  | { type: 'exercise/replace'; exIdx: number; exercise: Omit<NewExercise, 'sets' | 'restSec'> }
  | { type: 'exercise/remove'; exIdx: number }
  | { type: 'exercise/move'; exIdx: number; dir: -1 | 1 }
  | { type: 'exercise/update'; exIdx: number; patch: Partial<Pick<ExerciseLog, 'restSec' | 'note'>> }
  /** 남은 본세트 전체의 무게·횟수를 한 값으로 (증량 제안 적용) */
  | { type: 'exercise/setAll'; exIdx: number; field: 'weightKg' | 'reps'; value: number }
  | { type: 'set/update'; exIdx: number; setIdx: number; patch: SetPatch }
  | { type: 'set/complete'; exIdx: number; setIdx: number; now: number }
  | { type: 'set/undo'; exIdx: number; setIdx: number }
  | { type: 'set/add'; exIdx: number }
  | { type: 'set/remove'; exIdx: number; setIdx: number }
  | { type: 'set/insertWarmups'; exIdx: number; sets: SetPlan[] }
  | { type: 'rest/adjust'; deltaSec: number; now: number }
  | { type: 'rest/clear' }
  | { type: 'work/start'; exIdx: number; setIdx: number; now: number }
  | { type: 'work/cancel' }
  | { type: 'history/delete'; id: string }
  | { type: 'custom/add'; exercise: CustomExercise }
  | { type: 'settings/update'; patch: Partial<Settings> }
  | { type: 'state/replace'; state: AppState };

/** 횟수 ↔ 시간 종목으로 바꿀 때 비어 있는 값을 기본값으로 채운다 */
export function fitSetToKind<T extends SetPlan>(s: T, kind: ExerciseKind): T {
  if (kind === 'time' && s.durationSec <= 0) return { ...s, durationSec: 30 };
  if (kind === 'reps' && s.reps <= 0) return { ...s, reps: 10 };
  return s;
}

export function logSet(plan: SetPlan): SetLog {
  return { type: plan.type, reps: plan.reps, weightKg: plan.weightKg, durationSec: plan.durationSec, done: false };
}

const FALLBACK_SET: SetPlan = { type: 'normal', reps: 10, weightKg: 0, durationSec: 30 };

function fromRoutineExercise(t: RoutineExercise): ExerciseLog {
  return {
    id: uid(),
    exerciseId: t.exerciseId,
    templateId: t.id,
    name: t.name,
    kind: t.kind,
    restSec: t.restSec,
    note: t.note,
    sets: (t.sets.length > 0 ? t.sets : [FALLBACK_SET]).map(logSet),
  };
}

export function buildSession(routine: Routine | null, now: number): ActiveSession {
  return {
    id: uid(),
    routineId: routine?.id,
    routineName: routine?.name ?? '자유 운동',
    startedAt: now,
    rest: null,
    work: null,
    exercises: routine ? routine.exercises.map(fromRoutineExercise) : [],
  };
}

/** (exIdx, setIdx) 다음으로 할 미완료 세트. 같은 종목을 먼저, 그다음 종목 순서대로 */
export function nextPendingSet(exercises: ExerciseLog[], exIdx: number, setIdx: number): { exIdx: number; setIdx: number } | null {
  const same = exercises[exIdx]?.sets.findIndex((s, i) => i > setIdx && !s.done) ?? -1;
  if (same !== -1) return { exIdx, setIdx: same };
  for (let k = 1; k <= exercises.length; k++) {
    const i = (exIdx + k) % exercises.length;
    const j = exercises[i].sets.findIndex((s) => !s.done);
    if (j !== -1) return { exIdx: i, setIdx: j };
  }
  return null;
}

/** 루틴을 이번 세션 내용으로 갱신 (종목 구성·세트 수·무게·횟수). 완료 안 한 종목은 루틴 계획 유지 */
export function applySessionToRoutine(routine: Routine, session: Session, now: number): Routine {
  const exercises: RoutineExercise[] = [];
  for (const log of session.exercises) {
    const prev = routine.exercises.find((t) => t.id === log.templateId);
    const done = log.sets.filter((s) => s.done);
    if (done.length === 0) {
      if (prev) exercises.push(prev);
      continue;
    }
    // 오늘 한 세트 + (계획보다 덜 했으면) 남은 계획 세트를 오늘 본세트 무게로
    const lastNormal = done.filter((s) => s.type === 'normal').at(-1);
    const rest = (prev?.sets ?? []).slice(done.length).map((p) =>
      p.type === 'normal' && lastNormal ? { ...p, weightKg: lastNormal.weightKg } : { ...p },
    );
    exercises.push({
      id: prev?.id ?? uid(),
      exerciseId: log.exerciseId,
      name: log.name,
      kind: log.kind,
      restSec: log.restSec,
      note: prev?.note,
      sets: [...done.map(({ type, reps, weightKg, durationSec }) => ({ type, reps, weightKg, durationSec })), ...rest],
    });
  }
  return { ...routine, exercises, updatedAt: now };
}

/** 루틴과 비교해 이번 세션에서 계획이 달라졌는지 (무게·횟수·세트 수·종목) */
export function sessionDiffersFromRoutine(routine: Routine, session: Session): boolean {
  const updated = applySessionToRoutine(routine, session, routine.updatedAt);
  const strip = (r: Routine) =>
    JSON.stringify(r.exercises.map((e) => [e.name, e.restSec, e.sets.map((s) => [s.type, s.reps, s.weightKg, s.durationSec])]));
  return strip(updated) !== strip(routine);
}

function withActive(state: AppState, fn: (a: ActiveSession) => ActiveSession): AppState {
  return state.active ? { ...state, active: fn(state.active) } : state;
}

function mapExercise(a: ActiveSession, exIdx: number, fn: (e: ExerciseLog) => ExerciseLog): ActiveSession {
  return { ...a, exercises: a.exercises.map((e, i) => (i === exIdx ? fn(e) : e)) };
}

/** 세트 위치가 바뀌는 편집(삭제·이동) 후에는 진행 중인 타이머를 정리한다 */
function clearTimers(a: ActiveSession): ActiveSession {
  return { ...a, rest: null, work: null };
}

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'routine/save': {
      const exists = state.routines.some((r) => r.id === action.routine.id);
      const routines = exists
        ? state.routines.map((r) => (r.id === action.routine.id ? action.routine : r))
        : [...state.routines, action.routine];
      return { ...state, routines };
    }

    case 'routine/delete':
      return { ...state, routines: state.routines.filter((r) => r.id !== action.id) };

    case 'routine/addMany':
      return { ...state, routines: [...state.routines, ...action.routines] };

    case 'onboarding/complete':
      return {
        ...state,
        onboarded: true,
        routines: [...state.routines, ...action.routines],
        settings: { ...state.settings, weeklyGoal: action.weeklyGoal },
      };

    case 'session/start':
      if (state.active) return state;
      return { ...state, active: buildSession(action.routine, action.now) };

    case 'session/finish': {
      const a = state.active;
      if (!a) return state;
      const exercises = a.exercises
        .map((e) => ({ ...e, sets: e.sets.filter((s) => s.done) }))
        .filter((e) => e.sets.length > 0);
      const session: Session = {
        id: a.id,
        routineId: a.routineId,
        routineName: a.routineName,
        startedAt: a.startedAt,
        endedAt: action.now,
        note: a.note,
        exercises,
      };
      const routines =
        action.updateRoutine && a.routineId
          ? state.routines.map((r) => (r.id === a.routineId ? applySessionToRoutine(r, a, action.now) : r))
          : state.routines;
      return {
        ...state,
        active: null,
        routines,
        history: exercises.length > 0 ? [session, ...state.history] : state.history,
      };
    }

    case 'session/discard':
      return { ...state, active: null };

    case 'exercise/add':
      return withActive(state, (a) => ({
        ...a,
        exercises: [
          ...a.exercises,
          {
            id: uid(),
            exerciseId: action.exercise.exerciseId,
            name: action.exercise.name,
            kind: action.exercise.kind,
            restSec: action.exercise.restSec,
            sets: action.exercise.sets.map(logSet),
          },
        ],
      }));

    case 'exercise/replace':
      return withActive(state, (a) =>
        mapExercise(a, action.exIdx, (e) => ({
          ...e,
          exerciseId: action.exercise.exerciseId,
          name: action.exercise.name,
          kind: action.exercise.kind,
          sets: e.sets.map((s) => fitSetToKind(s, action.exercise.kind)),
        })),
      );

    case 'exercise/remove':
      return withActive(state, (a) => clearTimers({ ...a, exercises: a.exercises.filter((_, i) => i !== action.exIdx) }));

    case 'exercise/move':
      return withActive(state, (a) => {
        const j = action.exIdx + action.dir;
        if (j < 0 || j >= a.exercises.length) return a;
        const exercises = [...a.exercises];
        [exercises[action.exIdx], exercises[j]] = [exercises[j], exercises[action.exIdx]];
        return clearTimers({ ...a, exercises });
      });

    case 'exercise/update':
      return withActive(state, (a) => mapExercise(a, action.exIdx, (e) => ({ ...e, ...action.patch })));

    case 'exercise/setAll':
      return withActive(state, (a) =>
        mapExercise(a, action.exIdx, (e) => ({
          ...e,
          sets: e.sets.map((s) => (!s.done && s.type === 'normal' ? { ...s, [action.field]: action.value } : s)),
        })),
      );

    case 'set/update':
      // 무게·횟수를 바꾸면, 뒤에 남은 같은 종류 세트 중 원래 값이 같던 세트도 함께 바꾼다
      return withActive(state, (a) =>
        mapExercise(a, action.exIdx, (e) => {
          const target = e.sets[action.setIdx];
          if (!target) return e;
          return {
            ...e,
            sets: e.sets.map((s, i) => {
              if (i === action.setIdx) return { ...s, ...action.patch };
              if (i < action.setIdx || s.done || s.type !== target.type) return s;
              const follow: SetPatch = {};
              for (const key of ['weightKg', 'reps', 'durationSec'] as const) {
                const v = action.patch[key];
                if (v !== undefined && s[key] === target[key]) follow[key] = v;
              }
              return { ...s, ...follow };
            }),
          };
        }),
      );

    case 'set/complete':
      return withActive(state, (a) => {
        const ex = a.exercises[action.exIdx];
        const set = ex?.sets[action.setIdx];
        if (!set || set.done) return a;
        const next = mapExercise(a, action.exIdx, (e) => ({
          ...e,
          sets: e.sets.map((s, i) => (i === action.setIdx ? { ...s, done: true, completedAt: action.now } : s)),
        }));
        const following = nextPendingSet(next.exercises, action.exIdx, action.setIdx);
        // 드롭세트 직전에는 쉬지 않는다
        const beforeDrop =
          following !== null &&
          following.exIdx === action.exIdx &&
          next.exercises[action.exIdx].sets[following.setIdx].type === 'drop';
        const rest =
          following && !beforeDrop && ex.restSec > 0
            ? { endsAt: action.now + ex.restSec * 1000, totalSec: ex.restSec, exIdx: action.exIdx, setIdx: action.setIdx }
            : null;
        return { ...next, rest, work: null };
      });

    case 'set/undo':
      return withActive(state, (a) =>
        mapExercise(a, action.exIdx, (e) => ({
          ...e,
          sets: e.sets.map((s, i) => (i === action.setIdx ? { ...s, done: false, completedAt: undefined } : s)),
        })),
      );

    case 'set/add':
      return withActive(state, (a) =>
        mapExercise(a, action.exIdx, (e) => {
          const last = e.sets.filter((s) => s.type !== 'warmup').at(-1) ?? e.sets.at(-1);
          const plan: SetPlan = last
            ? { type: last.type === 'warmup' ? 'normal' : last.type, reps: last.reps, weightKg: last.weightKg, durationSec: last.durationSec }
            : { type: 'normal', reps: 10, weightKg: 0, durationSec: 30 };
          return { ...e, sets: [...e.sets, logSet(plan)] };
        }),
      );

    case 'set/remove':
      return withActive(state, (a) =>
        clearTimers(mapExercise(a, action.exIdx, (e) => ({ ...e, sets: e.sets.filter((_, i) => i !== action.setIdx) }))),
      );

    case 'set/insertWarmups':
      return withActive(state, (a) =>
        clearTimers(
          mapExercise(a, action.exIdx, (e) => ({
            ...e,
            sets: [...action.sets.map(logSet), ...e.sets.filter((s) => s.type !== 'warmup' || s.done)],
          })),
        ),
      );

    case 'rest/adjust':
      return withActive(state, (a) => {
        if (!a.rest) return a;
        const endsAt = a.rest.endsAt + action.deltaSec * 1000;
        if (endsAt <= action.now) return { ...a, rest: null };
        return { ...a, rest: { ...a.rest, endsAt, totalSec: Math.max(1, a.rest.totalSec + action.deltaSec) } };
      });

    case 'rest/clear':
      return withActive(state, (a) => ({ ...a, rest: null }));

    case 'work/start':
      return withActive(state, (a) => {
        const set = a.exercises[action.exIdx]?.sets[action.setIdx];
        if (!set || set.done || set.durationSec <= 0) return a;
        return {
          ...a,
          rest: null,
          work: { exIdx: action.exIdx, setIdx: action.setIdx, endsAt: action.now + set.durationSec * 1000, totalSec: set.durationSec },
        };
      });

    case 'work/cancel':
      return withActive(state, (a) => ({ ...a, work: null }));

    case 'history/delete':
      return { ...state, history: state.history.filter((s) => s.id !== action.id) };

    case 'custom/add':
      return { ...state, customExercises: [...state.customExercises, action.exercise] };

    case 'settings/update':
      return { ...state, settings: { ...state.settings, ...action.patch } };

    case 'state/replace':
      return action.state;
  }
}
