import { useEffect, useMemo, useState } from 'react';
import { findExercise } from '../../data/exercises';
import { defaultSetsFor } from '../../data/programs';
import { ExercisePicker } from '../../components/ExercisePicker';
import { Icon } from '../../components/Icon';
import { Keypad } from '../../components/Keypad';
import { ActionSheet, Sheet, type ActionItem } from '../../components/Sheet';
import { useToast } from '../../components/Toast';
import { cue, haptic } from '../../lib/cues';
import { useNow } from '../../lib/hooks';
import { suggestProgression, warmupSets, weightIncrement } from '../../lib/progression';
import { bestsByExercise, PR_LABEL, prSetIndexes, runningBest, setPRs } from '../../lib/records';
import { sessionDiffersFromRoutine } from '../../lib/reducer';
import { doneSets, formatDuration, formatSet, formatVolume, lastLogFor, logKey, sessionVolume, totalSets } from '../../lib/stats';
import { useStore } from '../../lib/store';
import { formatElapsed } from '../../lib/timer';
import type { ActiveSession, SetType } from '../../lib/types';
import { ExerciseCard, setLabels, SET_TYPE_LABEL, type Editing } from './ExerciseCard';
import { RestBar, RestSheet } from './RestBar';
import { NoteSheet, PlateSheet, RestTimeSheet, TipSheet } from './sheets';

type SheetState =
  | { kind: 'add' }
  | { kind: 'replace'; exIdx: number }
  | { kind: 'menu'; exIdx: number }
  | { kind: 'setMenu'; exIdx: number; setIdx: number }
  | { kind: 'tip'; exIdx: number }
  | { kind: 'rest'; exIdx: number }
  | { kind: 'plates'; exIdx: number }
  | { kind: 'note'; exIdx: number }
  | { kind: 'finish' }
  | null;

interface Props {
  onMinimize: () => void;
  onFinished: (sessionId: string) => void;
}

export function Workout(props: Props) {
  const { state } = useStore();
  if (!state.active) return null;
  return <WorkoutView a={state.active} {...props} />;
}

