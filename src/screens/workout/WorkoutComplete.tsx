import { useMemo, useState, type CSSProperties } from 'react';
import { Icon } from '../../components/Icon';
import { MuscleMap } from '../../components/MuscleMap';
import { useToast } from '../../components/Toast';
import { WeekStrip } from '../../components/WeekStrip';
import { muscleSets, PR_LABEL, sessionPRs } from '../../lib/records';
import { renderShareCard, shareImage } from '../../lib/shareCard';
import {
  bestSet,
  doneSets,
  formatDuration,
  formatSet,
  sessionDuration,
  sessionsThisWeek,
  sessionVolume,
  weekDays,
  weekStreak,
} from '../../lib/stats';
import { useStore } from '../../lib/store';
import { useCountUp } from '../../lib/useCountUp';

const MILESTONES = new Set([1, 5, 10, 20, 30, 50, 75, 100, 150, 200, 300, 365, 500]);

function CountUp({ value, format }: { value: number; format: (n: number) => string }) {
  const v = useCountUp(value);
  return <>{format(v)}</>;
}

const CONFETTI_COLORS = ['var(--accent)', 'var(--gold)', 'var(--success)', 'var(--work)'];

function Confetti() {
  const pieces = useMemo(
    () =>
      Array.from({ length: 28 }, (_, i) => ({
        left: Math.random() * 100,
        delay: Math.random() * 0.25,
        rotate: Math.random() * 360,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        drift: (Math.random() - 0.5) * 80,
      })),
    [],
  );
  return (
    <div className="confetti" aria-hidden="true">
      {pieces.map((p, i) => (
        <span
          key={i}
          style={
            {
              left: `${p.left}%`,
              background: p.color,
              animationDelay: `${p.delay}s`,
              '--rot': `${p.rotate}deg`,
              '--drift': `${p.drift}px`,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}

export function WorkoutComplete({ sessionId, onClose }: { sessionId: string; onClose: () => void }) {
  const { state } = useStore();
  const toast = useToast();
  const [sharing, setSharing] = useState(false);
  const index = state.history.findIndex((s) => s.id === sessionId);
  const session = state.history[index];
  const prs = useMemo(() => (session ? sessionPRs(session, state.history) : []), [session, state.history]);
  const muscles = useMemo(() => (session ? muscleSets([session]) : new Map()), [session]);

  if (!session) return null;
  const ordinal = state.history.length - index;
  const now = Date.now();
  const celebrate = prs.length > 0 || MILESTONES.has(ordinal);
  const streak = weekStreak(state.history, now);
  const thisWeek = sessionsThisWeek(state.history, now);
  const goal = state.settings.weeklyGoal;
  const prExercises = new Set(prs.map((p) => p.exercise));

  const share = async () => {
    setSharing(true);
    try {
      const days = weekDays(state.history, now).map((d) => ({ done: d.done, today: d.today }));
      const blob = await renderShareCard(session, ordinal, prs, { days, label: `${thisWeek}회 운동${streak > 1 ? ` · ${streak}주 연속` : ''}` });
      if (!blob) throw new Error('canvas');
      const result = await shareImage(blob, `오운완-${new Date(session.startedAt).toISOString().slice(0, 10)}.png`);
      if (result === 'downloaded') toast({ tone: 'success', icon: 'download', title: '공유 이미지를 저장했어요' });
    } catch {
      toast({ icon: 'info', title: '이미지를 만들지 못했어요' });
    } finally {
      setSharing(false);
    }
  };

  return (
    <section className="complete" aria-label="운동 완료">
      {celebrate && <Confetti />}
      <div className="complete-hero">
        <div className={`complete-medal${prs.length > 0 ? ' is-gold' : ''}`}>
          <Icon name={prs.length > 0 ? 'trophy' : 'check'} size={44} strokeWidth={2.4} />
        </div>
        <h1 className="t-title">{ordinal}번째 운동 완료!</h1>
        <p className="c-2">
          {session.routineName} · {thisWeek >= goal ? '이번 주 목표 달성! 🎉' : '오늘도 해냈어요 💪'}
        </p>
      </div>

      <div className="complete-stats">
        <div className="card">
          <span className="t-overline c-3">시간</span>
          <span className="t-stat">
            <CountUp value={Math.round(sessionDuration(session) / 60000)} format={(n) => formatDuration(Math.round(n) * 60000)} />
          </span>
        </div>
        <div className="card">
          <span className="t-overline c-3">볼륨</span>
          <span className="t-stat">
            <CountUp value={sessionVolume(session)} format={(n) => `${Math.round(n).toLocaleString('ko-KR')}kg`} />
          </span>
        </div>
        <div className="card">
          <span className="t-overline c-3">세트</span>
          <span className="t-stat">
            <CountUp value={doneSets(session)} format={(n) => `${Math.round(n)}`} />
          </span>
        </div>
        <div className={`card${prs.length > 0 ? ' is-gold' : ''}`}>
          <span className="t-overline c-3">새 기록</span>
          <span className="t-stat">
            <CountUp value={prs.length} format={(n) => `${Math.round(n)}`} />
          </span>
        </div>
      </div>

      {prs.length > 0 && (
        <div className="card pr-list">
          <h2 className="t-headline">
            <Icon name="trophy" size={18} /> 새 기록
          </h2>
          <ul>
            {prs.map((p, i) => (
              <li key={i}>
                <span>{p.exercise}</span>
                <span className="pr-chip">
                  {PR_LABEL[p.kind]} {p.value}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="card">
        <div className="row-between">
          <h2 className="t-headline">이번 주</h2>
          <span className="t-caption c-2">
            {streak > 1 && (
              <span className="streak">
                <Icon name="flame" size={14} /> {streak}주 연속
              </span>
            )}{' '}
            목표 {Math.min(thisWeek, goal)}/{goal}회
          </span>
        </div>
        <WeekStrip history={state.history} now={now} />
      </div>

      <div className="card">
        <h2 className="t-headline">오늘 쓴 근육</h2>
        <MuscleMap values={muscles} />
      </div>

      <div className="card">
        <h2 className="t-headline">운동 기록</h2>
        <ul className="summary-list">
          {session.exercises.map((e) => {
            const best = bestSet(e);
            return (
              <li key={e.id}>
                <span>
                  {e.name}
                  {prExercises.has(e.name) && <Icon name="trophy" size={14} className="gold" />}
                </span>
                <span className="c-2 num">
                  {e.sets.filter((s) => s.done && s.type !== 'warmup').length}세트{best ? ` · 최고 ${formatSet(e.kind, best)}` : ''}
                </span>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="complete-actions">
        <button type="button" className="btn btn-primary btn-lg btn-block" onClick={share} disabled={sharing}>
          <Icon name="share" size={20} /> {sharing ? '이미지 만드는 중…' : '#오운완 공유하기'}
        </button>
        <button type="button" className="btn btn-secondary btn-lg btn-block" onClick={onClose}>
          닫기
        </button>
      </div>
    </section>
  );
}
