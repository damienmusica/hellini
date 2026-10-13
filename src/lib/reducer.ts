import { uid } from './id';
import type {
  ActiveSession,
  AppState,
  ExerciseKind,
  ExerciseLog,
  Routine,
  Session,
  SetLog,
  Settings,
} from './types';

type SetPatch = Partial<Pick<SetLog, 'reps' | 'weightKg' | 'durationSec'>>;

export type Action =
  | { type: 'routine/save'; routine: Routine }
  | { type: 'routine/delete'; id: string }
  | { type: 'session/start'; routine: Routine; now: number }
  | { type: 'session/focus'; exIdx: number }
  | { type: 'session/finish'; now: number; updateRoutine: boolean }
  | { type: 'session/discard' }
  /** cascade: 같은 종목의 뒤에 남은(미완료) 세트에도 같은 값 적용 */
  | { type: 'set/update'; exIdx: number; setIdx: number; patch: SetPatch; cascade?: boolean }
  | { type: 'set/complete'; exIdx: number; setIdx: number; now: number }
  | { type: 'set/undo'; exIdx: number; setIdx: number }
  | { type: 'set/add'; exIdx: number }
  | { type: 'set/remove'; exIdx: number }
  | { type: 'exercise/add'; name: string; kind: ExerciseKind }
  | { type: 'rest/adjust'; deltaSec: number; now: number }
  | { type: 'rest/clear' }
  | { type: 'work/start'; exIdx: number; setIdx: number; now: number }
  | { type: 'work/cancel' }
  | { type: 'history/delete'; id: string }
  | { type: 'settings/update'; patch: Partial<Settings> }
  | { type: 'state/replace'; state: AppState };

function newSet(plan: Pick<SetLog, 'reps' | 'weightKg' | 'durationSec'>): SetLog {
  return { reps: plan.reps, weightKg: plan.weightKg, durationSec: plan.durationSec, done: false };
}

export function buildSession(routine: Routine, now: number): ActiveSession {
  return {
    id: uid(),
    routineId: routine.id,
    routineName: routine.name,
    startedAt: now,
    focus: 0,
    rest: null,
    work: null,
    exercises: routine.exercises.map((t) => ({
      id: uid(),
      templateId: t.id,
      name: t.name,
      kind: t.kind,
      restSec: t.restSec,
      sets: Array.from({ length: Math.max(1, t.sets) }, () => newSet(t)),
    })),
  };
}

/** 첫 번째 미완료 세트 인덱스, 없으면 -1 */
export function currentSetIndex(ex: ExerciseLog): number {
  return ex.sets.findIndex((s) => !s.done);
}

/** from 다음 종목부터 한 바퀴 돌며 미완료 세트가 남은 종목을 찾는다 */
export function nextIncomplete(exercises: ExerciseLog[], from: number): number {
  for (let k = 1; k <= exercises.length; k++) {
    const i = (from + k) % exercises.length;
    if (currentSetIndex(exercises[i]) !== -1) return i;
  }
  return -1;
}

/** 루틴의 기본 무게를 이번 세션의 마지막 완료 세트 무게로 바꾼다 */
export function applySessionToRoutine(routine: Routine, session: Session, now: number): Routine {
  return {
    ...routine,
    updatedAt: now,
    exercises: routine.exercises.map((t) => {
      const log = session.exercises.find((e) => e.templateId === t.id);
      const last = log?.sets.filter((s) => s.done).at(-1);
      return last && t.kind === 'reps' ? { ...t, weightKg: last.weightKg } : t;
    }),
  };
}

function withActive(state: AppState, fn: (a: ActiveSession) => ActiveSession): AppState {
  return state.active ? { ...state, active: fn(state.active) } : state;
}

