import { Icon } from '../components/Icon';
import { WeekStrip } from '../components/WeekStrip';
import {
  doneSets,
  formatDate,
  formatDuration,
  formatVolume,
  nextRoutine,
  relativeDay,
  sessionDuration,
  sessionsThisWeek,
  sessionVolume,
  weekStreak,
} from '../lib/stats';
import { useStore } from '../lib/store';
import type { Routine } from '../lib/types';

const DAY = 86_400_000;

/** 대략 걸리는 시간: 세트당 40초(시간 세트는 그 시간) + 세트 사이 휴식 + 종목 바꾸는 1분 */
export function estimateMinutes(r: Routine): number {
  let sec = 0;
  for (const e of r.exercises) {
    const n = e.sets.length;
    sec += e.sets.reduce((s, x) => s + (e.kind === 'time' ? x.durationSec : 40), 0);
    sec += Math.max(0, n - 1) * e.restSec + 60;
  }
  return Math.max(5, Math.round(sec / 60 / 5) * 5);
}

export function routineSummary(r: Routine): string {
  return r.exercises.map((e) => e.name).join(' · ') || '종목 없음';
}

function greeting(now: number): string {
  const h = new Date(now).getHours();
  if (h < 5) return '늦은 밤 열정 최고!';
  if (h < 11) return '좋은 아침이에요';
  if (h < 17) return '오늘도 득근해요';
  return '저녁 운동 가볼까요?';
}

interface Props {
  onOpenWorkout: () => void;
  onOpenSettings: () => void;
  onGoRoutines: () => void;
}

export function Home({ onOpenWorkout, onOpenSettings, onGoRoutines }: Props) {
  const { state, dispatch } = useStore();
  const now = Date.now();
  const next = nextRoutine(state.routines, state.history);
  const goal = state.settings.weeklyGoal;
  const thisWeek = sessionsThisWeek(state.history, now);
  const streak = weekStreak(state.history, now);
  const latest = state.history[0];
  const lastOfNext = next ? state.history.find((s) => s.routineId === next.id) : undefined;
  const needsBackup =
    state.history.length >= 5 && (!state.settings.lastBackupAt || now - state.settings.lastBackupAt > 30 * DAY);

  const start = (routine: Routine | null) => {
    if (state.active) {
      onOpenWorkout();
      return;
    }
    dispatch({ type: 'session/start', routine, now: Date.now() });
  };

  return (
    <section className="screen">
      <header className="screen-header">
        <div>
          <p className="t-caption c-2">{formatDate(now)}</p>
          <h1 className="t-title">{greeting(now)}</h1>
        </div>
        <button type="button" className="icon-btn" aria-label="설정" onClick={onOpenSettings}>
          <Icon name="gear" size={20} />
        </button>
      </header>

      <div className="card week-card">
        <div className="row-between">
          <div>
            <span className="t-overline c-3">이번 주 목표</span>
            <p className="t-section num">
              {Math.min(thisWeek, goal)}
              <span className="c-3">/{goal}회</span>
            </p>
          </div>
          {streak > 0 && (
            <span className="streak-badge">
              <Icon name="flame" size={16} /> {streak}주 연속
            </span>
          )}
        </div>
        <div className="goal-bar" aria-hidden="true">
          <span style={{ transform: `scaleX(${Math.min(1, thisWeek / goal)})` }} />
        </div>
        <WeekStrip history={state.history} now={now} />
      </div>

      {state.active ? (
        <div className="card hero-card is-active">
          <span className="t-overline accent">진행 중인 운동</span>
          <h2 className="t-section">{state.active.routineName}</h2>
          <p className="c-2">
            {doneSets(state.active)}세트 완료 · {formatDuration(now - state.active.startedAt)} 지남
          </p>
          <button type="button" className="btn btn-primary btn-lg btn-block" onClick={onOpenWorkout}>
            이어서 하기
          </button>
        </div>
      ) : next ? (
        <div className="card hero-card">
          <span className="t-overline accent">오늘의 루틴</span>
          <h2 className="t-section">{next.name}</h2>
          <p className="c-2 hero-summary">{routineSummary(next)}</p>
          <div className="hero-meta">
            <span>
              <Icon name="dumbbell" size={15} /> {next.exercises.length}종목 · {next.exercises.reduce((n, e) => n + e.sets.length, 0)}세트
            </span>
            <span>
              <Icon name="clock" size={15} /> 약 {estimateMinutes(next)}분
            </span>
            {lastOfNext && (
              <span>
                <Icon name="calendar" size={15} /> 지난번 {relativeDay(lastOfNext.startedAt, now)}
              </span>
            )}
          </div>
          <button type="button" className="btn btn-primary btn-lg btn-block" onClick={() => start(next)}>
            <Icon name="play" size={16} /> 운동 시작
          </button>
        </div>
      ) : (
        <div className="card hero-card">
          <span className="t-overline accent">시작하기</span>
          <h2 className="t-section">루틴이 아직 없어요</h2>
          <p className="c-2">추천 프로그램에서 고르거나 직접 만들어 보세요.</p>
          <button type="button" className="btn btn-primary btn-lg btn-block" onClick={onGoRoutines}>
            루틴 고르기
          </button>
        </div>
      )}

      {needsBackup && (
        <button type="button" className="banner" onClick={onOpenSettings}>
          <Icon name="download" size={18} />
          <span>기록을 백업한 지 오래됐어요. 설정에서 내보내기 해두세요.</span>
          <Icon name="chevronRight" size={16} />
        </button>
      )}

      {state.routines.length > 1 && (
        <>
          <div className="section-head">
            <h2 className="t-section">다른 루틴</h2>
            <button type="button" className="btn btn-ghost btn-sm" onClick={onGoRoutines}>
              전체 보기
            </button>
          </div>
          <div className="group">
            {state.routines
              .filter((r) => r.id !== next?.id)
              .slice(0, 4)
              .map((r) => (
                <div key={r.id} className="group-row">
                  <span className="group-row-main">
                    <span className="t-headline">{r.name}</span>
                    <span className="t-caption c-3 ellipsis">{routineSummary(r)}</span>
                  </span>
                  <button type="button" className="icon-btn start-btn" aria-label={`${r.name} 시작`} onClick={() => start(r)}>
                    <Icon name="play" size={14} />
                  </button>
                </div>
              ))}
          </div>
        </>
      )}

      <button type="button" className="btn btn-secondary btn-lg btn-block free-start" onClick={() => start(null)}>
        <Icon name="plus" size={18} /> 루틴 없이 자유 운동
      </button>

      {latest && (
        <>
          <div className="section-head">
            <h2 className="t-section">최근 운동</h2>
          </div>
          <div className="card recent-card">
            <div className="row-between">
              <span className="t-headline">{latest.routineName}</span>
              <span className="t-caption c-3">{relativeDay(latest.startedAt, now)}</span>
            </div>
            <div className="mini-stats">
              <span>
                <strong className="num">{formatDuration(sessionDuration(latest))}</strong>
                <small>시간</small>
              </span>
              <span>
                <strong className="num">{formatVolume(sessionVolume(latest))}</strong>
                <small>볼륨</small>
              </span>
              <span>
                <strong className="num">{doneSets(latest)}</strong>
                <small>세트</small>
              </span>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
