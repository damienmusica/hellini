import { useState } from 'react';
import { Modal } from '../components/Modal';
import { KindToggle } from '../components/KindToggle';
import { Stepper } from '../components/Stepper';
import { useNow } from '../lib/hooks';
import { applySessionToRoutine, currentSetIndex, nextIncomplete } from '../lib/reducer';
import {
  describeSets,
  doneSets,
  formatDuration,
  formatKg,
  formatVolume,
  lastLogFor,
  sessionVolume,
  totalSets,
} from '../lib/stats';
import { useStore } from '../lib/store';
import { formatCountdown, formatElapsed, formatSeconds } from '../lib/timer';
import type { ActiveSession, ExerciseKind, ExerciseLog, SetLog } from '../lib/types';

function setTarget(ex: ExerciseLog, set: SetLog): string {
  if (ex.kind === 'time') return formatSeconds(set.durationSec);
  return set.weightKg > 0 ? `${formatKg(set.weightKg)} × ${set.reps}회` : `${set.reps}회`;
}

function chipLabel(ex: ExerciseLog, set: SetLog, idx: number): string {
  if (!set.done) return String(idx + 1);
  if (ex.kind === 'time') return `${set.durationSec}초`;
  return set.weightKg > 0 ? `${set.weightKg}×${set.reps}` : `${set.reps}회`;
}

function ratio(remainingMs: number, totalSec: number): number {
  return Math.min(1, Math.max(0, remainingMs / (totalSec * 1000)));
}

export function Workout() {
  const { state } = useStore();
  const a = state.active;
  if (!a) return null;
  return <WorkoutView a={a} />;
}

function WorkoutView({ a }: { a: ActiveSession }) {
  const { dispatch } = useStore();
  const now = useNow(true, 250);
  const [finishing, setFinishing] = useState(false);
  const [adding, setAdding] = useState(false);

  const done = doneSets(a);
  const total = totalSets(a);
  const focusEx = a.exercises[a.focus];
  const focusSet = focusEx ? currentSetIndex(focusEx) : -1;
  const allDone = a.exercises.every((e) => currentSetIndex(e) === -1);
  const nextLabel = focusEx && focusSet !== -1 ? `${focusEx.name} ${focusSet + 1}세트 · ${setTarget(focusEx, focusEx.sets[focusSet])}` : null;

  let panel;
  if (a.work) {
    const ex = a.exercises[a.work.exIdx];
    const remaining = a.work.endsAt - now;
    const work = a.work;
    panel = (
      <div className="panel panel-work" aria-label="운동 타이머">
        <p className="panel-label">
          {ex.name} · {work.setIdx + 1}세트
        </p>
        <p className="big-time">{formatCountdown(remaining)}</p>
        <div className="progress">
          <div className="progress-bar" style={{ width: `${ratio(remaining, work.totalSec) * 100}%` }} />
        </div>
        <div className="btn-row">
          <button type="button" className="btn" onClick={() => dispatch({ type: 'work/cancel' })}>
            중지
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              const elapsedSec = Math.max(1, Math.round((now - (work.endsAt - work.totalSec * 1000)) / 1000));
              dispatch({ type: 'set/update', exIdx: work.exIdx, setIdx: work.setIdx, patch: { durationSec: elapsedSec } });
              dispatch({ type: 'set/complete', exIdx: work.exIdx, setIdx: work.setIdx, now: Date.now() });
            }}
          >
            지금 완료
          </button>
        </div>
      </div>
    );
  } else if (a.rest) {
    const remaining = a.rest.endsAt - now;
    panel = (
      <div className="panel panel-rest" aria-label="휴식 타이머">
        <p className="panel-label">휴식</p>
        <p className="big-time">{formatCountdown(remaining)}</p>
        <div className="progress">
          <div className="progress-bar" style={{ width: `${ratio(remaining, a.rest.totalSec) * 100}%` }} />
        </div>
        <div className="btn-row">
          <button type="button" className="btn" onClick={() => dispatch({ type: 'rest/adjust', deltaSec: -15, now: Date.now() })}>
            −15초
          </button>
          <button type="button" className="btn" onClick={() => dispatch({ type: 'rest/adjust', deltaSec: 15, now: Date.now() })}>
            +15초
          </button>
          <button type="button" className="btn btn-primary" onClick={() => dispatch({ type: 'rest/clear' })}>
            건너뛰기
          </button>
        </div>
        {nextLabel && <p className="panel-next">다음: {nextLabel}</p>}
      </div>
    );
  } else if (allDone) {
    panel = (
      <div className="panel panel-done">
        <p className="panel-title">모든 세트 완료! 🎉</p>
        <p className="muted">수고했어요. 기록을 저장하고 마무리하세요.</p>
        <button type="button" className="btn btn-primary btn-xl" onClick={() => setFinishing(true)}>
          운동 끝내기
        </button>
      </div>
    );
  } else if (focusEx && focusSet !== -1) {
    panel = <SetPanel ex={focusEx} exIdx={a.focus} setIdx={focusSet} />;
  } else {
    panel = (
      <div className="panel">
        <p className="panel-title">{focusEx?.name ?? '종목'} 완료</p>
        <button
          type="button"
          className="btn btn-primary btn-xl"
          onClick={() => dispatch({ type: 'session/focus', exIdx: nextIncomplete(a.exercises, a.focus) })}
        >
          다음 종목으로
        </button>
      </div>
    );
  }

  return (
    <section className="screen workout">
      <header className="workout-header">
        <div>
          <p className="eyebrow">{a.routineName}</p>
          <p className="workout-clock" aria-label="운동 경과 시간">
            {formatElapsed(now - a.startedAt)}
          </p>
        </div>
        <div className="workout-header-side">
          <span className="muted small">
            {done}/{total} 세트
          </span>
          <button type="button" className="btn btn-sm" onClick={() => setFinishing(true)}>
            종료
          </button>
        </div>
      </header>
      <div className="progress progress-thin">
        <div className="progress-bar" style={{ width: `${total ? (done / total) * 100 : 0}%` }} />
      </div>

      {panel}

      <h2 className="section-title">종목</h2>
      <ol className="exercise-list">
        {a.exercises.map((ex, i) => (
          <ExerciseRow key={ex.id} ex={ex} exIdx={i} focused={i === a.focus} />
        ))}
      </ol>

      {adding ? (
        <AddExerciseForm onDone={() => setAdding(false)} />
      ) : (
        <button type="button" className="btn btn-block btn-ghost" onClick={() => setAdding(true)}>
          + 종목 추가
        </button>
      )}

      {finishing && <FinishModal a={a} onClose={() => setFinishing(false)} />}
    </section>
  );
}

