import { findExercise } from '../../data/exercises';
import { Icon } from '../../components/Icon';
import { PartBadge } from '../../components/PartBadge';
import type { Suggestion } from '../../lib/progression';
import { trimKg } from '../../lib/stats';
import { formatSeconds } from '../../lib/timer';
import type { ExerciseLog, SetLog, SetType, WorkTimer } from '../../lib/types';

export type Field = 'weightKg' | 'reps' | 'durationSec';

export interface Editing {
  exIdx: number;
  setIdx: number;
  field: Field;
}

export const SET_TYPE_LABEL: Record<SetType, string> = {
  normal: '일반',
  warmup: '워밍업',
  drop: '드롭',
  failure: '실패',
};

const SET_TYPE_SHORT: Record<Exclude<SetType, 'normal'>, string> = { warmup: 'W', drop: 'D', failure: 'F' };

/** 일반 세트는 1,2,3… 번호, 나머지는 W/D/F */
export function setLabels(sets: SetLog[]): string[] {
  let n = 0;
  return sets.map((s) => (s.type === 'normal' ? String(++n) : SET_TYPE_SHORT[s.type]));
}

/** 지난번 같은 종류의 i번째 세트 */
export function previousFor(last: ExerciseLog | undefined, sets: SetLog[], setIdx: number): SetLog | undefined {
  if (!last) return undefined;
  const type = sets[setIdx].type;
  const order = sets.slice(0, setIdx).filter((s) => s.type === type).length;
  return last.sets.filter((s) => s.done && s.type === type)[order];
}

function prevText(kind: ExerciseLog['kind'], s: SetLog | undefined): string {
  if (!s) return '—';
  if (kind === 'time') return `${s.durationSec}초`;
  return s.weightKg > 0 ? `${trimKg(s.weightKg)} × ${s.reps}` : `${s.reps}회`;
}

interface Props {
  ex: ExerciseLog;
  exIdx: number;
  last: ExerciseLog | undefined;
  prSets: Set<number>;
  editing: Editing | null;
  work: WorkTimer | null;
  suggestion: Suggestion | null;
  onEdit: (e: Editing) => void;
  onCopyPrev: (setIdx: number, prev: SetLog) => void;
  onToggle: (setIdx: number) => void;
  onStartWork: (setIdx: number) => void;
  onStopWork: () => void;
  onSetMenu: (setIdx: number) => void;
  onAddSet: () => void;
  onMenu: () => void;
  onTip: () => void;
  onRest: () => void;
  onApplySuggestion: () => void;
  onDismissSuggestion: () => void;
}

