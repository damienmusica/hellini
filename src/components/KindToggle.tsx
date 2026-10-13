import type { ExerciseKind } from '../lib/types';

export function KindToggle({ value, onChange }: { value: ExerciseKind; onChange: (k: ExerciseKind) => void }) {
  return (
    <div className="segmented" role="radiogroup" aria-label="종목 종류">
      {(
        [
          ['reps', '횟수'],
          ['time', '시간'],
        ] as const
      ).map(([k, label]) => (
        <button key={k} type="button" role="radio" aria-checked={value === k} className={value === k ? 'is-on' : ''} onClick={() => onChange(k)}>
          {label}
        </button>
      ))}
    </div>
  );
}
