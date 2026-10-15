import { useState } from 'react';
import { Icon } from '../components/Icon';
import { PlaceSheet } from '../components/PlaceSheet';
import { WeekStrip } from '../components/WeekStrip';
import { needsBodyCheck } from '../lib/body';
import { MAIN_PLACE_ID, unavailableIn } from '../lib/places';
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

/** 같은 프로그램 안에서 몇 번째 차례인지 (프로그램이 아니면 null) */
function cyclePosition(routines: Routine[], r: Routine): { program: string; index: number; total: number } | null {
  if (!r.note) return null;
  const group = routines.filter((x) => x.note === r.note);
  if (group.length < 2) return null;
  return { program: r.note, index: group.indexOf(r) + 1, total: group.length };
}

interface Props {
  onOpenWorkout: () => void;
  onOpenSettings: () => void;
  onGoRoutines: () => void;
  onGoBody?: () => void;
}

/**
 * 홈: 오늘 무엇을 할지가 먼저. 진행 중인 운동이 있으면 재개가 유일한 주요 행동이다.
 * 주간 목표는 작은 진행 요약으로, 다른 루틴과 최근 기록은 그 아래.
 */
export function Home({ onOpenWorkout, onOpenSettings, onGoRoutines, onGoBody }: Props) {
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
  const [placeOpen, setPlaceOpen] = useState<'list' | 'review' | null>(null);
  const place = state.places.find((p) => p.id === state.settings.placeId);
  const away = place && place.id !== MAIN_PLACE_ID;
  const missing = next && place ? unavailableIn(place, next.exercises) : [];
  const cycle = next ? cyclePosition(state.routines, next) : null;

  const start = (routine: Routine | null) => {
    if (state.active) {
      onOpenWorkout();
      return;
    }
    // 이 장소에서 못 하는 종목이 있으면 시작 전에 대체안을 검토한다
    if (routine && routine === next && missing.length > 0) {
      setPlaceOpen('review');
      return;
    }
    dispatch({ type: 'session/start', routine, now: Date.now() });
  };

  const placeChip = (
    <button type="button" className={`place-chip${away ? ' is-away' : ''}`} onClick={() => setPlaceOpen('list')} aria-label={`장소: ${place?.name ?? '평소 헬스장'}`}>
      <Icon name="pin" size={14} />
      {place?.name ?? '평소 헬스장'}
      {missing.length > 0 && <span className="place-chip-note">· 조정 {missing.length}</span>}
      <Icon name="chevronDown" size={14} />
    </button>
  );

  return (
    <section className="screen home">
      <header className="screen-header home-header">
        <div>
          <p className="t-caption c-2">{formatDate(now)}</p>
          <p className="home-brand">헬린이</p>
        </div>
        <button type="button" className="icon-btn" aria-label="설정" onClick={onOpenSettings}>
          <Icon name="gear" size={20} />
        </button>
      </header>

      {state.active ? (
        <div className="hero is-active">
          <span className="t-overline hero-kicker">진행 중인 운동</span>
          <h1 className="t-title">{state.active.routineName}</h1>
          <p className="c-2">
            {doneSets(state.active)}세트 완료 · {formatDuration(now - state.active.startedAt)} 지남
          </p>
          <button type="button" className="btn btn-primary btn-lg btn-block" onClick={onOpenWorkout}>
            이어서 하기
          </button>
        </div>
      ) : next ? (
        <div className="hero">
          <span className="t-overline hero-kicker">
            오늘{cycle ? ` · ${cycle.program} ${cycle.index}/${cycle.total}` : ''}
          </span>
          <h1 className="t-title">{next.name}</h1>
          {placeChip}
          <p className="c-2 hero-summary">{routineSummary(next)}</p>
          <div className="hero-meta">
            <span>{next.exercises.length}종목 · 약 {estimateMinutes(next)}분</span>
            {lastOfNext && <span>지난번 {relativeDay(lastOfNext.startedAt, now)}</span>}
            {missing.length > 0 && <span className="c-warn">조정 필요 {missing.length}종목</span>}
          </div>
          <button type="button" className="btn btn-primary btn-lg btn-block" onClick={() => start(next)}>
            <Icon name="play" size={16} /> 운동 시작
          </button>
        </div>
      ) : (
        <div className="hero">
          <span className="t-overline hero-kicker">시작하기</span>
          <h1 className="t-title">루틴이 아직 없어요</h1>
          <p className="c-2">추천 프로그램에서 고르거나 직접 만들어 보세요.</p>
          <button type="button" className="btn btn-primary btn-lg btn-block" onClick={onGoRoutines}>
            루틴 고르기
          </button>
        </div>
      )}

      <div className="week-row">
        <div className="week-row-head">
          <span className="t-caption c-2">이번 주</span>
          <span className="num week-row-count">
            {Math.min(thisWeek, goal)}
            <span className="c-2">/{goal}회</span>
          </span>
          {streak > 0 && (
            <span className="t-caption c-2">
              <Icon name="flame" size={13} /> {streak}주 연속
            </span>
          )}
        </div>
        <WeekStrip history={state.history} now={now} />
      </div>

      {needsBodyCheck(state.body, now) && onGoBody && (
        <button type="button" className="banner" onClick={onGoBody}>
          <Icon name="scale" size={18} />
          <span>체성분을 잰 지 3개월이 넘었어요. 다시 재서 목표를 점검해요.</span>
          <Icon name="chevronRight" size={16} />
        </button>
      )}
      {needsBackup && (
        <button type="button" className="banner" onClick={onOpenSettings}>
          <Icon name="download" size={18} />
          <span>기록을 백업한 지 오래됐어요. 설정에서 내보내기 해두세요.</span>
          <Icon name="chevronRight" size={16} />
        </button>
      )}

      {!state.active && state.routines.length > 1 && (
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
                    <span className="t-caption c-2 ellipsis">{routineSummary(r)}</span>
                  </span>
                  <button type="button" className="icon-btn start-btn" aria-label={`${r.name} 시작`} onClick={() => start(r)}>
                    <Icon name="play" size={14} />
                  </button>
                </div>
              ))}
          </div>
        </>
      )}

      {!state.active && (
        <div className="home-secondary">
          <button type="button" className="btn btn-ghost" onClick={() => start(null)}>
            <Icon name="plus" size={16} /> 루틴 없이 자유 운동
          </button>
          {!next && placeChip}
        </div>
      )}

      {latest && (
        <>
          <div className="section-head">
            <h2 className="t-section">최근 운동</h2>
          </div>
          <div className="card recent-card">
            <div className="row-between">
              <span className="t-headline">{latest.routineName}</span>
              <span className="t-caption c-2">{relativeDay(latest.startedAt, now)}</span>
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
      {placeOpen && <PlaceSheet routine={next} initialMode={placeOpen} onClose={() => setPlaceOpen(null)} />}
    </section>
  );
}
