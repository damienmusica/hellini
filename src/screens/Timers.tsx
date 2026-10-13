import { useCallback, useEffect, useRef, useState } from 'react';
import { NumberField } from '../components/NumberField';
import { cue } from '../lib/cues';
import { useCountdownTicks, useNow } from '../lib/hooks';
import { useStore } from '../lib/store';
import {
  clockElapsed,
  clockPause,
  clockStart,
  formatCountdown,
  formatElapsed,
  formatSeconds,
  idleClock,
  intervalPhaseAt,
  intervalTotalMs,
  type Clock,
  type IntervalConfig,
} from '../lib/timer';

type Mode = 'interval' | 'countdown' | 'stopwatch';
type Report = (mode: Mode, running: boolean) => void;

const MODES: [Mode, string][] = [
  ['interval', '인터벌'],
  ['countdown', '카운트다운'],
  ['stopwatch', '스톱워치'],
];

const PREFS_KEY = 'hellini:timers';

interface TimerPrefs {
  interval: IntervalConfig;
  countdownSec: number;
}

const defaultPrefs: TimerPrefs = {
  interval: { prepareSec: 10, workSec: 20, restSec: 10, rounds: 8 },
  countdownSec: 60,
};

function loadPrefs(): TimerPrefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (raw) return { ...defaultPrefs, ...(JSON.parse(raw) as Partial<TimerPrefs>) };
  } catch {
    // 기본값 사용
  }
  return defaultPrefs;
}

function savePrefs(patch: Partial<TimerPrefs>): void {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify({ ...loadPrefs(), ...patch }));
  } catch {
    // 저장 못 해도 동작에는 지장 없음
  }
}

export function Timers({ onRunningChange }: { onRunningChange: (running: boolean) => void }) {
  const [mode, setMode] = useState<Mode>('interval');
  const [running, setRunning] = useState<Record<Mode, boolean>>({ interval: false, countdown: false, stopwatch: false });

  const report = useCallback<Report>(
    (m, r) => setRunning((prev) => (prev[m] === r ? prev : { ...prev, [m]: r })),
    [],
  );

  useEffect(() => {
    onRunningChange(Object.values(running).some(Boolean));
  }, [running, onRunningChange]);

  return (
    <section className="screen">
      <header className="screen-header">
        <h1>타이머</h1>
      </header>
      <div className="segmented" role="tablist" aria-label="타이머 종류">
        {MODES.map(([m, label]) => (
          <button key={m} type="button" role="tab" aria-selected={mode === m} className={mode === m ? 'is-on' : ''} onClick={() => setMode(m)}>
            {label}
            {running[m] && mode !== m ? ' •' : ''}
          </button>
        ))}
      </div>
      {/* 모드를 바꿔도 돌던 타이머가 멈추지 않도록 셋 다 마운트해 둔다 */}
      <div hidden={mode !== 'interval'}>
        <IntervalTimer report={report} />
      </div>
      <div hidden={mode !== 'countdown'}>
        <CountdownTimer report={report} />
      </div>
      <div hidden={mode !== 'stopwatch'}>
        <Stopwatch report={report} />
      </div>
    </section>
  );
}

function useTimerClock(mode: Mode, report: Report, tickMs: number) {
  const [clock, setClock] = useState<Clock>(idleClock);
  const now = useNow(clock.running, tickMs);
  useEffect(() => report(mode, clock.running), [mode, clock.running, report]);
  const start = useCallback(() => setClock((c) => clockStart(c, Date.now())), []);
  const pause = useCallback(() => setClock((c) => clockPause(c, Date.now())), []);
  const reset = useCallback(() => setClock(idleClock), []);
  return {
    clock,
    now,
    elapsed: clockElapsed(clock, now),
    started: clock.running || clock.base > 0,
    start,
    pause,
    reset,
  };
}

const INTERVAL_PRESETS: { label: string; cfg: IntervalConfig }[] = [
  { label: '타바타 20/10 ×8', cfg: { prepareSec: 10, workSec: 20, restSec: 10, rounds: 8 } },
  { label: '30/30 ×10', cfg: { prepareSec: 10, workSec: 30, restSec: 30, rounds: 10 } },
  { label: '40/20 ×8', cfg: { prepareSec: 10, workSec: 40, restSec: 20, rounds: 8 } },
  { label: 'EMOM 1분 ×10', cfg: { prepareSec: 10, workSec: 60, restSec: 0, rounds: 10 } },
];