function WorkoutView({ a, onMinimize, onFinished }: { a: ActiveSession } & Props) {
  const { state, dispatch } = useStore();
  const toast = useToast();
  const now = useNow(true, 250);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [sheet, setSheet] = useState<SheetState>(null);
  const [restOpen, setRestOpen] = useState(false);
  const [dismissed, setDismissed] = useState<Set<string>>(() => new Set());

  const bests = useMemo(() => bestsByExercise(state.history), [state.history]);
  const lastLogs = useMemo(() => a.exercises.map((e) => lastLogFor(state.history, e)), [state.history, a.exercises]);
  const prSets = useMemo(() => a.exercises.map((e) => prSetIndexes(bests.get(logKey(e)), e)), [a.exercises, bests]);

  const done = doneSets(a);
  const total = totalSets(a);
  const volume = sessionVolume(a);

  useEffect(() => {
    if (!a.rest && !a.work) setRestOpen(false);
  }, [a.rest, a.work]);

  // 키패드가 가리지 않도록 편집 중인 칸을 화면 가운데로
  useEffect(() => {
    if (!editing) return;
    const el = document.querySelector('.set-cell.is-editing');
    el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [editing]);

  const complete = (exIdx: number, setIdx: number) => {
    const ex = a.exercises[exIdx];
    const set = ex.sets[setIdx];
    const prev = runningBest(bests.get(logKey(ex)), ex.sets.filter((_, i) => i !== setIdx));
    const kinds = setPRs(prev, { ...set, done: true }, ex.kind);
    dispatch({ type: 'set/complete', exIdx, setIdx, now: Date.now() });
    setEditing(null);
    haptic(15);
    if (kinds.length > 0) {
      cue('pr', state.settings);
      toast({ tone: 'gold', icon: 'trophy', title: '새 기록 달성!', body: `${ex.name} ${formatSet(ex.kind, set)} · ${PR_LABEL[kinds[0]]}` });
    }
  };

  const nextField = (e: Editing): Editing | null => {
    const ex = a.exercises[e.exIdx];
    if (e.field === 'weightKg') return { ...e, field: 'reps' };
    const nextSet = ex.sets.findIndex((s, i) => i > e.setIdx && !s.done);
    if (nextSet === -1) return null;
    return { exIdx: e.exIdx, setIdx: nextSet, field: ex.kind === 'time' ? 'durationSec' : 'weightKg' };
  };

  const addExercises = (picked: { exerciseId: string; name: string; kind: 'reps' | 'time' }[]) => {
    for (const p of picked) {
      const last = lastLogFor(state.history, p);
      dispatch({
        type: 'exercise/add',
        exercise: {
          exerciseId: p.exerciseId,
          name: p.name,
          kind: p.kind,
          restSec: p.kind === 'time' ? 45 : state.settings.defaultRestSec,
          sets: defaultSetsFor(p.exerciseId, p.kind, last),
        },
      });
    }
    setSheet(null);
    window.setTimeout(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }), 50);
  };

  const exerciseMenu = (exIdx: number): ActionItem[] => {
    const ex = a.exercises[exIdx];
    const info = findExercise(ex.exerciseId ?? ex.name);
    const workSet = ex.sets.find((s) => s.type === 'normal');
    const items: ActionItem[] = [
      { label: '자세 팁 · 영상', icon: 'info', onSelect: () => setSheet({ kind: 'tip', exIdx }) },
      { label: '휴식 시간 바꾸기', icon: 'timer', onSelect: () => setSheet({ kind: 'rest', exIdx }) },
    ];
    if (ex.kind === 'reps' && workSet && workSet.weightKg > 0) {
      items.push({
        label: '워밍업 세트 넣기',
        icon: 'sparkle',
        onSelect: () => {
          const sets = warmupSets(workSet.weightKg, state.settings.barKg, info?.equipment === '바벨');
          if (sets.length === 0) {
            toast({ icon: 'info', title: '무게가 가벼워서 워밍업 없이 해도 돼요.' });
            return;
          }
          dispatch({ type: 'set/insertWarmups', exIdx, sets });
          toast({ tone: 'success', icon: 'check', title: `워밍업 ${sets.length}세트를 넣었어요` });
        },
      });
    }
    if (info?.equipment === '바벨' || info?.equipment === '스미스') {
      items.push({ label: '원판 계산기', icon: 'scale', onSelect: () => setSheet({ kind: 'plates', exIdx }) });
    }
    items.push(
      { label: ex.note ? '메모 수정' : '메모 남기기', icon: 'note', onSelect: () => setSheet({ kind: 'note', exIdx }) },
      { label: '다른 종목으로 바꾸기', icon: 'swap', onSelect: () => setSheet({ kind: 'replace', exIdx }) },
    );
    if (exIdx > 0) items.push({ label: '위로 옮기기', icon: 'arrowUp', onSelect: () => dispatch({ type: 'exercise/move', exIdx, dir: -1 }) });
    if (exIdx < a.exercises.length - 1)
      items.push({ label: '아래로 옮기기', icon: 'arrowDown', onSelect: () => dispatch({ type: 'exercise/move', exIdx, dir: 1 }) });
    items.push({
      label: '종목 삭제',
      icon: 'trash',
      danger: true,
      onSelect: () => {
        if (!ex.sets.some((s) => s.done) || window.confirm(`${ex.name} 기록을 지울까요?`)) {
          setEditing(null);
          dispatch({ type: 'exercise/remove', exIdx });
        }
      },
    });
    return items;
  };

  const setMenu = (exIdx: number, setIdx: number): ActionItem[] => {
    const ex = a.exercises[exIdx];
    const set = ex.sets[setIdx];
    const types: SetType[] = ['warmup', 'normal', 'drop', 'failure'];
    const items: ActionItem[] = types
      .filter((t) => t !== set.type)
      .map((t) => ({ label: `${SET_TYPE_LABEL[t]} 세트로`, onSelect: () => dispatch({ type: 'set/update', exIdx, setIdx, patch: { type: t } }) }));
    if (ex.kind === 'time' && !set.done) items.push({ label: '타이머 없이 완료', icon: 'check', onSelect: () => complete(exIdx, setIdx) });
    if (ex.sets.length > 1)
      items.push({
        label: '세트 삭제',
        icon: 'trash',
        danger: true,
        onSelect: () => {
          setEditing(null);
          dispatch({ type: 'set/remove', exIdx, setIdx });
        },
      });
    return items;
  };

  const editingSet = editing ? a.exercises[editing.exIdx]?.sets[editing.setIdx] : undefined;
  const editingEx = editing ? a.exercises[editing.exIdx] : undefined;

  return (
    <section className={`workout${editing ? ' has-keypad' : ''}`}>
      <header className="workout-header">
        <button type="button" className="icon-btn" aria-label="운동 화면 접기" onClick={onMinimize}>
          <Icon name="chevronDown" size={22} />
        </button>
        <div className="workout-header-title">
          <span className="t-caption c-2">{a.routineName}</span>
          <span className="workout-clock num" aria-label="운동 시간">
            {formatElapsed(now - a.startedAt)}
          </span>
        </div>
        <button type="button" className="btn btn-primary btn-sm btn-pill" onClick={() => setSheet({ kind: 'finish' })}>
          완료
        </button>
      </header>

      <div className="workout-stats">
        <div>
          <span className="t-overline c-3">시간</span>
          <span className="workout-stat num">{formatDuration(now - a.startedAt)}</span>
        </div>
        <div>
          <span className="t-overline c-3">볼륨</span>
          <span className="workout-stat num">{formatVolume(volume)}</span>
        </div>
        <div>
          <span className="t-overline c-3">세트</span>
          <span className="workout-stat num">
            {done}
            <small>/{total}</small>
          </span>
        </div>
      </div>

      {a.exercises.length === 0 && (
        <div className="workout-empty">
          <Icon name="dumbbell" size={40} />
          <p className="t-headline">어떤 운동부터 할까요?</p>
          <p className="t-caption c-2">종목을 추가하면 세트를 기록할 수 있어요.</p>
        </div>
      )}

      <div className="ex-list">
        {a.exercises.map((ex, exIdx) => {
          const suggestion = dismissed.has(ex.id) ? null : suggestProgression(ex, lastLogs[exIdx]);
          return (
            <ExerciseCard
              key={ex.id}
              ex={ex}
              exIdx={exIdx}
              last={lastLogs[exIdx]}
              prSets={prSets[exIdx]}
              editing={editing}
              work={a.work}
              suggestion={suggestion}
              onEdit={setEditing}
              onCopyPrev={(setIdx, prev) =>
                dispatch({
                  type: 'set/update',
                  exIdx,
                  setIdx,
                  patch: ex.kind === 'time' ? { durationSec: prev.durationSec } : { weightKg: prev.weightKg, reps: prev.reps },
                })
              }
              onToggle={(setIdx) => {
                if (ex.sets[setIdx].done) dispatch({ type: 'set/undo', exIdx, setIdx });
                else complete(exIdx, setIdx);
              }}
              onStartWork={(setIdx) => {
                setEditing(null);
                dispatch({ type: 'work/start', exIdx, setIdx, now: Date.now() });
              }}
              onStopWork={() => dispatch({ type: 'work/cancel' })}
              onSetMenu={(setIdx) => setSheet({ kind: 'setMenu', exIdx, setIdx })}
              onAddSet={() => dispatch({ type: 'set/add', exIdx })}
              onMenu={() => setSheet({ kind: 'menu', exIdx })}
              onTip={() => setSheet({ kind: 'tip', exIdx })}
              onRest={() => setSheet({ kind: 'rest', exIdx })}
              onApplySuggestion={() => {
                if (!suggestion) return;
                dispatch({ type: 'exercise/setAll', exIdx, field: suggestion.field, value: suggestion.value });
                setDismissed((d) => new Set(d).add(ex.id));
                toast({ tone: 'success', icon: 'sparkle', title: '좋아요, 오늘은 한 단계 위로!' });
              }}
              onDismissSuggestion={() => setDismissed((d) => new Set(d).add(ex.id))}
            />
          );
        })}
      </div>

      <div className="workout-actions">
        <button type="button" className="btn btn-tinted btn-lg btn-block" onClick={() => setSheet({ kind: 'add' })}>
          <Icon name="plus" size={20} /> 운동 추가
        </button>
        <button
          type="button"
          className="btn btn-danger-text btn-block"
          onClick={() => {
            if (window.confirm('이번 운동을 기록하지 않고 끝낼까요?')) dispatch({ type: 'session/discard' });
          }}
        >
          운동 취소
        </button>
      </div>

      {!editing && <RestBar a={a} now={now} onExpand={() => setRestOpen(true)} />}
      {restOpen && <RestSheet a={a} now={now} onClose={() => setRestOpen(false)} />}

      {editing && editingSet && editingEx && (
        <Keypad
          key={`${editing.exIdx}-${editing.setIdx}-${editing.field}`}
          label={`${editingEx.name} ${setLabels(editingEx.sets)[editing.setIdx]}세트 · ${
            editing.field === 'weightKg' ? '무게' : editing.field === 'reps' ? '횟수' : '시간'
          }`}
          value={editingSet[editing.field]}
          unit={editing.field === 'weightKg' ? 'kg' : editing.field === 'reps' ? '회' : '초'}
          decimal={editing.field === 'weightKg'}
          step={editing.field === 'weightKg' ? weightIncrement(editingEx) : editing.field === 'reps' ? 1 : 5}
          max={editing.field === 'durationSec' ? 3600 : 999}
          onChange={(v) => dispatch({ type: 'set/update', exIdx: editing.exIdx, setIdx: editing.setIdx, patch: { [editing.field]: v } })}
          nextLabel={nextField(editing) ? '다음' : '완료'}
          onNext={() => setEditing(nextField(editing))}
          onClose={() => setEditing(null)}
        />
      )}

      {sheet?.kind === 'add' && <ExercisePicker mode="add" onPick={addExercises} onClose={() => setSheet(null)} />}
      {sheet?.kind === 'replace' && (
        <ExercisePicker
          mode="replace"
          current={a.exercises[sheet.exIdx]}
          onPick={([p]) => {
            dispatch({ type: 'exercise/replace', exIdx: sheet.exIdx, exercise: p });
            setSheet(null);
          }}
          onClose={() => setSheet(null)}
        />
      )}
      {sheet?.kind === 'menu' && a.exercises[sheet.exIdx] && (
        <ActionSheet title={a.exercises[sheet.exIdx].name} items={exerciseMenu(sheet.exIdx)} onClose={() => setSheet(null)} />
      )}
      {sheet?.kind === 'setMenu' && a.exercises[sheet.exIdx]?.sets[sheet.setIdx] && (
        <ActionSheet
          title={`${a.exercises[sheet.exIdx].name} ${setLabels(a.exercises[sheet.exIdx].sets)[sheet.setIdx]}세트`}
          items={setMenu(sheet.exIdx, sheet.setIdx)}
          onClose={() => setSheet(null)}
        />
      )}
      {sheet?.kind === 'tip' && a.exercises[sheet.exIdx] && (
        <TipSheet exerciseId={a.exercises[sheet.exIdx].exerciseId} name={a.exercises[sheet.exIdx].name} onClose={() => setSheet(null)} />
      )}
      {sheet?.kind === 'rest' && a.exercises[sheet.exIdx] && (
        <RestTimeSheet
          name={a.exercises[sheet.exIdx].name}
          value={a.exercises[sheet.exIdx].restSec}
          onPick={(restSec) => dispatch({ type: 'exercise/update', exIdx: sheet.exIdx, patch: { restSec } })}
          onClose={() => setSheet(null)}
        />
      )}
      {sheet?.kind === 'plates' && a.exercises[sheet.exIdx] && (
        <PlateSheet
          weightKg={(a.exercises[sheet.exIdx].sets.find((s) => !s.done && s.type !== 'warmup') ?? a.exercises[sheet.exIdx].sets[0]).weightKg}
          barKg={state.settings.barKg}
          onBarChange={(barKg) => dispatch({ type: 'settings/update', patch: { barKg } })}
          onClose={() => setSheet(null)}
        />
      )}
      {sheet?.kind === 'note' && a.exercises[sheet.exIdx] && (
        <NoteSheet
          name={a.exercises[sheet.exIdx].name}
          value={a.exercises[sheet.exIdx].note ?? ''}
          onSave={(note) => dispatch({ type: 'exercise/update', exIdx: sheet.exIdx, patch: { note: note || undefined } })}
          onClose={() => setSheet(null)}
        />
      )}
      {sheet?.kind === 'finish' && <FinishSheet a={a} onClose={() => setSheet(null)} onFinished={onFinished} />}
    </section>
  );
}

