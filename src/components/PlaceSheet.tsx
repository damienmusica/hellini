import { useMemo, useState } from 'react';
import { findExercise } from '../data/exercises';
import { uid } from '../lib/id';
import { CHECKABLE_EQUIPMENT, CHECKABLE_FEATURES, isAvailable, MAIN_PLACE_ID, markUnavailable, missingReason, PLACE_PRESETS } from '../lib/places';
import type { ExerciseRef } from '../lib/reducer';
import { useStore } from '../lib/store';
import { rankSubstitutes } from '../lib/substitutes';
import type { Equipment, Feature, Place, Routine, RoutineExercise } from '../lib/types';
import { ExercisePicker } from './ExercisePicker';
import { Icon } from './Icon';
import { Sheet } from './Sheet';

type Mode = 'list' | 'temp' | 'review';

interface Props {
  /** 오늘 할 루틴. 고른 장소에서 못 하는 종목을 미리 알려주고 대체안을 검토한다 */
  routine?: Routine;
  /** review: 바로 시작 전 조정 검토부터 */
  initialMode?: Mode;
  onClose: () => void;
}

/**
 * 장소 선택과 시작 전 조정. 한 시트 안에서 단계만 바뀐다 (목록 → 새 장소 → 검토).
 * 새 장소는 장비를 확인하지 않은 상태에서 시작하고, 프리셋이나 직접 선택으로 명시한다.
 * 검토 단계에서는 못 하는 종목마다 대체안을 제안하고, 사용자가 바꾸거나 그대로 두고 시작한다. 기본 루틴은 그대로다.
 */
