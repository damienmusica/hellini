import { useEffect, useMemo, useRef, useState } from 'react';
import { findExercise, isInverseLoad } from '../../data/exercises';
import { defaultSetsFor } from '../../data/programs';
import { ExercisePicker } from '../../components/ExercisePicker';
import { GuideSheet } from '../../components/GuideSheet';
import { Icon } from '../../components/Icon';
import { Keypad } from '../../components/Keypad';
import { ActionSheet, Sheet, type ActionItem } from '../../components/Sheet';
import { useToast } from '../../components/Toast';
import { cue, haptic } from '../../lib/cues';
import { useNow } from '../../lib/hooks';
import { isAvailable, lastLogEntry, MAIN_PLACE_ID, markUnavailable, placeKey } from '../../lib/places';
import { warmupSets, weightIncrement } from '../../lib/progression';
import { bestsByExercise, PR_LABEL, prSetIndexes, runningBest, setPRs } from '../../lib/records';
import { nextPendingSet, routineChanges, type ApplyOptions } from '../../lib/reducer';
import { doneSets, formatDuration, formatSet, formatVolume, lastLogAt, logKey, sessionVolume, totalSets } from '../../lib/stats';
import { useStore } from '../../lib/store';
import { formatElapsed } from '../../lib/timer';
import type { ActiveSession, SetType } from '../../lib/types';
import { ExerciseCard, isFirstTime, setLabels, SET_TYPE_LABEL, type Editing } from './ExerciseCard';
import { RestBar, RestSheet } from './RestBar';
import { NoteSheet, PlateSheet, RestTimeSheet } from './sheets';

