import type { Equipment } from '../lib/types';

/**
 * 기본 운동 종목 라이브러리.
 * muscle: 주동근(primary)·협응근(secondary) — 부위별 볼륨·근육 지도 계산에 쓴다.
 * tip: 헬린이용 한 줄 자세 포인트.
 */

export type Muscle =
  | 'chest'
  | 'lats'
  | 'upperBack'
  | 'lowerBack'
  | 'traps'
  | 'frontDelts'
  | 'sideDelts'
  | 'rearDelts'
  | 'biceps'
  | 'triceps'
  | 'forearms'
  | 'abs'
  | 'obliques'
  | 'quads'
  | 'hamstrings'
  | 'glutes'
  | 'adductors'
  | 'calves'
  | 'cardio';

export type BodyPart = '가슴' | '등' | '어깨' | '하체' | '팔' | '복근' | '유산소' | '전신';

export type { Equipment };

export interface ExerciseInfo {
  id: string;
  name: string;
  en: string;
  part: BodyPart;
  equipment: Equipment;
  primary: Muscle[];
  secondary: Muscle[];
  kind: 'reps' | 'time';
  tip: string;
}

export const MUSCLE_LABEL: Record<Muscle, string> = {
  chest: '가슴',
  lats: '광배',
  upperBack: '등 상부',
  lowerBack: '허리',
  traps: '승모',
  frontDelts: '전면 어깨',
  sideDelts: '측면 어깨',
  rearDelts: '후면 어깨',
  biceps: '이두',
  triceps: '삼두',
  forearms: '전완',
  abs: '복근',
  obliques: '옆구리',
  quads: '대퇴사두',
  hamstrings: '햄스트링',
  glutes: '둔근',
  adductors: '내전근',
  calves: '종아리',
  cardio: '심폐',
};

export const BODY_PARTS: BodyPart[] = ['가슴', '등', '어깨', '하체', '팔', '복근', '유산소', '전신'];

type Row = [
  id: string,
  name: string,
  en: string,
  part: BodyPart,
  equipment: Equipment,
  primary: Muscle[],
  secondary: Muscle[],
  tip: string,
  kind?: 'time',
];

