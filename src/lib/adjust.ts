import { findExercise, requiresOf } from '../data/exercises';
import { isAvailable, missingReason } from './places';
import type { ExerciseRef } from './reducer';
import { rankSubstitutes } from './substitutes';
import type { Place, Routine, RoutineExercise, Session, SessionPlace } from './types';

export interface Proposal {
  slot: RoutineExercise;
  /** 왜 못 하는지 */
  reason: string | null;
  /** 제안 (없으면 적격 후보 없음) */
  to: ExerciseRef | null;
  /** 제안이 없을 때 사용자가 고른 처리. keep: 그대로 두고 운동 중 정함, skip: 오늘 제외 */
  fallback: 'keep' | 'skip';
  /** 후보 없음 설명 */
  note?: string;
}

/**
 * 시작 전 조정: 이 장소에서 못 하는 종목마다 대체안을 하나 제안한다.
 * 적격성(같은 역할 또는 비슷한 역할 + 장비·보조 장비) → 순위 → 세션 전체 검토 순서다.
 * - 같은 부위라는 이유만으로는 제안하지 않는다 (등 ≠ 수직 당기기).
 * - 세션 안에 이미 있는 종목이나 다른 자리에 제안한 종목은 다시 제안하지 않는다 (한 종목 11세트 몰림 방지).
 * - 적격 후보가 없으면 "비슷하게 바꾸기 어려워요"로 멈춘다. 낮은 점수라도 무조건 하나를 고르지 않는다.
 */
export function proposeSwaps(routine: Routine, place: Place | SessionPlace | undefined, history: Session[]): Proposal[] {
  const used = new Set<string>();
  for (const e of routine.exercises) if (e.exerciseId && isAvailable(place, e)) used.add(e.exerciseId);
  const out: Proposal[] = [];
  for (const slot of routine.exercises) {
    if (isAvailable(place, slot)) continue;
    const candidates = rankSubstitutes(slot, history, { place, limit: 8, strict: true }).filter((c) => !used.has(c.info.id));
    const top = candidates[0];
    if (top) used.add(top.info.id);
    out.push({
      slot,
      reason: missingReason(place, slot),
      to: top ? { exerciseId: top.info.id, name: top.info.name, kind: top.info.kind } : null,
      fallback: 'keep',
      note: top ? undefined : '현재 장비로 비슷하게 바꾸기 어려워요',
    });
  }
  return out;
}

/** 후보 카드에 보여줄 "필요한 것": 장비 + 보조 장비 */
export function needsOf(exerciseId: string): string[] {
  const info = findExercise(exerciseId);
  if (!info) return [];
  return [info.equipment, ...requiresOf(info.id)].filter((x) => x !== '맨몸' && x !== '기타');
}
