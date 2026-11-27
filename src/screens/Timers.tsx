import { useCallback, useEffect, useRef, useState } from 'react';
import { Icon } from '../components/Icon';
import { Ring } from '../components/Ring';
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
  type IntervalPhase,
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

  const report = useCallback<Report>((m, r) => setRunning((prev) => (prev[m] === r ? prev : { ...prev, [m]: r })), []);

  useEffect(() => {
    onRunningChange(Object.values(running).some(Boolean));
  }, [running, onRunningChange]);

  return (
    <section className="screen">
      <header className="screen-header">
        <h1 className="t-title">타이머</h1>
      </header>
      <div className="segmented" role="tablist" aria-label="타이머 종류">
        {MODES.map(([m, label]) => (
          <button key={m} type="button" role="tab" aria-selected={mode === m} className={mode === m ? 'is-on' : ''} onClick={() => setMode(m)}>
            {label}
            {running[m] && mode !== m && <span className="live-dot" aria-label="실행 중" />}
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
  return { clock, now, elapsed: clockElapsed(clock, now), started: clock.running || clock.base > 0, start, pause, reset };
}

type TimerClock = ReturnType<typeof useTimerClock>;

function StepRow({ label, value, display, step, min, max, onChange }: { label: string; value: number; display: string; step: number; min: number; max: number; onChange: (v: number) => void }) {
  return (
    <div className="step-row">
      <span className="t-headline">{label}</span>
      <div className="step-ctrl">
        <button type="button" className="icon-btn" aria-label={`${label} 줄이기`} disabled={value <= min} onClick={() => onChange(Math.max(min, value - step))}>
          <Icon name="minus" size={18} strokeWidth={2.6} />
        </button>
        <span className="step-value num" aria-label={`${label} ${display}`}>
          {display}
        </span>
        <button type="button" className="icon-btn" aria-label={`${label} 늘리기`} disabled={value >= max} onClick={() => onChange(Math.min(max, value + step))}>
          <Icon name="plus" size={18} strokeWidth={2.6} />
        </button>
      </div>
    </div>
  );
}

function Controls({ t, done }: { t: TimerClock; done: boolean }) {
  return (
    <div className="timer-controls">
      <button type="button" className="round-btn" aria-label="리셋" onClick={t.reset}>
        <Icon name="reset" size={24} />
      </button>
      {!done &&
        (t.clock.running ? (
          <button type="button" className="round-btn is-primary" aria-label="일시정지" onClick={t.pause}>
            <Icon name="pause" size={30} strokeWidth={3} />
          </button>
        ) : (
          <button type="button" className="round-btn is-primary" aria-label="계속" onClick={t.start}>
            <Icon name="play" size={28} />
          </button>
        ))}
      <span className="round-btn is-ghost" aria-hidden="true" />
    </div>
  );
}

const INTERVAL_PRESETS: { name: string; cfg: IntervalConfig }[] = [
  { name: '타바타', cfg: { prepareSec: 10, workSec: 20, restSec: 10, rounds: 8 } },
  { name: '30/30', cfg: { prepareSec: 10, workSec: 30, restSec: 30, rounds: 10 } },
  { name: '40/20', cfg: { prepareSec: 10, workSec: 40, restSec: 20, rounds: 8 } },
  { name: 'EMOM', cfg: { prepareSec: 10, workSec: 60, restSec: 0, rounds: 10 } },
];

const PHASE_LABEL: Record<IntervalPhase, string> = { prepare: '준비', work: '운동', rest: '휴식', done: '완료!' };

function sameCfg(a: IntervalConfig, b: IntervalConfig) {
  return a.workSec === b.workSec && a.restSec === b.restSec && a.rounds === b.rounds && a.prepareSec === b.prepareSec;
}

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
        <div className="preset-grid">
          {INTERVAL_PRESETS.map((p) => (
            <button key={p.name} type="button" className={`preset${sameCfg(p.cfg, cfg) ? ' is-on' : ''}`} onClick={() => setCfg(p.cfg)}>
              <span className="t-headline">{p.name}</span>
              <span className="t-caption c-2">
                {p.cfg.restSec > 0 ? `${p.cfg.workSec}초 / ${p.cfg.restSec}초` : `${p.cfg.workSec}초마다`} × {p.cfg.rounds}
              </span>
            </button>
          ))}
        </div>
        <div className="group">
          <StepRow label="운동" value={cfg.workSec} display={formatSeconds(cfg.workSec)} step={5} min={5} max={600} onChange={(workSec) => setCfg({ workSec })} />
          <StepRow label="휴식" value={cfg.restSec} display={cfg.restSec ? formatSeconds(cfg.restSec) : '없음'} step={5} min={0} max={600} onChange={(restSec) => setCfg({ restSec })} />
          <StepRow label="라운드" value={cfg.rounds} display={`${cfg.rounds}회`} step={1} min={1} max={50} onChange={(rounds) => setCfg({ rounds })} />
          <StepRow label="준비" value={cfg.prepareSec} display={cfg.prepareSec ? formatSeconds(cfg.prepareSec) : '없음'} step={5} min={0} max={30} onChange={(prepareSec) => setCfg({ prepareSec })} />
        </div>
        <button type="button" className="btn btn-primary btn-lg btn-block" onClick={t.start}>
          <Icon name="play" size={16} /> 시작 · 총 {formatSeconds(Math.round(intervalTotalMs(cfg) / 1000))}
        </button>
      </div>
    );
  }

  const progress = ph.phaseTotalMs > 0 ? ph.remainingMs / ph.phaseTotalMs : 0;
  const nextLabel =
    ph.phase === 'prepare'
      ? `다음 · 운동 ${formatSeconds(cfg.workSec)}`
      : ph.phase === 'work'
        ? ph.round < cfg.rounds
          ? cfg.restSec > 0
            ? `다음 · 휴식 ${formatSeconds(cfg.restSec)}`
            : `다음 · ${ph.round + 1}라운드`
          : '마지막 라운드!'
        : ph.phase === 'rest'
          ? `다음 · ${ph.round + 1}라운드 운동`
          : '수고했어요';

  return (
    <div className="timer-pane">
      <div className={`stage stage-${ph.phase}`} role="timer" aria-label="인터벌 타이머">
        <div className="stage-top">
          <span className="stage-phase">{PHASE_LABEL[ph.phase]}</span>
          <span className="stage-round num">
            {ph.round} / {cfg.rounds}
          </span>
        </div>
        <div className="stage-ring">
          <Ring size={250} stroke={10} progress={progress} />
          <span className="stage-time num">{formatCountdown(ph.remainingMs)}</span>
        </div>
        <div className="stage-bottom">
          <span>{nextLabel}</span>
          <span className="num">남은 시간 {formatCountdown(intervalTotalMs(cfg) - t.elapsed)}</span>
        </div>
      </div>
      <Controls t={t} done={ph.phase === 'done'} />
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
    const next = Math.max(5, sec);
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
        <div className="chip-wrap">
          {COUNTDOWN_PRESETS.map((sec) => (
            <button key={sec} type="button" className={`chip${durationSec === sec ? ' is-on' : ''}`} onClick={() => setDuration(sec)}>
              {formatSeconds(sec)}
            </button>
          ))}
        </div>
        <div className="group">
          <StepRow label="분" value={Math.floor(durationSec / 60)} display={`${Math.floor(durationSec / 60)}분`} step={1} min={0} max={180} onChange={(m) => setDuration(m * 60 + (durationSec % 60))} />
          <StepRow label="초" value={durationSec % 60} display={`${durationSec % 60}초`} step={5} min={0} max={55} onChange={(s) => setDuration(Math.floor(durationSec / 60) * 60 + s)} />
        </div>
        <button type="button" className="btn btn-primary btn-lg btn-block" onClick={t.start}>
          <Icon name="play" size={16} /> {formatSeconds(durationSec)} 시작
        </button>
      </div>
    );
  }

  return (
    <div className="timer-pane">
      <div className={`stage ${done ? 'stage-done' : 'stage-rest'}`} role="timer" aria-label="카운트다운">
        <div className="stage-top">
          <span className="stage-phase">{done ? '끝!' : '카운트다운'}</span>
          <span className="stage-round num">{formatSeconds(durationSec)}</span>
        </div>
        <div className="stage-ring">
          <Ring size={250} stroke={10} progress={Math.max(0, remaining / (durationSec * 1000))} />
          <span className="stage-time num">{formatCountdown(remaining)}</span>
        </div>
        <div className="stage-bottom">
          {!done && (
            <button type="button" className="stage-btn" onClick={() => setDuration(durationSec + 30)}>
              +30초
            </button>
          )}
        </div>
      </div>
      <Controls t={t} done={done} />
    </div>
  );
}

