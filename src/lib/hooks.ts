import { useEffect, useRef, useState } from 'react';
import { cue } from './cues';
import type { Settings } from './types';

/** active인 동안 주기적으로 현재 시각을 갱신. 앱으로 돌아올 때도 즉시 갱신 */
export function useNow(active: boolean, intervalMs = 200): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    const onVisible = () => setNow(Date.now());
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [active, intervalMs]);
  return now;
}

/** 같은 카운트다운(key) 안에서 3·2·1초가 될 때 tick 신호 */
export function useCountdownTicks(key: string | null, remainingMs: number, settings: Settings): void {
  const last = useRef<{ key: string | null; sec: number }>({ key: null, sec: 0 });
  useEffect(() => {
    const sec = Math.ceil(remainingMs / 1000);
    const prev = last.current;
    if (key !== null && prev.key === key && sec < prev.sec && sec >= 1 && sec <= 3) {
      cue('tick', settings);
    }
    last.current = { key, sec };
  }, [key, remainingMs, settings]);
}

/** 운동·타이머가 도는 동안 화면이 꺼지지 않게 한다 (지원 브라우저만) */
export function useWakeLock(enabled: boolean): void {
  useEffect(() => {
    if (!enabled || !('wakeLock' in navigator)) return;
    let sentinel: WakeLockSentinel | null = null;
    let cancelled = false;

    const acquire = async () => {
      if (document.visibilityState !== 'visible' || (sentinel && !sentinel.released)) return;
      try {
        const s = await navigator.wakeLock.request('screen');
        if (cancelled) void s.release();
        else sentinel = s;
      } catch {
        // 배터리 절약 모드 등에서 거절될 수 있다
      }
    };

    void acquire();
    const onVisible = () => {
      if (document.visibilityState === 'visible') void acquire();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
      void sentinel?.release();
    };
  }, [enabled]);
}
