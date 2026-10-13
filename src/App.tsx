import { useEffect, useRef, useState, type JSX } from 'react';
import { IconDumbbell, IconHistory, IconList, IconTimer } from './components/Icons';
import { cue, unlockAudio } from './lib/cues';
import { useCountdownTicks, useNow, useWakeLock } from './lib/hooks';
import { useStore } from './lib/store';
import { formatCountdown, formatElapsed } from './lib/timer';
import { History } from './screens/History';
import { Routines } from './screens/Routines';
import { Timers } from './screens/Timers';
import { Today } from './screens/Today';
import { Workout } from './screens/Workout';

type Tab = 'today' | 'routines' | 'timers' | 'history';

const TABS: { id: Tab; label: string; Icon: () => JSX.Element }[] = [
  { id: 'today', label: '운동', Icon: IconDumbbell },
  { id: 'routines', label: '루틴', Icon: IconList },
  { id: 'timers', label: '타이머', Icon: IconTimer },
  { id: 'history', label: '기록', Icon: IconHistory },
];

export default function App() {
  const { state } = useStore();
  const [tab, setTab] = useState<Tab>('today');
  const [timerRunning, setTimerRunning] = useState(false);

  useWakeLock(state.active !== null || timerRunning);

  // iOS는 사용자 터치가 있어야 오디오가 풀린다. 백그라운드에서 돌아온 뒤에도 다시 풀어준다.
  useEffect(() => {
    window.addEventListener('pointerdown', unlockAudio);
    return () => window.removeEventListener('pointerdown', unlockAudio);
  }, []);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [tab]);

  return (
    <div className="app">
      <main className="content">
        {tab === 'today' && (state.active ? <Workout /> : <Today onGoRoutines={() => setTab('routines')} />)}
        {tab === 'routines' && <Routines />}
        <div hidden={tab !== 'timers'}>
          <Timers onRunningChange={setTimerRunning} />
        </div>
        {tab === 'history' && <History />}
      </main>

      <ActiveSessionWatcher />
      {state.active && tab !== 'today' && <ActivePill onOpen={() => setTab('today')} />}

      <nav className="tabbar" aria-label="메뉴">
        {TABS.map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            className={`tab${tab === id ? ' is-on' : ''}`}
            aria-current={tab === id ? 'page' : undefined}
            onClick={() => setTab(id)}
          >
            <Icon />
            <span>{label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}

/**
 * 휴식·시간 세트 타이머는 어느 탭에 있든 돌아야 하므로 화면과 분리해 항상 마운트한다.
 * 0초가 되면 신호를 내고 다음 상태로 넘긴다.
 */
function ActiveSessionWatcher() {
  const { state, dispatch } = useStore();
  const a = state.active;
  const work = a?.work ?? null;
  const rest = a?.rest ?? null;
  const target = work ?? rest;
  const now = useNow(target !== null);
  const remaining = target ? target.endsAt - now : 0;
  const key = work ? `work-${work.endsAt}` : rest ? `rest-${rest.endsAt}` : null;
  const handled = useRef<string | null>(null);

  useCountdownTicks(key, remaining, state.settings);

  useEffect(() => {
    if (key === null || remaining > 0 || handled.current === key) return;
    handled.current = key;
    if (work) {
      cue('rest', state.settings);
      // 시간 세트가 끝난 시각부터 휴식을 잰다 (화면이 꺼졌다 켜져도 정확하게)
      dispatch({ type: 'set/complete', exIdx: work.exIdx, setIdx: work.setIdx, now: work.endsAt });
    } else {
      cue('go', state.settings);
      dispatch({ type: 'rest/clear' });
    }
  }, [key, remaining, work, state.settings, dispatch]);

  return null;
}

function ActivePill({ onOpen }: { onOpen: () => void }) {
  const { state } = useStore();
  const now = useNow(true, 500);
  const a = state.active;
  if (!a) return null;
  const label = a.rest
    ? `휴식 ${formatCountdown(a.rest.endsAt - now)}`
    : a.work
      ? `운동 ${formatCountdown(a.work.endsAt - now)}`
      : `운동 중 ${formatElapsed(now - a.startedAt)}`;
  return (
    <button type="button" className={`active-pill${a.rest ? ' is-rest' : ''}`} onClick={onOpen}>
      {label} ›
    </button>
  );
}