function Stopwatch({ report }: { report: Report }) {
  const t = useTimerClock('stopwatch', report, 50);
  const [laps, setLaps] = useState<number[]>([]);

  return (
    <div className="timer-pane">
      <div className="stage stage-watch" role="timer" aria-label="스톱워치">
        <span className="stage-watch-time num">{formatElapsed(t.elapsed, true)}</span>
      </div>
      <div className="timer-controls">
        {t.clock.running ? (
          <button type="button" className="round-btn" onClick={() => setLaps((l) => [t.elapsed, ...l])}>
            랩
          </button>
        ) : (
          <button
            type="button"
            className="round-btn"
            disabled={!t.started}
            onClick={() => {
              t.reset();
              setLaps([]);
            }}
          >
            리셋
          </button>
        )}
        {t.clock.running ? (
          <button type="button" className="round-btn is-danger" aria-label="정지" onClick={t.pause}>
            <Icon name="pause" size={30} strokeWidth={3} />
          </button>
        ) : (
          <button type="button" className="round-btn is-primary" aria-label={t.started ? '계속' : '시작'} onClick={t.start}>
            <Icon name="play" size={28} />
          </button>
        )}
        <span className="round-btn is-ghost" aria-hidden="true" />
      </div>
      {laps.length > 0 && (
        <ol className="group lap-list">
          {laps.map((total, i) => {
            const prev = laps[i + 1] ?? 0;
            return (
              <li key={laps.length - i} className="group-row">
                <span className="group-row-main">랩 {laps.length - i}</span>
                <span className="num">{formatElapsed(total - prev, true)}</span>
                <span className="num c-3">{formatElapsed(total, true)}</span>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
