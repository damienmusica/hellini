import { uid } from '../lib/id';
import type { ExerciseLog, Routine, RoutineExercise, SetPlan } from '../lib/types';
import { findExercise, type Equipment } from './exercises';

/** [종목 id, 세트, 횟수(시간 종목은 초), 휴식(초)] */
type PlanRow = [exerciseId: string, sets: number, repsOrSec: number, restSec?: number];

export interface Program {
  id: string;
  name: string;
  summary: string;
  /** 무엇을 위한 프로그램인지 한 단어 */
  purpose: string;
  level: '입문' | '초급' | '중급';
  days: string;
  place: 'gym' | 'home';
  description: string;
  routines: { name: string; rows: PlanRow[] }[];
}

export const PROGRAMS: Program[] = [
  {
    id: 'fullbody',
    name: '헬린이 무분할',
    summary: '주 2~3회 · A/B 번갈아',
    purpose: '습관·자세',
    level: '입문',
    days: '주 2~3회',
    place: 'gym',
    description: '한 번 갈 때 전신을 다 해요. 헬스 처음 1~2달은 이걸로 자세와 습관을 잡는 게 가장 좋아요.',
    routines: [
      {
        name: '무분할 A',
        rows: [
          ['squat', 3, 10, 120],
          ['bench-press', 3, 10, 120],
          ['lat-pulldown', 3, 12, 90],
          ['dumbbell-shoulder-press', 3, 12, 90],
          ['plank', 3, 30, 45],
        ],
      },
      {
        name: '무분할 B',
        rows: [
          ['leg-press', 3, 12, 90],
          ['incline-dumbbell-press', 3, 12, 90],
          ['seated-cable-row', 3, 12, 90],
          ['romanian-deadlift', 3, 10, 120],
          ['crunch', 3, 15, 45],
        ],
      },
    ],
  },
  {
    id: 'upper-lower',
    name: '상하체 2분할',
    summary: '주 4회 · 상체/하체 번갈아',
    purpose: '근비대 입문',
    level: '초급',
    days: '주 4회',
    place: 'gym',
    description: '무분할에 익숙해졌다면 다음 단계예요. 부위당 볼륨이 늘어 근육이 더 잘 붙어요.',
    routines: [
      {
        name: '상체',
        rows: [
          ['bench-press', 4, 8, 120],
          ['barbell-row', 4, 8, 120],
          ['dumbbell-shoulder-press', 3, 10, 90],
          ['lat-pulldown', 3, 10, 90],
          ['dumbbell-curl', 3, 12, 60],
          ['triceps-pushdown', 3, 12, 60],
        ],
      },
      {
        name: '하체',
        rows: [
          ['squat', 4, 8, 150],
          ['romanian-deadlift', 3, 10, 120],
          ['leg-press', 3, 12, 90],
          ['leg-curl', 3, 12, 60],
          ['calf-raise', 3, 15, 60],
          ['hanging-leg-raise', 3, 10, 60],
        ],
      },
    ],
  },
  {
    id: 'ppl',
    name: '3분할 (밀기·당기기·하체)',
    summary: '주 3~6회 · 밀기/당기기/하체',
    purpose: '근비대',
    level: '중급',
    days: '주 3~6회',
    place: 'gym',
    description: '가슴·어깨·삼두(밀기), 등·이두(당기기), 하체로 나눠요. 운동에 재미가 붙은 사람에게 추천해요.',
    routines: [
      {
        name: '밀기 (가슴·어깨·삼두)',
        rows: [
          ['bench-press', 4, 8, 150],
          ['incline-dumbbell-press', 3, 10, 90],
          ['overhead-press', 3, 8, 120],
          ['lateral-raise', 3, 15, 60],
          ['triceps-pushdown', 3, 12, 60],
        ],
      },
      {
        name: '당기기 (등·이두)',
        rows: [
          ['deadlift', 3, 5, 180],
          ['lat-pulldown', 3, 10, 90],
          ['barbell-row', 3, 8, 120],
          ['face-pull', 3, 15, 60],
          ['barbell-curl', 3, 10, 60],
          ['hammer-curl', 3, 12, 60],
        ],
      },
      {
        name: '하체',
        rows: [
          ['squat', 4, 8, 150],
          ['leg-press', 3, 10, 90],
          ['romanian-deadlift', 3, 10, 120],
          ['leg-extension', 3, 12, 60],
          ['leg-curl', 3, 12, 60],
          ['calf-raise', 3, 15, 60],
        ],
      },
    ],
  },
  {
    id: 'ppl-ab',
    name: 'PPL A/B (6일 순환)',
    summary: '주 5~6회 · 6개 루틴 순서대로',
    purpose: '근비대 · 매일',
    level: '중급',
    days: '주 5~6회',
    place: 'gym',
    description:
      '밀기·당기기·하체를 A(가슴·스쿼트 중심)와 B(어깨·힙힌지 중심)로 나눠 6일에 한 바퀴 돌아요. 요일이 아니라 순서라서 하루 쉬어도 다음 차례부터 이어져요. 부위마다 6일에 두 번, 주당 10~16세트쯤 돼요.',
    routines: [
      {
        name: '밀기 A (가슴 중심)',
        rows: [
          ['bench-press', 4, 8, 150],
          ['incline-dumbbell-press', 3, 10, 90],
          ['dumbbell-shoulder-press', 3, 10, 90],
          ['lateral-raise', 4, 15, 60],
          ['triceps-pushdown', 3, 12, 60],
          ['overhead-triceps-extension', 3, 12, 60],
        ],
      },
      {
        name: '당기기 A (등 넓이)',
        rows: [
          ['lat-pulldown', 4, 10, 90],
          ['barbell-row', 4, 8, 120],
          ['seated-cable-row', 3, 12, 90],
          ['face-pull', 3, 15, 60],
          ['barbell-curl', 3, 10, 60],
          ['hammer-curl', 3, 12, 60],
        ],
      },
      {
        name: '하체 A (스쿼트 중심)',
        rows: [
          ['squat', 4, 8, 150],
          ['leg-press', 3, 12, 90],
          ['leg-extension', 3, 15, 60],
          ['leg-curl', 3, 12, 60],
          ['calf-raise', 4, 15, 60],
          ['hanging-leg-raise', 3, 12, 60],
        ],
      },
      {
        name: '밀기 B (어깨 중심)',
        rows: [
          ['overhead-press', 4, 8, 120],
          ['incline-bench-press', 3, 10, 120],
          ['chest-press-machine', 3, 12, 90],
          ['cable-lateral-raise', 4, 15, 60],
          ['pec-deck', 3, 15, 60],
          ['skull-crusher', 3, 10, 60],
        ],
      },
      {
        name: '당기기 B (등 두께)',
        rows: [
          ['deadlift', 3, 5, 180],
          ['t-bar-row', 3, 10, 120],
          ['lat-pulldown', 3, 12, 90],
          ['rear-delt-fly', 3, 15, 60],
          ['preacher-curl', 3, 12, 60],
          ['cable-curl', 3, 12, 60],
        ],
      },
      {
        name: '하체 B (힙힌지 중심)',
        rows: [
          ['romanian-deadlift', 4, 10, 120],
          ['hack-squat', 3, 10, 120],
          ['hip-thrust', 3, 10, 90],
          ['leg-curl', 3, 12, 60],
          ['calf-raise', 4, 15, 60],
          ['cable-crunch', 3, 15, 60],
        ],
      },
    ],
  },
  {
    id: 'five-by-five',
    name: '5×5 바벨',
    summary: '주 3회 · A/B 번갈아',
    purpose: '근력',
    level: '초급',
    days: '주 3회',
    place: 'gym',
    description: '바벨 세 종목을 5회 5세트. 매번 조금씩 무게를 올리는 가장 단순하고 확실한 근력 프로그램이에요.',
    routines: [
      {
        name: '5×5 A',
        rows: [
          ['squat', 5, 5, 150],
          ['bench-press', 5, 5, 150],
          ['barbell-row', 5, 5, 150],
        ],
      },
      {
        name: '5×5 B',
        rows: [
          ['squat', 5, 5, 150],
          ['overhead-press', 5, 5, 150],
          ['deadlift', 1, 5, 180],
        ],
      },
    ],
  },
  {
    id: 'home',
    name: '홈트 전신',
    summary: '주 3회 · 기구 없이',
    purpose: '습관 · 맨몸',
    level: '입문',
    days: '주 3회',
    place: 'home',
    description: '맨몸으로 집에서 하는 전신 루틴이에요. 익숙해지면 횟수나 세트를 늘려 보세요.',
    routines: [
      {
        name: '홈트 A',
        rows: [
          ['bodyweight-squat', 3, 15, 60],
          ['push-up', 3, 10, 60],
          ['lunge', 3, 10, 60],
          ['glute-bridge', 3, 15, 45],
          ['plank', 3, 30, 45],
        ],
      },
      {
        name: '홈트 B',
        rows: [
          ['bulgarian-split-squat', 3, 10, 60],
          ['bench-dips', 3, 10, 60],
          ['burpee', 3, 10, 60],
          ['dead-bug', 3, 10, 45],
          ['mountain-climber', 3, 30, 45],
        ],
      },
    ],
  },
];