const PHASE_LABEL = { prepare: '준비', work: '운동', rest: '휴식', done: '완료!' } as const;

function IntervalTimer({ report }: { report: Report }) {
  const { state } = useStore();
  const [cfg, setCfgState] = useState<IntervalConfig>(() => loadPrefs().interval);
  const t = useTimerClock('interval', report, 100);
  const ph = intervalPhaseAt(cfg, t.elapsed);
  const key = t.started ? `${ph.phase}-${ph.round}` : null;
  const prevKey = useRef<string | null>(null);
  const settings = state.settings;

  const setCfg = (patch: Partial<IntervalConfig>) =>
    setCfgState((c) => {
      const next = { ...c, ...patch };
      savePrefs({ interval: next });
      return next;
    });

  useCountdownTicks(ph.phase === 'done' ? null : key, ph.remainingMs, settings);

  useEffect(() => {
    const prev = prevKey.current;
    prevKey.current = key;
    if (key === null || key === prev) return;
    if (prev === null) {
      // 준비 시간 없이 바로 시작하는 경우
      if (ph.phase === 'work') cue('go', settings);
      return;
    }
    if (ph.phase === 'work') cue('go', settings);
    else if (ph.phase === 'rest') cue('rest', settings);
    else if (ph.phase === 'done') cue('end', settings);
  }, [key, ph.phase, settings]);

  const { pause } = t;
  useEffect(() => {
    if (ph.phase === 'done' && t.clock.running) pause();
  }, [ph.phase, t.clock.running, pause]);

  if (!t.started) {
    return (
      <div className="timer-pane">
        <div className="chip-row">
          {INTERVAL_PRESETS.map((p) => (
            <button key={p.label} type="button" className="chip chip-preset" onClick={() => setCfg(p.cfg)}>
              {p.label}
            </button>
          ))}
        </div>
        <div className="field-grid">
          <label className="field">
            <span>운동(초)</span>
            <NumberField value={cfg.workSec} min={1} max={3600} label="운동 시간" onChange={(workSec) => setCfg({ workSec })} />
          </label>
          <label className="field">
            <span>휴식(초)</span>
            <NumberField value={cfg.restSec} max={3600} label="휴식 시간" onChange={(restSec) => setCfg({ restSec })} />
          </label>
          <label className="field">
            <span>라운드</span>
            <NumberField value={cfg.rounds} min={1} max={99} label="라운드" onChange={(rounds) => setCfg({ rounds })} />
          </label>
          <label className="field">
            <span>준비(초)</span>
            <NumberField value={cfg.prepareSec} max={60} label="준비 시간" onChange={(prepareSec) => setCfg({ prepareSec })} />
          </label>
        </div>
        <p className="muted center">총 {formatSeconds(Math.round(intervalTotalMs(cfg) / 1000))}</p>
        <button type="button" className="btn btn-primary btn-xl" onClick={t.start}>
          ▶ 시작
        </button>
      </div>
    );
  }

  const progress = ph.phaseTotalMs > 0 ? ph.remainingMs / ph.phaseTotalMs : 0;
  return (
    <div className="timer-pane">
      <div className={`panel panel-${ph.phase}`} aria-label="인터벌 타이머">
        <p className="panel-label">{PHASE_LABEL[ph.phase]}</p>
        <p className="big-time">{formatCountdown(ph.remainingMs)}</p>
        <div className="progress">
          <div className="progress-bar" style={{ width: `${progress * 100}%` }} />
        </div>
        <p className="panel-next">
          라운드 {ph.round} / {cfg.rounds} · 전체 남은 시간 {formatCountdown(intervalTotalMs(cfg) - t.elapsed)}
        </p>
      </div>
      <TimerControls t={t} done={ph.phase === 'done'} />
    </div>
  );
}

const COUNTDOWN_PRESETS = [30, 60, 90, 120, 180, 300];

