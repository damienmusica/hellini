interface Props {
  size: number;
  stroke: number;
  /** 0~1 남은 비율 */
  progress: number;
  className?: string;
}

/** 원형 진행 표시. 색은 CSS(.ring-fg의 stroke)로 정한다 */
export function Ring({ size, stroke, progress, className }: Props) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const p = Math.min(1, Math.max(0, progress));
  return (
    <svg className={`ring ${className ?? ''}`} width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
      <circle className="ring-bg" cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} fill="none" />
      <circle
        className="ring-fg"
        cx={size / 2}
        cy={size / 2}
        r={r}
        strokeWidth={stroke}
        fill="none"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - p)}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </svg>
  );
}
