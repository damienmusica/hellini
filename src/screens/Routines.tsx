import { useState } from 'react';
import { KindToggle } from '../components/KindToggle';
import { NumberField } from '../components/NumberField';
import { uid } from '../lib/id';
import { useStore } from '../lib/store';
import { formatSeconds } from '../lib/timer';
import type { ExerciseTemplate, Routine } from '../lib/types';

function newTemplate(): ExerciseTemplate {
  return { id: uid(), name: '', kind: 'reps', sets: 3, reps: 10, durationSec: 30, weightKg: 0, restSec: 90 };
}

function newRoutine(): Routine {
  return { id: uid(), name: '', exercises: [newTemplate()], updatedAt: Date.now() };
}

function planText(e: ExerciseTemplate): string {
  const body = e.kind === 'time' ? formatSeconds(e.durationSec) : e.weightKg > 0 ? `${e.weightKg}kg × ${e.reps}` : `${e.reps}회`;
  return `${e.sets}세트 · ${body}`;
}

export function Routines() {
  const { state } = useStore();
  const [editing, setEditing] = useState<Routine | null>(null);

  if (editing) {
    const isNew = !state.routines.some((r) => r.id === editing.id);
    return <RoutineEditor initial={editing} isNew={isNew} onClose={() => setEditing(null)} />;
  }

  return (
    <section className="screen">
      <header className="screen-header">
        <h1>루틴</h1>
        <p className="muted">종목, 세트, 무게, 휴식 시간을 정해두면 운동할 때 그대로 따라가요.</p>
      </header>

      <ul className="card-list">
        {state.routines.map((r) => (
          <li key={r.id}>
            <button type="button" className="card card-button" onClick={() => setEditing(r)}>
              <h3>{r.name}</h3>
              <ul className="plain-list muted small">
                {r.exercises.map((e) => (
                  <li key={e.id}>
                    {e.name} — {planText(e)}
                  </li>
                ))}
              </ul>
              <span className="card-action">편집 ›</span>
            </button>
          </li>
        ))}
      </ul>

      <button type="button" className="btn btn-primary btn-block" onClick={() => setEditing(newRoutine())}>
        + 새 루틴
      </button>
    </section>
  );
}

function RoutineEditor({ initial, isNew, onClose }: { initial: Routine; isNew: boolean; onClose: () => void }) {
  const { dispatch } = useStore();
  const [draft, setDraft] = useState<Routine>(initial);
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial);

  const updateEx = (i: number, patch: Partial<ExerciseTemplate>) =>
    setDraft((d) => ({ ...d, exercises: d.exercises.map((e, j) => (j === i ? { ...e, ...patch } : e)) }));

  const move = (i: number, dir: -1 | 1) =>
    setDraft((d) => {
      const j = i + dir;
      if (j < 0 || j >= d.exercises.length) return d;
      const exercises = [...d.exercises];
      [exercises[i], exercises[j]] = [exercises[j], exercises[i]];
      return { ...d, exercises };
    });

  const remove = (i: number) => setDraft((d) => ({ ...d, exercises: d.exercises.filter((_, j) => j !== i) }));

  const save = () => {
    const routine: Routine = {
      ...draft,
      name: draft.name.trim() || '새 루틴',
      exercises: draft.exercises.map((e) => ({ ...e, name: e.name.trim() || '이름 없는 종목' })),
      updatedAt: Date.now(),
    };
    dispatch({ type: 'routine/save', routine });
    onClose();
  };

  const cancel = () => {
    if (!dirty || window.confirm('저장하지 않은 변경 사항이 사라져요. 나갈까요?')) onClose();
  };

  const duplicate = () => {
    dispatch({
      type: 'routine/save',
      routine: {
        ...draft,
        id: uid(),
        name: `${draft.name.trim() || '새 루틴'} 복사본`,
        exercises: draft.exercises.map((e) => ({ ...e, id: uid() })),
        updatedAt: Date.now(),
      },
    });
    onClose();
  };

  const del = () => {
    if (window.confirm(`'${initial.name}' 루틴을 삭제할까요? 지난 운동 기록은 남아요.`)) {
      dispatch({ type: 'routine/delete', id: initial.id });
      onClose();
    }
  };

  return (
    <section className="screen">
      <header className="editor-header">
        <button type="button" className="btn btn-sm" onClick={cancel}>
          취소
        </button>
        <h1 className="editor-title">{isNew ? '새 루틴' : '루틴 편집'}</h1>
        <button type="button" className="btn btn-sm btn-primary" onClick={save}>
          저장
        </button>
      </header>

      <label className="field">
        <span>루틴 이름</span>
        <input
          className="text-input"
          value={draft.name}
          placeholder="예: 상체 A, 하체 데이"
          onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
        />
      </label>

      <ol className="card-list">
        {draft.exercises.map((e, i) => (
          <li key={e.id} className="card ex-edit">
            <div className="ex-edit-head">
              <span className="ex-edit-num">{i + 1}</span>
              <input
                className="text-input"
                value={e.name}
                placeholder="종목 이름 (예: 스쿼트)"
                aria-label={`${i + 1}번 종목 이름`}
                onChange={(ev) => updateEx(i, { name: ev.target.value })}
              />
            </div>
            <KindToggle value={e.kind} onChange={(kind) => updateEx(i, { kind })} />
            <div className="field-grid">
              <label className="field">
                <span>세트</span>
                <NumberField value={e.sets} min={1} max={20} label="세트" onChange={(sets) => updateEx(i, { sets })} />
              </label>
              {e.kind === 'reps' ? (
                <>
                  <label className="field">
                    <span>횟수</span>
                    <NumberField value={e.reps} min={1} max={999} label="횟수" onChange={(reps) => updateEx(i, { reps })} />
                  </label>
                  <label className="field">
                    <span>무게(kg)</span>
                    <NumberField value={e.weightKg} max={999} decimal label="무게" onChange={(weightKg) => updateEx(i, { weightKg })} />
                  </label>
                </>
              ) : (
                <label className="field">
                  <span>시간(초)</span>
                  <NumberField value={e.durationSec} min={1} max={3600} label="시간" onChange={(durationSec) => updateEx(i, { durationSec })} />
                </label>
              )}
              <label className="field">
                <span>휴식(초)</span>
                <NumberField value={e.restSec} max={1800} label="휴식" onChange={(restSec) => updateEx(i, { restSec })} />
              </label>
            </div>
            <div className="ex-edit-actions">
              <button type="button" className="btn btn-sm" aria-label={`${i + 1}번 종목 위로`} disabled={i === 0} onClick={() => move(i, -1)}>
                ↑
              </button>
              <button
                type="button"
                className="btn btn-sm"
                aria-label={`${i + 1}번 종목 아래로`}
                disabled={i === draft.exercises.length - 1}
                onClick={() => move(i, 1)}
              >
                ↓
              </button>
              <button type="button" className="btn btn-sm btn-danger-ghost" onClick={() => remove(i)}>
                삭제
              </button>
            </div>
          </li>
        ))}
      </ol>

      <button
        type="button"
        className="btn btn-block btn-ghost"
        onClick={() => setDraft((d) => ({ ...d, exercises: [...d.exercises, newTemplate()] }))}
      >
        + 종목 추가
      </button>

      {!isNew && (
        <div className="btn-row editor-footer">
          <button type="button" className="btn" onClick={duplicate} disabled={dirty} title={dirty ? '먼저 저장해 주세요' : undefined}>
            복제
          </button>
          <button type="button" className="btn btn-danger-ghost" onClick={del}>
            루틴 삭제
          </button>
        </div>
      )}
    </section>
  );
}