function SetPanel({ ex, exIdx, setIdx }: { ex: ExerciseLog; exIdx: number; setIdx: number }) {
  const { state, dispatch } = useStore();
  const set = ex.sets[setIdx];
  const last = lastLogFor(state.history, ex.name);
  const update = (patch: Partial<SetLog>) => dispatch({ type: 'set/update', exIdx, setIdx, patch, cascade: true });

  return (
    <div className="panel">
      <p className="panel-title">{ex.name}</p>
      <p className="muted">
        {setIdx + 1} / {ex.sets.length} 세트
      </p>
      {last && <p className="muted small">지난번: {describeSets(last)}</p>}

      {ex.kind === 'reps' ? (
        <div className="stepper-grid">
          <Stepper label="무게" unit="kg" step={2.5} decimal value={set.weightKg} max={999} onChange={(v) => update({ weightKg: v })} />
          <Stepper label="횟수" unit="회" step={1} value={set.reps} max={999} onChange={(v) => update({ reps: v })} />
        </div>
      ) : (
        <div className="stepper-grid">
          <Stepper label="시간" unit="초" step={5} value={set.durationSec} min={1} max={3600} onChange={(v) => update({ durationSec: v })} />
        </div>
      )}

      {ex.kind === 'reps' ? (
        <button
          type="button"
          className="btn btn-primary btn-xl"
          onClick={() => dispatch({ type: 'set/complete', exIdx, setIdx, now: Date.now() })}
        >
          세트 완료
        </button>
      ) : (
        <>
          <button
            type="button"
            className="btn btn-primary btn-xl"
            onClick={() => dispatch({ type: 'work/start', exIdx, setIdx, now: Date.now() })}
          >
            ▶ {formatSeconds(set.durationSec)} 시작
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-block"
            onClick={() => dispatch({ type: 'set/complete', exIdx, setIdx, now: Date.now() })}
          >
            타이머 없이 완료
          </button>
        </>
      )}
    </div>
  );
}

