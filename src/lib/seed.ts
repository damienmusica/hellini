import { uid } from './id';
import type { ExerciseTemplate, Routine } from './types';

function ex(
  name: string,
  plan: Partial<Omit<ExerciseTemplate, 'id' | 'name'>>,
): ExerciseTemplate {
  return {
    id: uid(),
    name,
    kind: 'reps',
    sets: 3,
    reps: 10,
    durationSec: 30,
    weightKg: 0,
    restSec: 90,
    ...plan,
  };
}

/** 처음 실행할 때 보여줄 예시 루틴. 사용자가 고치거나 지우면 된다. */
export function seedRoutines(now = Date.now()): Routine[] {
  return [
    {
      id: uid(),
      name: '전신 A (예시)',
      updatedAt: now,
      exercises: [
        ex('스쿼트', { weightKg: 20 }),
        ex('벤치프레스', { weightKg: 20 }),
        ex('바벨 로우', { weightKg: 20 }),
        ex('플랭크', { kind: 'time', durationSec: 30, restSec: 45 }),
      ],
    },
    {
      id: uid(),
      name: '맨몸 서킷 (예시)',
      updatedAt: now,
      exercises: [
        ex('푸시업', { reps: 12, restSec: 60 }),
        ex('맨몸 스쿼트', { reps: 15, restSec: 60 }),
        ex('런지', { reps: 10, restSec: 60 }),
        ex('플랭크', { kind: 'time', durationSec: 40, restSec: 45 }),
      ],
    },
  ];
}