export function PlaceSheet({ routine, initialMode = 'list', onClose }: Props) {
  const { state, dispatch } = useStore();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [name, setName] = useState('');
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [features, setFeatures] = useState<Feature[]>([]);
  const [keep, setKeep] = useState(false);
  const [preset, setPreset] = useState<string | null>(null);

  const current = state.places.find((p) => p.id === state.settings.placeId);

  const pick = (id: string) => {
    dispatch({ type: 'place/select', id });
    const p = state.places.find((x) => x.id === id);
    if (routine && p && routine.exercises.some((e) => !isAvailable(p, e))) setMode('review');
    else onClose();
  };

  const applyPreset = (id: string) => {
    const p = PLACE_PRESETS.find((x) => x.id === id)!;
    setPreset(id);
    setEquipment(p.equipment);
    setFeatures(p.features);
  };

  const toggle = <T,>(list: T[], v: T): T[] => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  const createTemp = () => {
    const label = PLACE_PRESETS.find((x) => x.id === preset)?.name ?? '다른 곳';
    const place: Place = { id: uid(), name: name.trim() || label, equipment, features, unavailable: [], swaps: {}, temp: !keep };
    dispatch({ type: 'place/save', place });
    dispatch({ type: 'place/select', id: place.id });
    if (routine && routine.exercises.some((e) => !isAvailable(place, e))) setMode('review');
    else onClose();
  };

  if (mode === 'review' && routine) {
    // place/select 직후에는 state가 아직 이전 값일 수 있어 settings.placeId로 다시 찾는다
    return <ReviewStep routine={routine} place={current} onBack={() => setMode('list')} onClose={onClose} />;
  }

  if (mode === 'temp') {
    const probe: Place = { id: 'probe', name: '', equipment, features, unavailable: [], swaps: {} };
    const preview = routine ? routine.exercises.filter((e) => !isAvailable(probe, e)) : [];
    return (
      <Sheet
        title="다른 곳에서 운동"
        onClose={onClose}
        footer={
          <div className="btn-row">
            <button type="button" className="btn btn-secondary btn-lg" onClick={() => setMode('list')}>
              뒤로
            </button>
            <button type="button" className="btn btn-primary btn-lg" onClick={createTemp}>
              {preview.length > 0 ? `다음 · 조정 ${preview.length}개 검토` : '이 장비로 시작'}
            </button>
          </div>
        }
      >
        <p className="t-caption c-2">확인한 장비만 골라요. 프리셋을 누르거나 직접 체크해요.</p>
        <div className="preset-row" role="group" aria-label="프리셋">
          {PLACE_PRESETS.map((p) => (
            <button key={p.id} type="button" className={`preset-chip${preset === p.id ? ' is-on' : ''}`} aria-pressed={preset === p.id} onClick={() => applyPreset(p.id)}>
              <span className="t-headline">{p.name}</span>
              <span className="t-caption c-2">{p.desc}</span>
            </button>
          ))}
        </div>
        <div className="field">
          <span className="t-caption c-2">장비</span>
          <div className="chip-wrap" role="group" aria-label="있는 장비">
            {CHECKABLE_EQUIPMENT.map((e) => {
              const on = equipment.includes(e);
              return (
                <button key={e} type="button" className={`chip${on ? ' is-on' : ''}`} aria-pressed={on} onClick={() => setEquipment((l) => toggle(l, e))}>
                  {on && <Icon name="check" size={14} strokeWidth={3} />}
                  {e}
                </button>
              );
            })}
          </div>
        </div>
        <div className="field">
          <span className="t-caption c-2">보조 장비</span>
          <div className="chip-wrap" role="group" aria-label="있는 보조 장비">
            {CHECKABLE_FEATURES.map((f) => {
              const on = features.includes(f);
              return (
                <button key={f} type="button" className={`chip${on ? ' is-on' : ''}`} aria-pressed={on} onClick={() => setFeatures((l) => toggle(l, f))}>
                  {on && <Icon name="check" size={14} strokeWidth={3} />}
                  {f}
                </button>
              );
            })}
          </div>
        </div>
        {routine && (
          <p className="t-caption c-2">
            {preview.length === 0 ? `'${routine.name}' 종목은 다 할 수 있어요.` : `사용할 수 없는 운동 ${preview.length}개: ${preview.map((e) => e.name).join(', ')}`}
          </p>
        )}
        <label className="field">
          <span className="t-caption c-2">장소 이름 (선택)</span>
          <input className="text-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="예: 출장 호텔 짐" />
        </label>
        <label className="group-row toggle-row">
          <span className="group-row-main">
            <span>이 장소 저장해 두기</span>
            <span className="t-caption c-2">끄면 오늘만 쓰고, 마치면 평소 헬스장으로 돌아와요</span>
          </span>
          <span className="switch">
            <input type="checkbox" role="switch" aria-label="이 장소 저장해 두기" checked={keep} onChange={(e) => setKeep(e.target.checked)} />
            <span />
          </span>
        </label>
      </Sheet>
    );
  }

  return (
    <Sheet title="어디서 운동해요?" onClose={onClose}>
      <div className="group" role="radiogroup" aria-label="장소">
        {state.places
          .filter((p) => !p.temp)
          .map((p) => {
            const on = state.settings.placeId === p.id;
            const n = p.unavailable.length;
            return (
              <button key={p.id} type="button" role="radio" aria-checked={on} className={`group-row${on ? ' is-on' : ''}`} onClick={() => pick(p.id)}>
                <span className="group-row-main">
                  <span>{p.name}</span>
                  <span className="t-caption c-2">
                    {p.id === MAIN_PLACE_ID || !p.equipment ? '기구 제한 없음' : [...p.equipment, ...(p.features ?? [])].join(' · ') || '맨몸'}
                    {n > 0 ? ` · 뺀 종목 ${n}` : ''}
                  </span>
                </span>
                <span className={`check-dot${on ? ' is-on' : ''}`}>{on && <Icon name="check" size={16} strokeWidth={3} />}</span>
              </button>
            );
          })}
        <button type="button" className="group-row" onClick={() => setMode('temp')}>
          <span className="group-row-main">
            <span>다른 곳에서 (호텔 짐 등)</span>
            <span className="t-caption c-2">등록 없이 장비만 고르고 시작</span>
          </span>
          <Icon name="chevronRight" size={18} />
        </button>
      </div>
    </Sheet>
  );
}

interface Proposal {
  slot: RoutineExercise;
  reason: string | null;
  /** null이면 그대로 둔다 */
  to: ExerciseRef | null;
}