function mapExercise(a: ActiveSession, exIdx: number, fn: (e: ExerciseLog) => ExerciseLog): ActiveSession {
  return { ...a, exercises: a.exercises.map((e, i) => (i === exIdx ? fn(e) : e)) };
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

    case 'session/start':
      if (state.active) return state;
      return { ...state, active: buildSession(action.routine, action.now) };

    case 'session/focus':
      return withActive(state, (a) =>
        action.exIdx >= 0 && action.exIdx < a.exercises.length ? { ...a, focus: action.exIdx } : a,
      );

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
        exercises,
      };
      const routines =
        action.updateRoutine && a.routineId
          ? state.routines.map((r) => (r.id === a.routineId ? applySessionToRoutine(r, session, action.now) : r))
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

    case 'set/update':
      return withActive(state, (a) =>
        mapExercise(a, action.exIdx, (e) => ({
          ...e,
          sets: e.sets.map((s, i) =>
            i === action.setIdx || (action.cascade && i > action.setIdx && !s.done) ? { ...s, ...action.patch } : s,
          ),
        })),
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
        const exerciseDone = currentSetIndex(next.exercises[action.exIdx]) === -1;
        const following = exerciseDone ? nextIncomplete(next.exercises, action.exIdx) : action.exIdx;
        const anyLeft = following !== -1;
        return {
          ...next,
          focus: anyLeft ? following : action.exIdx,
          rest: anyLeft && ex.restSec > 0 ? { endsAt: action.now + ex.restSec * 1000, totalSec: ex.restSec } : null,
          work: null,
        };
      });

    case 'set/undo':
      return withActive(state, (a) => ({
        ...mapExercise(a, action.exIdx, (e) => ({
          ...e,
          sets: e.sets.map((s, i) => (i === action.setIdx ? { ...s, done: false, completedAt: undefined } : s)),
        })),
        focus: action.exIdx,
      }));

    case 'set/add':
      return withActive(state, (a) =>
        mapExercise(a, action.exIdx, (e) => {
          const last = e.sets.at(-1);
          const plan = last ?? { reps: 10, weightKg: 0, durationSec: 30 };
          return { ...e, sets: [...e.sets, newSet(plan)] };
        }),
      );

    case 'set/remove':
      // 마지막 세트가 아직 안 한 세트일 때만 지운다 (기록은 보존)
      return withActive(state, (a) => {
        const ex = a.exercises[action.exIdx];
        const last = ex?.sets.at(-1);
        if (!ex || !last || last.done || ex.sets.length <= 1) return a;
        const lastIdx = ex.sets.length - 1;
        const work = a.work && a.work.exIdx === action.exIdx && a.work.setIdx === lastIdx ? null : a.work;
        return { ...mapExercise(a, action.exIdx, (e) => ({ ...e, sets: e.sets.slice(0, -1) })), work };
      });

    case 'exercise/add':
      return withActive(state, (a) => {
        const name = action.name.trim();
        if (!name) return a;
        const plan = { reps: 10, weightKg: 0, durationSec: 30 };
        const ex: ExerciseLog = {
          id: uid(),
          name,
          kind: action.kind,
          restSec: action.kind === 'time' ? 45 : 90,
          sets: [newSet(plan), newSet(plan), newSet(plan)],
        };
        return { ...a, exercises: [...a.exercises, ex], focus: a.exercises.length };
      });

    case 'rest/adjust':
      return withActive(state, (a) => {
        if (!a.rest) return a;
        const endsAt = a.rest.endsAt + action.deltaSec * 1000;
        if (endsAt <= action.now) return { ...a, rest: null };
        return { ...a, rest: { endsAt, totalSec: Math.max(1, a.rest.totalSec + action.deltaSec) } };
      });

    case 'rest/clear':
      return withActive(state, (a) => ({ ...a, rest: null }));

    case 'work/start':
      return withActive(state, (a) => {
        const set = a.exercises[action.exIdx]?.sets[action.setIdx];
        if (!set || set.done || set.durationSec <= 0) return a;
        return {
          ...a,
          focus: action.exIdx,
          rest: null,
          work: {
            exIdx: action.exIdx,
            setIdx: action.setIdx,
            endsAt: action.now + set.durationSec * 1000,
            totalSec: set.durationSec,
          },
        };
      });

    case 'work/cancel':
      return withActive(state, (a) => ({ ...a, work: null }));

    case 'history/delete':
      return { ...state, history: state.history.filter((s) => s.id !== action.id) };

    case 'settings/update':
      return { ...state, settings: { ...state.settings, ...action.patch } };

    case 'state/replace':
      return action.state;
  }
}