const ROWS: Row[] = [
  // 가슴
  ['bench-press', '벤치프레스', 'Bench Press', '가슴', '바벨', ['chest'], ['triceps', 'frontDelts'], '견갑을 모으고 바를 명치 쪽으로 내린다'],
  ['incline-bench-press', '인클라인 벤치프레스', 'Incline Bench Press', '가슴', '바벨', ['chest'], ['frontDelts', 'triceps'], '벤치 30~45°, 쇄골 아래로 내린다'],
  ['dumbbell-bench-press', '덤벨 벤치프레스', 'Dumbbell Bench Press', '가슴', '덤벨', ['chest'], ['triceps', 'frontDelts'], '팔꿈치는 몸통과 45° 정도'],
  ['incline-dumbbell-press', '인클라인 덤벨 프레스', 'Incline Dumbbell Press', '가슴', '덤벨', ['chest'], ['frontDelts', 'triceps'], '덤벨을 위에서 살짝 모으며 민다'],
  ['dumbbell-fly', '덤벨 플라이', 'Dumbbell Fly', '가슴', '덤벨', ['chest'], ['frontDelts'], '팔꿈치를 살짝 굽힌 채 큰 원을 그린다'],
  ['chest-press-machine', '체스트 프레스 머신', 'Chest Press Machine', '가슴', '머신', ['chest'], ['triceps', 'frontDelts'], '손잡이가 가슴 중앙 높이에 오게 의자 조절'],
  ['pec-deck', '펙덱 플라이', 'Pec Deck Fly', '가슴', '머신', ['chest'], ['frontDelts'], '어깨가 들리지 않게 가슴으로 모은다'],
  ['cable-crossover', '케이블 크로스오버', 'Cable Crossover', '가슴', '케이블', ['chest'], ['frontDelts'], '상체를 살짝 숙이고 배꼽 앞에서 모은다'],
  ['push-up', '푸시업', 'Push-up', '가슴', '맨몸', ['chest'], ['triceps', 'frontDelts', 'abs'], '머리부터 발끝까지 일직선 유지'],
  ['dips', '딥스', 'Dips', '가슴', '맨몸', ['chest', 'triceps'], ['frontDelts'], '상체를 앞으로 기울이면 가슴, 세우면 삼두'],

  // 등
  ['deadlift', '데드리프트', 'Deadlift', '등', '바벨', ['lowerBack', 'glutes', 'hamstrings'], ['traps', 'quads', 'forearms'], '바는 정강이에 붙이고 허리는 중립'],
  ['pull-up', '풀업', 'Pull-up', '등', '맨몸', ['lats'], ['biceps', 'upperBack'], '가슴을 바 쪽으로 끌어올린다'],
  ['chin-up', '친업', 'Chin-up', '등', '맨몸', ['lats', 'biceps'], ['upperBack'], '손바닥이 나를 보게 잡는다'],
  ['assisted-pull-up', '어시스트 풀업', 'Assisted Pull-up', '등', '머신', ['lats'], ['biceps', 'upperBack'], '무게가 클수록 쉬워진다'],
  ['lat-pulldown', '랫풀다운', 'Lat Pulldown', '등', '케이블', ['lats'], ['biceps', 'upperBack'], '팔이 아니라 팔꿈치를 옆구리로 당긴다'],
  ['barbell-row', '바벨 로우', 'Barbell Row', '등', '바벨', ['upperBack', 'lats'], ['biceps', 'rearDelts', 'lowerBack'], '상체 45° 숙이고 배꼽 쪽으로 당긴다'],
  ['dumbbell-row', '원암 덤벨 로우', 'One-arm Dumbbell Row', '등', '덤벨', ['lats', 'upperBack'], ['biceps', 'rearDelts'], '덤벨을 골반 쪽으로 끌어온다'],
  ['seated-cable-row', '시티드 케이블 로우', 'Seated Cable Row', '등', '케이블', ['upperBack', 'lats'], ['biceps', 'rearDelts'], '가슴을 펴고 견갑을 뒤로 모은다'],
  ['t-bar-row', '티바 로우', 'T-Bar Row', '등', '바벨', ['upperBack', 'lats'], ['biceps', 'lowerBack'], '허리를 굽히지 말고 가슴을 내민다'],
  ['back-extension', '백 익스텐션', 'Back Extension', '등', '맨몸', ['lowerBack'], ['glutes', 'hamstrings'], '몸이 일직선이 될 때까지만 올라온다'],
  ['shrug', '슈러그', 'Shrug', '등', '덤벨', ['traps'], ['forearms'], '어깨를 귀 쪽으로 곧게 올린다'],

  // 어깨
  ['overhead-press', '오버헤드 프레스', 'Overhead Press', '어깨', '바벨', ['frontDelts'], ['sideDelts', 'triceps'], '엉덩이와 배에 힘을 주고 머리 위로 민다'],
  ['dumbbell-shoulder-press', '덤벨 숄더 프레스', 'Dumbbell Shoulder Press', '어깨', '덤벨', ['frontDelts', 'sideDelts'], ['triceps'], '귀 높이에서 시작해 위로 민다'],
  ['shoulder-press-machine', '숄더 프레스 머신', 'Shoulder Press Machine', '어깨', '머신', ['frontDelts', 'sideDelts'], ['triceps'], '손잡이가 어깨 높이에 오게 조절'],
  ['lateral-raise', '사이드 레터럴 레이즈', 'Lateral Raise', '어깨', '덤벨', ['sideDelts'], ['traps'], '어깨 높이까지만, 새끼손가락이 살짝 위'],
  ['cable-lateral-raise', '케이블 레터럴 레이즈', 'Cable Lateral Raise', '어깨', '케이블', ['sideDelts'], ['traps'], '천천히 내리며 긴장을 유지한다'],
  ['front-raise', '프론트 레이즈', 'Front Raise', '어깨', '덤벨', ['frontDelts'], ['sideDelts'], '반동 없이 눈높이까지'],
  ['rear-delt-fly', '리어 델트 플라이', 'Rear Delt Fly', '어깨', '머신', ['rearDelts'], ['upperBack'], '팔을 넓게 벌리며 뒤로 민다'],
  ['face-pull', '페이스풀', 'Face Pull', '어깨', '케이블', ['rearDelts'], ['upperBack', 'traps'], '로프를 얼굴 쪽으로 당기며 양쪽으로 벌린다'],
  ['arnold-press', '아놀드 프레스', 'Arnold Press', '어깨', '덤벨', ['frontDelts', 'sideDelts'], ['triceps'], '손목을 돌리며 위로 민다'],
  ['upright-row', '업라이트 로우', 'Upright Row', '어깨', '바벨', ['sideDelts', 'traps'], ['biceps'], '팔꿈치를 손보다 높게, 가슴 높이까지'],

  // 하체
  ['squat', '스쿼트', 'Back Squat', '하체', '바벨', ['quads', 'glutes'], ['hamstrings', 'lowerBack'], '무릎은 발끝 방향, 허벅지가 바닥과 평행까지'],
  ['front-squat', '프론트 스쿼트', 'Front Squat', '하체', '바벨', ['quads'], ['glutes', 'abs'], '팔꿈치를 높게 들어 상체를 세운다'],
  ['goblet-squat', '고블릿 스쿼트', 'Goblet Squat', '하체', '덤벨', ['quads', 'glutes'], ['abs'], '덤벨을 가슴에 붙이고 상체를 세운다'],
  ['bodyweight-squat', '맨몸 스쿼트', 'Bodyweight Squat', '하체', '맨몸', ['quads', 'glutes'], ['hamstrings'], '의자에 앉듯 엉덩이를 뒤로 뺀다'],
  ['smith-squat', '스미스 머신 스쿼트', 'Smith Machine Squat', '하체', '스미스', ['quads', 'glutes'], ['hamstrings'], '발을 몸보다 살짝 앞에 둔다'],
  ['leg-press', '레그 프레스', 'Leg Press', '하체', '머신', ['quads', 'glutes'], ['hamstrings'], '무릎을 끝까지 펴서 잠그지 않는다'],
  ['hack-squat', '핵 스쿼트', 'Hack Squat', '하체', '머신', ['quads'], ['glutes'], '등을 패드에 붙이고 깊게 앉는다'],
  ['leg-extension', '레그 익스텐션', 'Leg Extension', '하체', '머신', ['quads'], [], '위에서 1초 멈추고 천천히 내린다'],
  ['leg-curl', '레그 컬', 'Leg Curl', '하체', '머신', ['hamstrings'], ['calves'], '골반이 들리지 않게 고정'],
  ['romanian-deadlift', '루마니안 데드리프트', 'Romanian Deadlift', '하체', '바벨', ['hamstrings', 'glutes'], ['lowerBack'], '엉덩이를 뒤로 빼며 햄스트링이 당길 때까지'],
  ['lunge', '런지', 'Lunge', '하체', '덤벨', ['quads', 'glutes'], ['hamstrings', 'adductors'], '앞무릎과 뒷무릎 모두 90°'],
  ['bulgarian-split-squat', '불가리안 스플릿 스쿼트', 'Bulgarian Split Squat', '하체', '덤벨', ['quads', 'glutes'], ['hamstrings', 'adductors'], '뒷발은 벤치에, 앞발로 밀어 올린다'],
  ['hip-thrust', '힙 쓰러스트', 'Hip Thrust', '하체', '바벨', ['glutes'], ['hamstrings'], '턱을 당기고 엉덩이를 꽉 조인다'],
  ['glute-bridge', '글루트 브릿지', 'Glute Bridge', '하체', '맨몸', ['glutes'], ['hamstrings'], '갈비뼈를 내리고 엉덩이로 들어 올린다'],
  ['hip-abduction', '힙 어브덕션', 'Hip Abduction', '하체', '머신', ['glutes'], [], '상체를 살짝 숙이면 둔근에 더 들어간다'],
  ['hip-adduction', '힙 어덕션', 'Hip Adduction', '하체', '머신', ['adductors'], [], '반동 없이 천천히 모은다'],
  ['calf-raise', '카프 레이즈', 'Calf Raise', '하체', '머신', ['calves'], [], '최대한 내렸다가 끝까지 올린다'],

  // 팔
  ['barbell-curl', '바벨 컬', 'Barbell Curl', '팔', '바벨', ['biceps'], ['forearms'], '팔꿈치를 옆구리에 고정'],
  ['dumbbell-curl', '덤벨 컬', 'Dumbbell Curl', '팔', '덤벨', ['biceps'], ['forearms'], '올리면서 손목을 바깥으로 돌린다'],
  ['hammer-curl', '해머 컬', 'Hammer Curl', '팔', '덤벨', ['biceps', 'forearms'], [], '엄지가 위를 향하게 잡는다'],
  ['preacher-curl', '프리처 컬', 'Preacher Curl', '팔', '머신', ['biceps'], [], '팔을 완전히 펴기 직전까지 내린다'],
  ['cable-curl', '케이블 컬', 'Cable Curl', '팔', '케이블', ['biceps'], ['forearms'], '상체 반동 없이 팔꿈치만 접는다'],
  ['triceps-pushdown', '트라이셉스 푸시다운', 'Triceps Pushdown', '팔', '케이블', ['triceps'], [], '팔꿈치를 고정하고 끝까지 편다'],
  ['overhead-triceps-extension', '오버헤드 트라이셉스 익스텐션', 'Overhead Triceps Extension', '팔', '덤벨', ['triceps'], [], '팔꿈치가 벌어지지 않게 머리 뒤로 내린다'],
  ['skull-crusher', '라잉 트라이셉스 익스텐션', 'Skull Crusher', '팔', '바벨', ['triceps'], [], '바를 이마 위쪽으로 천천히 내린다'],
  ['close-grip-bench-press', '클로즈 그립 벤치프레스', 'Close-Grip Bench Press', '팔', '바벨', ['triceps'], ['chest', 'frontDelts'], '어깨너비로 잡고 팔꿈치를 몸에 붙인다'],
  ['bench-dips', '벤치 딥스', 'Bench Dips', '팔', '맨몸', ['triceps'], ['chest', 'frontDelts'], '어깨가 앞으로 말리지 않게 깊이 조절'],
  ['wrist-curl', '리스트 컬', 'Wrist Curl', '팔', '덤벨', ['forearms'], [], '전완을 무릎에 올리고 손목만 움직인다'],

  // 복근
  ['plank', '플랭크', 'Plank', '복근', '맨몸', ['abs'], ['obliques', 'frontDelts'], '엉덩이가 처지거나 솟지 않게', 'time'],
  ['side-plank', '사이드 플랭크', 'Side Plank', '복근', '맨몸', ['obliques'], ['abs', 'glutes'], '골반을 높이 들어 일직선', 'time'],
  ['crunch', '크런치', 'Crunch', '복근', '맨몸', ['abs'], [], '허리는 바닥에 붙이고 상체만 말아 올린다'],
  ['leg-raise', '레그 레이즈', 'Leg Raise', '복근', '맨몸', ['abs'], ['obliques'], '허리가 뜨지 않는 범위에서 내린다'],
  ['hanging-leg-raise', '행잉 레그 레이즈', 'Hanging Leg Raise', '복근', '맨몸', ['abs'], ['obliques', 'forearms'], '반동 없이 골반을 말아 올린다'],
  ['cable-crunch', '케이블 크런치', 'Cable Crunch', '복근', '케이블', ['abs'], [], '엉덩이는 고정, 명치를 배꼽 쪽으로 만다'],
  ['russian-twist', '러시안 트위스트', 'Russian Twist', '복근', '맨몸', ['obliques'], ['abs'], '가슴째로 돌린다'],
  ['ab-wheel', '앱 롤아웃', 'Ab Wheel Rollout', '복근', '기타', ['abs'], ['lats', 'obliques'], '허리가 꺾이지 않는 데까지만 굴린다'],
  ['dead-bug', '데드버그', 'Dead Bug', '복근', '맨몸', ['abs'], ['obliques'], '허리를 바닥에 붙인 채 팔다리를 교차'],
  ['mountain-climber', '마운틴 클라이머', 'Mountain Climber', '복근', '맨몸', ['abs', 'cardio'], ['quads', 'frontDelts'], '엉덩이 높이를 유지하며 빠르게', 'time'],

  // 유산소
  ['treadmill', '러닝머신', 'Treadmill', '유산소', '머신', ['cardio'], ['quads', 'calves'], '대화 가능한 속도부터 시작', 'time'],
  ['stationary-bike', '실내 사이클', 'Stationary Bike', '유산소', '머신', ['cardio'], ['quads'], '페달이 가장 아래일 때 무릎이 살짝 굽게', 'time'],
  ['rowing-machine', '로잉 머신', 'Rowing Machine', '유산소', '머신', ['cardio'], ['upperBack', 'quads'], '다리 → 상체 → 팔 순서로 당긴다', 'time'],
  ['stair-climber', '천국의 계단', 'Stair Climber', '유산소', '머신', ['cardio'], ['glutes', 'quads'], '손잡이에 기대지 않는다', 'time'],
  ['jump-rope', '줄넘기', 'Jump Rope', '유산소', '기타', ['cardio'], ['calves'], '손목으로 돌리고 낮게 뛴다', 'time'],
  ['jumping-jack', '점핑잭', 'Jumping Jack', '유산소', '맨몸', ['cardio'], ['calves'], '착지는 발 앞꿈치로 가볍게', 'time'],

  // 전신
  ['burpee', '버피', 'Burpee', '전신', '맨몸', ['cardio', 'quads'], ['chest', 'abs'], '플랭크 자세에서 허리가 처지지 않게'],
  ['kettlebell-swing', '케틀벨 스윙', 'Kettlebell Swing', '전신', '케틀벨', ['glutes', 'hamstrings'], ['lowerBack', 'frontDelts'], '팔이 아니라 엉덩이를 튕겨서 올린다'],
  ['thruster', '쓰러스터', 'Thruster', '전신', '덤벨', ['quads', 'frontDelts'], ['glutes', 'triceps'], '스쿼트에서 일어나는 힘으로 머리 위로 민다'],
  ['farmers-carry', '파머스 캐리', "Farmer's Carry", '전신', '덤벨', ['forearms', 'traps'], ['abs', 'glutes'], '어깨를 펴고 곧게 걷는다', 'time'],
];

