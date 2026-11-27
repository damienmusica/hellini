import { Icon } from './Icon';
import type { WeeklyReview } from '../lib/review';
import { formatShortDate } from '../lib/stats';

interface Props {
  review: WeeklyReview;
  title?: string;
  onDismiss?: () => void;
}

/**
 * 주간 리뷰 카드. 숫자 셋(운동·볼륨·새 기록) 위에 규칙이 만든 문장 몇 줄.
 * 문장은 충족한 조건만, 톤은 점 하나로. 긴 격려문·점수·캐릭터는 없다.
 */
export function WeeklyReviewCard({ review, title = '지난 주 리뷰', onDismiss }: Props) {
  const period = `${formatShortDate(review.weekStart)}~${formatShortDate(review.weekEnd - 1)}`;
  return (
    <section className="card review-card" aria-label={title}>
      <div className="row-between">
        <div>
          <h2 className="t-headline">{title}</h2>
          <p className="t-caption c-3">{period}</p>
        </div>
        {onDismiss && (
          <button type="button" className="icon-btn is-plain" aria-label="리뷰 닫기" onClick={onDismiss}>
            <Icon name="close" size={18} />
          </button>
        )}
      </div>
      <div className="review-kpis">
        <span>
          <strong className="num">
            {review.sessions}
            <small>/{review.goal}회</small>
          </strong>
          <small>운동</small>
        </span>
        <span>
          <strong className="num">{review.volume >= 1000 ? `${Math.round(review.volume / 100) / 10}t` : `${Math.round(review.volume)}kg`}</strong>
          <small>볼륨</small>
        </span>
        <span>
          <strong className="num">{review.prs}</strong>
          <small>새 기록</small>
        </span>
      </div>
      <ul className="review-lines">
        {review.lines.map((l) => (
          <li key={l.code} className={`is-${l.tone}`}>
            <span className="review-dot" aria-hidden="true" />
            <span>{l.text}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
