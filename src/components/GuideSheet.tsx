import { findExercise, formVideoUrl, MUSCLE_LABEL, requiresOf, weightBasisOf } from '../data/exercises';
import { GUIDE_SOURCES, GUIDE_VERSION, guideOf, REVIEW_LABEL, UNILATERAL } from '../data/guides';
import { formatCountdown } from '../lib/timer';
import type { RestTimer } from '../lib/types';
import { Icon } from './Icon';
import { Sheet } from './Sheet';

interface Props {
  exerciseId?: string;
  name: string;
  /** 운동 중이면 남은 휴식을 시트 위에 작게 보여준다 (타이머는 계속 돈다) */
  rest?: RestTimer | null;
  now?: number;
  /** 후보 카드에서 열었을 때: 시트 안에서 바로 고를 수 있게 */
  onPick?: () => void;
  /** 후보로 열었을 때 원래 종목 이름과 달라지는 점 */
  from?: string;
  diff?: string[];
  onClose: () => void;
}

/** 설명 오류 신고: 운동 id와 콘텐츠 버전을 제목에 붙여 저장소 이슈로 */
export function guideIssueUrl(exerciseId: string, name: string): string {
  const title = `[운동 설명] ${name} (${exerciseId}) v${GUIDE_VERSION}`;
  const body = `운동: ${name} (${exerciseId})\n콘텐츠 버전: ${GUIDE_VERSION}\n\n틀리거나 빠진 내용:\n`;
  return `https://github.com/damienmusica/hellini/issues/new?title=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}`;
}

/**
 * 운동 설명 시트. 첫 화면은 목적·필요 장비·기록 기준·핵심 동작 3단계. 실수·영상·출처는 펼쳐서.
 * 열고 닫아도 입력값·세트·스크롤·타이머는 그대로다 (시트는 상태를 건드리지 않는다).
 */
export function GuideSheet({ exerciseId, name, rest, now, onPick, from, diff, onClose }: Props) {
  const info = findExercise(exerciseId ?? name);
  const guide = guideOf(info?.id);
  const needs = info ? [info.equipment, ...requiresOf(info.id)].filter((x) => x !== '맨몸' && x !== '기타') : [];
  const record = info
    ? [guide?.record ?? (info.kind === 'time' ? '초 단위 시간' : weightBasisOf(info.id)), UNILATERAL.has(info.id) && !guide?.record ? '횟수는 한쪽 기준' : null]
        .filter(Boolean)
        .join(' · ')
    : null;
  const remaining = rest && now !== undefined ? rest.endsAt - now : null;

  return (
    <Sheet title={`${name} · 운동 설명`} onClose={onClose} size="full">
      {remaining !== null && remaining > 0 && (
        <p className="guide-timer num" aria-live="off">
          <Icon name="timer" size={14} /> 휴식 {formatCountdown(remaining)}
        </p>
      )}
      {!info ? (
        <p className="c-2">직접 추가한 종목이라 설명이 없어요. 무게 기준과 횟수 규칙은 메모에 적어 두면 좋아요.</p>
      ) : (
        <>
          <p className="guide-purpose">{guide?.purpose ?? info.tip}</p>
          <dl className="guide-facts">
            <div>
              <dt>필요 장비</dt>
              <dd>{needs.length ? needs.join(' · ') : '없음 (맨몸)'}</dd>
            </div>
            {guide?.setup && (
              <div>
                <dt>준비</dt>
                <dd>{guide.setup}</dd>
              </div>
            )}
            <div>
              <dt>기록 기준</dt>
              <dd>{record}</dd>
            </div>
            <div>
              <dt>쓰는 근육</dt>
              <dd>
                {info.primary.map((m) => MUSCLE_LABEL[m]).join(', ')}
                {info.secondary.length > 0 && <span className="c-2"> · {info.secondary.map((m) => MUSCLE_LABEL[m]).join(', ')}</span>}
              </dd>
            </div>
          </dl>
          {from && (
            <div className="guide-diff">
              <p className="t-caption c-2">'{from}' 대신 하면</p>
              <p>{diff && diff.length ? diff.join(' · ') : '같은 장비·같은 기록 기준이에요'}. 무게와 횟수가 같다는 뜻은 아니에요.</p>
            </div>
          )}
          {guide ? (
            <ol className="guide-steps">
              {guide.steps.map((s, i) => (
                <li key={i}>
                  <span className="guide-step-no num">{i + 1}</span>
                  <span>{s}</span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="t-caption c-2">단계별 설명은 아직 없어요. 위 한 줄 팁과 참고 영상으로 확인해요.</p>
          )}
          {guide && guide.mistakes.length > 0 && (
            <details className="guide-more">
              <summary>흔한 실수</summary>
              <ul className="guide-list">
                {guide.mistakes.map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
            </details>
          )}
          <details className="guide-more">
            <summary>참고 영상 · 출처</summary>
            <a className="btn btn-secondary btn-block" href={formVideoUrl(name)} target="_blank" rel="noreferrer">
              <Icon name="video" size={20} /> 유튜브에서 자세 영상 검색
            </a>
            <p className="t-caption c-2">
              헬린이 운동 설명 v{GUIDE_VERSION} · {guide ? `${REVIEW_LABEL[guide.review]}${guide.reviewedAt ? ` (${guide.reviewedAt})` : ''}` : '라이브러리 한 줄 팁'}. {GUIDE_SOURCES}. 교육용 정보예요. 불편하거나 아프면 멈추고 확인해요.
            </p>
            <a className="t-caption guide-report" href={guideIssueUrl(info.id, info.name)} target="_blank" rel="noreferrer">
              설명이 틀렸나요? 알려주기 ({info.id})
            </a>
          </details>
        </>
      )}
      {onPick && (
        <button type="button" className="btn btn-primary btn-lg btn-block" onClick={onPick}>
          이 운동으로 바꾸기
        </button>
      )}
    </Sheet>
  );
}
