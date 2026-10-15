import { useEffect, useMemo, useState } from 'react';
import { BODY_PARTS, findExercise, type BodyPart } from '../data/exercises';
import { BarList, ColumnChart, LineChart } from '../components/Charts';
import { ExercisePicker } from '../components/ExercisePicker';
import { Icon } from '../components/Icon';
import { Keypad } from '../components/Keypad';
import { MuscleMap } from '../components/MuscleMap';
import { PartBadge } from '../components/PartBadge';
import { Sheet } from '../components/Sheet';
import { useToast } from '../components/Toast';
import { MAIN_PLACE_ID } from '../lib/places';
import { plateauSessions } from '../lib/progression';
import { bestsByExercise, estimate1RM, muscleSets, sessionPRs } from '../lib/records';
import {
  bestSet,
  dayStart,
  daysSinceByPart,
  describeSets,
  doneSets,
  formatDate,
  formatDuration,
  formatSet,
  formatShortDate,
  formatTime,
  formatVolume,
  isWorkingSet,
  logKey,
  relativeDay,
  sessionDuration,
  sessionsByDay,
  sessionVolume,
  trimKg,
  weeklySeries,
  weekStreak,
} from '../lib/stats';
import { useStore } from '../lib/store';
import type { ExerciseLog, Session } from '../lib/types';
import { BodyView } from './Body';
import { latestBody, LEVEL_LABEL, strengthLevel } from '../lib/body';

type View = 'log' | 'stats' | 'exercises' | 'body';

const DAY = 86_400_000;

export function History({ onOpenSettings, initialView }: { onOpenSettings: () => void; initialView?: View }) {
  const { state } = useStore();
  const [view, setView] = useState<View>(initialView ?? 'log');

  return (
    <section className="screen">
      <header className="screen-header">
        <h1 className="t-title">기록</h1>
        <button type="button" className="icon-btn" aria-label="설정" onClick={onOpenSettings}>
          <Icon name="gear" size={20} />
        </button>
      </header>
      <div className="segmented" role="tablist">
        {(
          [
            ['log', '운동 기록'],
            ['stats', '통계'],
            ['exercises', '종목별'],
            ['body', '몸'],
          ] as const
        ).map(([v, label]) => (
          <button key={v} type="button" role="tab" aria-selected={view === v} className={view === v ? 'is-on' : ''} onClick={() => setView(v)}>
            {label}
          </button>
        ))}
      </div>
      {view === 'body' ? (
        <BodyView />
      ) : state.history.length === 0 ? (
        <div className="card empty-card">
          <Icon name="calendar" size={32} />
          <p className="t-headline">아직 기록이 없어요</p>
          <p className="t-caption c-2">첫 운동을 마치면 여기에 차곡차곡 쌓여요.</p>
        </div>
      ) : view === 'log' ? (
        <LogView />
      ) : view === 'stats' ? (
        <StatsView />
      ) : (
        <ExercisesView />
      )}
    </section>
  );
}

function monthLabel(y: number, m: number): string {
  return `${y}년 ${m + 1}월`;
}

