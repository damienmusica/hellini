import { useState } from 'react';
import { uid } from '../lib/id';
import { CHECKABLE_EQUIPMENT, MAIN_PLACE_ID, unavailableIn } from '../lib/places';
import { useStore } from '../lib/store';
import type { Equipment, Place, Routine } from '../lib/types';
import { Icon } from './Icon';
import { Sheet } from './Sheet';

interface Props {
  /** 오늘 할 루틴. 고른 장소에서 못 하는 종목을 미리 알려준다 */
  routine?: Routine;
  onClose: () => void;
}

/**
 * 어디서 운동할지 고르기. 평소 헬스장(기본) / 저장한 장소 / 오늘만 쓰는 임시 장소(호텔 짐 등) / 맨몸.
 * 임시 장소는 등록 없이 장비만 체크하고 시작한다. 운동을 마치면 자동으로 평소 헬스장으로 돌아온다.
 */
export function PlaceSheet({ routine, onClose }: Props) {
  const { state, dispatch } = useStore();
  const [mode, setMode] = useState<'list' | 'temp'>('list');
  const [name, setName] = useState('');
  const [equipment, setEquipment] = useState<Equipment[]>(['덤벨', '머신', '케이블']);
  const [keep, setKeep] = useState(false);

  const pick = (id: string) => {
    dispatch({ type: 'place/select', id });
    onClose();
  };

  const startTemp = (eq: Equipment[] | undefined, label: string) => {
    const place: Place = { id: uid(), name: name.trim() || label, equipment: eq, unavailable: [], swaps: {}, temp: !keep };
    dispatch({ type: 'place/save', place });
    dispatch({ type: 'place/select', id: place.id });
    onClose();
  };

  if (mode === 'temp') {
    const preview = routine ? unavailableIn({ id: 'preview', name: '', equipment, unavailable: [], swaps: {} }, routine.exercises) : [];
    return (
      <Sheet title="다른 곳에서 운동" onClose={onClose}>
        <p className="c-2">있는 장비만 체크하면, 없는 기구 종목은 운동 화면에서 바로 바꿀 수 있어요. 기본 루틴은 그대로예요.</p>
        <label className="field">
          <span className="t-caption c-2">장소 이름 (선택)</span>
          <input className="text-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="예: 출장 호텔 짐" />
        </label>
        <div className="chip-wrap" role="group" aria-label="있는 장비">
          {CHECKABLE_EQUIPMENT.map((e) => {
            const on = equipment.includes(e);
            return (
              <button
                key={e}
                type="button"
                className={`chip${on ? ' is-on' : ''}`}
                aria-pressed={on}
                onClick={() => setEquipment((list) => (on ? list.filter((x) => x !== e) : [...list, e]))}
              >
                {on && <Icon name="check" size={14} strokeWidth={3} />}
                {e}
              </button>
            );
          })}
        </div>
        {routine && (
          <p className="t-caption c-2">
            {preview.length === 0
              ? `'${routine.name}' 종목은 다 할 수 있어요.`
              : `'${routine.name}'에서 ${preview.map((e) => e.name).join(', ')}은(는) 여기 기구가 없어요. 시작하면 바꿀 수 있어요.`}
          </p>
        )}
        <label className="group-row toggle-row">
          <span className="group-row-main">
            <span>이 장소 저장해 두기</span>
            <span className="t-caption c-3">끄면 오늘만 쓰고, 마치면 평소 헬스장으로 돌아와요</span>
          </span>
          <span className="switch">
            <input type="checkbox" role="switch" aria-label="이 장소 저장해 두기" checked={keep} onChange={(e) => setKeep(e.target.checked)} />
            <span />
          </span>
        </label>
        <div className="btn-row">
          <button type="button" className="btn btn-secondary btn-lg" onClick={() => setMode('list')}>
            뒤로
          </button>
          <button type="button" className="btn btn-primary btn-lg" onClick={() => startTemp(equipment, '다른 헬스장')}>
            이 장비로 할게요
          </button>
        </div>
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
                  <span className="t-caption c-3">
                    {p.id === MAIN_PLACE_ID ? '기구 제한 없음' : p.equipment ? p.equipment.join(' · ') : '기구 제한 없음'}
                    {n > 0 ? ` · 없는 기구 ${n}종목` : ''}
                  </span>
                </span>
                <span className={`check-dot${on ? ' is-on' : ''}`}>{on && <Icon name="check" size={16} strokeWidth={3} />}</span>
              </button>
            );
          })}
        <button type="button" className="group-row" onClick={() => setMode('temp')}>
          <span className="group-row-main">
            <span>다른 곳에서 (호텔 짐 등)</span>
            <span className="t-caption c-3">등록 없이 있는 장비만 체크하고 시작</span>
          </span>
          <Icon name="chevronRight" size={18} />
        </button>
        <button type="button" className="group-row" onClick={() => startTemp(['맨몸' as Equipment], '맨몸')}>
          <span className="group-row-main">
            <span>맨몸만</span>
            <span className="t-caption c-3">기구 없이 · 오늘만</span>
          </span>
          <Icon name="chevronRight" size={18} />
        </button>
      </div>
    </Sheet>
  );
}
