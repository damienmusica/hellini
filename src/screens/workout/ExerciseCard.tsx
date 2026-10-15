import { findExercise, weightBasis } from '../../data/exercises';
import { Icon } from '../../components/Icon';
import { PartBadge } from '../../components/PartBadge';
import { formatRepRange } from '../../lib/progression';
import { trimKg } from '../../lib/stats';
import { formatSeconds } from '../../lib/timer';
import type { Effort, ExerciseLog, SetLog, SetType, WorkTimer } from '../../lib/types';

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

export const EFFORT_LABEL: Record<Effort, string> = { easy: '여유 있었어요', ok: '적당했어요', hard: '거의 한계였어요' };

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
  /** 지금 할 세트가 이 종목에 있으면 그 위치 */
  currentSetIdx: number | null;
  /** 이전 기록이 다른 장소에서 한 것이면 그 장소 이름 */
  lastPlaceName?: string;
  /** 지금 장소에 기구가 없는 종목 */
  unavailable?: boolean;
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
  onEffort: (effort: Effort) => void;
  onSwap: () => void;
}

export function ExerciseCard(p: Props) {
  const { ex, exIdx, last, editing } = p;
  const info = findExercise(ex.exerciseId ?? ex.name);
  const labels = setLabels(ex.sets);
  const isTime = ex.kind === 'time';
  const firstTime = !last && !isTime && ex.sets.some((s) => s.weightKg > 0) && !ex.sets.some((s) => s.done);
  const isActive = (setIdx: number, field: Field) =>
    editing?.exIdx === exIdx && editing.setIdx === setIdx && editing.field === field;
  const started = ex.sets.some((s) => s.done && s.type === 'normal');
  const suggestion = ex.suggested && !ex.suggested.applied && !ex.suggested.dismissed && !started ? ex.suggested : null;
  const workSets = ex.sets.filter((s) => s.type !== 'warmup');
  const allDone = workSets.length > 0 && workSets.every((s) => s.done);
  const firstNormal = ex.sets.find((s) => s.type === 'normal');
  const pending = ex.sets.some((s) => !s.done);

  return (
    <article className="ex-card" aria-label={ex.name}>
      <header className="ex-head">
        <PartBadge exerciseId={ex.exerciseId} name={ex.name} part={info?.part} />
        <button type="button" className="ex-title" onClick={p.onTip}>
          <span className="ex-name">{ex.name}</span>
          <span className="t-caption c-3">
            {info ? `${info.part} · ${info.equipment}${isTime ? '' : ` · ${weightBasis(info.equipment)}`}` : '직접 추가한 종목'}
            {!isTime && firstNormal && ` · 목표 ${formatRepRange(firstNormal.reps)}`}
          </span>
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

      {ex.swap && (
        <p className="ex-swap">
          <Icon name="swap" size={14} /> {ex.swap.from} 대신 ·{' '}
          {ex.swap.reason === 'place' ? '이 장소 설정' : ex.swap.reason === 'missing' ? '기구 없음' : ex.swap.reason === 'busy' ? '기구 사용 중' : '오늘만'}
        </p>
      )}

      {p.unavailable && pending && (
        <div className="ex-flag">
          <Icon name="info" size={16} />
          <span>여기엔 없는 기구예요</span>
          <button type="button" className="btn btn-sm btn-secondary btn-pill" onClick={p.onSwap}>
            바꾸기
          </button>
        </div>
      )}

      {firstTime && <p className="ex-first">처음 하는 종목이에요. 적힌 무게는 시작 예시라서, 자세가 편한 무게로 바꿔 주세요.</p>}
      {!firstTime && p.lastPlaceName && !started && (
        <p className="ex-first">'이전' 칸은 {p.lastPlaceName}에서 한 기록이에요. 여기 기구는 다를 수 있으니 참고만 하세요.</p>
      )}

      {ex.note && <p className="ex-note">{ex.note}</p>}

      {suggestion && (
        <div className="suggest" data-code={suggestion.code}>
          <Icon name="sparkle" size={18} />
          <span>{suggestion.label}</span>
          {suggestion.apply && (
            <button type="button" className="btn btn-sm btn-primary btn-pill" onClick={p.onApplySuggestion}>
              적용
            </button>
          )}
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
            <div
              key={i}
              role="row"
              aria-current={p.currentSetIdx === i ? 'step' : undefined}
              className={`set-row${s.done ? ' is-done' : ''}${running ? ' is-running' : ''}${p.currentSetIdx === i ? ' is-current' : ''}`}
            >
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

      {allDone && (
        <div className="effort" role="group" aria-label={`${ex.name} 마지막 세트 체감`}>
          <span className="t-caption c-2">마지막 세트는 어땠어요?</span>
          <div className="effort-chips">
            {(Object.keys(EFFORT_LABEL) as Effort[]).map((e) => (
              <button
                key={e}
                type="button"
                className={`chip${ex.effort === e ? ' is-on' : ''}`}
                aria-pressed={ex.effort === e}
                onClick={() => p.onEffort(e)}
              >
                {EFFORT_LABEL[e]}
              </button>
            ))}
          </div>
        </div>
      )}
    </article>
  );
}
