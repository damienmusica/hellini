import { findExercise } from '../data/exercises';
import type { Equipment, ExerciseLog, Place, Session, SessionPlace } from './types';

export const MAIN_PLACE_ID = 'main';

export function mainPlace(): Place {
  return { id: MAIN_PLACE_ID, name: '평소 헬스장', unavailable: [], swaps: {} };
}

/** 장비 체크리스트에 보여줄 것. 맨몸·기타는 항상 있는 것으로 본다 */
export const CHECKABLE_EQUIPMENT: Equipment[] = ['바벨', '덤벨', '머신', '케이블', '스미스', '케틀벨'];

export function sessionPlace(p: Place): SessionPlace {
  return p.equipment ? { id: p.id, name: p.name, equipment: p.equipment } : { id: p.id, name: p.name };
}

/** 기록을 장소별로 묶는 키. 장소가 없는 옛 기록은 기본 장소 */
export function placeKey(session: Pick<Session, 'place'>): string {
  return session.place?.id ?? MAIN_PLACE_ID;
}

/** 이 장소에서 이 종목을 할 수 있는지 (기구가 있는지). 모르는 종목·직접 만든 종목은 할 수 있는 것으로 본다 */
export function isAvailable(place: Pick<Place, 'equipment' | 'unavailable'> | SessionPlace | undefined, e: { exerciseId?: string; name: string }): boolean {
  if (!place) return true;
  const info = findExercise(e.exerciseId ?? e.name);
  if (!info) return true;
  if ('unavailable' in place && place.unavailable.includes(info.id)) return false;
  if (!place.equipment) return true;
  return info.equipment === '맨몸' || info.equipment === '기타' || place.equipment.includes(info.equipment);
}

/** 이 장소에서 할 수 없는 종목 (운동 시작 전 미리 알려주기용) */
export function unavailableIn(place: Place | undefined, exercises: { exerciseId?: string; name: string }[]): { exerciseId?: string; name: string }[] {
  return exercises.filter((e) => !isAvailable(place, e));
}

/** 장소 프로필에 기구 없음 + 대체 종목을 기록한다 */
export function markUnavailable(place: Place, exerciseId: string, swapTo?: string): Place {
  const unavailable = place.unavailable.includes(exerciseId) ? place.unavailable : [...place.unavailable, exerciseId];
  const swaps = swapTo && swapTo !== exerciseId ? { ...place.swaps, [exerciseId]: swapTo } : place.swaps;
  return { ...place, unavailable, swaps };
}

/** 기구를 다시 쓸 수 있게 (장소 프로필에서 제외 해제) */
export function markAvailable(place: Place, exerciseId: string): Place {
  const swaps = { ...place.swaps };
  delete swaps[exerciseId];
  return { ...place, unavailable: place.unavailable.filter((id) => id !== exerciseId), swaps };
}

/** history는 최신순. 같은 종목의 가장 최근 기록을 세션과 함께. place를 주면 그 장소 기록을 먼저 찾고, strict면 그 장소만 */
export function lastLogEntry(
  history: Session[],
  e: { exerciseId?: string; name: string },
  place?: string,
  strict = false,
): { session: Session; log: ExerciseLog } | undefined {
  const key = e.exerciseId ?? e.name.trim().toLowerCase();
  const find = (match: (s: Session) => boolean) => {
    for (const session of history) {
      if (!match(session)) continue;
      const log = session.exercises.find((x) => (x.exerciseId ?? x.name.trim().toLowerCase()) === key && x.sets.some((s) => s.done));
      if (log) return { session, log };
    }
    return undefined;
  };
  if (place === undefined) return find(() => true);
  return find((s) => placeKey(s) === place) ?? (strict ? undefined : find(() => true));
}
