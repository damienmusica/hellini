import { findExercise } from '../data/exercises';
import { defaultSetsFor } from '../data/programs';
import { uid } from './id';
import { isAvailable, MAIN_PLACE_ID, mainPlace, sessionPlace } from './places';
import { suggest } from './progression';
import { lastLogAt } from './stats';
import type {
  ActiveSession,
  AppState,
  BodyLog,
  CustomExercise,
  ExerciseKind,
  ExerciseLog,
  Place,
  Profile,
  Routine,
  RoutineExercise,
  Session,
  SetLog,
  SetPlan,
  Settings,
  SwapReason,
} from './types';

export type SetPatch = Partial<Pick<SetLog, 'type' | 'reps' | 'weightKg' | 'durationSec' | 'rpe'>>;

export interface NewExercise {
  exerciseId?: string;
  name: string;
  kind: ExerciseKind;
  restSec: number;
  sets: SetPlan[];
}

export interface ExerciseRef {
  exerciseId?: string;
  name: string;
  kind: ExerciseKind;
}

/** 운동을 마칠 때 기본 루틴에 무엇을 반영할지. 둘 다 끄면 오늘만 적용 */
export interface ApplyOptions {
  /** 같은 종목의 목표 무게·횟수를 오늘 기록으로 */
  targets: boolean;
  /** 오늘 바꾼·추가한·뺀 종목과 늘린 세트 수까지 */
  structure: boolean;
}

export type Action =
  | { type: 'routine/save'; routine: Routine }
  | { type: 'routine/delete'; id: string }
  | { type: 'routine/addMany'; routines: Routine[] }
  | { type: 'onboarding/complete'; routines: Routine[]; weeklyGoal: number }
  | { type: 'session/start'; routine: Routine | null; now: number }
  | { type: 'session/finish'; now: number; apply: ApplyOptions }
  | { type: 'session/discard' }
  | { type: 'exercise/add'; exercise: NewExercise; now?: number }
  /** 남은 계획만 다른 종목으로 바꾼다. 완료한 세트는 원래 종목에 남는다. plan은 새 종목 기준 세트 값 */
  | { type: 'exercise/replace'; exIdx: number; exercise: ExerciseRef; plan: SetPlan[]; reason?: SwapReason; now?: number }
  /** 종목을 잘못 골랐을 때: 완료한 세트까지 통째로 다른 종목으로 정정 */
  | { type: 'exercise/relabel'; exIdx: number; exercise: ExerciseRef }
  /** 오늘은 여기까지: 완료한 세트는 남기고 남은 계획만 뺀다 */
  | { type: 'exercise/skipRemaining'; exIdx: number }
  | { type: 'exercise/remove'; exIdx: number }
  | { type: 'exercise/move'; exIdx: number; dir: -1 | 1 }
  /** 기구를 누가 쓰고 있을 때: 맨 뒤로 미룬다 */
  | { type: 'exercise/defer'; exIdx: number }
  | { type: 'exercise/update'; exIdx: number; patch: Partial<Pick<ExerciseLog, 'restSec' | 'note' | 'effort'>> }
  /** 남은 본세트 전체의 무게·횟수를 한 값으로 */
  | { type: 'exercise/setAll'; exIdx: number; field: 'weightKg' | 'reps'; value: number }
  /** 저장된 제안을 남은 본세트에 적용하고 이력에 남긴다 */
  | { type: 'exercise/applySuggestion'; exIdx: number }
  | { type: 'exercise/dismissSuggestion'; exIdx: number }
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
  /** 끝난 운동 기록 정정 (세트 값·종목·삭제) */
  | { type: 'history/replace'; session: Session }
  | { type: 'custom/add'; exercise: CustomExercise }
  /** 장소 추가·수정 (같은 id면 덮어쓴다) */
  | { type: 'place/save'; place: Place }
  | { type: 'place/delete'; id: string }
  | { type: 'place/select'; id: string }
  /** 체성분 기록 추가·수정 (같은 id면 덮어쓴다). 날짜순 유지 */
  | { type: 'body/save'; log: BodyLog }
  | { type: 'body/delete'; id: string }
  | { type: 'profile/update'; patch: Partial<Profile> }
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

