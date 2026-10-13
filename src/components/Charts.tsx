import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';

/** 부모 너비에 맞춰 SVG를 그리기 위한 측정 훅 */
function useWidth<T extends HTMLElement>(): [RefObject<T | null>, number] {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(320);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setWidth(Math.max(200, el.clientWidth));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width];
}

/** 0부터 시작하는 깔끔한 눈금 최댓값 (1, 2, 2.5, 5 × 10^k) */
export function niceMax(v: number): number {
  if (v <= 0) return 1;
  const exp = Math.pow(10, Math.floor(Math.log10(v)));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * exp >= v) return m * exp;
  return 10 * exp;
}

export function compact(n: number): string {
  if (n >= 10000) return `${Math.round(n / 1000)}K`;
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}K`;
  return `${Math.round(n * 10) / 10}`;
}

function columnPath(x: number, w: number, top: number, base: number): string {
  const r = Math.min(4, w / 2, base - top);
  return `M${x} ${base} L${x} ${top + r} Q${x} ${top} ${x + r} ${top} L${x + w - r} ${top} Q${x + w} ${top} ${x + w} ${top + r} L${x + w} ${base} Z`;
}

function Tooltip({ x, children }: { x: number; children: ReactNode }) {
  return (
    <div className="chart-tip" style={{ left: x }}>
      {children}
    </div>
  );
}

export interface ColumnDatum {
  label: string;
  value: number;
  /** 툴팁 첫 줄 (값) */
  valueText: string;
  /** 툴팁 둘째 줄 (설명) */
  caption: string;
}

/** 단일 계열 세로 막대 (주별 볼륨 등). 막대를 누르면 값이 뜬다 */
export function ColumnChart({ data, height = 180, label }: { data: ColumnDatum[]; height?: number; label: string }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);
  const padL = 34;
  const padB = 22;
  const padT = 12;
  const plotW = width - padL;
  const plotH = height - padB - padT;
  const max = niceMax(Math.max(...data.map((d) => d.value)));
  const slot = plotW / data.length;
  const barW = Math.min(24, slot * 0.6);
  const ticks = [0, max / 2, max];
  const y = (v: number) => padT + plotH - (v / max) * plotH;
  const lastIdx = data.length - 1;

  return (
    <div ref={ref} className="chart" onPointerLeave={() => setActive(null)}>
      <svg width={width} height={height} role="img" aria-label={label}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={padL} x2={width} y1={y(t)} y2={y(t)} className="chart-grid" />
            <text x={padL - 6} y={y(t) + 4} textAnchor="end" className="chart-axis">
              {compact(t)}
            </text>
          </g>
        ))}
        {data.map((d, i) => {
          const cx = padL + slot * i + slot / 2;
          const showLabel = i === 0 || i === lastIdx || i === Math.floor(lastIdx / 2);
          return (
            <g
              key={i}
              tabIndex={0}
              role="img"
              aria-label={`${d.caption} ${d.valueText}`}
              onPointerEnter={() => setActive(i)}
              onPointerDown={() => setActive(i)}
              onFocus={() => setActive(i)}
              onBlur={() => setActive(null)}
              className={`chart-col${active === i ? ' is-active' : ''}`}
            >
              <rect x={padL + slot * i} y={padT} width={slot} height={plotH} className="chart-hit" />
              {d.value > 0 && <path d={columnPath(cx - barW / 2, barW, y(d.value), y(0))} className="chart-bar" />}
              {showLabel && (
                <text x={cx} y={height - 6} textAnchor="middle" className="chart-axis">
                  {d.label}
                </text>
              )}
            </g>
          );
        })}
        {data[lastIdx] && data[lastIdx].value > 0 && active === null && (
          <text x={padL + slot * lastIdx + slot / 2} y={y(data[lastIdx].value) - 6} textAnchor="middle" className="chart-value">
            {compact(data[lastIdx].value)}
          </text>
        )}
      </svg>
      {active !== null && data[active] && (
        <Tooltip x={Math.min(Math.max(padL + slot * active + slot / 2, 60), width - 60)}>
          <strong>{data[active].valueText}</strong>
          <span>{data[active].caption}</span>
        </Tooltip>
      )}
    </div>
  );
}

export interface LinePoint {
  x: number;
  y: number;
  valueText: string;
  caption: string;
}

/** 단일 계열 꺾은선 (종목별 추정 1RM 추이). 손가락을 대면 가장 가까운 점의 값이 뜬다 */
export function LineChart({ points, height = 190, label, xLabel }: { points: LinePoint[]; height?: number; label: string; xLabel: (x: number) => string }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);
  const padL = 34;
  const padR = 18;
  const padB = 22;
  const padT = 18;
  if (points.length === 0) return null;
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const rawMin = Math.min(...ys);
  const rawMax = Math.max(...ys);
  const span = Math.max(1, rawMax - rawMin);
  const lo = Math.max(0, Math.floor((rawMin - span * 0.3) / 5) * 5);
  const hi = Math.ceil((rawMax + span * 0.2) / 5) * 5 || 5;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;
  const sx = (x: number) => padL + (maxX === minX ? plotW / 2 : ((x - minX) / (maxX - minX)) * plotW);
  const sy = (v: number) => padT + plotH - ((v - lo) / (hi - lo)) * plotH;
  const ticks = [lo, (lo + hi) / 2, hi];
  const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${sx(p.x)} ${sy(p.y)}`).join(' ');
  const area = `${line} L${sx(points.at(-1)!.x)} ${sy(lo)} L${sx(points[0].x)} ${sy(lo)} Z`;
  const last = points.at(-1)!;

  const nearest = (clientX: number, rect: DOMRect) => {
    const x = clientX - rect.left;
    let best = 0;
    points.forEach((p, i) => {
      if (Math.abs(sx(p.x) - x) < Math.abs(sx(points[best].x) - x)) best = i;
    });
    setActive(best);
  };

  return (
    <div ref={ref} className="chart" onPointerLeave={() => setActive(null)}>
      <svg
        width={width}
        height={height}
        role="img"
        aria-label={label}
        tabIndex={0}
        onPointerMove={(e) => nearest(e.clientX, e.currentTarget.getBoundingClientRect())}
        onPointerDown={(e) => nearest(e.clientX, e.currentTarget.getBoundingClientRect())}
        onKeyDown={(e) => {
          if (e.key === 'ArrowLeft') setActive((a) => Math.max(0, (a ?? points.length) - 1));
          if (e.key === 'ArrowRight') setActive((a) => Math.min(points.length - 1, (a ?? -1) + 1));
        }}
        onBlur={() => setActive(null)}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line x1={padL} x2={width - padR} y1={sy(t)} y2={sy(t)} className="chart-grid" />
            <text x={padL - 6} y={sy(t) + 4} textAnchor="end" className="chart-axis">
              {compact(t)}
            </text>
          </g>
        ))}
        <path d={area} className="chart-area" />
        <path d={line} className="chart-line" />
        {active !== null && <line x1={sx(points[active].x)} x2={sx(points[active].x)} y1={padT} y2={padT + plotH} className="chart-cross" />}
        <circle cx={sx((active !== null ? points[active] : last).x)} cy={sy((active !== null ? points[active] : last).y)} r={5} className="chart-dot" />
        <text x={padL} y={height - 6} className="chart-axis">
          {xLabel(minX)}
        </text>
        {maxX !== minX && (
          <text x={width - padR} y={height - 6} textAnchor="end" className="chart-axis">
            {xLabel(maxX)}
          </text>
        )}
        {active === null && (
          <text x={Math.min(sx(last.x), width - padR)} y={sy(last.y) - 10} textAnchor="end" className="chart-value">
            {last.valueText}
          </text>
        )}
      </svg>
      {active !== null && (
        <Tooltip x={Math.min(Math.max(sx(points[active].x), 60), width - 60)}>
          <strong>{points[active].valueText}</strong>
          <span>{points[active].caption}</span>
        </Tooltip>
      )}
    </div>
  );
}

/** 가로 막대 목록 (부위별 세트 수). 값은 막대 끝에 표시 */
export function BarList({ rows, unit }: { rows: { label: string; value: number }[]; unit: string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="bar-list">
      {rows.map((r) => (
        <li key={r.label}>
          <span className="bar-label">{r.label}</span>
          <span className="bar-track">
            <span className="bar-fill" style={{ width: `${(r.value / max) * 100}%` }} />
          </span>
          <span className="bar-value num">
            {Math.round(r.value * 10) / 10}
            {unit}
          </span>
        </li>
      ))}
    </ul>
  );
}
