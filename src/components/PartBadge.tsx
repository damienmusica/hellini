import { findExercise } from '../data/exercises';

/** 종목 앞에 붙는 부위 표시 (가슴·등·하체…) */
export function PartBadge({ exerciseId, name, part }: { exerciseId?: string; name?: string; part?: string }) {
  const label = part ?? findExercise(exerciseId ?? name)?.part ?? '기타';
  return (
    <span className="part-badge" aria-hidden="true">
      {label}
    </span>
  );
}
