import { describe, expect, it } from 'vitest';
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
} from '../../src/lib/timer';

describe('clock', () => {
  it('일시정지한 시간은 경과 시간에 들어가지 않는다', () => {
    let c = clockStart(idleClock, 1_000);
    expect(clockElapsed(c, 4_000)).toBe(3_000);
    c = clockPause(c, 4_000);
    expect(clockElapsed(c, 60_000)).toBe(3_000);
    c = clockStart(c, 60_000);
    expect(clockElapsed(c, 62_500)).toBe(5_500);
  });

  it('이미 도는 시계를 다시 시작해도 기준 시각이 바뀌지 않는다', () => {
    const c = clockStart(idleClock, 1_000);
    expect(clockStart(c, 5_000)).toBe(c);
  });
});

describe('intervalPhaseAt', () => {
  const tabata = { prepareSec: 10, workSec: 20, restSec: 10, rounds: 8 };

  it('준비 → 운동 → 휴식 순서로 진행한다', () => {
    expect(intervalPhaseAt(tabata, 0)).toMatchObject({ phase: 'prepare', round: 1, remainingMs: 10_000 });
    expect(intervalPhaseAt(tabata, 10_000)).toMatchObject({ phase: 'work', round: 1, remainingMs: 20_000 });
    expect(intervalPhaseAt(tabata, 29_500)).toMatchObject({ phase: 'work', round: 1, remainingMs: 500 });
    expect(intervalPhaseAt(tabata, 30_000)).toMatchObject({ phase: 'rest', round: 1, remainingMs: 10_000 });
    expect(intervalPhaseAt(tabata, 40_000)).toMatchObject({ phase: 'work', round: 2 });
  });

  it('마지막 라운드 뒤에는 휴식 없이 끝난다', () => {
    const total = intervalTotalMs(tabata);
    expect(total).toBe((10 + 8 * 20 + 7 * 10) * 1000);
    expect(intervalPhaseAt(tabata, total - 1)).toMatchObject({ phase: 'work', round: 8 });
    expect(intervalPhaseAt(tabata, total)).toMatchObject({ phase: 'done', round: 8, remainingMs: 0 });
  });

  it('휴식 0초(EMOM)면 운동 구간만 이어진다', () => {
    const emom = { prepareSec: 0, workSec: 60, restSec: 0, rounds: 3 };
    expect(intervalPhaseAt(emom, 0)).toMatchObject({ phase: 'work', round: 1 });
    expect(intervalPhaseAt(emom, 60_000)).toMatchObject({ phase: 'work', round: 2 });
    expect(intervalPhaseAt(emom, 180_000)).toMatchObject({ phase: 'done' });
  });
});

describe('format', () => {
  it('남은 시간은 올림, 경과 시간은 내림', () => {
    expect(formatCountdown(59_200)).toBe('1:00');
    expect(formatCountdown(200)).toBe('0:01');
    expect(formatCountdown(-500)).toBe('0:00');
    expect(formatElapsed(59_900)).toBe('0:59');
    expect(formatElapsed(3_723_400, true)).toBe('1:02:03.4');
  });

  it('초를 한국어로 읽기 쉽게', () => {
    expect(formatSeconds(45)).toBe('45초');
    expect(formatSeconds(60)).toBe('1분');
    expect(formatSeconds(90)).toBe('1분 30초');
  });
});