function ExerciseRow({ ex, exIdx, focused }: { ex: ExerciseLog; exIdx: number; focused: boolean }) {
  const { dispatch } = useStore();
  const current = currentSetIndex(ex);
  const doneCount = ex.sets.filter((s) => s.done).length;
  const canRemove = ex.sets.length > 1 && !ex.sets[ex.sets.length - 1].done;

  return (
    <li className={`card exercise-row${focused ? ' is-focus' : ''}${current === -1 ? ' is-done' : ''}`}>
      <button type="button" className="exercise-row-head" onClick={() => dispatch({ type: 'session/focus', exIdx })}>
        <span className="exercise-name">{ex.name}</span>
        <span className="muted small">
          {doneCount}/{ex.sets.length}
        </span>
      </button>
      <div className="set-chips">
        {ex.sets.map((s, j) => (
          <button
            key={j}
            type="button"
            className={`chip${s.done ? ' chip-done' : ''}${focused && j === current ? ' chip-current' : ''}`}
            aria-label={`${ex.name} ${j + 1}세트${s.done ? ' 완료됨' : ''}`}
            onClick={() => {
              if (!s.done) dispatch({ type: 'session/focus', exIdx });
              else if (window.confirm(`${ex.name} ${j + 1}세트 완료를 취소할까요?`)) dispatch({ type: 'set/undo', exIdx, setIdx: j });
            }}
          >
            {chipLabel(ex, s, j)}
          </button>
        ))}
        <button type="button" className="chip chip-ghost" aria-label={`${ex.name} 세트 추가`} onClick={() => dispatch({ type: 'set/add', exIdx })}>
          +
        </button>
        {canRemove && (
          <button
            type="button"
            className="chip chip-ghost"
            aria-label={`${ex.name} 마지막 세트 삭제`}
            onClick={() => dispatch({ type: 'set/remove', exIdx })}
          >
            −
          </button>
        )}
      </div>
    </li>
  );
}

function AddExerciseForm({ onDone }: { onDone: () => void }) {
  const { dispatch } = useStore();
  const [name, setName] = useState('');
  const [kind, setKind] = useState<ExerciseKind>('reps');

  return (
    <form
      className="card form-card"
      onSubmit={(e) => {
        e.preventDefault();
        if (!name.trim()) return;
        dispatch({ type: 'exercise/add', name, kind });
        onDone();
      }}
    >
      <label className="field">
        <span>종목 이름</span>
        <input className="text-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="예: 덤벨 컬" autoFocus />
      </label>
      <KindToggle value={kind} onChange={setKind} />
      <div className="btn-row">
        <button type="button" className="btn" onClick={onDone}>
          취소
        </button>
        <button type="submit" className="btn btn-primary" disabled={!name.trim()}>
          추가
        </button>
      </div>
    </form>
  );
}

function FinishModal({ a, onClose }: { a: ActiveSession; onClose: () => void }) {
  const { state, dispatch } = useStore();
  const [updateRoutine, setUpdateRoutine] = useState(true);
  const done = doneSets(a);
  const volume = sessionVolume(a);
  const routine = state.routines.find((r) => r.id === a.routineId);
  const weightsChanged =
    routine !== undefined &&
    applySessionToRoutine(routine, a, 0).exercises.some((t, i) => t.weightKg !== routine.exercises[i].weightKg);

  const discard = () => {
    if (window.confirm('이번 운동을 기록하지 않고 버릴까요?')) dispatch({ type: 'session/discard' });
  };

  if (done === 0) {
    return (
      <Modal title="운동 종료" onClose={onClose}>
        <p>완료한 세트가 없어서 기록할 게 없어요.</p>
        <div className="btn-row">
          <button type="button" className="btn" onClick={onClose}>
            계속하기
          </button>
          <button type="button" className="btn btn-danger" onClick={() => dispatch({ type: 'session/discard' })}>
            기록 없이 종료
          </button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal title="운동을 마칠까요?" onClose={onClose}>
      <dl className="summary">
        <div>
          <dt>시간</dt>
          <dd>{formatDuration(Date.now() - a.startedAt)}</dd>
        </div>
        <div>
          <dt>세트</dt>
          <dd>
            {done} / {totalSets(a)}
          </dd>
        </div>
        {volume > 0 && (
          <div>
            <dt>볼륨</dt>
            <dd>{formatVolume(volume)}</dd>
          </div>
        )}
      </dl>
      {weightsChanged && (
        <label className="check">
          <input type="checkbox" checked={updateRoutine} onChange={(e) => setUpdateRoutine(e.target.checked)} />
          <span>오늘 들어 올린 무게를 루틴 기본값으로 저장</span>
        </label>
      )}
      <div className="btn-row">
        <button type="button" className="btn" onClick={onClose}>
          계속하기
        </button>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => dispatch({ type: 'session/finish', now: Date.now(), updateRoutine: weightsChanged && updateRoutine })}
        >
          저장하고 종료
        </button>
      </div>
      <button type="button" className="btn btn-link btn-block" onClick={discard}>
        기록하지 않고 버리기
      </button>
    </Modal>
  );
}
