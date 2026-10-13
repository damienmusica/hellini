import { NumberField } from './NumberField';

interface Props {
  label: string;
  value: number;
  step: number;
  unit: string;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  decimal?: boolean;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function Stepper({ label, value, step, unit, onChange, min = 0, max = 9999, decimal }: Props) {
  const set = (n: number) => onChange(Math.min(max, Math.max(min, round2(n))));
  return (
    <div className="stepper">
      <span className="stepper-label">{label}</span>
      <div className="stepper-row">
        <button type="button" className="btn stepper-btn" aria-label={`${label} 줄이기`} onClick={() => set(value - step)}>
          −
        </button>
        <div className="stepper-value">
          <NumberField
            className="num-input num-input-lg"
            value={value}
            onChange={set}
            label={label}
            min={min}
            max={max}
            decimal={decimal}
          />
          <span className="stepper-unit">{unit}</span>
        </div>
        <button type="button" className="btn stepper-btn" aria-label={`${label} 늘리기`} onClick={() => set(value + step)}>
          +
        </button>
      </div>
    </div>
  );
}
