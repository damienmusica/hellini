import { Icon } from '../../components/Icon';
import { Ring } from '../../components/Ring';
import { Sheet } from '../../components/Sheet';
import { nextPendingSet } from '../../lib/reducer';
import { formatSet } from '../../lib/stats';
import { useStore } from '../../lib/store';
import { formatCountdown } from '../../lib/timer';
import type { ActiveSession } from '../../lib/types';
import { setLabels } from './ExerciseCard';

export function nextSetText(a: ActiveSession): string | null {
  if (!a.rest) return null;
  const next = nextPendingSet(a.exercises, a.rest.exIdx, a.rest.setIdx);
  if (!next) return null;
  const ex = a.exercises[next.exIdx];
  const label = setLabels(ex.sets)[next.setIdx];
  const set = ex.sets[next.setIdx];
  return `${ex.name} ${/\d/.test(label) ? `${label}세트` : label} · ${formatSet(ex.kind, set)}`;
}

function ratio(remainingMs: number, totalSec: number): number {
  return Math.min(1, Math.max(0, remainingMs / (totalSec * 1000)));
}

/** 운동 화면 아래에 떠 있는 휴식·시간 세트 타이머 */
export function RestBar({ a, now, onExpand }: { a: ActiveSession; now: number; onExpand: () => void }) {
  const { dispatch } = useStore();

  if (a.work) {
    const ex = a.exercises[a.work.exIdx];
    const remaining = a.work.endsAt - now;
    return (
      <div className="rest-bar is-work" role="timer" aria-label="운동 타이머">
        <div className="rest-bar-progress" style={{ transform: `scaleX(${ratio(remaining, a.work.totalSec)})` }} />
        <button type="button" className="rest-bar-main" onClick={onExpand}>
          <span className="t-caption">{ex?.name}</span>
          <span className="rest-bar-time num">{formatCountdown(remaining)}</span>
        </button>
        <button type="button" className="btn btn-sm btn-pill rest-pill" onClick={() => dispatch({ type: 'work/cancel' })}>
          중지
        </button>
      </div>
    );
  }

  if (!a.rest) return null;
  const remaining = a.rest.endsAt - now;
  const next = nextSetText(a);
  return (
    <div className={`rest-bar${remaining <= 3000 ? ' is-ending' : ''}`} role="timer" aria-label="휴식 타이머">
      <div className="rest-bar-progress" style={{ transform: `scaleX(${ratio(remaining, a.rest.totalSec)})` }} />
      <button type="button" className="rest-bar-main" onClick={onExpand} aria-label="휴식 타이머 크게 보기">
        <span className="t-caption">{next ? `다음 · ${next}` : '휴식'}</span>
        <span className="rest-bar-time num">{formatCountdown(remaining)}</span>
      </button>
      <button type="button" className="btn btn-sm btn-pill rest-pill" onClick={() => dispatch({ type: 'rest/adjust', deltaSec: -15, now: Date.now() })}>
        −15
      </button>
      <button type="button" className="btn btn-sm btn-pill rest-pill" onClick={() => dispatch({ type: 'rest/adjust', deltaSec: 15, now: Date.now() })}>
        +15
      </button>
      <button type="button" className="btn btn-sm btn-pill btn-primary" onClick={() => dispatch({ type: 'rest/clear' })}>
        건너뛰기
      </button>
    </div>
  );
}

/** 휴식 타이머 크게 보기 */
export function RestSheet({ a, now, onClose }: { a: ActiveSession; now: number; onClose: () => void }) {
  const { dispatch } = useStore();
  const timer = a.work ?? a.rest;
  if (!timer) return null;
  const remaining = timer.endsAt - now;
  const isWork = a.work !== null;
  const next = nextSetText(a);

  return (
    <Sheet onClose={onClose} label={isWork ? '운동 타이머' : '휴식 타이머'}>
      <div className={`rest-big${isWork ? ' is-work' : ''}${remaining <= 3000 ? ' is-ending' : ''}`}>
        <p className="t-headline c-2">{isWork ? a.exercises[a.work!.exIdx]?.name : '휴식'}</p>
        <div className="rest-ring">
          <Ring size={260} stroke={12} progress={ratio(remaining, timer.totalSec)} />
          <span className="t-display num rest-ring-time">{formatCountdown(remaining)}</span>
        </div>
        {next && !isWork && <p className="t-caption c-2 center">다음 · {next}</p>}
        {isWork ? (
          <div className="btn-row">
            <button type="button" className="btn btn-secondary btn-lg" onClick={() => dispatch({ type: 'work/cancel' })}>
              중지
            </button>
          </div>
        ) : (
          <div className="btn-row">
            <button type="button" className="btn btn-secondary btn-lg" onClick={() => dispatch({ type: 'rest/adjust', deltaSec: -15, now: Date.now() })}>
              −15초
            </button>
            <button type="button" className="btn btn-secondary btn-lg" onClick={() => dispatch({ type: 'rest/adjust', deltaSec: 15, now: Date.now() })}>
              +15초
            </button>
            <button
              type="button"
              className="btn btn-primary btn-lg"
              onClick={() => {
                dispatch({ type: 'rest/clear' });
                onClose();
              }}
            >
              <Icon name="chevronRight" size={18} /> 건너뛰기
            </button>
          </div>
        )}
      </div>
    </Sheet>
  );
}
