import type { Muscle } from '../data/exercises';

/** 왼쪽 절반 좌표로 그린 path를 오른쪽으로 뒤집는다 (가로 120 기준) */
function mirror(d: string): string {
  const tokens = d.match(/[A-Za-z]|-?\d*\.?\d+/g) ?? [];
  let isX = true;
  return tokens
    .map((t) => {
      if (/[A-Za-z]/.test(t)) {
        isX = true;
        return t;
      }
      const out = isX ? String(120 - Number(t)) : t;
      isX = !isX;
      return out;
    })
    .join(' ');
}

type Region = { muscle: Muscle; d: string };

function pair(muscle: Muscle, d: string): Region[] {
  return [
    { muscle, d },
    { muscle, d: mirror(d) },
  ];
}

const ellipse = (cx: number, cy: number, rx: number, ry: number) =>
  `M${cx - rx} ${cy} Q${cx - rx} ${cy - ry} ${cx} ${cy - ry} Q${cx + rx} ${cy - ry} ${cx + rx} ${cy} Q${cx + rx} ${cy + ry} ${cx} ${cy + ry} Q${cx - rx} ${cy + ry} ${cx - rx} ${cy} Z`;

const LIMBS = [
  'M26 50 Q32 46 38 52 L37 90 Q31 93 26 89 Z',
  'M23 91 Q28 88 33 92 L31 116 Q26 118 22 115 Z',
  'M42 120 Q51 117 59.5 121 L59 176 Q50 180 45 175 Q39 150 42 120 Z',
  'M44 184 Q49 181 55 184 L54 222 L45 222 Z',
];

const SILHOUETTE = [
  ellipse(60, 19, 12, 13),
  'M54 30 L66 30 L67 41 L53 41 Z',
  'M38 46 Q60 38 82 46 L80 120 Q60 126 40 120 Z',
  ...LIMBS,
  ...LIMBS.map(mirror),
  ellipse(25, 121, 5, 6),
  ellipse(95, 121, 5, 6),
  ellipse(51, 181, 6, 6),
  ellipse(69, 181, 6, 6),
  'M44 222 L56 222 L57 234 L41 234 Z',
  'M76 222 L64 222 L63 234 L79 234 Z',
];

const FRONT: Region[] = [
  ...pair('frontDelts', ellipse(36, 52, 9, 9)),
  ...pair('chest', 'M42 50 Q51 44 59 47 L59 70 Q50 74 42 68 Q38 60 42 50 Z'),
  ...pair('biceps', 'M27 64 Q31 61 35 64 L36 88 Q31 92 27 88 Z'),
  ...pair('forearms', 'M24 93 Q28 90 32 93 L30 115 Q26 117 23 114 Z'),
  { muscle: 'abs', d: 'M52 73 Q60 71 68 73 L68 113 Q60 118 52 113 Z' },
  ...pair('obliques', 'M43 72 Q47 73 50 75 L50 112 Q45 108 43 99 Z'),
  ...pair('quads', 'M44 124 Q51 120 58 124 L58 172 Q50 176 46 171 Q41 148 44 124 Z'),
  ...pair('adductors', 'M58.5 126 L59.5 126 L59.5 150 L58.5 150 Z'),
  ...pair('calves', 'M45 188 Q49 185 54 188 L53 216 Q49 219 46 216 Z'),
];

const BACK: Region[] = [
  { muscle: 'traps', d: 'M60 37 L72 47 L67 63 L60 70 L53 63 L48 47 Z' },
  ...pair('rearDelts', ellipse(36, 53, 9, 9)),
  ...pair('lats', 'M43 58 Q47 56 52 61 L58 92 Q52 99 46 97 Q40 80 43 58 Z'),
  { muscle: 'upperBack', d: 'M54 66 L60 72 L66 66 L64 88 L56 88 Z' },
  { muscle: 'lowerBack', d: 'M53 92 Q60 90 67 92 L67 114 Q60 117 53 114 Z' },
  ...pair('triceps', 'M27 64 Q31 61 35 64 L36 88 Q31 92 27 88 Z'),
  ...pair('forearms', 'M24 93 Q28 90 32 93 L30 115 Q26 117 23 114 Z'),
  ...pair('glutes', ellipse(51, 128, 9.5, 10)),
  ...pair('hamstrings', 'M44 140 Q51 136 58 140 L57 172 Q50 176 46 172 Q42 156 44 140 Z'),
  ...pair('calves', 'M44 188 Q49 184 55 188 L54 214 Q49 218 45 214 Z'),
];

/** 0~1을 4단계로 */
function level(v: number | undefined): number {
  if (!v || v <= 0) return 0;
  if (v < 0.25) return 1;
  if (v < 0.5) return 2;
  if (v < 0.8) return 3;
  return 4;
}

interface Props {
  /** 근육별 운동량 (세트 수 등). 최댓값 기준으로 진하기를 정한다 */
  values: Map<Muscle, number>;
  className?: string;
}

export function MuscleMap({ values, className }: Props) {
  const max = Math.max(1, ...values.values());
  const norm = (m: Muscle) => (values.get(m) ?? 0) / max;
  const trained = [...values.entries()].filter(([, v]) => v > 0).length;

  const view = (regions: Region[], label: string, dx: number) => (
    <g transform={`translate(${dx} 0)`}>
      {SILHOUETTE.map((d, i) => (
        <path key={i} d={d} className="mm-body" />
      ))}
      {regions.map((r, i) => (
        <path key={i} d={r.d} className={`mm-muscle mm-l${level(norm(r.muscle))}`} />
      ))}
      <text x="60" y="248" textAnchor="middle" className="mm-label">
        {label}
      </text>
    </g>
  );

  return (
    <svg
      className={`muscle-map ${className ?? ''}`}
      viewBox="0 0 250 252"
      role="img"
      aria-label={trained > 0 ? `운동한 근육 ${trained}곳` : '운동한 근육 없음'}
    >
      {view(FRONT, '앞', 0)}
      {view(BACK, '뒤', 130)}
    </svg>
  );
}