function LogView() {
  const { state } = useStore();
  const today = new Date();
  const [ym, setYm] = useState({ y: today.getFullYear(), m: today.getMonth() });
  const [day, setDay] = useState<number | null>(null);
  const [open, setOpen] = useState<Session | null>(null);
  const byDay = useMemo(() => sessionsByDay(state.history), [state.history]);

  const first = new Date(ym.y, ym.m, 1);
  const daysInMonth = new Date(ym.y, ym.m + 1, 0).getDate();
  const lead = (first.getDay() + 6) % 7;
  const monthStart = first.getTime();
  const monthEnd = new Date(ym.y, ym.m + 1, 1).getTime();
  const inMonth = state.history.filter((s) => s.startedAt >= monthStart && s.startedAt < monthEnd);
  const shown = day !== null ? inMonth.filter((s) => dayStart(s.startedAt) === day) : inMonth;
  const todayStart = dayStart(Date.now());

  const shift = (d: number) => {
    setDay(null);
    setYm(({ y, m }) => {
      const date = new Date(y, m + d, 1);
      return { y: date.getFullYear(), m: date.getMonth() };
    });
  };

  return (
    <>
      <div className="card calendar">
        <div className="calendar-head">
          <button type="button" className="icon-btn is-plain" aria-label="이전 달" onClick={() => shift(-1)}>
            <Icon name="chevronLeft" size={20} />
          </button>
          <span className="t-headline">{monthLabel(ym.y, ym.m)}</span>
          <button type="button" className="icon-btn is-plain" aria-label="다음 달" onClick={() => shift(1)} disabled={monthEnd > Date.now()}>
            <Icon name="chevronRight" size={20} />
          </button>
        </div>
        <div className="calendar-grid" role="grid" aria-label={`${monthLabel(ym.y, ym.m)} 운동한 날`}>
          {['월', '화', '수', '목', '금', '토', '일'].map((d) => (
            <span key={d} className="calendar-dow">
              {d}
            </span>
          ))}
          {Array.from({ length: lead }, (_, i) => (
            <span key={`b${i}`} />
          ))}
          {Array.from({ length: daysInMonth }, (_, i) => {
            const date = new Date(ym.y, ym.m, i + 1).getTime();
            const count = byDay.get(date) ?? 0;
            return (
              <button
                key={date}
                type="button"
                className={`calendar-day lv${Math.min(count, 2)}${date === todayStart ? ' is-today' : ''}${day === date ? ' is-selected' : ''}`}
                aria-label={`${i + 1}일${count ? ` 운동 ${count}회` : ''}`}
                aria-pressed={day === date}
                disabled={count === 0}
                onClick={() => setDay(day === date ? null : date)}
              >
                {i + 1}
              </button>
            );
          })}
        </div>
        <p className="t-caption c-2 calendar-sum">
          {monthLabel(ym.y, ym.m)} · {inMonth.length}회 · 볼륨 {formatVolume(inMonth.reduce((n, s) => n + sessionVolume(s), 0))}
        </p>
      </div>

      {day !== null && (
        <button type="button" className="btn btn-ghost btn-sm filter-clear" onClick={() => setDay(null)}>
          <Icon name="close" size={14} /> {formatDate(day)} 필터 해제
        </button>
      )}

      {shown.length === 0 ? (
        <p className="empty-note">이 달에는 운동 기록이 없어요.</p>
      ) : (
        <ul className="session-list">
          {shown.map((s) => (
            <li key={s.id}>
              <SessionCard session={s} onOpen={() => setOpen(s)} />
            </li>
          ))}
        </ul>
      )}
      {open && <SessionSheet session={open} onClose={() => setOpen(null)} />}
    </>
  );
}

function SessionCard({ session, onOpen }: { session: Session; onOpen: () => void }) {
  const { state } = useStore();
  const prs = useMemo(() => sessionPRs(session, state.history).length, [session, state.history]);
  return (
    <button type="button" className="card session-card" onClick={onOpen}>
      <span className="row-between">
        <span className="t-caption c-3">
          {formatDate(session.startedAt)} · {formatTime(session.startedAt)}
        </span>
        {prs > 0 && (
          <span className="pr-chip">
            <Icon name="trophy" size={12} /> {prs}
          </span>
        )}
      </span>
      <span className="t-headline">{session.routineName}</span>
      <span className="mini-stats">
        <span>
          <strong className="num">{formatDuration(sessionDuration(session))}</strong>
          <small>시간</small>
        </span>
        <span>
          <strong className="num">{formatVolume(sessionVolume(session))}</strong>
          <small>볼륨</small>
        </span>
        <span>
          <strong className="num">{doneSets(session)}</strong>
          <small>세트</small>
        </span>
      </span>
      <span className="session-lines">
        {session.exercises.slice(0, 3).map((e) => {
          const best = bestSet(e);
          return (
            <span key={e.id}>
              <span>
                {e.sets.filter(isWorkingSet).length} × {e.name}
              </span>
              <span className="c-3 num">{best ? formatSet(e.kind, best) : ''}</span>
            </span>
          );
        })}
        {session.exercises.length > 3 && <span className="c-3">외 {session.exercises.length - 3}종목</span>}
      </span>
    </button>
  );
}

type EditField = 'weightKg' | 'reps' | 'durationSec';

