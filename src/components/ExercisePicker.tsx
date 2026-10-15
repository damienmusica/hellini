import { useMemo, useState } from 'react';
import { BODY_PARTS, EXERCISES, findExercise, type BodyPart } from '../data/exercises';
import { uid } from '../lib/id';
import { isAvailable } from '../lib/places';
import { useStore } from '../lib/store';
import type { ExerciseKind, Place, SessionPlace, SwapReason } from '../lib/types';
import { rankSubstitutes } from '../lib/substitutes';
import { GuideSheet } from './GuideSheet';
import { Icon } from './Icon';
import { PartBadge } from './PartBadge';
import { Sheet } from './Sheet';

export interface PickedExercise {
  exerciseId: string;
  name: string;
  kind: ExerciseKind;
}

interface Item extends PickedExercise {
  part: string;
  equipment: string;
  en: string;
}

const CHO = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ';

/** 초성 검색용: "벤치프레스" → "ㅂㅊㅍㄹㅅ" */
function chosung(s: string): string {
  return [...s]
    .map((ch) => {
      const code = ch.charCodeAt(0) - 0xac00;
      return code >= 0 && code < 11172 ? CHO[Math.floor(code / 588)] : ch;
    })
    .join('');
}

function matches(item: Item, q: string): boolean {
  const query = q.replace(/\s+/g, '').toLowerCase();
  if (!query) return true;
  const name = item.name.replace(/\s+/g, '').toLowerCase();
  if (name.includes(query) || item.en.toLowerCase().replace(/\s+/g, '').includes(query)) return true;
  return /^[ㄱ-ㅎ]+$/.test(query) && chosung(name).includes(query);
}

export interface PickMeta {
  reason?: SwapReason;
  /** 기구 없음: 이 장소에서는 항상 이 종목으로 */
  remember?: boolean;
}

const REASON_LABEL: Record<Exclude<SwapReason, 'place' | 'adjust'>, string> = { busy: '사용 중', missing: '기구 없음', prefer: '다른 운동' };

interface Props {
  /** add: 여러 개 추가, replace: 남은 계획을 바꿀 종목, relabel: 잘못 고른 종목 정정 */
  mode: 'add' | 'replace' | 'relabel';
  /** 교체·정정 모드에서 지금 종목 — 같은 역할 종목을 먼저 추천한다 */
  current?: { exerciseId?: string; name: string };
  /** 시트 위쪽에 보여줄 안내 (적용 범위 등) */
  note?: string;
  /** 지금 장소. 없는 기구 종목은 추천에서 빼고 목록에 표시한다 */
  place?: Place | SessionPlace;
  /** replace: 기구 없음일 때 "이 장소에서는 항상"을 고를 수 있는 장소 이름 */
  rememberPlaceName?: string;
  /** replace: 적격 후보가 없을 때 "오늘은 이 운동 제외" */
  onSkip?: () => void;
  onPick: (picked: PickedExercise[], meta?: PickMeta) => void;
  onClose: () => void;
}

const TITLE = { add: '운동 추가', replace: '운동 변경', relabel: '실제로 한 종목 고르기' } as const;