/** 세션을 만들 때 필요한 주변 정보: 지난 기록(제안 근거)과 장소(자동 교체) */
export interface SessionContext {
  history: Session[];
  place?: Place;
  now: number;
}

function placeOf(state: AppState): Place {
  return state.places.find((p) => p.id === state.settings.placeId) ?? state.places.find((p) => p.id === MAIN_PLACE_ID) ?? mainPlace();
}

function withSuggestion(e: ExerciseLog, ctx: SessionContext | undefined): ExerciseLog {
  if (!ctx) return e;
  const s = suggest(e, ctx.history, ctx.place?.id ?? MAIN_PLACE_ID, ctx.now);
  return s ? { ...e, suggested: s } : e;
}

/** 장소 프로필에 "여기서는 이 종목 대신 저걸로"가 있으면 시작할 때 바꿔 둔다. 무게는 대체 종목 자신의 이 장소 기록(없으면 시작값) */
function swapForPlace(t: RoutineExercise, ctx: SessionContext | undefined): ExerciseLog {
  const base = fromRoutineExercise(t);
  const place = ctx?.place;
  const to = place && t.exerciseId ? place.swaps[t.exerciseId] : undefined;
  const info = to ? findExercise(to) : undefined;
  if (!place || !to || !info || isAvailable(place, t)) return base;
  const plan = defaultSetsFor(info.id, info.kind, lastLogAt(ctx.history, { exerciseId: info.id, name: info.name }, place.id));
  const n = Math.max(1, t.sets.filter((s) => s.type === 'normal').length);
  const pick = (i: number) => plan[i] ?? plan.at(-1) ?? FALLBACK_SET;
  return {
    ...base,
    exerciseId: info.id,
    name: info.name,
    kind: info.kind,
    sets: Array.from({ length: n }, (_, i) => logSet(fitSetToKind({ ...pick(i), type: 'normal' }, info.kind))),
    swap: { from: t.name, reason: 'place' },
  };
}

