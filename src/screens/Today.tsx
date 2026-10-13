import { useStore } from '../lib/store';
import {
  doneSets,
  formatDate,
  formatDuration,
  formatVolume,
  sessionVolume,
  sessionsThisWeek,
} from '../lib/stats';
import type { Routine } from '../lib/types';

function routineSummary(r: Routine): string {
  return r.exercises.map((e) => e.name).join(' · ') || '종목 없음';
}

export function Today({ onGoRoutines }: { onGoRoutines: () => void }) {
  const { state, dispatch } = useStore();
  const now = Date.now();
  const latest = state.history[0];

  const start = (routine: Routine) => {
    if (routine.exercises.length === 0) {
      window.alert('종목이 없는 루틴이에요. 루틴 탭에서 종목을 추가해 주세요.');
      return;
    }
    dispatch({ type: 'session/start', routine, now: Date.now() });
  };

  return (
    <section className="screen">
      <header className="screen-header">
        <p className="eyebrow">{formatDate(now)}</p>
        <h1>오늘 운동</h1>
      </header>

      <div className="stat-row">
        <div className="stat">
          <span className="stat-value">{sessionsThisWeek(state.history, now)}회</span>
          <span className="stat-label">이번 주</span>
        </div>
        <div className="stat">
          <span className="stat-value">{state.history.length}회</span>
          <span className="stat-label">누적</span>
        </div>
      </div>

      <h2 className="section-title">루틴 선택</h2>
      {state.routines.length === 0 ? (
        <div className="card empty">
          <p>아직 루틴이 없어요.</p>
          <button type="button" className="btn btn-primary" onClick={onGoRoutines}>
            루틴 만들기
          </button>
        </div>
      ) : (
        <ul className="card-list">
          {state.routines.map((r) => (
            <li key={r.id} className="card routine-card">
              <div className="routine-card-body">
                <h3>{r.name}</h3>
                <p className="muted">{routineSummary(r)}</p>
                <p className="muted small">
                  {r.exercises.length}종목 · {r.exercises.reduce((n, e) => n + e.sets, 0)}세트
                </p>
              </div>
              <button type="button" className="btn btn-primary" onClick={() => start(r)}>
                시작
              </button>
            </li>
          ))}
        </ul>
      )}

      {latest && (
        <>
          <h2 className="section-title">최근 운동</h2>
          <div className="card">
            <h3>{latest.routineName}</h3>
            <p className="muted">
              {formatDate(latest.startedAt)} · {formatDuration((latest.endedAt ?? latest.startedAt) - latest.startedAt)} ·{' '}
              {doneSets(latest)}세트
              {sessionVolume(latest) > 0 ? ` · 볼륨 ${formatVolume(sessionVolume(latest))}` : ''}
            </p>
          </div>
        </>
      )}
    </section>
  );
}