export function ExercisePicker({ mode, current, note, place, rememberPlaceName, onSkip, onPick, onClose }: Props) {
  const { state, dispatch } = useStore();
  const currentInfo = findExercise(current?.exerciseId ?? current?.name);
  const [query, setQuery] = useState('');
  const [part, setPart] = useState<BodyPart | '최근' | '전체'>('전체');
  // 사유는 사용자가 골랐을 때만 기록한다. 기본은 없음
  const [reason, setReason] = useState<SwapReason | undefined>(undefined);
  const [guide, setGuide] = useState<PickedExercise | null>(null);
  const [remember, setRemember] = useState(false);
  // 교체는 추천 3~5개에 집중하고, 전체 목록은 "다른 운동 찾기"를 눌렀을 때 연다
  const [showAll, setShowAll] = useState(mode !== 'replace');
  const suggestions = useMemo(
    () => (mode === 'replace' && current ? rankSubstitutes(current, state.history, { place, limit: 5, avoidSameEquipment: reason === 'busy', strict: true }) : []),
    [mode, current, state.history, place, reason],
  );
  const [selected, setSelected] = useState<Item[]>([]);
  const [creating, setCreating] = useState(false);
  const meta = (): PickMeta | undefined => (mode === 'replace' ? { reason, remember: reason === 'missing' && remember } : undefined);

  const all: Item[] = useMemo(
    () => [
      ...EXERCISES.map((e) => ({ exerciseId: e.id, name: e.name, kind: e.kind, part: e.part, equipment: e.equipment, en: e.en })),
      ...state.customExercises.map((c) => ({ exerciseId: c.id, name: c.name, kind: c.kind, part: c.part, equipment: '직접 추가', en: '' })),
    ],
    [state.customExercises],
  );

  const recentIds = useMemo(() => {
    const ids: string[] = [];
    for (const s of state.history) for (const e of s.exercises) if (e.exerciseId && !ids.includes(e.exerciseId)) ids.push(e.exerciseId);
    return ids.slice(0, 20);
  }, [state.history]);

  const list = useMemo(() => {
    let items = all;
    if (part === '최근') items = recentIds.map((id) => all.find((i) => i.exerciseId === id)).filter((i): i is Item => !!i);
    else if (part !== '전체') items = all.filter((i) => i.part === part);
    return items.filter((i) => matches(i, query) && i.exerciseId !== currentInfo?.id);
  }, [all, part, query, recentIds, currentInfo]);

  const toggle = (item: Item) => {
    if (mode !== 'add') {
      onPick([item], meta());
      return;
    }
    setSelected((s) => (s.some((x) => x.exerciseId === item.exerciseId) ? s.filter((x) => x.exerciseId !== item.exerciseId) : [...s, item]));
  };

  const filters: (BodyPart | '최근' | '전체')[] = ['전체', ...(recentIds.length ? (['최근'] as const) : []), ...BODY_PARTS];

  // 후보 카드의 ⓘ: 같은 시트 자리에서 설명을 열고, 닫아도 선택이 확정되지 않는다
  if (guide) {
    return <GuideSheet exerciseId={guide.exerciseId} name={guide.name} onPick={() => onPick([guide], meta())} onClose={() => setGuide(null)} />;
  }

  return (
    <Sheet
      title={TITLE[mode]}
      onClose={onClose}
      size={showAll ? 'full' : 'auto'}
      footer={
        mode === 'add' ? (
          <button type="button" className="btn btn-primary btn-lg btn-block" disabled={selected.length === 0} onClick={() => onPick(selected)}>
            {selected.length > 0 ? `${selected.length}개 추가` : '종목을 골라 주세요'}
          </button>
        ) : undefined
      }
    >
      {note && <p className="t-caption c-2 picker-hint">{note}</p>}

      {mode === 'replace' && (
        <div className="reason-row" role="group" aria-label="변경 사유">
          <span className="t-caption c-2">사유 (선택)</span>
          {(Object.keys(REASON_LABEL) as Exclude<SwapReason, 'place' | 'adjust'>[]).map((r) => (
            <button key={r} type="button" className={`chip${reason === r ? ' is-on' : ''}`} aria-pressed={reason === r} onClick={() => setReason(reason === r ? undefined : r)}>
              {REASON_LABEL[r]}
            </button>
          ))}
        </div>
      )}

      {mode === 'replace' && reason === 'missing' && rememberPlaceName && (
        <label className="group-row toggle-row">
          <span className="group-row-main">
            <span>{rememberPlaceName}에서는 항상 이 종목으로</span>
            <span className="t-caption c-2">설정 → 장소에서 되돌릴 수 있어요</span>
          </span>
          <span className="switch">
            <input type="checkbox" role="switch" aria-label="이 장소에서는 항상" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
            <span />
          </span>
        </label>
      )}

      {mode === 'replace' && !showAll && (
        <section aria-label="추천 대체 운동">
          <h3 className="picker-section">'{currentInfo?.name}' 대신</h3>
          {suggestions.length === 0 ? (
            <div className="no-candidate">
              <p className="t-headline">현재 장비로 비슷하게 바꾸기 어려워요</p>
              <p className="t-caption c-2">같은 역할(예: 위에서 당기기)을 하는 운동이 지금 장비로는 없어요. 오늘은 빼거나, 다른 역할의 운동을 직접 골라요.</p>
              {onSkip && (
                <button type="button" className="btn btn-secondary btn-block" onClick={onSkip}>
                  오늘은 이 운동 제외
                </button>
              )}
            </div>
          ) : (
            <ul className="sub-cards">
              {suggestions.map((sub) => (
                <li key={sub.info.id} className="sub-item">
                  <button type="button" className="sub-card" onClick={() => onPick([{ exerciseId: sub.info.id, name: sub.info.name, kind: sub.info.kind }], meta())}>
                    <span className="sub-name">{sub.info.name}</span>
                    <span className="t-caption c-2">{sub.needs.length ? sub.needs.join(' · ') : '맨몸'}</span>
                    <span className="t-caption c-2">{sub.reason}</span>
                    <span className="t-caption c-2">{sub.lastText ? `지난번 ${sub.lastText}` : '처음 해요'}</span>
                  </button>
                  <button
                    type="button"
                    className="icon-btn is-plain sub-info"
                    aria-label={`${sub.info.name} 운동 설명`}
                    onClick={() => setGuide({ exerciseId: sub.info.id, name: sub.info.name, kind: sub.info.kind })}
                  >
                    <Icon name="info" size={18} />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <button type="button" className="btn btn-secondary btn-block" onClick={() => setShowAll(true)}>
            <Icon name="search" size={18} /> 다른 운동 찾기
          </button>
        </section>
      )}

      {showAll && (
        <>
          <div className="picker-search">
            <Icon name="search" size={18} />
            <input
              className="picker-input"
              type="search"
              placeholder="종목 검색 (초성도 돼요: ㅂㅊ)"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="종목 검색"
              autoFocus={mode === 'replace'}
            />
          </div>
          <div className="chip-scroll" role="tablist" aria-label="부위">
            {filters.map((p) => (
              <button key={p} type="button" role="tab" aria-selected={part === p} className={`chip${part === p ? ' is-on' : ''}`} onClick={() => setPart(p)}>
                {p}
              </button>
            ))}
          </div>
        </>
      )}

      {showAll && (
      <ul className="picker-list">
        {list.map((item) => {
          const on = selected.some((s) => s.exerciseId === item.exerciseId);
          return (
            <li key={item.exerciseId}>
              <button type="button" className={`picker-row${on ? ' is-on' : ''}`} onClick={() => toggle(item)} aria-pressed={mode === 'add' ? on : undefined}>
                <PartBadge part={item.part} />
                <span className="picker-row-text">
                  <span className="picker-row-name">{item.name}</span>
                  <span className="t-caption c-3">
                    {item.part} · {item.equipment}
                    {item.kind === 'time' ? ' · 시간' : ''}
                    {place && !isAvailable(place, item) && <span className="picker-na"> · 여기 없는 기구</span>}
                  </span>
                </span>
                {mode === 'add' && <span className={`check-dot${on ? ' is-on' : ''}`}>{on && <Icon name="check" size={16} strokeWidth={3} />}</span>}
              </button>
            </li>
          );
        })}
        {list.length === 0 && <li className="empty-note">찾는 종목이 없어요. 아래에서 직접 추가할 수 있어요.</li>}
      </ul>
      )}

      {!showAll ? null : creating ? (
        <CustomForm
          initialName={query}
          onCancel={() => setCreating(false)}
          onCreate={(c) => {
            dispatch({ type: 'custom/add', exercise: c });
            setCreating(false);
            const item: Item = { exerciseId: c.id, name: c.name, kind: c.kind, part: c.part, equipment: '직접 추가', en: '' };
            if (mode !== 'add') onPick([item], meta());
            else setSelected((s) => [...s, item]);
          }}
        />
      ) : (
        <button type="button" className="btn btn-ghost btn-block" onClick={() => setCreating(true)}>
          <Icon name="plus" size={18} /> 직접 종목 만들기
        </button>
      )}
    </Sheet>
  );
}

function CustomForm({
  initialName,
  onCreate,
  onCancel,
}: {
  initialName: string;
  onCreate: (c: { id: string; name: string; part: string; kind: ExerciseKind }) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initialName);
  const [part, setPart] = useState<BodyPart>('가슴');
  const [kind, setKind] = useState<ExerciseKind>('reps');
  return (
    <form
      className="card custom-form"
      onSubmit={(e) => {
        e.preventDefault();
        if (name.trim()) onCreate({ id: `custom-${uid()}`, name: name.trim(), part, kind });
      }}
    >
      <label className="field">
        <span className="t-caption c-2">종목 이름</span>
        <input className="text-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="예: 스미스 인클라인 프레스" autoFocus />
      </label>
      <div className="chip-scroll">
        {BODY_PARTS.map((p) => (
          <button key={p} type="button" className={`chip${part === p ? ' is-on' : ''}`} onClick={() => setPart(p)}>
            {p}
          </button>
        ))}
      </div>
      <div className="segmented">
        <button type="button" className={kind === 'reps' ? 'is-on' : ''} onClick={() => setKind('reps')}>
          무게 × 횟수
        </button>
        <button type="button" className={kind === 'time' ? 'is-on' : ''} onClick={() => setKind('time')}>
          시간
        </button>
      </div>
      <div className="btn-row">
        <button type="button" className="btn btn-secondary" onClick={onCancel}>
          취소
        </button>
        <button type="submit" className="btn btn-primary" disabled={!name.trim()}>
          만들기
        </button>
      </div>
    </form>
  );
}
