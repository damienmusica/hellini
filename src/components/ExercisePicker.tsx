import { useMemo, useState } from 'react';
import { BODY_PARTS, EXERCISES, findExercise, type BodyPart } from '../data/exercises';
import { uid } from '../lib/id';
import { useStore } from '../lib/store';
import type { ExerciseKind } from '../lib/types';
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

interface Props {
  mode: 'add' | 'replace';
  /** 교체 모드에서 지금 종목 — 같은 부위를 먼저 보여준다 */
  current?: { exerciseId?: string; name: string };
  onPick: (picked: PickedExercise[]) => void;
  onClose: () => void;
}

export function ExercisePicker({ mode, current, onPick, onClose }: Props) {
  const { state, dispatch } = useStore();
  const currentInfo = findExercise(current?.exerciseId ?? current?.name);
  const [query, setQuery] = useState('');
  const [part, setPart] = useState<BodyPart | '최근' | '전체'>(currentInfo?.part ?? '전체');
  const [selected, setSelected] = useState<Item[]>([]);
  const [creating, setCreating] = useState(false);

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
    if (mode === 'replace') {
      onPick([item]);
      return;
    }
    setSelected((s) => (s.some((x) => x.exerciseId === item.exerciseId) ? s.filter((x) => x.exerciseId !== item.exerciseId) : [...s, item]));
  };

  const filters: (BodyPart | '최근' | '전체')[] = ['전체', ...(recentIds.length ? (['최근'] as const) : []), ...BODY_PARTS];

  return (
    <Sheet
      title={mode === 'replace' ? '대체 종목 고르기' : '운동 추가'}
      onClose={onClose}
      size="full"
      footer={
        mode === 'add' ? (
          <button type="button" className="btn btn-primary btn-lg btn-block" disabled={selected.length === 0} onClick={() => onPick(selected)}>
            {selected.length > 0 ? `${selected.length}개 추가` : '종목을 골라 주세요'}
          </button>
        ) : undefined
      }
    >
      <div className="picker-search">
        <Icon name="search" size={18} />
        <input
          className="picker-input"
          type="search"
          placeholder="종목 검색 (초성도 돼요: ㅂㅊ)"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="종목 검색"
        />
      </div>
      <div className="chip-scroll" role="tablist" aria-label="부위">
        {filters.map((p) => (
          <button key={p} type="button" role="tab" aria-selected={part === p} className={`chip${part === p ? ' is-on' : ''}`} onClick={() => setPart(p)}>
            {p}
          </button>
        ))}
      </div>
      {mode === 'replace' && currentInfo && part === currentInfo.part && !query && (
        <p className="t-caption c-2 picker-hint">'{currentInfo.name}' 대신 할 수 있는 {currentInfo.part} 운동이에요.</p>
      )}

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
                  </span>
                </span>
                {mode === 'add' && <span className={`check-dot${on ? ' is-on' : ''}`}>{on && <Icon name="check" size={16} strokeWidth={3} />}</span>}
              </button>
            </li>
          );
        })}
        {list.length === 0 && <li className="empty-note">찾는 종목이 없어요. 아래에서 직접 추가할 수 있어요.</li>}
      </ul>

      {creating ? (
        <CustomForm
          initialName={query}
          onCancel={() => setCreating(false)}
          onCreate={(c) => {
            dispatch({ type: 'custom/add', exercise: c });
            setCreating(false);
            const item: Item = { exerciseId: c.id, name: c.name, kind: c.kind, part: c.part, equipment: '직접 추가', en: '' };
            if (mode === 'replace') onPick([item]);
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
