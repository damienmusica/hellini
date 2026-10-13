import { useEffect, useState } from 'react';

interface Props {
  value: number;
  onChange: (value: number) => void;
  label: string;
  min?: number;
  max?: number;
  decimal?: boolean;
  className?: string;
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

/** 입력 중에는 문자열을 그대로 두고, 유효한 숫자일 때만 반영한다 (빈 칸으로 지우고 다시 쓰기 가능) */
export function NumberField({ value, onChange, label, min = 0, max = 9999, decimal = false, className }: Props) {
  const [text, setText] = useState(String(value));
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (!editing) setText(String(value));
  }, [value, editing]);

  return (
    <input
      className={className ?? 'num-input'}
      type="text"
      inputMode={decimal ? 'decimal' : 'numeric'}
      enterKeyHint="done"
      aria-label={label}
      value={text}
      onFocus={(e) => {
        setEditing(true);
        e.currentTarget.select();
      }}
      onBlur={() => setEditing(false)}
      onChange={(e) => {
        const t = e.target.value.replace(',', '.');
        setText(t);
        const n = Number(t);
        if (t.trim() !== '' && Number.isFinite(n)) onChange(clamp(decimal ? n : Math.round(n), min, max));
      }}
    />
  );
}
