import { useEffect, useState } from 'react';
import { findExercise } from '../data/exercises';
import { defaultSetsFor, instantiateProgram, PROGRAMS, type Program } from '../data/programs';
import { ExercisePicker } from '../components/ExercisePicker';
import { Icon } from '../components/Icon';
import { Keypad } from '../components/Keypad';
import { PartBadge } from '../components/PartBadge';
import { ActionSheet, Sheet, type ActionItem } from '../components/Sheet';
import { useToast } from '../components/Toast';
import { uid } from '../lib/id';
import { weightIncrement } from '../lib/progression';
import { lastLogFor, trimKg } from '../lib/stats';
import { fitSetToKind } from '../lib/reducer';
import { useStore } from '../lib/store';
import { formatSeconds } from '../lib/timer';
import type { Routine, RoutineExercise, SetType } from '../lib/types';
import { estimateMinutes, routineSummary } from './Home';
import { ProgramPreview } from './Onboarding';
import { setLabels, SET_TYPE_LABEL } from './workout/ExerciseCard';
import { RestTimeSheet } from './workout/sheets';

export function Routines() {
  const { state, dispatch } = useStore();
  const toast = useToast();
  const [editing, setEditing] = useState<Routine | null>(null);
  const [menu, setMenu] = useState<Routine | null>(null);
  const [program, setProgram] = useState<Program | null>(null);

  if (editing) {
    const isNew = !state.routines.some((r) => r.id === editing.id);
    return <RoutineEditor initial={editing} isNew={isNew} onClose={() => setEditing(null)} />;
  }

  const menuItems = (r: Routine): ActionItem[] => [
    {
      label: '운동 시작',
      icon: 'play',
      onSelect: () => {
        if (state.active) toast({ icon: 'info', title: '이미 진행 중인 운동이 있어요' });
        else dispatch({ type: 'session/start', routine: r, now: Date.now() });
      },
    },
    { label: '편집', icon: 'edit', onSelect: () => setEditing(r) },
    {
      label: '복제',
      icon: 'list',
      onSelect: () =>
        dispatch({
          type: 'routine/save',
          routine: { ...r, id: uid(), name: `${r.name} 복사본`, exercises: r.exercises.map((e) => ({ ...e, id: uid() })), updatedAt: Date.now() },
        }),
    },
    {
      label: '삭제',
      icon: 'trash',
      danger: true,
      onSelect: () => {
        if (window.confirm(`'${r.name}' 루틴을 삭제할까요? 지난 운동 기록은 남아요.`)) dispatch({ type: 'routine/delete', id: r.id });
      },
    },
  ];

  return (
    <section className="screen">
      <header className="screen-header">
        <h1 className="t-title">루틴</h1>
        <button
          type="button"
          className="btn btn-tinted btn-sm btn-pill"
          onClick={() => setEditing({ id: uid(), name: '', exercises: [], updatedAt: Date.now() })}
        >
          <Icon name="plus" size={16} /> 새 루틴
        </button>
      </header>

      {state.routines.length === 0 ? (
        <div className="card empty-card">
          <Icon name="list" size={32} />
          <p className="t-headline">아직 루틴이 없어요</p>
          <p className="t-caption c-2">아래 추천 프로그램을 추가하거나 직접 만들어 보세요.</p>
        </div>
      ) : (
        <ul className="routine-list">
          {state.routines.map((r) => (
            <li key={r.id} className="card routine-card">
              <button type="button" className="routine-card-main" onClick={() => setEditing(r)}>
                {r.note && <span className="t-overline c-3">{r.note}</span>}
                <span className="t-headline">{r.name}</span>
                <span className="t-caption c-2 clamp-2">{routineSummary(r)}</span>
                <span className="t-caption c-3">
                  {r.exercises.length}종목 · 약 {estimateMinutes(r)}분
                </span>
              </button>
              <button type="button" className="icon-btn is-plain" aria-label={`${r.name} 메뉴`} onClick={() => setMenu(r)}>
                <Icon name="more" size={22} strokeWidth={3} />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="section-head">
        <h2 className="t-section">추천 프로그램</h2>
      </div>
      <ul className="program-list">
        {PROGRAMS.map((p) => (
          <li key={p.id}>
            <button type="button" className="card program-card" onClick={() => setProgram(p)}>
              <span className="program-card-top">
                <span className="tag">{p.level}</span>
                <span className="t-caption c-3">{p.summary}</span>
              </span>
              <span className="t-headline">{p.name}</span>
              <span className="t-caption c-2 clamp-2">{p.description}</span>
            </button>
          </li>
        ))}
      </ul>

      {menu && <ActionSheet title={menu.name} items={menuItems(menu)} onClose={() => setMenu(null)} />}
      {program && (
        <Sheet
          title={program.name}
          onClose={() => setProgram(null)}
          size="full"
          footer={
            <button
              type="button"
              className="btn btn-primary btn-lg btn-block"
              onClick={() => {
                dispatch({ type: 'routine/addMany', routines: instantiateProgram(program, Date.now()) });
                toast({ tone: 'success', icon: 'check', title: `루틴 ${program.routines.length}개를 추가했어요` });
                setProgram(null);
              }}
            >
              내 루틴에 추가
            </button>
          }
        >
          <ProgramPreview program={program} />
        </Sheet>
      )}
    </section>
  );
}

type Field = 'weightKg' | 'reps' | 'durationSec';

function RoutineEditor({ initial, isNew, onClose }: { initial: Routine; isNew: boolean; onClose: () => void }) {
  const { state, dispatch } = useStore();
  const [draft, setDraft] = useState<Routine>(initial);
  const [editing, setEditing] = useState<{ exIdx: number; setIdx: number; field: Field } | null>(null);
  const [sheet, setSheet] = useState<
    { kind: 'add' } | { kind: 'replace'; exIdx: number } | { kind: 'menu'; exIdx: number } | { kind: 'rest'; exIdx: number } | { kind: 'set'; exIdx: number; setIdx: number } | null
  >(null);
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial);

  const updateEx = (exIdx: number, fn: (e: RoutineExercise) => RoutineExercise) =>
    setDraft((d) => ({ ...d, exercises: d.exercises.map((e, i) => (i === exIdx ? fn(e) : e)) }));

  const save = () => {
    dispatch({ type: 'routine/save', routine: { ...draft, name: draft.name.trim() || '새 루틴', updatedAt: Date.now() } });
    onClose();
  };

  const cancel = () => {
    if (!dirty || window.confirm('저장하지 않은 변경 사항이 사라져요. 나갈까요?')) onClose();
  };

  const exMenu = (exIdx: number): ActionItem[] => {
    const items: ActionItem[] = [
      { label: '휴식 시간 바꾸기', icon: 'timer', onSelect: () => setSheet({ kind: 'rest', exIdx }) },
      { label: '다른 종목으로 바꾸기', icon: 'swap', onSelect: () => setSheet({ kind: 'replace', exIdx }) },
    ];
    const move = (dir: -1 | 1) =>
      setDraft((d) => {
        const exercises = [...d.exercises];
        [exercises[exIdx], exercises[exIdx + dir]] = [exercises[exIdx + dir], exercises[exIdx]];
        return { ...d, exercises };
      });
    if (exIdx > 0) items.push({ label: '위로 옮기기', icon: 'arrowUp', onSelect: () => move(-1) });
    if (exIdx < draft.exercises.length - 1) items.push({ label: '아래로 옮기기', icon: 'arrowDown', onSelect: () => move(1) });
    items.push({
      label: '종목 삭제',
      icon: 'trash',
      danger: true,
      onSelect: () => {
        setEditing(null);
        setDraft((d) => ({ ...d, exercises: d.exercises.filter((_, i) => i !== exIdx) }));
      },
    });
    return items;
  };

  useEffect(() => {
    if (editing) document.querySelector('.set-cell.is-editing')?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [editing]);

  const editingEx = editing ? draft.exercises[editing.exIdx] : undefined;
  const editingSet = editing && editingEx ? editingEx.sets[editing.setIdx] : undefined;
  const nextField = (e: { exIdx: number; setIdx: number; field: Field }) => {
    const ex = draft.exercises[e.exIdx];
    if (e.field === 'weightKg') return { ...e, field: 'reps' as Field };
    if (e.setIdx + 1 < ex.sets.length) return { exIdx: e.exIdx, setIdx: e.setIdx + 1, field: (ex.kind === 'time' ? 'durationSec' : 'weightKg') as Field };
    return null;
  };

  return (
    <section className={`screen editor${editing ? ' has-keypad' : ''}`}>
      <header className="editor-header">
        <button type="button" className="btn btn-ghost btn-sm" onClick={cancel}>
          취소
        </button>
        <h1 className="t-headline">{isNew ? '새 루틴' : '루틴 편집'}</h1>
        <button type="button" className="btn btn-primary btn-sm btn-pill" onClick={save}>
          저장
        </button>
      </header>

      <input
        className="title-input"
        value={draft.name}
        placeholder="루틴 이름 (예: 상체 A)"
        aria-label="루틴 이름"
        onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
      />

      <div className="ex-list">
        {draft.exercises.map((ex, exIdx) => {
          const info = findExercise(ex.exerciseId ?? ex.name);
          const labels = setLabels(ex.sets.map((s) => ({ ...s, done: false })));
          const isTime = ex.kind === 'time';
          return (
            <article key={ex.id} className="ex-card" aria-label={ex.name}>
              <header className="ex-head">
                <PartBadge exerciseId={ex.exerciseId} name={ex.name} />
                <span className="ex-title">
                  <span className="ex-name">{ex.name}</span>
                  <span className="t-caption c-3">{info ? `${info.part} · ${info.equipment}` : '직접 추가한 종목'}</span>
                </span>
                <button type="button" className="icon-btn is-plain" aria-label={`${ex.name} 메뉴`} onClick={() => setSheet({ kind: 'menu', exIdx })}>
                  <Icon name="more" size={22} strokeWidth={3} />
                </button>
              </header>
              <button type="button" className="rest-chip" onClick={() => setSheet({ kind: 'rest', exIdx })}>
                <Icon name="timer" size={15} /> 휴식 {ex.restSec > 0 ? formatSeconds(ex.restSec) : '끔'}
              </button>
              <div className={`set-table plan${isTime ? ' is-time' : ''}`} role="table" aria-label={`${ex.name} 세트`}>
                <div className="set-row set-head" role="row">
                  <span role="columnheader">세트</span>
                  {isTime ? (
                    <span role="columnheader">초</span>
                  ) : (
                    <>
                      <span role="columnheader">kg</span>
                      <span role="columnheader">회</span>
                    </>
                  )}
                  <span role="columnheader" className="sr-only">
                    삭제
                  </span>
                </div>
                {ex.sets.map((s, setIdx) => {
                  const active = (f: Field) => editing?.exIdx === exIdx && editing.setIdx === setIdx && editing.field === f;
                  const name = `${ex.name} ${labels[setIdx]}세트`;
                  return (
                    <div key={setIdx} className="set-row" role="row">
                      <button type="button" className={`set-label set-${s.type}`} aria-label={`${name} 종류`} onClick={() => setSheet({ kind: 'set', exIdx, setIdx })}>
                        {labels[setIdx]}
                      </button>
                      {isTime ? (
                        <button
                          type="button"
                          className={`set-cell num${active('durationSec') ? ' is-editing' : ''}`}
                          aria-label={`${name} 시간 ${s.durationSec}초`}
                          onClick={() => setEditing({ exIdx, setIdx, field: 'durationSec' })}
                        >
                          {s.durationSec}
                        </button>
                      ) : (
                        <>
                          <button
                            type="button"
                            className={`set-cell num${active('weightKg') ? ' is-editing' : ''}`}
                            aria-label={`${name} 무게 ${trimKg(s.weightKg)}kg`}
                            onClick={() => setEditing({ exIdx, setIdx, field: 'weightKg' })}
                          >
                            {trimKg(s.weightKg)}
                          </button>
                          <button
                            type="button"
                            className={`set-cell num${active('reps') ? ' is-editing' : ''}`}
                            aria-label={`${name} 횟수 ${s.reps}회`}
                            onClick={() => setEditing({ exIdx, setIdx, field: 'reps' })}
                          >
                            {s.reps}
                          </button>
                        </>
                      )}
                      <button
                        type="button"
                        className="set-check is-remove"
                        aria-label={`${name} 삭제`}
                        disabled={ex.sets.length <= 1}
                        onClick={() => {
                          setEditing(null);
                          updateEx(exIdx, (e) => ({ ...e, sets: e.sets.filter((_, i) => i !== setIdx) }));
                        }}
                      >
                        <Icon name="minus" size={18} strokeWidth={2.6} />
                      </button>
                    </div>
                  );
                })}
              </div>
              <button
                type="button"
                className="btn btn-secondary btn-sm btn-block add-set"
                onClick={() => updateEx(exIdx, (e) => ({ ...e, sets: [...e.sets, { ...(e.sets.at(-1) ?? { type: 'normal', reps: 10, weightKg: 0, durationSec: 30 }) }] }))}
              >
                <Icon name="plus" size={16} /> 세트 추가
              </button>
            </article>
          );
        })}
      </div>

      <button type="button" className="btn btn-tinted btn-lg btn-block editor-add" onClick={() => setSheet({ kind: 'add' })}>
        <Icon name="plus" size={20} /> 운동 추가
      </button>

      {editing && editingEx && editingSet && (
        <Keypad
          key={`${editing.exIdx}-${editing.setIdx}-${editing.field}`}
          label={`${editingEx.name} · ${editing.field === 'weightKg' ? '무게' : editing.field === 'reps' ? '횟수' : '시간'}`}
          value={editingSet[editing.field]}
          unit={editing.field === 'weightKg' ? 'kg' : editing.field === 'reps' ? '회' : '초'}
          decimal={editing.field === 'weightKg'}
          step={editing.field === 'weightKg' ? weightIncrement(editingEx) : editing.field === 'reps' ? 1 : 5}
          max={editing.field === 'durationSec' ? 3600 : 999}
          onChange={(v) =>
            updateEx(editing.exIdx, (e) => {
              const old = e.sets[editing.setIdx][editing.field];
              // 뒤 세트 중 값이 같던 세트도 같이 바꾼다
              return {
                ...e,
                sets: e.sets.map((s, i) => (i === editing.setIdx || (i > editing.setIdx && s[editing.field] === old) ? { ...s, [editing.field]: v } : s)),
              };
            })
          }
          nextLabel={nextField(editing) ? '다음' : '완료'}
          onNext={() => setEditing(nextField(editing))}
          onClose={() => setEditing(null)}
        />
      )}

      {sheet?.kind === 'add' && (
        <ExercisePicker
          mode="add"
          onPick={(picked) => {
            setDraft((d) => ({
              ...d,
              exercises: [
                ...d.exercises,
                ...picked.map((p) => ({
                  id: uid(),
                  exerciseId: p.exerciseId,
                  name: p.name,
                  kind: p.kind,
                  restSec: p.kind === 'time' ? 45 : state.settings.defaultRestSec,
                  sets: defaultSetsFor(p.exerciseId, p.kind, lastLogFor(state.history, p)),
                })),
              ],
            }));
            setSheet(null);
          }}
          onClose={() => setSheet(null)}
        />
      )}
      {sheet?.kind === 'replace' && draft.exercises[sheet.exIdx] && (
        <ExercisePicker
          mode="replace"
          current={draft.exercises[sheet.exIdx]}
          onPick={([p]) => {
            updateEx(sheet.exIdx, (e) => ({ ...e, exerciseId: p.exerciseId, name: p.name, kind: p.kind, sets: e.sets.map((x) => fitSetToKind(x, p.kind)) }));
            setSheet(null);
          }}
          onClose={() => setSheet(null)}
        />
      )}
      {sheet?.kind === 'menu' && draft.exercises[sheet.exIdx] && (
        <ActionSheet title={draft.exercises[sheet.exIdx].name} items={exMenu(sheet.exIdx)} onClose={() => setSheet(null)} />
      )}
      {sheet?.kind === 'rest' && draft.exercises[sheet.exIdx] && (
        <RestTimeSheet
          name={draft.exercises[sheet.exIdx].name}
          value={draft.exercises[sheet.exIdx].restSec}
          onPick={(restSec) => updateEx(sheet.exIdx, (e) => ({ ...e, restSec }))}
          onClose={() => setSheet(null)}
        />
      )}
      {sheet?.kind === 'set' && draft.exercises[sheet.exIdx]?.sets[sheet.setIdx] && (
        <ActionSheet
          title="세트 종류"
          items={(['warmup', 'normal', 'drop', 'failure'] as SetType[]).map((t) => ({
            label: `${SET_TYPE_LABEL[t]} 세트`,
            onSelect: () =>
              updateEx(sheet.exIdx, (e) => ({ ...e, sets: e.sets.map((s, i) => (i === sheet.setIdx ? { ...s, type: t } : s)) })),
          }))}
          onClose={() => setSheet(null)}
        />
      )}
    </section>
  );
}