export function buildSession(routine: Routine | null, now: number, ctx?: SessionContext): ActiveSession {
  const place = ctx?.place;
  return {
    id: uid(),
    routineId: routine?.id,
    routineName: routine?.name ?? '자유 운동',
    startedAt: now,
    rest: null,
    work: null,
    exercises: routine ? routine.exercises.map((t) => withSuggestion(swapForPlace(t, ctx), ctx)) : [],
    place: place && place.id !== MAIN_PLACE_ID ? sessionPlace(place) : undefined,
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

export function sameExercise(a: { exerciseId?: string; name: string }, b: { exerciseId?: string; name: string }): boolean {
  if (a.exerciseId && b.exerciseId) return a.exerciseId === b.exerciseId;
  return a.name.trim() === b.name.trim();
}

function toPlan(s: SetPlan): SetPlan {
  return { type: s.type, reps: s.reps, weightKg: s.weightKg, durationSec: s.durationSec };
}

/** 루틴 자리(slot)를 같은 종목으로 수행한 기록 */
function sameExerciseLog(t: RoutineExercise, session: Session): ExerciseLog | undefined {
  return session.exercises.find((e) => e.templateId === t.id && sameExercise(e, t) && e.sets.some((s) => s.done));
}

/** 한 세트의 다음 목표: 더 무겁게 했으면 그 세트로, 같은 무게면 횟수(시간)가 늘었을 때만. 가볍게 한 날은 낮추지 않는다 */
function nextTarget(p: SetPlan, d: SetPlan): SetPlan {
  if (d.weightKg > p.weightKg) return toPlan(d);
  if (d.weightKg < p.weightKg) return p;
  return { ...p, reps: Math.max(p.reps, d.reps), durationSec: Math.max(p.durationSec, d.durationSec) };
}

/** 목표 반영: 세트 수·종류는 계획 그대로, 완료한 세트로 다음 목표만 올린다. 하지 않은 세트는 계획값 유지 */
function withUpdatedTargets(t: RoutineExercise, log: ExerciseLog | undefined): RoutineExercise {
  const done = log?.sets.filter((s) => s.done) ?? [];
  if (done.length === 0) return t;
  const sets = t.sets.map((p, i) => {
    const order = t.sets.slice(0, i).filter((x) => x.type === p.type).length;
    const d = done.filter((x) => x.type === p.type)[order];
    return d ? nextTarget(p, d) : p;
  });
  return { ...t, sets };
}

/** 같은 종목 자리: 오늘 한 세트 + 덜 했으면 남은 계획 본세트 (세트 수는 줄이지 않는다) */
function setsFromSession(slot: RoutineExercise, done: SetPlan[]): SetPlan[] {
  const doneNormal = done.filter((s) => s.type === 'normal').length;
  const rest = slot.sets.filter((s) => s.type === 'normal').slice(doneNormal);
  return [...done.map(toPlan), ...rest];
}

interface SlotPlan {
  slot?: RoutineExercise;
  log?: ExerciseLog;
  kind: 'keep' | 'replace' | 'add';
}

/** 세션을 루틴 자리 기준으로 정리: 같은 종목 유지 / 다른 종목으로 교체 / 새로 추가. 빠진 자리는 목록에 없다 */
function mapSlots(routine: Routine, session: Session): SlotPlan[] {
  const replaced = new Set<string>();
  for (const log of session.exercises) {
    const slot = routine.exercises.find((t) => t.id === log.templateId);
    if (slot && !sameExercise(log, slot)) replaced.add(slot.id);
  }
  const used = new Set<string>();
  const out: SlotPlan[] = [];
  for (const log of session.exercises) {
    const slot = routine.exercises.find((t) => t.id === log.templateId);
    const hasDone = log.sets.some((s) => s.done);
    if (slot) {
      const same = sameExercise(log, slot);
      if (used.has(slot.id) || (same && replaced.has(slot.id))) continue;
      used.add(slot.id);
      out.push({ slot, log, kind: same ? 'keep' : 'replace' });
    } else if (hasDone) {
      out.push({ log, kind: 'add' });
    }
  }
  return out;
}

export function applySessionToRoutine(routine: Routine, session: Session, now: number, apply: ApplyOptions): Routine {
  if (!apply.targets && !apply.structure) return routine;
  let exercises = apply.targets ? routine.exercises.map((t) => withUpdatedTargets(t, sameExerciseLog(t, session))) : routine.exercises;
  if (apply.structure) {
    const byId = new Map(exercises.map((t) => [t.id, t]));
    exercises = mapSlots(routine, session).map(({ slot, log, kind }) => {
      const done = log?.sets.filter((s) => s.done) ?? [];
      if (kind === 'keep') return { ...byId.get(slot!.id)!, sets: setsFromSession(byId.get(slot!.id)!, done) };
      const sets = (done.length > 0 ? done : log!.sets).map(toPlan);
      return {
        id: slot?.id ?? uid(),
        exerciseId: log!.exerciseId,
        name: log!.name,
        kind: log!.kind,
        restSec: log!.restSec,
        sets,
      };
    });
  }
  return { ...routine, exercises, updatedAt: now };
}

function trim(n: number): string {
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100);
}

function describeTarget(before: RoutineExercise, after: RoutineExercise): string | null {
  const key = (r: RoutineExercise) => JSON.stringify(r.sets.map((x) => [x.type, x.reps, x.weightKg, x.durationSec]));
  if (key(before) === key(after)) return null;
  if (before.kind === 'time') {
    return `${before.name} ${before.sets.map((x) => x.durationSec).join('/')}초 → ${after.sets.map((x) => x.durationSec).join('/')}초`;
  }
  const maxB = Math.max(...before.sets.map((x) => x.weightKg));
  const maxA = Math.max(...after.sets.map((x) => x.weightKg));
  if (maxB !== maxA) return `${before.name} ${trim(maxB)} → ${trim(maxA)}kg`;
  return `${before.name} ${before.sets.map((x) => x.reps).join('/')}회 → ${after.sets.map((x) => x.reps).join('/')}회`;
}

/** 마치기 전에 보여줄 변경 내역: 목표(무게·횟수)와 구성(종목·세트 수)을 따로 */
export function routineChanges(routine: Routine, session: Session): { targets: string[]; structure: string[] } {
  const targets = routine.exercises
    .map((t) => describeTarget(t, withUpdatedTargets(t, sameExerciseLog(t, session))))
    .filter((x): x is string => x !== null);

  const structure: string[] = [];
  const slots = mapSlots(routine, session);
  for (const { slot, log, kind } of slots) {
    if (kind === 'replace') structure.push(`${slot!.name} → ${log!.name}`);
    else if (kind === 'add') structure.push(`+ ${log!.name}`);
    else {
      const before = slot!.sets.length;
      const after = setsFromSession(slot!, log!.sets.filter((s) => s.done)).length;
      if (after !== before) structure.push(`${slot!.name} ${before}세트 → ${after}세트`);
    }
  }
  const kept = new Set(slots.filter((x) => x.slot).map((x) => x.slot!.id));
  for (const t of routine.exercises) if (!kept.has(t.id)) structure.push(`− ${t.name}`);
  return { targets, structure };
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
      return { ...state, active: buildSession(action.routine, action.now, { history: state.history, place: placeOf(state), now: action.now }) };

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
        place: a.place,
      };
      const routines = a.routineId
        ? state.routines.map((r) => (r.id === a.routineId ? applySessionToRoutine(r, a, action.now, action.apply) : r))
        : state.routines;
      // 등록 없이 쓴 임시 장소는 끝나면 치우고 기본 장소로 돌아온다
      const temp = a.place ? state.places.find((p) => p.id === a.place!.id)?.temp : false;
      return {
        ...state,
        active: null,
        routines,
        history: exercises.length > 0 ? [session, ...state.history] : state.history,
        places: temp ? state.places.filter((p) => p.id !== a.place!.id) : state.places,
        settings: temp ? { ...state.settings, placeId: MAIN_PLACE_ID } : state.settings,
      };
    }

    case 'session/discard':
      return { ...state, active: null };

    case 'exercise/add':
      return withActive(state, (a) => ({
        ...a,
        exercises: [
          ...a.exercises,
          withSuggestion(
            {
              id: uid(),
              exerciseId: action.exercise.exerciseId,
              name: action.exercise.name,
              kind: action.exercise.kind,
              restSec: action.exercise.restSec,
              sets: action.exercise.sets.map(logSet),
            },
            { history: state.history, place: placeOf(state), now: action.now ?? Date.now() },
          ),
        ],
      }));

    case 'exercise/replace':
      return withActive(state, (a) => {
        const ex = a.exercises[action.exIdx];
        if (!ex) return a;
        const { exerciseId, name, kind } = action.exercise;
        const done = ex.sets.filter((x) => x.done);
        const pending = Math.max(1, ex.sets.filter((x) => !x.done && x.type !== 'warmup').length);
        const base = action.plan.filter((p) => p.type !== 'warmup');
        const pick = (i: number) => base[i] ?? base.at(-1) ?? FALLBACK_SET;
        const next: ExerciseLog = withSuggestion(
          {
            id: uid(),
            exerciseId,
            // 같은 루틴 자리를 대신한다는 표시 (종목이 다르므로 목표 반영 대상은 아님)
            templateId: ex.templateId,
            name,
            kind,
            restSec: ex.restSec,
            sets: Array.from({ length: pending }, (_, i) => logSet(fitSetToKind({ ...pick(i), type: 'normal' }, kind))),
            swap: { from: ex.name, reason: action.reason ?? 'prefer' },
          },
          { history: state.history, place: placeOf(state), now: action.now ?? Date.now() },
        );
        const exercises =
          done.length === 0
            ? a.exercises.map((e, i) => (i === action.exIdx ? next : e))
            : [...a.exercises.slice(0, action.exIdx), { ...ex, sets: done }, next, ...a.exercises.slice(action.exIdx + 1)];
        // 진행 중이던 휴식은 그대로 두고, 위치만 맞춘다
        let rest = a.rest;
        if (rest && rest.exIdx === action.exIdx) rest = done.length > 0 ? { ...rest, setIdx: done.length - 1 } : null;
        else if (rest && rest.exIdx > action.exIdx && done.length > 0) rest = { ...rest, exIdx: rest.exIdx + 1 };
        const work = a.work && a.work.exIdx === action.exIdx ? null : a.work && done.length > 0 && a.work.exIdx > action.exIdx ? { ...a.work, exIdx: a.work.exIdx + 1 } : a.work;
        return { ...a, exercises, rest, work };
      });

    case 'exercise/relabel':
      return withActive(state, (a) =>
        mapExercise(a, action.exIdx, (e) => ({
          ...e,
          exerciseId: action.exercise.exerciseId,
          name: action.exercise.name,
          kind: action.exercise.kind,
          sets: e.sets.map((x) => fitSetToKind(x, action.exercise.kind)),
        })),
      );

    case 'exercise/skipRemaining':
      return withActive(state, (a) => {
        const ex = a.exercises[action.exIdx];
        if (!ex) return a;
        const done = ex.sets.filter((x) => x.done);
        if (done.length === 0) return clearTimers({ ...a, exercises: a.exercises.filter((_, i) => i !== action.exIdx) });
        const work = a.work?.exIdx === action.exIdx ? null : a.work;
        const rest = a.rest?.exIdx === action.exIdx ? { ...a.rest, setIdx: done.length - 1 } : a.rest;
        return { ...mapExercise(a, action.exIdx, (e) => ({ ...e, sets: done })), work, rest };
      });

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

    case 'exercise/defer':
      return withActive(state, (a) => {
        if (action.exIdx >= a.exercises.length - 1) return a;
        const exercises = [...a.exercises.filter((_, i) => i !== action.exIdx), a.exercises[action.exIdx]];
        return clearTimers({ ...a, exercises });
      });

    case 'exercise/update':
      return withActive(state, (a) => mapExercise(a, action.exIdx, (e) => ({ ...e, ...action.patch })));

    case 'exercise/applySuggestion':
      return withActive(state, (a) =>
        mapExercise(a, action.exIdx, (e) => {
          const apply = e.suggested?.apply;
          if (!e.suggested || !apply) return e;
          let n = 0;
          const sets = e.sets.map((s) => {
            if (s.done || s.type !== 'normal') return s;
            const i = n++;
            if (apply.field === 'weightKg') return { ...s, weightKg: apply.value };
            return { ...s, reps: apply.values[i] ?? apply.values.at(-1) ?? s.reps, weightKg: apply.weightKg ?? s.weightKg };
          });
          return { ...e, sets, suggested: { ...e.suggested, applied: true } };
        }),
      );

    case 'exercise/dismissSuggestion':
      return withActive(state, (a) =>
        mapExercise(a, action.exIdx, (e) => (e.suggested ? { ...e, suggested: { ...e.suggested, dismissed: true } } : e)),
      );

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

    case 'history/replace': {
      const exercises = action.session.exercises
        .map((e) => ({ ...e, sets: e.sets.filter((x) => x.done) }))
        .filter((e) => e.sets.length > 0);
      if (exercises.length === 0) return { ...state, history: state.history.filter((h) => h.id !== action.session.id) };
      const fixed = { ...action.session, exercises };
      return { ...state, history: state.history.map((h) => (h.id === fixed.id ? fixed : h)) };
    }

    case 'custom/add':
      return { ...state, customExercises: [...state.customExercises, action.exercise] };

    case 'place/save': {
      const exists = state.places.some((p) => p.id === action.place.id);
      const places = exists ? state.places.map((p) => (p.id === action.place.id ? action.place : p)) : [...state.places, action.place];
      return { ...state, places };
    }

    case 'place/delete': {
      if (action.id === MAIN_PLACE_ID) return state;
      const places = state.places.filter((p) => p.id !== action.id);
      const settings = state.settings.placeId === action.id ? { ...state.settings, placeId: MAIN_PLACE_ID } : state.settings;
      return { ...state, places, settings };
    }

    case 'place/select':
      if (!state.places.some((p) => p.id === action.id)) return state;
      return { ...state, settings: { ...state.settings, placeId: action.id } };

    case 'body/save': {
      const rest = state.body.filter((b) => b.id !== action.log.id);
      return { ...state, body: [...rest, action.log].sort((a, b) => b.date - a.date) };
    }

    case 'body/delete':
      return { ...state, body: state.body.filter((b) => b.id !== action.id) };

    case 'profile/update':
      return { ...state, profile: { ...state.profile, ...action.patch } };

    case 'settings/update':
      return { ...state, settings: { ...state.settings, ...action.patch } };

    case 'state/replace':
      return action.state;
  }
}
