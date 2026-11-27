import { weekDays } from '../lib/stats';
import type { Session } from '../lib/types';

const DAY_NAMES = ['월', '화', '수', '목', '금', '토', '일'];

/** 이번 주 월~일, 운동한 날은 채워서 */
export function WeekStrip({ history, now }: { history: Session[]; now: number }) {
  const days = weekDays(history, now);
  return (
    <ol className="week-strip" aria-label="이번 주 운동한 날">
      {days.map((d, i) => (
        <li key={d.date} className={`${d.done ? 'is-done' : ''}${d.today ? ' is-today' : ''}`}>
          <span className="week-day">{DAY_NAMES[i]}</span>
          <span className="week-dot" aria-label={d.done ? `${DAY_NAMES[i]}요일 운동함` : `${DAY_NAMES[i]}요일`}>
            {new Date(d.date).getDate()}
          </span>
        </li>
      ))}
    </ol>
  );
}
