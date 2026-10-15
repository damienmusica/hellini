import { describe, expect, it } from 'vitest';
import { defaultState, parseState } from '../../src/lib/storage';

describe('parseState', () => {
  it('헬린이 데이터가 아니면 거절한다', () => {
    expect(parseState(null)).toBeNull();
    expect(parseState({ version: 1, routines: [], history: [] })).toBeNull();
    expect(parseState({ version: 2, routines: {}, history: [] })).toBeNull();
  });

  it('빠진 값은 기본값으로 채운다', () => {
    const s = parseState({ version: 3, routines: [], history: [], settings: { sound: false } });
    expect(s).toEqual({ ...defaultState(), settings: { ...defaultState().settings, sound: false } });
  });

  it('v2 백업은 기본 장소를 붙여 최신 버전으로 올리고, 기록은 그대로 둔다', () => {
    const history = [{ id: 's1', routineName: 'r', startedAt: 1, endedAt: 2, exercises: [] }];
    const s = parseState({ version: 2, routines: [], history, settings: { weeklyGoal: 4 } })!;
    expect(s.version).toBe(4);
    expect(s.places.map((p) => p.id)).toEqual(['main']);
    expect(s.settings.placeId).toBe('main');
    expect(s.history).toEqual(history);
  });

  it('없는 장소를 가리키는 placeId는 기본 장소로 되돌린다', () => {
    const s = parseState({ version: 3, routines: [], history: [], places: [{ id: 'main', name: '평소 헬스장' }], settings: { placeId: 'gone' } })!;
    expect(s.settings.placeId).toBe('main');
    expect(s.places[0]).toEqual({ id: 'main', name: '평소 헬스장', unavailable: [], swaps: {} });
  });
});
