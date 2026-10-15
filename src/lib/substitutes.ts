import { EXERCISES, findExercise, NEAR_ROLES, ROLE_LABEL, roleOf, type ExerciseInfo } from '../data/exercises';
import { isAvailable, placeKey } from './places';
import { bestSet, formatSet, lastLogFor } from './stats';
import type { Place, Session, SessionPlace } from './types';

export interface Substitute {
  info: ExerciseInfo;
  /** 3: 같은 역할, 2: 비슷한 역할, 1: 같은 부위 */
  match: 3 | 2 | 1;
  reason: string;
  /** 이 종목의 지난 기록 (없으면 처음) */
  lastText: string | null;
}

/**
 * 대체 운동 후보 순위 (결정 규칙, 같은 입력이면 같은 결과).
 * 1) 역할이 같은 종목 → 2) 비슷한 역할 → 3) 같은 부위. 각 단계 안에서는 해 본 적 있는 종목 먼저, 그다음 라이브러리 순서.
 * 무게는 옮기지 않는다: 새 종목의 무게는 그 종목 자신의 기록이나 시작값으로 정한다.
 */
export function rankSubstitutes(
  current: { exerciseId?: string; name: string },
  history: Session[],
  opts: { place?: Place | SessionPlace; limit?: number } = {},
): Substitute[] {
  const cur = findExercise(current.exerciseId ?? current.name);
  if (!cur) return [];
  const limit = opts.limit ?? 8;
  const role = roleOf(cur.id);
  const near = new Set(role ? NEAR_ROLES[role] ?? [] : []);
  const here = opts.place ? placeKey({ place: opts.place }) : undefined;

  // 없는 기구·이 장소에서 뺀 종목은 점수를 매기기 전에 제외한다
  const scored = EXERCISES.filter((e) => e.id !== cur.id && isAvailable(opts.place, e))
    .map((info, order) => {
      const r = roleOf(info.id);
      const match: 0 | 1 | 2 | 3 = r && r === role ? 3 : r && near.has(r) ? 2 : info.part === cur.part ? 1 : 0;
      const last = lastLogFor(history, { exerciseId: info.id, name: info.name }, here);
      const best = last ? bestSet(last) : undefined;
      return { info, match, order, last, best };
    })
    .filter((x) => x.match > 0)
    .sort((a, b) => b.match - a.match || Number(!!b.last) - Number(!!a.last) || a.order - b.order);

  return scored.slice(0, limit).map(({ info, match, best }) => {
    const r = roleOf(info.id);
    const reason =
      match === 3 ? `같은 역할 · ${ROLE_LABEL[r!]}` : match === 2 ? `비슷한 역할 · ${ROLE_LABEL[r!]}` : `같은 부위 · ${info.part}`;
    return {
      info,
      match: match as 3 | 2 | 1,
      reason,
      lastText: best ? formatSet(info.kind, best) : null,
    };
  });
}