/** 시작 전 조정: 못 하는 종목과 대체안을 한 화면에서 비교하고 한 번에 적용한다 */
function ReviewStep({ routine, place, onBack, onClose }: { routine: Routine; place: Place | undefined; onBack: () => void; onClose: () => void }) {
  const { state, dispatch } = useStore();
  const [picking, setPicking] = useState<string | null>(null);
  const [remember, setRemember] = useState(false);
  const initial = useMemo<Proposal[]>(
    () =>
      routine.exercises
        .filter((e) => !isAvailable(place, e))
        .map((slot) => {
          const top = rankSubstitutes(slot, state.history, { place, limit: 1 })[0];
          return { slot, reason: missingReason(place, slot), to: top ? { exerciseId: top.info.id, name: top.info.name, kind: top.info.kind } : null };
        }),
    [routine, place, state.history],
  );
  const [proposals, setProposals] = useState<Proposal[]>(initial);
  const canRemember = !!place && !place.temp && place.id !== MAIN_PLACE_ID;

  const start = (apply: boolean) => {
    const swaps: Record<string, ExerciseRef> = {};
    if (apply) for (const p of proposals) if (p.to) swaps[p.slot.id] = p.to;
    if (apply && remember && place) {
      let next = place;
      for (const p of proposals) if (p.to && p.slot.exerciseId) next = markUnavailable(next, p.slot.exerciseId, p.to.exerciseId);
      dispatch({ type: 'place/save', place: next });
    }
    dispatch({ type: 'session/start', routine, now: Date.now(), swaps: Object.keys(swaps).length ? swaps : undefined });
    onClose();
  };

  if (picking) {
    const slot = proposals.find((p) => p.slot.id === picking)!.slot;
    return (
      <ExercisePicker
        mode="replace"
        current={slot}
        place={place}
        note="시작 전 조정 · 오늘만"
        onPick={([p]) => {
          setProposals((list) => list.map((x) => (x.slot.id === picking ? { ...x, to: { exerciseId: p.exerciseId, name: p.name, kind: p.kind } } : x)));
          setPicking(null);
        }}
        onClose={() => setPicking(null)}
      />
    );
  }

  const applied = proposals.filter((p) => p.to).length;
  return (
    <Sheet
      title="시작 전 조정"
      onClose={onClose}
      footer={
        <div className="btn-row">
          <button type="button" className="btn btn-secondary btn-lg" onClick={() => start(false)}>
            조정 없이 시작
          </button>
          <button type="button" className="btn btn-primary btn-lg" onClick={() => start(true)} disabled={applied === 0}>
            {applied}개 바꾸고 시작
          </button>
        </div>
      }
    >
      <p className="t-caption c-2">
        {place?.name ?? '이 장소'}에서 못 하는 운동 {proposals.length}개. 바꾼 종목은 오늘만 적용되고 기본 루틴은 그대로예요.
      </p>
      <ul className="review-list">
        {proposals.map((p) => {
          const toInfo = p.to ? findExercise(p.to.exerciseId ?? p.to.name) : undefined;
          return (
            <li key={p.slot.id} className="review-row">
              <div className="review-from">
                <span className="t-headline">{p.slot.name}</span>
                <span className="t-caption c-warn">{p.reason ?? '사용 불가'}</span>
              </div>
              <Icon name="arrowDown" size={16} className="c-3" />
              <div className="review-to">
                {p.to ? (
                  <>
                    <span className="t-headline">{p.to.name}</span>
                    <span className="t-caption c-2">{toInfo ? toInfo.equipment : ''}</span>
                  </>
                ) : (
                  <span className="t-caption c-2">그대로 두고 운동 중에 정해요</span>
                )}
              </div>
              <div className="review-actions">
                <button type="button" className="btn btn-sm btn-secondary btn-pill" onClick={() => setPicking(p.slot.id)}>
                  다른 운동
                </button>
                {p.to && (
                  <button type="button" className="btn btn-sm btn-ghost btn-pill" onClick={() => setProposals((l) => l.map((x) => (x.slot.id === p.slot.id ? { ...x, to: null } : x)))}>
                    그대로
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      {canRemember && (
        <label className="group-row toggle-row">
          <span className="group-row-main">
            <span>{place!.name}에 기억하기</span>
            <span className="t-caption c-2">다음부터 여기서는 자동으로 바꿔요. 설정 → 장소에서 되돌려요</span>
          </span>
          <span className="switch">
            <input type="checkbox" role="switch" aria-label="이 장소에 기억하기" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
            <span />
          </span>
        </label>
      )}
      <button type="button" className="btn btn-ghost btn-sm" onClick={onBack}>
        장소 다시 고르기
      </button>
    </Sheet>
  );
}