function CountdownTimer({ report }: { report: Report }) {
  const { state } = useStore();
  const [durationSec, setDurationState] = useState(() => loadPrefs().countdownSec);
  const t = useTimerClock('countdown', report, 100);
  const remaining = durationSec * 1000 - t.elapsed;
  const done = t.started && remaining <= 0;

  const setDuration = (sec: number) => {
    const next = Math.max(1, sec);
    setDurationState(next);
    savePrefs({ countdownSec: next });
  };

  useCountdownTicks(t.started ? `countdown-${durationSec}` : null, remaining, state.settings);

  const { pause } = t;
  useEffect(() => {
    if (t.clock.running && remaining <= 0) {
      cue('end', state.settings);
      pause();
    }
  }, [t.clock.running, remaining, pause, state.settings]);

  if (!t.started) {
    return (
      <div className="timer-pane">
        <div className="chip-row">
          {COUNTDOWN_PRESETS.map((sec) => (
            <button
              key={sec}
              type="button"
              className={`chip chip-preset${durationSec === sec ? ' chip-current' : ''}`}
              onClick={() => setDuration(sec)}
            >
              {formatSeconds(sec)}
            </button>
          ))}
        </div>
        <div className="field-grid">
          <label className="field">
            <span>분</span>
            <NumberField
              value={Math.floor(durationSec / 60)}
              max={180}
              label="분"
              onChange={(m) => setDuration(m * 60 + (durationSec % 60))}
            />
          </label>
          <label className="field">
            <span>초</span>
            <NumberField
              value={durationSec % 60}
              max={59}
              label="초"
              onChange={(s) => setDuration(Math.floor(durationSec / 60) * 60 + s)}
            />
          </label>
        </div>
        <button type="button" className="btn btn-primary btn-xl" onClick={t.start}>
          ▶ {formatSeconds(durationSec)} 시작
        </button>
      </div>
    );
  }

  return (
    <div className="timer-pane">
      <div className={`panel ${done ? 'panel-done' : 'panel-rest'}`} aria-label="카운트다운">
        <p className="panel-label">{done ? '끝!' : '카운트다운'}</p>
        <p className="big-time">{formatCountdown(remaining)}</p>
        <div className="progress">
          <div className="progress-bar" style={{ width: `${Math.max(0, remaining / (durationSec * 1000)) * 100}%` }} />
        </div>
      </div>
      {!done && (
        <button type="button" className="btn btn-block" onClick={() => setDuration(durationSec + 30)}>
          +30초
        </button>
      )}
      <TimerControls t={t} done={done} />
    </div>
  );
}

function Stopwatch({ report }: { report: Report }) {
  const t = useTimerClock('stopwatch', report, 50);
  const [laps, setLaps] = useState<number[]>([]);

  return (
    <div className="timer-pane">
      <div className="panel" aria-label="스톱워치">
        <p className="panel-label">스톱워치</p>
        <p className="big-time">{formatElapsed(t.elapsed, true)}</p>
      </div>
      <div className="btn-row">
        {t.clock.running ? (
          <>
            <button type="button" className="btn btn-xl" onClick={() => setLaps((l) => [t.elapsed, ...l])}>
              랩
            </button>
            <button type="button" className="btn btn-primary btn-xl" onClick={t.pause}>
              정지
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              className="btn btn-xl"
              disabled={!t.started}
              onClick={() => {
                t.reset();
                setLaps([]);
              }}
            >
              리셋
            </button>
            <button type="button" className="btn btn-primary btn-xl" onClick={t.start}>
              {t.started ? '계속' : '▶ 시작'}
            </button>
          </>
        )}
      </div>
      {laps.length > 0 && (
        <ol className="lap-list">
          {laps.map((total, i) => {
            const prev = laps[i + 1] ?? 0;
            return (
              <li key={laps.length - i}>
                <span>랩 {laps.length - i}</span>
                <span className="mono">{formatElapsed(total - prev, true)}</span>
                <span className="mono muted">{formatElapsed(total, true)}</span>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

function TimerControls({ t, done }: { t: ReturnType<typeof useTimerClock>; done: boolean }) {
  return (
    <div className="btn-row">
      <button type="button" className="btn btn-xl" onClick={t.reset}>
        리셋
      </button>
      {!done &&
        (t.clock.running ? (
          <button type="button" className="btn btn-primary btn-xl" onClick={t.pause}>
            일시정지
          </button>
        ) : (
          <button type="button" className="btn btn-primary btn-xl" onClick={t.start}>
            계속
          </button>
        ))}
    </div>
  );
}