function SessionSheet({ session, onClose }: { session: Session; onClose: () => void }) {
  const { state, dispatch } = useStore();
  const toast = useToast();
  // 수정 후에도 최신 기록을 보여준다
  const live = state.history.find((h) => h.id === session.id) ?? session;
  const [draft, setDraft] = useState<Session | null>(null);
  const [editing, setEditing] = useState<{ exIdx: number; setIdx: number; field: EditField } | null>(null);
  const [relabel, setRelabel] = useState<number | null>(null);
  const prs = sessionPRs(live, state.history);

  useEffect(() => {
    if (editing) document.querySelector('.history-edit .set-cell.is-editing')?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [editing]);

  const updateEx = (exIdx: number, fn: (e: ExerciseLog) => ExerciseLog) =>
    setDraft((d) => (d ? { ...d, exercises: d.exercises.map((e, i) => (i === exIdx ? fn(e) : e)) } : d));

  const save = () => {
    if (!draft) return;
    const empty = draft.exercises.every((e) => e.sets.length === 0);
    if (empty && !window.confirm('세트를 모두 지웠어요. 이 운동 기록을 삭제할까요?')) return;
    dispatch({ type: 'history/replace', session: draft });
    setDraft(null);
    setEditing(null);
    if (empty) onClose();
    else toast({ tone: 'success', icon: 'check', title: '기록을 고쳤어요', body: '통계와 다음 추천에 바로 반영돼요' });
  };

  if (draft) {
    const editingEx = editing ? draft.exercises[editing.exIdx] : undefined;
    const editingSet = editing && editingEx ? editingEx.sets[editing.setIdx] : undefined;
    return (
      <Sheet
        title="기록 고치기"
        onClose={() => {
          if (window.confirm('고친 내용을 저장하지 않고 닫을까요?')) {
            setDraft(null);
            setEditing(null);
          }
        }}
        size="full"
        footer={
          <div className="btn-row">
            <button
              type="button"
              className="btn btn-secondary btn-lg"
              onClick={() => {
                setDraft(null);
                setEditing(null);
              }}
            >
              취소
            </button>
            <button type="button" className="btn btn-primary btn-lg" onClick={save}>
              저장
            </button>
          </div>
        }
      >
        <div className={`history-edit${editing ? ' has-keypad' : ''}`}>
          <p className="t-caption c-2">
            {formatDate(draft.startedAt)} · {draft.routineName}. 무게·횟수를 누르면 고칠 수 있어요.
          </p>
          {draft.exercises.map((e, exIdx) => {
            const isTime = e.kind === 'time';
            return (
              <article key={e.id} className="ex-card flat" aria-label={`${e.name} 기록`}>
                <header className="ex-head">
                  <PartBadge exerciseId={e.exerciseId} name={e.name} />
                  <span className="ex-title">
                    <span className="ex-name">{e.name}</span>
                    <span className="t-caption c-3">{e.sets.length}세트</span>
                  </span>
                  <button type="button" className="btn btn-sm btn-ghost" onClick={() => setRelabel(exIdx)}>
                    종목 정정
                  </button>
                </header>
                <div className={`set-table plan${isTime ? ' is-time' : ''}`} role="table" aria-label={`${e.name} 세트`}>
                  {e.sets.map((x, setIdx) => {
                    const active = (f: EditField) => editing?.exIdx === exIdx && editing.setIdx === setIdx && editing.field === f;
                    const name = `${e.name} ${setIdx + 1}세트`;
                    return (
                      <div key={setIdx} className="set-row" role="row">
                        <span className={`set-label set-${x.type}`}>{x.type === 'warmup' ? 'W' : setIdx + 1}</span>
                        {isTime ? (
                          <button
                            type="button"
                            className={`set-cell num${active('durationSec') ? ' is-editing' : ''}`}
                            aria-label={`${name} 시간 ${x.durationSec}초`}
                            onClick={() => setEditing({ exIdx, setIdx, field: 'durationSec' })}
                          >
                            {x.durationSec}
                          </button>
                        ) : (
                          <>
                            <button
                              type="button"
                              className={`set-cell num${active('weightKg') ? ' is-editing' : ''}`}
                              aria-label={`${name} 무게 ${trimKg(x.weightKg)}kg`}
                              onClick={() => setEditing({ exIdx, setIdx, field: 'weightKg' })}
                            >
                              {trimKg(x.weightKg)}
                            </button>
                            <button
                              type="button"
                              className={`set-cell num${active('reps') ? ' is-editing' : ''}`}
                              aria-label={`${name} 횟수 ${x.reps}회`}
                              onClick={() => setEditing({ exIdx, setIdx, field: 'reps' })}
                            >
                              {x.reps}
                            </button>
                          </>
                        )}
                        <button
                          type="button"
                          className="set-check is-remove"
                          aria-label={`${name} 삭제`}
                          onClick={() => {
                            setEditing(null);
                            updateEx(exIdx, (ex) => ({ ...ex, sets: ex.sets.filter((_, i) => i !== setIdx) }));
                          }}
                        >
                          <Icon name="minus" size={18} strokeWidth={2.6} />
                        </button>
                      </div>
                    );
                  })}
                  {e.sets.length === 0 && <p className="t-caption c-3">세트를 모두 지웠어요. 저장하면 이 종목은 기록에서 빠져요.</p>}
                </div>
              </article>
            );
          })}
        </div>
        {editing && editingEx && editingSet && (
          <Keypad
            key={`${editing.exIdx}-${editing.setIdx}-${editing.field}`}
            label={`${editingEx.name} ${editing.setIdx + 1}세트 · ${editing.field === 'weightKg' ? '무게' : editing.field === 'reps' ? '횟수' : '시간'}`}
            value={editingSet[editing.field]}
            unit={editing.field === 'weightKg' ? 'kg' : editing.field === 'reps' ? '회' : '초'}
            decimal={editing.field === 'weightKg'}
            step={editing.field === 'weightKg' ? 2.5 : editing.field === 'reps' ? 1 : 5}
            max={editing.field === 'durationSec' ? 3600 : 999}
            onChange={(v) =>
              updateEx(editing.exIdx, (ex) => ({ ...ex, sets: ex.sets.map((x, i) => (i === editing.setIdx ? { ...x, [editing.field]: v } : x)) }))
            }
            nextLabel="완료"
            onNext={() => setEditing(null)}
            onClose={() => setEditing(null)}
          />
        )}
        {relabel !== null && draft.exercises[relabel] && (
          <ExercisePicker
            mode="relabel"
            current={draft.exercises[relabel]}
            note={`${draft.exercises[relabel].name} 기록 전체를 고른 종목으로 바꿔요.`}
            onPick={([p]) => {
              updateEx(relabel, (ex) => ({ ...ex, exerciseId: p.exerciseId, name: p.name, kind: p.kind }));
              setRelabel(null);
            }}
            onClose={() => setRelabel(null)}
          />
        )}
      </Sheet>
    );
  }

  return (
    <Sheet title={live.routineName} onClose={onClose} size="full">
      <p className="t-caption c-2">
        {formatDate(live.startedAt)} {formatTime(live.startedAt)} · {formatDuration(sessionDuration(live))} · {formatVolume(sessionVolume(live))}
      </p>
      {prs.length > 0 && (
        <div className="pr-row">
          {prs.map((p, i) => (
            <span key={i} className="pr-chip">
              <Icon name="trophy" size={12} /> {p.exercise} {p.value}
            </span>
          ))}
        </div>
      )}
      <MuscleMap values={muscleSets([live])} />
      <ul className="group detail-list">
        {live.exercises.map((e) => (
          <li key={e.id} className="group-row">
            <PartBadge exerciseId={e.exerciseId} name={e.name} />
            <span className="group-row-main">
              <span className="t-headline">{e.name}</span>
              <span className="t-caption c-2">{describeSets(e)}</span>
            </span>
          </li>
        ))}
      </ul>
      <button type="button" className="btn btn-tinted btn-lg btn-block" onClick={() => setDraft(structuredClone(live))}>
        <Icon name="edit" size={18} /> 기록 고치기
      </button>
      <button
        type="button"
        className="btn btn-danger-text btn-block"
        onClick={() => {
          if (window.confirm('이 운동 기록을 삭제할까요?')) {
            dispatch({ type: 'history/delete', id: live.id });
            onClose();
          }
        }}
      >
        기록 삭제
      </button>
    </Sheet>
  );
}

function StatsView() {
  const { state } = useStore();
  const now = Date.now();
  const weeks = useMemo(() => weeklySeries(state.history, 12, now), [state.history, now]);
  const recent = useMemo(() => state.history.filter((s) => s.startedAt >= now - 7 * DAY), [state.history, now]);
  const muscles = useMemo(() => muscleSets(recent), [recent]);
  const fresh = useMemo(() => daysSinceByPart(state.history, now), [state.history, now]);
  const partSets = useMemo(() => {
    const map = new Map<BodyPart, number>();
    for (const s of recent)
      for (const e of s.exercises) {
        const info = findExercise(e.exerciseId ?? e.name);
        if (!info) continue;
        map.set(info.part, (map.get(info.part) ?? 0) + e.sets.filter(isWorkingSet).length);
      }
    return BODY_PARTS.filter((p) => map.has(p)).map((p) => ({ label: p, value: map.get(p)! }));
  }, [recent]);
  const monthStart = new Date(new Date(now).getFullYear(), new Date(now).getMonth(), 1).getTime();
  const month = state.history.filter((s) => s.startedAt >= monthStart);

  return (
    <>
      <div className="stat-tiles">
        <div className="card">
          <span className="t-overline c-3">총 운동</span>
          <span className="t-stat">{state.history.length}회</span>
        </div>
        <div className="card">
          <span className="t-overline c-3">연속</span>
          <span className="t-stat">{weekStreak(state.history, now)}주</span>
        </div>
        <div className="card">
          <span className="t-overline c-3">이번 달</span>
          <span className="t-stat">{month.length}회</span>
        </div>
      </div>

      <div className="card">
        <h2 className="t-headline">주간 볼륨</h2>
        <p className="t-caption c-3">최근 12주, 완료한 본세트의 무게 × 횟수 합</p>
        <ColumnChart
          label="최근 12주 주간 볼륨"
          data={weeks.map((w) => ({
            label: formatShortDate(w.start),
            value: w.volume,
            valueText: formatVolume(w.volume),
            caption: `${formatShortDate(w.start)} 주 · ${w.sessions}회 · ${w.sets}세트`,
          }))}
        />
        <details className="table-toggle">
          <summary>표로 보기</summary>
          <table className="data-table">
            <thead>
              <tr>
                <th>주</th>
                <th>운동</th>
                <th>세트</th>
                <th>볼륨</th>
              </tr>
            </thead>
            <tbody>
              {weeks
                .slice()
                .reverse()
                .map((w) => (
                  <tr key={w.start}>
                    <td>{formatShortDate(w.start)}</td>
                    <td className="num">{w.sessions}</td>
                    <td className="num">{w.sets}</td>
                    <td className="num">{formatVolume(w.volume)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </details>
      </div>

      <div className="card">
        <h2 className="t-headline">최근 7일 부위별 세트</h2>
        {partSets.length > 0 ? (
          <>
            <BarList rows={partSets} unit="세트" />
            <MuscleMap values={muscles} />
          </>
        ) : (
          <p className="t-caption c-3">최근 7일간 기록이 없어요.</p>
        )}
      </div>

      <div className="card">
        <h2 className="t-headline">부위별 마지막 운동</h2>
        <ul className="fresh-list">
          {BODY_PARTS.filter((p) => p !== '유산소' && p !== '전신').map((p) => {
            const d = fresh.get(p);
            return (
              <li key={p} className={d === undefined ? 'is-none' : d >= 7 ? 'is-stale' : ''}>
                <span>{p}</span>
                <span className="num">{d === undefined ? '아직' : d === 0 ? '오늘' : `${d}일 전`}</span>
              </li>
            );
          })}
        </ul>
      </div>
    </>
  );
}

interface ExerciseSummary {
  key: string;
  exerciseId?: string;
  name: string;
  kind: 'reps' | 'time';
  last: number;
  sessions: number;
}

function ExercisesView() {
  const { state } = useStore();
  const [open, setOpen] = useState<ExerciseSummary | null>(null);
  const bests = useMemo(() => bestsByExercise(state.history), [state.history]);
  const list = useMemo(() => {
    const map = new Map<string, ExerciseSummary>();
    for (const s of state.history)
      for (const e of s.exercises) {
        const key = logKey(e);
        const cur = map.get(key);
        if (cur) cur.sessions++;
        else map.set(key, { key, exerciseId: e.exerciseId, name: e.name, kind: e.kind, last: s.startedAt, sessions: 1 });
      }
    return [...map.values()];
  }, [state.history]);
  const now = Date.now();

  return (
    <>
      <ul className="group">
        {list.map((x) => {
          const b = bests.get(x.key);
          const headline =
            x.kind === 'time' ? `최고 ${b?.duration ?? 0}초` : b && b.weight > 0 ? `최고 ${trimKg(b.weight)}kg · 1RM ${Math.round(b.e1rm)}kg` : `최다 ${b?.reps ?? 0}회`;
          return (
            <li key={x.key}>
              <button type="button" className="group-row" onClick={() => setOpen(x)}>
                <PartBadge exerciseId={x.exerciseId} name={x.name} />
                <span className="group-row-main">
                  <span className="t-headline">{x.name}</span>
                  <span className="t-caption c-2">{headline}</span>
                </span>
                <span className="t-caption c-3">{relativeDay(x.last, now)}</span>
                <Icon name="chevronRight" size={16} className="c-3" />
              </button>
            </li>
          );
        })}
      </ul>
      {open && <ExerciseSheet summary={open} onClose={() => setOpen(null)} />}
    </>
  );
}

function ExerciseSheet({ summary, onClose }: { summary: ExerciseSummary; onClose: () => void }) {
  const { state } = useStore();
  const logs = useMemo(
    () =>
      state.history
        .flatMap((s) => s.exercises.filter((e) => logKey(e) === summary.key).map((e) => ({ session: s, log: e })))
        .filter(({ log }) => log.sets.some(isWorkingSet)),
    [state.history, summary.key],
  );
  const best = bestsByExercise(state.history).get(summary.key);
  const weighted = summary.kind === 'reps' && (best?.weight ?? 0) > 0;
  const metric = summary.kind === 'time' ? '최고 시간' : weighted ? '추정 1RM' : '최다 반복';
  const points = logs
    .slice()
    .reverse()
    .map(({ session, log }) => {
      const sets = log.sets.filter(isWorkingSet);
      const y =
        summary.kind === 'time'
          ? Math.max(...sets.map((s) => s.durationSec))
          : weighted
            ? Math.max(...sets.map((s) => estimate1RM(s.weightKg, s.reps)))
            : Math.max(...sets.map((s) => s.reps));
      const rounded = Math.round(y * 10) / 10;
      return {
        x: session.startedAt,
        y: rounded,
        valueText: summary.kind === 'time' ? `${rounded}초` : weighted ? `${rounded}kg` : `${rounded}회`,
        caption: formatDate(session.startedAt),
      };
    });

  const plateau = summary.kind === 'reps' ? plateauSessions(state.history, { exerciseId: summary.key, name: summary.name }, MAIN_PLACE_ID) : 0;
  const bw = latestBody(state.body)?.weightKg;
  const level = weighted && bw ? strengthLevel(summary.exerciseId, best!.e1rm, bw, state.profile.sex) : null;

  return (
    <Sheet title={summary.name} onClose={onClose} size="full">
      {plateau > 0 && (
        <p className="ex-flag">
          <Icon name="info" size={16} />
          <span>{plateau}번 연속 최고 세트가 제자리예요. 세트를 하나 늘리거나 비슷한 역할의 종목을 섞어 보는 것도 방법이에요. 바꿀지는 직접 정해요.</span>
        </p>
      )}
      <div className="stat-tiles">
        {summary.kind === 'time' ? (
          <div className="card">
            <span className="t-overline c-3">최고 시간</span>
            <span className="t-stat">{best?.duration ?? 0}초</span>
          </div>
        ) : weighted ? (
          <>
            <div className="card">
              <span className="t-overline c-3">최고 무게</span>
              <span className="t-stat">{trimKg(best!.weight)}kg</span>
            </div>
            <div className="card">
              <span className="t-overline c-3">추정 1RM</span>
              <span className="t-stat">{Math.round(best!.e1rm)}kg</span>
            </div>
          </>
        ) : (
          <div className="card">
            <span className="t-overline c-3">최다 반복</span>
            <span className="t-stat">{best?.reps ?? 0}회</span>
          </div>
        )}
        <div className="card">
          <span className="t-overline c-3">한 날</span>
          <span className="t-stat">{logs.length}일</span>
        </div>
      </div>
      {level && (
        <p className="t-caption c-2 level-line">
          체중 대비 <strong>{level.ratio}배</strong> · {LEVEL_LABEL[level.level]}
          {level.next !== null ? ` · 다음 단계까지 1RM ${level.next}kg` : ''}
          <span className="c-3"> (대략적인 근력 기준)</span>
        </p>
      )}
      {points.length >= 2 ? (
        <div className="card">
          <h3 className="t-headline">{metric} 추이</h3>
          {weighted && <p className="t-caption c-3">추정 1RM: 그날 가장 좋은 세트로 계산한 1회 최대 무게</p>}
          <LineChart points={points} label={`${summary.name} ${metric} 추이`} xLabel={formatShortDate} />
        </div>
      ) : (
        <p className="t-caption c-3">두 번 이상 하면 성장 그래프가 생겨요.</p>
      )}
      <ul className="group detail-list">
        {logs.map(({ session, log }) => (
          <li key={session.id + log.id} className="group-row">
            <span className="group-row-main">
              <span className="t-caption c-3">{formatDate(session.startedAt)}</span>
              <span>{describeSets(log)}</span>
            </span>
          </li>
        ))}
      </ul>
    </Sheet>
  );
}