/** 처음 시작할 때 무게: 바벨은 빈 봉(20kg), 나머지는 가볍게 */
const START_WEIGHT: Record<Equipment, number> = {
  바벨: 20,
  덤벨: 5,
  머신: 10,
  케이블: 10,
  스미스: 10,
  케틀벨: 8,
  맨몸: 0,
  기타: 0,
};

export function planExercise(exerciseId: string, sets: number, repsOrSec: number, restSec = 90, home = false): RoutineExercise {
  const info = findExercise(exerciseId);
  if (!info) throw new Error(`unknown exercise ${exerciseId}`);
  const weightKg = home ? 0 : START_WEIGHT[info.equipment];
  const plan: SetPlan =
    info.kind === 'time'
      ? { type: 'normal', reps: 0, weightKg: 0, durationSec: repsOrSec }
      : { type: 'normal', reps: repsOrSec, weightKg, durationSec: 0 };
  return {
    id: uid(),
    exerciseId: info.id,
    name: info.name,
    kind: info.kind,
    restSec,
    sets: Array.from({ length: sets }, () => ({ ...plan })),
  };
}

export function instantiateProgram(program: Program, now: number): Routine[] {
  return program.routines.map((r) => ({
    id: uid(),
    name: r.name,
    note: program.name,
    updatedAt: now,
    exercises: r.rows.map(([id, sets, reps, rest]) => planExercise(id, sets, reps, rest, program.place === 'home')),
  }));
}

