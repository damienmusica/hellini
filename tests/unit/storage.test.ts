import { describe, expect, it } from 'vitest';
import { defaultState, parseState } from '../../src/lib/storage';

describe('parseState', () => {
  it('헬린이 데이터가 아니면 거절한다', () => {
    expect(parseState(null)).toBeNull();
    expect(parseState({ version: 1, routines: [], history: [] })).toBeNull();
    expect(parseState({ version: 2, routines: {}, history: [] })).toBeNull();
  });

  it('빠진 값은 기본값으로 채운다', () => {
    const s = parseState({ version: 2, routines: [], history: [], settings: { sound: false } });
    expect(s).toEqual({ ...defaultState(), settings: { ...defaultState().settings, sound: false } });
  });
});