export function ExerciseCard(p: Props) {
  const { ex, exIdx, last, editing } = p;
  const info = findExercise(ex.exerciseId ?? ex.name);
  const labels = setLabels(ex.sets);
  const isTime = ex.kind === 'time';
  const isActive = (setIdx: number, field: Field) =>
    editing?.exIdx === exIdx && editing.setIdx === setIdx && editing.field === field;

  return (
    <article className="ex-card" aria-label={ex.name}>
      <header className="ex-head">
        <PartBadge exerciseId={ex.exerciseId} name={ex.name} part={info?.part} />
        <button type="button" className="ex-title" onClick={p.onTip}>
          <span className="ex-name">{ex.name}</span>
          <span className="t-caption c-3">{info ? `${info.part} · ${info.equipment}` : '직접 추가한 종목'}</span>
        </button>
        <button type="button" className="icon-btn is-plain" aria-label={`${ex.name} 메뉴`} onClick={p.onMenu}>
          <Icon name="more" size={22} strokeWidth={3} />
        </button>
      </header>

      {info && (
        <button type="button" className="ex-tip" onClick={p.onTip}>
          <Icon name="info" size={15} />
          <span>{info.tip}</span>
        </button>
      )}

      {ex.note && <p className="ex-note">{ex.note}</p>}

      {p.suggestion && (
        <div className="suggest">
          <Icon name="sparkle" size={18} />
          <span>{p.suggestion.label}</span>
          <button type="button" className="btn btn-sm btn-primary btn-pill" onClick={p.onApplySuggestion}>
            적용
          </button>
          <button type="button" className="icon-btn is-plain suggest-x" aria-label="제안 닫기" onClick={p.onDismissSuggestion}>
            <Icon name="close" size={16} />
          </button>
        </div>
      )}

      <button type="button" className="rest-chip" onClick={p.onRest}>
        <Icon name="timer" size={15} />
        휴식 {ex.restSec > 0 ? formatSeconds(ex.restSec) : '끔'}
      </button>

      <div className={`set-table${isTime ? ' is-time' : ''}`} role="table" aria-label={`${ex.name} 세트`}>
        <div className="set-row set-head" role="row">
          <span role="columnheader">세트</span>
          <span role="columnheader">이전</span>
          {isTime ? (
            <span role="columnheader">초</span>
          ) : (
            <>
              <span role="columnheader">kg</span>
              <span role="columnheader">회</span>
            </>
          )}
          <span role="columnheader" className="sr-only">
            완료
          </span>
        </div>

        {ex.sets.map((s, i) => {
          const prev = previousFor(last, ex.sets, i);
          const running = p.work?.exIdx === exIdx && p.work.setIdx === i;
          const name = `${ex.name} ${labels[i]}세트`;
          return (
            <div key={i} role="row" className={`set-row${s.done ? ' is-done' : ''}${running ? ' is-running' : ''}`}>
              <button
                type="button"
                className={`set-label set-${s.type}`}
                aria-label={`${name} 종류: ${SET_TYPE_LABEL[s.type]}`}
                onClick={() => p.onSetMenu(i)}
              >
                {labels[i]}
                {p.prSets.has(i) && <span className="pr-dot">PR</span>}
              </button>
              <button
                type="button"
                className="set-prev num"
                disabled={!prev || s.done}
                aria-label={prev ? `${name} 이전 기록 ${prevText(ex.kind, prev)} 불러오기` : `${name} 이전 기록 없음`}
                onClick={() => prev && p.onCopyPrev(i, prev)}
              >
                {prevText(ex.kind, prev)}
              </button>
              {isTime ? (
                <button
                  type="button"
                  className={`set-cell num${isActive(i, 'durationSec') ? ' is-editing' : ''}`}
                  aria-label={`${name} 시간 ${s.durationSec}초`}
                  onClick={() => p.onEdit({ exIdx, setIdx: i, field: 'durationSec' })}
                >
                  {s.durationSec}
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    className={`set-cell num${isActive(i, 'weightKg') ? ' is-editing' : ''}`}
                    aria-label={`${name} 무게 ${trimKg(s.weightKg)}kg`}
                    onClick={() => p.onEdit({ exIdx, setIdx: i, field: 'weightKg' })}
                  >
                    {trimKg(s.weightKg)}
                  </button>
                  <button
                    type="button"
                    className={`set-cell num${isActive(i, 'reps') ? ' is-editing' : ''}`}
                    aria-label={`${name} 횟수 ${s.reps}회`}
                    onClick={() => p.onEdit({ exIdx, setIdx: i, field: 'reps' })}
                  >
                    {s.reps}
                  </button>
                </>
              )}
              {isTime && !s.done ? (
                <button
                  type="button"
                  className={`set-check is-play${running ? ' is-running' : ''}`}
                  aria-label={running ? `${name} 타이머 멈추기` : `${name} 타이머 시작`}
                  onClick={() => (running ? p.onStopWork() : p.onStartWork(i))}
                >
                  <Icon name={running ? 'pause' : 'play'} size={16} strokeWidth={2.6} />
                </button>
              ) : (
                <button
                  type="button"
                  className={`set-check${s.done ? ' is-done' : ''}`}
                  aria-label={s.done ? `${name} 완료 취소` : `${name} 완료`}
                  aria-pressed={s.done}
                  onClick={() => p.onToggle(i)}
                >
                  <Icon name="check" size={18} strokeWidth={3} />
                </button>
              )}
            </div>
          );
        })}
      </div>

      <button type="button" className="btn btn-secondary btn-sm btn-block add-set" onClick={p.onAddSet}>
        <Icon name="plus" size={16} /> 세트 추가
      </button>
    </article>
  );
}