type SheetState =
  | { kind: 'add' }
  | { kind: 'replace'; exIdx: number }
  | { kind: 'relabel'; exIdx: number }
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
  const [statsOpen, setStatsOpen] = useState(false);
  // 사용자가 직접 펼치거나 접은 종목 (현재 종목은 기본으로 펼친다)
  const [expandedOverride, setExpandedOverride] = useState<Map<string, boolean>>(() => new Map());
  // 처음 하는 종목 안내는 세션에서 한 번만
  const introKey = `hellini:intro:${a.id}`;
  const [introDismissed, setIntroDismissed] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem(introKey) === '1';
    } catch {
      return false;
    }
  });
  const dismissIntro = () => {
    setIntroDismissed(true);
    try {
      sessionStorage.setItem(introKey, '1');
    } catch {
      // 무시
    }
  };

  const here = placeKey(a);
  const place = state.places.find((p) => p.id === here);
  // 되돌리기 판단용: 토스트가 떠 있는 동안 완료 세트가 바뀌었으면 되돌리지 않는다
  const latest = useRef(a);
  latest.current = a;
  const placeName = a.place?.name ?? place?.name ?? '평소 헬스장';
  const bests = useMemo(() => bestsByExercise(state.history), [state.history]);
  // 이전 기록은 같은 장소 것을 먼저, 없으면 다른 장소 것 (참고용으로 표시하고 그렇다고 알려준다)
  const lastEntries = useMemo(() => a.exercises.map((e) => lastLogEntry(state.history, e, here)), [state.history, a.exercises, here]);
  const lastLogs = lastEntries.map((x) => x?.log);
  const prSets = useMemo(() => a.exercises.map((e) => prSetIndexes(bests.get(logKey(e)), e)), [a.exercises, bests]);

  const done = doneSets(a);
  const total = totalSets(a);
  const volume = sessionVolume(a);
  const hasFirstTime = a.exercises.some((e, i) => isFirstTime(e, lastLogs[i]));

  // 지금 할 세트: 가장 최근에 완료한 세트의 다음 (없으면 처음 남은 세트)
  const current = useMemo(() => {
    let lastEx = -1;
    let lastSet = -1;
    let lastAt = -1;
    for (const [i, e] of a.exercises.entries()) {
      for (const [j, s] of e.sets.entries()) {
        if (s.done && (s.completedAt ?? 0) >= lastAt) [lastEx, lastSet, lastAt] = [i, j, s.completedAt ?? 0];
      }
    }
    if (lastEx !== -1) return nextPendingSet(a.exercises, lastEx, lastSet);
    const i = a.exercises.findIndex((e) => e.sets.some((s) => !s.done));
    return i === -1 ? null : { exIdx: i, setIdx: a.exercises[i].sets.findIndex((s) => !s.done) };
  }, [a.exercises]);

  // 지금 할 세트가 화면 밖이면 "지금 할 세트로" 버튼을 띄운다
  const [currentOffscreen, setCurrentOffscreen] = useState<'up' | 'down' | null>(null);
  useEffect(() => {
    const el = document.querySelector('.set-row.is-current');
    if (!el) {
      setCurrentOffscreen(null);
      return;
    }
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) setCurrentOffscreen(null);
      else setCurrentOffscreen(entry.boundingClientRect.top < 0 ? 'up' : 'down');
    });
    io.observe(el);
    return () => io.disconnect();
  }, [current?.exIdx, current?.setIdx, a.exercises.length]);

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
    const inverse = isInverseLoad(ex.exerciseId ?? ex.name);
    const prev = runningBest(bests.get(logKey(ex)), ex.sets.filter((_, i) => i !== setIdx), inverse);
    const kinds = setPRs(prev, { ...set, done: true }, ex.kind, inverse);
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
      const last = lastLogAt(state.history, p, here);
      dispatch({
        type: 'exercise/add',
        exercise: {
          exerciseId: p.exerciseId,
          name: p.name,
          kind: p.kind,
          restSec: p.kind === 'time' ? 45 : state.settings.defaultRestSec,
          sets: defaultSetsFor(p.exerciseId, p.kind, last),
        },
        now: Date.now(),
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
      { label: '운동 설명', icon: 'info', onSelect: () => setSheet({ kind: 'tip', exIdx }) },
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
    const doneCount = ex.sets.filter((s) => s.done).length;
    const pendingCount = ex.sets.length - doneCount;
    items.push({ label: ex.note ? '메모 수정' : '메모 남기기', icon: 'note', onSelect: () => setSheet({ kind: 'note', exIdx }) });
    if (pendingCount > 0) {
      items.push({
        label: doneCount > 0 ? '남은 세트만 다른 종목으로' : '다른 종목으로 바꾸기',
        icon: 'swap',
        onSelect: () => setSheet({ kind: 'replace', exIdx }),
      });
      if (exIdx < a.exercises.length - 1 && doneCount === 0) {
        items.push({
          label: '순서 뒤로 미루기 (사용 중)',
          icon: 'arrowDown',
          onSelect: () => {
            dispatch({ type: 'exercise/defer', exIdx });
            toast({ icon: 'arrowDown', title: `${ex.name}을(를) 맨 뒤로 미뤘어요` });
          },
        });
      }
    }
    if (doneCount > 0) {
      items.push({ label: '완료 기록 정정', icon: 'edit', onSelect: () => setSheet({ kind: 'relabel', exIdx }) });
      if (pendingCount > 0) {
        items.push({
          label: '오늘은 여기까지 (남은 세트 빼기)',
          icon: 'check',
          onSelect: () => {
            setEditing(null);
            dispatch({ type: 'exercise/skipRemaining', exIdx });
          },
        });
      }
    }
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
          <span className="t-caption c-2">
            {a.routineName}
            {here !== MAIN_PLACE_ID && ` · ${placeName}`}
          </span>
          <span className="workout-clock num" aria-label="운동 시간">
            {formatElapsed(now - a.startedAt)}
          </span>
        </div>
        <button type="button" className="btn btn-primary btn-sm btn-pill" onClick={() => setSheet({ kind: 'finish' })}>
          완료
        </button>
      </header>

      <button type="button" className="stats-toggle" aria-expanded={statsOpen} onClick={() => setStatsOpen((v) => !v)}>
        <span>
          세트 <span className="num">{done}/{total}</span> · 볼륨 <span className="num">{formatVolume(volume)}</span>
        </span>
        <Icon name={statsOpen ? 'chevronDown' : 'chevronRight'} size={16} />
      </button>
      <div className={`workout-stats${statsOpen ? '' : ' is-collapsed'}`}>
        <div>
          <span className="t-overline c-2">시간</span>
          <span className="workout-stat num">{formatDuration(now - a.startedAt)}</span>
        </div>
        <div>
          <span className="t-overline c-2">볼륨</span>
          <span className="workout-stat num">{formatVolume(volume)}</span>
        </div>
        <div>
          <span className="t-overline c-2">세트</span>
          <span className="workout-stat num">
            {done}
            <small>/{total}</small>
          </span>
        </div>
      </div>

      {hasFirstTime && !introDismissed && (
        <div className="intro-note" role="note">
          <Icon name="info" size={16} />
          <span>처음 하는 종목은 적힌 무게가 시작 예시예요(표에 '시작값'). 자세가 편한 무게로 바꿔요.</span>
          <button type="button" className="icon-btn is-plain" aria-label="안내 닫기" onClick={dismissIntro}>
            <Icon name="close" size={16} />
          </button>
        </div>
      )}

      {a.exercises.length === 0 && (
        <div className="workout-empty">
          <Icon name="dumbbell" size={40} />
          <p className="t-headline">어떤 운동부터 할까요?</p>
          <p className="t-caption c-2">종목을 추가하면 세트를 기록할 수 있어요.</p>
        </div>
      )}

      <div className="ex-list">
        {a.exercises.map((ex, exIdx) => {
          const entry = lastEntries[exIdx];
          const lastPlaceName = entry && placeKey(entry.session) !== here ? (entry.session.place?.name ?? '평소 헬스장') : undefined;
          const isCurrent = current?.exIdx === exIdx || (current === null && exIdx === a.exercises.length - 1);
          const expanded = expandedOverride.get(ex.id) ?? (isCurrent || editing?.exIdx === exIdx);
          return (
            <ExerciseCard
              key={ex.id}
              ex={ex}
              exIdx={exIdx}
              last={lastLogs[exIdx]}
              prSets={prSets[exIdx]}
              editing={editing}
              work={a.work}
              currentSetIdx={current?.exIdx === exIdx ? current.setIdx : null}
              expanded={expanded}
              lastPlaceName={lastPlaceName}
              unavailable={!isAvailable(place ?? a.place, ex)}
              onToggleExpand={() => setExpandedOverride((m) => new Map(m).set(ex.id, !expanded))}
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
                const code = ex.suggested?.code;
                dispatch({ type: 'exercise/applySuggestion', exIdx });
                toast({
                  tone: 'success',
                  icon: 'sparkle',
                  title: code === 'add-weight' || code === 'add-reps' ? '좋아요, 오늘은 한 단계 위로!' : '적용했어요',
                });
              }}
              onDismissSuggestion={() => dispatch({ type: 'exercise/dismissSuggestion', exIdx })}
              onEffort={(effort) => dispatch({ type: 'exercise/update', exIdx, patch: { effort } })}
              onSwap={() => setSheet({ kind: 'replace', exIdx })}
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

      {!editing && currentOffscreen && (
        <button
          type="button"
          className={`jump-current${a.rest || a.work ? ' above-bar' : ''}`}
          onClick={() => document.querySelector('.set-row.is-current')?.scrollIntoView({ block: 'center', behavior: 'smooth' })}
        >
          <Icon name={currentOffscreen === 'up' ? 'arrowUp' : 'arrowDown'} size={16} /> 지금 할 세트
        </button>
      )}
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
      {sheet?.kind === 'replace' && a.exercises[sheet.exIdx] && (
        <ExercisePicker
          mode="replace"
          current={a.exercises[sheet.exIdx]}
          place={place ?? a.place}
          rememberPlaceName={place && !place.temp && a.exercises[sheet.exIdx].exerciseId ? placeName : undefined}
          note={
            a.exercises[sheet.exIdx].sets.some((s) => s.done)
              ? `완료한 ${a.exercises[sheet.exIdx].sets.filter((s) => s.done).length}세트는 유지 · 오늘만`
              : '오늘만 · 기본 루틴은 마칠 때 따로 골라요'
          }
          onSkip={() => {
            const ex = a.exercises[sheet.exIdx];
            setEditing(null);
            if (ex.sets.some((s) => s.done)) dispatch({ type: 'exercise/skipRemaining', exIdx: sheet.exIdx });
            else dispatch({ type: 'exercise/remove', exIdx: sheet.exIdx });
            setSheet(null);
            toast({ icon: 'close', title: `${ex.name}은(는) 오늘 빼요` });
          }}
          onPick={([p], meta) => {
            const ex = a.exercises[sheet.exIdx];
            const before = a.exercises;
            const beforeDone = doneSets(a);
            // 새 종목 무게는 그 종목 자신의 이 장소 기록(없으면 시작값)으로: 원래 종목 무게를 옮기지 않는다
            dispatch({
              type: 'exercise/replace',
              exIdx: sheet.exIdx,
              exercise: p,
              plan: defaultSetsFor(p.exerciseId, p.kind, lastLogAt(state.history, p, here)),
              reason: meta?.reason,
              now: Date.now(),
            });
            if (meta?.remember && place && !place.temp && ex.exerciseId) {
              dispatch({ type: 'place/save', place: markUnavailable(place, ex.exerciseId, p.exerciseId) });
            }
            setSheet(null);
            toast({
              tone: 'success',
              icon: 'swap',
              title: `${ex.name} → ${p.name}`,
              body: meta?.remember ? `${placeName}에서는 항상 이렇게 해요` : undefined,
              action: {
                label: '되돌리기',
                onClick: () => {
                  if (doneSets(latest.current) !== beforeDone) {
                    toast({ icon: 'info', title: '그 사이 세트를 완료해서 되돌리지 않았어요' });
                    return;
                  }
                  dispatch({ type: 'session/restoreExercises', exercises: before });
                },
              },
            });
          }}
          onClose={() => setSheet(null)}
        />
      )}
      {sheet?.kind === 'relabel' && a.exercises[sheet.exIdx] && (
        <ExercisePicker
          mode="relabel"
          current={a.exercises[sheet.exIdx]}
          note={`종목을 잘못 골랐을 때 쓰세요. ${a.exercises[sheet.exIdx].name}에 기록한 세트가 모두 고른 종목 기록으로 바뀌어요.`}
          onPick={([p]) => {
            dispatch({ type: 'exercise/relabel', exIdx: sheet.exIdx, exercise: p });
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
        <GuideSheet exerciseId={a.exercises[sheet.exIdx].exerciseId} name={a.exercises[sheet.exIdx].name} rest={a.rest} now={now} onClose={() => setSheet(null)} />
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

function ChangeList({ items }: { items: string[] }) {
  const shown = items.slice(0, 4);
  return (
    <ul className="change-list">
      {shown.map((x) => (
        <li key={x}>{x}</li>
      ))}
      {items.length > shown.length && <li className="c-3">외 {items.length - shown.length}개</li>}
    </ul>
  );
}

function FinishSheet({ a, onClose, onFinished }: { a: ActiveSession; onClose: () => void; onFinished: (id: string) => void }) {
  const { state, dispatch } = useStore();
  const routine = state.routines.find((r) => r.id === a.routineId);
  const done = doneSets(a);
  const pending = totalSets(a) - done;
  const changes = routine && done > 0 ? routineChanges(routine, a) : { targets: [], structure: [] };
  const away = placeKey(a) !== MAIN_PLACE_ID;
  // 목표(무게·횟수)는 올라간 경우만 반영되므로 기본으로 켜고, 종목 구성은 오늘만 쓰는 게 기본.
  // 다른 장소 기록은 기구가 달라 비교가 안 되니 둘 다 끈다
  const [apply, setApply] = useState<ApplyOptions>({ targets: !away, structure: false });

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
      {pending > 0 && <p className="t-caption c-2">완료하지 않은 {pending}세트는 기록에서 빠져요. 실패로 치지 않아요.</p>}
      <div className="btn-row">
        <button type="button" className="btn btn-secondary btn-lg" onClick={onClose}>
          계속하기
        </button>
        <button
          type="button"
          className="btn btn-primary btn-lg"
          onClick={() => {
            dispatch({
              type: 'session/finish',
              now: Date.now(),
              apply: { targets: apply.targets && changes.targets.length > 0, structure: apply.structure && changes.structure.length > 0 },
            });
            onFinished(a.id);
          }}
        >
          운동 저장
        </button>
      </div>
      {routine && (changes.targets.length > 0 || changes.structure.length > 0) && (
        <div className="apply-box">
          <p className="t-caption c-2">저장하면서 '{routine.name}' 기본 루틴에 반영할 것 (검토)</p>
          {away && <p className="t-caption c-2">{a.place?.name}에서 한 기록이라 기본으로 반영하지 않아요. 기구가 같으면 켜도 돼요.</p>}
          {changes.targets.length > 0 && (
            <label className="group-row toggle-row">
              <span className="group-row-main">
                <span>오늘 기록을 다음 기본값에 반영</span>
                <ChangeList items={changes.targets} />
                <span className="t-caption c-2">오늘 더 한 무게·횟수를 기본값으로 복사해요. 증량 제안은 다음 운동을 시작할 때 따로 떠요.</span>
              </span>
              <span className="switch">
                <input
                  type="checkbox"
                  role="switch"
                  aria-label="오늘 기록을 다음 기본값에 반영"
                  checked={apply.targets}
                  onChange={(e) => setApply((x) => ({ ...x, targets: e.target.checked }))}
                />
                <span />
              </span>
            </label>
          )}
          {changes.structure.length > 0 && (
            <label className="group-row toggle-row">
              <span className="group-row-main">
                <span>종목 구성도 바꾸기</span>
                <ChangeList items={changes.structure} />
                <span className="t-caption c-2">끄면 오늘 바꾼 종목은 오늘만 적용돼요</span>
              </span>
              <span className="switch">
                <input
                  type="checkbox"
                  role="switch"
                  aria-label="종목 구성도 바꾸기"
                  checked={apply.structure}
                  onChange={(e) => setApply((x) => ({ ...x, structure: e.target.checked }))}
                />
                <span />
              </span>
            </label>
          )}
        </div>
      )}
    </Sheet>
  );
}