function FinishSheet({ a, onClose, onFinished }: { a: ActiveSession; onClose: () => void; onFinished: (id: string) => void }) {
  const { state, dispatch } = useStore();
  const routine = state.routines.find((r) => r.id === a.routineId);
  const done = doneSets(a);
  const pending = totalSets(a) - done;
  const changed = routine !== undefined && done > 0 && sessionDiffersFromRoutine(routine, a);
  const [updateRoutine, setUpdateRoutine] = useState(true);

  if (done === 0) {
    return (
      <Sheet title="운동을 끝낼까요?" onClose={onClose}>
        <p className="c-2">완료한 세트가 없어서 기록할 게 없어요. 세트 오른쪽 ✓를 눌러야 기록돼요.</p>
        <div className="btn-row">
          <button type="button" className="btn btn-secondary btn-lg" onClick={onClose}>
            계속하기
          </button>
          <button type="button" className="btn btn-lg btn-danger-solid" onClick={() => dispatch({ type: 'session/discard' })}>
            기록 없이 끝내기
          </button>
        </div>
      </Sheet>
    );
  }

  return (
    <Sheet title="운동을 마칠까요?" onClose={onClose}>
      <div className="finish-stats">
        <div>
          <span className="t-overline c-3">시간</span>
          <strong className="num">{formatDuration(Date.now() - a.startedAt)}</strong>
        </div>
        <div>
          <span className="t-overline c-3">세트</span>
          <strong className="num">{done}</strong>
        </div>
        <div>
          <span className="t-overline c-3">볼륨</span>
          <strong className="num">{formatVolume(sessionVolume(a))}</strong>
        </div>
      </div>
      {pending > 0 && <p className="t-caption c-2">완료하지 않은 {pending}세트는 기록에서 빠져요.</p>}
      {changed && (
        <label className="group-row toggle-row">
          <span className="group-row-main">
            <span>루틴에 오늘 기록 반영</span>
            <span className="t-caption c-3">다음에 '{routine.name}'을 시작하면 오늘 무게·횟수로 채워져요</span>
          </span>
          <span className="switch">
            <input type="checkbox" checked={updateRoutine} onChange={(e) => setUpdateRoutine(e.target.checked)} />
            <span />
          </span>
        </label>
      )}
      <div className="btn-row">
        <button type="button" className="btn btn-secondary btn-lg" onClick={onClose}>
          계속하기
        </button>
        <button
          type="button"
          className="btn btn-primary btn-lg"
          onClick={() => {
            dispatch({ type: 'session/finish', now: Date.now(), updateRoutine: changed && updateRoutine });
            onFinished(a.id);
          }}
        >
          운동 완료
        </button>
      </div>
    </Sheet>
  );
}
