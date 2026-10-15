import { useState } from 'react';
import { haptic } from '../lib/cues';
import { Icon } from './Icon';

interface Props {
  label: string;
  value: number;
  unit: string;
  decimal: boolean;
  step: number;
  max?: number;
  onChange: (value: number) => void;
  onNext: () => void;
  nextLabel: string;
  onClose: () => void;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

function parse(text: string): number {
  const n = Number(text);
  return text === '' || !Number.isFinite(n) ? 0 : n;
}

/**
 * 운동 중 숫자 입력용 키패드. 시스템 키보드가 화면을 밀어 올리지 않고,
 * 땀 묻은 손으로도 누르기 쉽게 키를 크게 만들었다. 첫 입력은 기존 값을 덮어쓴다.
 * 부모에서 key={필드}로 다시 마운트해 필드가 바뀔 때마다 입력 상태를 초기화한다.
 */
export function Keypad({ label, value, unit, decimal, step, max = 9999, onChange, onNext, nextLabel, onClose }: Props) {
  const [text, setText] = useState(String(value));
  const [fresh, setFresh] = useState(true);

  const commit = (t: string) => {
    const n = Math.min(max, parse(t));
    setText(t);
    setFresh(false);
    onChange(n);
  };

  const press = (key: string) => {
    haptic(8);
    if (key === 'back') {
      commit(fresh ? '' : text.slice(0, -1));
      return;
    }
    if (key === '.') {
      if (!decimal) return;
      if (fresh || text === '') commit('0.');
      else if (!text.includes('.')) commit(`${text}.`);
      return;
    }
    const base = fresh ? '' : text;
    const [int, frac] = base.split('.');
    if (frac !== undefined && frac.length >= 2) return;
    if (frac === undefined && int.replace(/^0+/, '').length >= 4) return;
    commit(base === '0' ? key : base + key);
  };

  const bump = (dir: 1 | -1) => {
    haptic(8);
    const n = Math.min(max, Math.max(0, round2(value + dir * step)));
    setText(String(n));
    setFresh(true);
    onChange(n);
  };

  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', decimal ? '.' : '', '0', 'back'];

  return (
    <div className="keypad" role="group" aria-label={`${label} 입력`}>
      <div className="keypad-head">
        <span className="t-caption c-2">{label}</span>
        <span className="keypad-value num" aria-live="polite">
          {fresh ? value : text || '0'}
          <small>{unit}</small>
        </span>
        <button type="button" className="icon-btn" aria-label="키패드 닫기" onClick={onClose}>
          <Icon name="chevronDown" size={20} />
        </button>
      </div>
      <div className="keypad-grid">
        {keys.map((k, i) =>
          k === '' ? (
            <span key={i} />
          ) : (
            <button
              key={k}
              type="button"
              className="key"
              aria-label={k === 'back' ? '지우기' : k === '.' ? '소수점' : k}
              onClick={() => press(k)}
            >
              {k === 'back' ? <Icon name="backspace" size={22} /> : k}
            </button>
          ),
        )}
        <button type="button" className="key key-step" style={{ gridArea: 'minus' }} aria-label={`${step} 빼기`} onClick={() => bump(-1)}>
          −{step}
        </button>
        <button type="button" className="key key-step" style={{ gridArea: 'plus' }} aria-label={`${step} 더하기`} onClick={() => bump(1)}>
          +{step}
        </button>
        <button type="button" className="key key-next" style={{ gridArea: 'next' }} onClick={onNext}>
          {nextLabel}
        </button>
      </div>
    </div>
  );
}