export const EXERCISES: ExerciseInfo[] = ROWS.map(([id, name, en, part, equipment, primary, secondary, tip, kind]) => ({
  id,
  name,
  en,
  part,
  equipment,
  primary,
  secondary,
  tip,
  kind: kind ?? 'reps',
}));

const byId = new Map(EXERCISES.map((e) => [e.id, e]));
const byName = new Map(EXERCISES.map((e) => [e.name.replace(/\s+/g, ''), e]));

export function findExercise(idOrName: string | undefined): ExerciseInfo | undefined {
  if (!idOrName) return undefined;
  return byId.get(idOrName) ?? byName.get(idOrName.replace(/\s+/g, ''));
}

/** 자세 영상 검색 링크 (외부 유튜브) */
export function formVideoUrl(name: string): string {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(`${name} 자세`)}`;
}

/**
 * 운동 역할: 대체 운동을 고를 때 "같은 부위"보다 먼저 보는 기준.
 * 예) 스쿼트 대신 레그 프레스는 같은 역할, 레그 컬은 같은 하체지만 다른 역할.
 */
export type Role =
  | 'horizontal-press'
  | 'incline-press'
  | 'chest-fly'
  | 'dip'
  | 'vertical-pull'
  | 'horizontal-pull'
  | 'hinge'
  | 'shrug'
  | 'vertical-press'
  | 'lateral-raise'
  | 'front-raise'
  | 'rear-delt'
  | 'squat'
  | 'single-leg'
  | 'knee-extension'
  | 'knee-flexion'
  | 'hip-thrust'
  | 'hip-abduction'
  | 'hip-adduction'
  | 'calf'
  | 'elbow-flexion'
  | 'elbow-extension'
  | 'wrist'
  | 'core-stability'
  | 'core-flexion'
  | 'core-rotation'
  | 'conditioning'
  | 'full-body'
  | 'carry';

export const ROLE_LABEL: Record<Role, string> = {
  'horizontal-press': '수평 밀기',
  'incline-press': '경사 밀기',
  'chest-fly': '가슴 모으기',
  dip: '딥스',
  'vertical-pull': '위에서 당기기',
  'horizontal-pull': '앞에서 당기기',
  hinge: '힙 힌지',
  shrug: '어깨 으쓱',
  'vertical-press': '머리 위로 밀기',
  'lateral-raise': '옆으로 들기',
  'front-raise': '앞으로 들기',
  'rear-delt': '후면 어깨',
  squat: '스쿼트 패턴',
  'single-leg': '한 다리 스쿼트',
  'knee-extension': '무릎 펴기',
  'knee-flexion': '무릎 굽히기',
  'hip-thrust': '엉덩이 밀기',
  'hip-abduction': '다리 벌리기',
  'hip-adduction': '다리 모으기',
  calf: '종아리',
  'elbow-flexion': '팔 굽히기',
  'elbow-extension': '팔 펴기',
  wrist: '손목',
  'core-stability': '코어 버티기',
  'core-flexion': '복근 말기',
  'core-rotation': '몸통 회전',
  conditioning: '유산소·컨디셔닝',
  'full-body': '전신',
  carry: '들고 걷기',
};

const ROLE_MEMBERS: Record<Role, string[]> = {
  'horizontal-press': ['bench-press', 'dumbbell-bench-press', 'chest-press-machine', 'push-up'],
  'incline-press': ['incline-bench-press', 'incline-dumbbell-press'],
  'chest-fly': ['dumbbell-fly', 'pec-deck', 'cable-crossover'],
  dip: ['dips', 'bench-dips'],
  'vertical-pull': ['pull-up', 'chin-up', 'assisted-pull-up', 'lat-pulldown'],
  'horizontal-pull': ['barbell-row', 'dumbbell-row', 'seated-cable-row', 't-bar-row'],
  hinge: ['deadlift', 'romanian-deadlift', 'back-extension', 'kettlebell-swing'],
  shrug: ['shrug'],
  'vertical-press': ['overhead-press', 'dumbbell-shoulder-press', 'shoulder-press-machine', 'arnold-press'],
  'lateral-raise': ['lateral-raise', 'cable-lateral-raise', 'upright-row'],
  'front-raise': ['front-raise'],
  'rear-delt': ['rear-delt-fly', 'face-pull'],
  squat: ['squat', 'front-squat', 'goblet-squat', 'bodyweight-squat', 'smith-squat', 'leg-press', 'hack-squat'],
  'single-leg': ['lunge', 'bulgarian-split-squat'],
  'knee-extension': ['leg-extension'],
  'knee-flexion': ['leg-curl'],
  'hip-thrust': ['hip-thrust', 'glute-bridge'],
  'hip-abduction': ['hip-abduction'],
  'hip-adduction': ['hip-adduction'],
  calf: ['calf-raise'],
  'elbow-flexion': ['barbell-curl', 'dumbbell-curl', 'hammer-curl', 'preacher-curl', 'cable-curl'],
  'elbow-extension': ['triceps-pushdown', 'overhead-triceps-extension', 'skull-crusher', 'close-grip-bench-press'],
  wrist: ['wrist-curl'],
  'core-stability': ['plank', 'side-plank', 'dead-bug', 'ab-wheel'],
  'core-flexion': ['crunch', 'leg-raise', 'hanging-leg-raise', 'cable-crunch'],
  'core-rotation': ['russian-twist'],
  conditioning: ['mountain-climber', 'burpee', 'jumping-jack', 'jump-rope', 'treadmill', 'stationary-bike', 'rowing-machine', 'stair-climber'],
  'full-body': ['thruster'],
  carry: ['farmers-carry'],
};

/** 비슷한 역할: 같은 역할이 없을 때 다음으로 볼 후보 */
export const NEAR_ROLES: Partial<Record<Role, Role[]>> = {
  'horizontal-press': ['incline-press', 'dip'],
  'incline-press': ['horizontal-press', 'vertical-press'],
  dip: ['horizontal-press', 'elbow-extension'],
  'chest-fly': ['horizontal-press'],
  'vertical-pull': ['horizontal-pull'],
  'horizontal-pull': ['vertical-pull'],
  squat: ['single-leg'],
  'single-leg': ['squat'],
  hinge: ['hip-thrust'],
  'hip-thrust': ['hinge'],
  'vertical-press': ['incline-press', 'lateral-raise'],
  'lateral-raise': ['vertical-press'],
  'front-raise': ['vertical-press'],
  'rear-delt': ['horizontal-pull'],
  'core-flexion': ['core-stability'],
  'core-stability': ['core-flexion'],
  'core-rotation': ['core-stability'],
  'full-body': ['conditioning'],
};

const ROLE_OF = new Map<string, Role>(
  (Object.entries(ROLE_MEMBERS) as [Role, string[]][]).flatMap(([role, ids]) => ids.map((id) => [id, role] as [string, Role])),
);

export function roleOf(exerciseId: string | undefined): Role | undefined {
  return exerciseId ? ROLE_OF.get(exerciseId) : undefined;
}

/** 무게를 어떤 기준으로 적는지 (기록끼리 비교하려면 같은 기준이어야 한다) */
export function weightBasis(equipment: Equipment | undefined): string {
  switch (equipment) {
    case '바벨':
      return '봉 포함 총무게';
    case '덤벨':
      return '한 손 덤벨 무게';
    case '케틀벨':
      return '케틀벨 1개 무게';
    case '머신':
    case '케이블':
    case '스미스':
      return '기구 표시 무게';
    case '맨몸':
      return '추가 중량 (맨몸이면 0)';
    default:
      return '무게';
  }
}
