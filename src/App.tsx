import { useEffect, useRef, useState } from 'react';
import { Icon, type IconName } from './components/Icon';
import { useToast } from './components/Toast';
import { cue, setHapticsEnabled, unlockAudio } from './lib/cues';
import { useCountdownTicks, useNow, useWakeLock } from './lib/hooks';
import { useStore } from './lib/store';
import { formatCountdown, formatElapsed } from './lib/timer';
import { History } from './screens/History';
import { Home } from './screens/Home';
import { Onboarding } from './screens/Onboarding';
import { Routines } from './screens/Routines';
import { SettingsSheet } from './screens/Settings';
import { Timers } from './screens/Timers';
import { Workout } from './screens/workout/Workout';
import { WorkoutComplete } from './screens/workout/WorkoutComplete';

type Tab = 'home' | 'routines' | 'timers' | 'history';

const TABS: { id: Tab; label: string; icon: IconName }[] = [
  { id: 'home', label: '홈', icon: 'home' },
  { id: 'routines', label: '루틴', icon: 'list' },
  { id: 'timers', label: '타이머', icon: 'timer' },
  { id: 'history', label: '기록', icon: 'chart' },
];

export default function App() {
  const { state } = useStore();
  const [tab, setTab] = useState<Tab>('home');
  const [workoutOpen, setWorkoutOpen] = useState(state.active !== null);
  const [completedId, setCompletedId] = useState<string | null>(null);
  const [timerRunning, setTimerRunning] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const activeId = state.active?.id;
  const prevActiveId = useRef(activeId);

  useWakeLock(state.active !== null || timerRunning);

  useEffect(() => setHapticsEnabled(state.settings.vibrate), [state.settings.vibrate]);

  // iOS는 사용자 터치가 있어야 오디오가 풀린다. 백그라운드에서 돌아온 뒤에도 다시 풀어준다.
  useEffect(() => {
    window.addEventListener('pointerdown', unlockAudio);
    return () => window.removeEventListener('pointerdown', unlockAudio);
  }, []);

  // 새 운동이 시작되면 운동 화면을 연다
  useEffect(() => {
    if (activeId && activeId !== prevActiveId.current) setWorkoutOpen(true);
    prevActiveId.current = activeId;
  }, [activeId]);

  const showWorkout = state.active !== null && workoutOpen;
  const overlay = completedId !== null || showWorkout;

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [tab, overlay]);

  if (!state.onboarded) return <Onboarding />;

  return (
    <div className="app">
      {completedId !== null ? (
        <WorkoutComplete
          sessionId={completedId}
          onClose={() => {
            setCompletedId(null);
            setTab('home');
          }}
        />
      ) : (
        showWorkout && (
          <Workout
            onMinimize={() => setWorkoutOpen(false)}
            onFinished={(id) => {
              setWorkoutOpen(false);
              setCompletedId(id);
            }}
          />
        )
      )}

      <main className="content" hidden={overlay}>
        {tab === 'home' && (
          <Home onOpenWorkout={() => setWorkoutOpen(true)} onOpenSettings={() => setSettingsOpen(true)} onGoRoutines={() => setTab('routines')} />
        )}
        {tab === 'routines' && <Routines />}
        {/* 탭을 옮겨도 돌던 타이머가 멈추지 않도록 항상 마운트해 둔다 */}
        <div hidden={tab !== 'timers'}>
          <Timers onRunningChange={setTimerRunning} />
        </div>
        {tab === 'history' && <History onOpenSettings={() => setSettingsOpen(true)} />}
      </main>

      <ActiveSessionWatcher />

      {!overlay && state.active && <MiniBar onOpen={() => setWorkoutOpen(true)} />}

      {!overlay && (
        <nav className="tabbar" aria-label="메뉴">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`tab${tab === t.id ? ' is-on' : ''}`}
              aria-current={tab === t.id ? 'page' : undefined}
              onClick={() => setTab(t.id)}
            >
              <Icon name={t.icon} size={24} strokeWidth={tab === t.id ? 2.4 : 2} />
              <span>{t.label}</span>
            </button>
          ))}
        </nav>
      )}

      {settingsOpen && <SettingsSheet onClose={() => setSettingsOpen(false)} />}
    </div>
  );
}

/**
 * 휴식·시간 세트 타이머는 어느 화면에 있든 돌아야 하므로 화면과 분리해 항상 마운트한다.
 * 0초가 되면 신호를 내고 다음 상태로 넘긴다.
 */
function ActiveSessionWatcher() {
  const { state, dispatch } = useStore();
  const toast = useToast();
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
      toast({ tone: 'success', icon: 'dumbbell', title: '휴식 끝! 다음 세트 가볼까요?' });
    }
  }, [key, remaining, work, state.settings, dispatch, toast]);

  return null;
}

/** 운동 화면을 접었을 때 탭 바 위에 떠 있는 진행 중 표시 */
function MiniBar({ onOpen }: { onOpen: () => void }) {
  const { state } = useStore();
  const now = useNow(true, 500);
  const a = state.active;
  if (!a) return null;
  const status = a.rest
    ? `휴식 ${formatCountdown(a.rest.endsAt - now)}`
    : a.work
      ? `운동 ${formatCountdown(a.work.endsAt - now)}`
      : formatElapsed(now - a.startedAt);
  return (
    <button type="button" className={`mini-bar${a.rest ? ' is-rest' : ''}`} onClick={onOpen} aria-label="진행 중인 운동 열기">
      <span className="mini-dot" />
      <span className="mini-text">
        <span className="t-caption c-2">진행 중</span>
        <span className="mini-title">{a.routineName}</span>
      </span>
      <span className="mini-status num">{status}</span>
      <Icon name="chevronRight" size={18} />
    </button>
  );
}