/** 프로그램 카드에 바로 보여줄 사실: 회당 대략 시간, 필요한 장비 (세트당 40초 + 휴식 + 종목 전환 1분) */
export function programFacts(program: Program): { minutes: number; equipment: Equipment[] } {
  const equipment: Equipment[] = [];
  let total = 0;
  for (const r of program.routines) {
    let sec = 0;
    for (const [id, sets, reps, rest = 90] of r.rows) {
      const info = findExercise(id);
      if (info && info.equipment !== '맨몸' && info.equipment !== '기타' && !equipment.includes(info.equipment)) equipment.push(info.equipment);
      sec += sets * (info?.kind === 'time' ? reps : 40) + Math.max(0, sets - 1) * rest + 60;
    }
    total += sec;
  }
  const minutes = Math.max(5, Math.round(total / program.routines.length / 60 / 5) * 5);
  return { minutes, equipment };
}

export function findProgram(id: string): Program | undefined {
  return PROGRAMS.find((p) => p.id === id);
}

export type Experience = 'new' | 'some' | 'regular';
export type Place = 'gym' | 'home';

/** 온보딩 답으로 프로그램 추천 (규칙 기반) */
export function recommendProgram(experience: Experience, days: number, place: Place): Program {
  if (place === 'home') return findProgram('home')!;
  if (experience === 'new' || days <= 3) return findProgram(experience === 'regular' ? 'five-by-five' : 'fullbody')!;
  if (days === 4) return findProgram('upper-lower')!;
  if (days >= 6 || experience === 'regular') return findProgram('ppl-ab')!;
  return findProgram('upper-lower')!;
}

/** 새로 추가하는 종목의 기본 세트: 지난 기록이 있으면 그대로, 없으면 3세트 가볍게 */
export function defaultSetsFor(exerciseId: string, kind: 'reps' | 'time', last: ExerciseLog | undefined): SetPlan[] {
  const done = last?.sets.filter((s) => s.done && s.type !== 'warmup') ?? [];
  if (done.length > 0) return done.slice(0, 5).map(({ type, reps, weightKg, durationSec }) => ({ type, reps, weightKg, durationSec }));
  const info = findExercise(exerciseId);
  const plan: SetPlan =
    kind === 'time'
      ? { type: 'normal', reps: 0, weightKg: 0, durationSec: 30 }
      : { type: 'normal', reps: 10, weightKg: info ? START_WEIGHT[info.equipment] : 0, durationSec: 0 };
  return [{ ...plan }, { ...plan }, { ...plan }];
}
