import { useState } from 'react';
import { findExercise, formVideoUrl, MUSCLE_LABEL } from '../../data/exercises';
import { Icon } from '../../components/Icon';
import { Sheet } from '../../components/Sheet';
import { platesPerSide } from '../../lib/progression';
import { trimKg } from '../../lib/stats';
import { formatSeconds } from '../../lib/timer';

export function TipSheet({ exerciseId, name, onClose }: { exerciseId?: string; name: string; onClose: () => void }) {
  const info = findExercise(exerciseId ?? name);
  return (
    <Sheet title={name} onClose={onClose}>
      {info ? (
        <>
          <p className="t-caption c-3">
            {info.en} · {info.part} · {info.equipment}
          </p>
          <div className="tip-box">
            <Icon name="info" size={18} />
            <p>{info.tip}</p>
          </div>
          <dl className="muscle-list">
            <div>
              <dt className="t-caption c-3">주로 쓰는 근육</dt>
              <dd>{info.primary.map((m) => MUSCLE_LABEL[m]).join(', ')}</dd>
            </div>
            {info.secondary.length > 0 && (
              <div>
                <dt className="t-caption c-3">함께 쓰는 근육</dt>
                <dd>{info.secondary.map((m) => MUSCLE_LABEL[m]).join(', ')}</dd>
              </div>
            )}
          </dl>
        </>
      ) : (
        <p className="c-2">직접 추가한 종목이에요.</p>
      )}
      <a className="btn btn-tinted btn-lg btn-block" href={formVideoUrl(name)} target="_blank" rel="noreferrer">
        <Icon name="video" size={20} /> 유튜브에서 자세 영상 보기
      </a>
    </Sheet>
  );
}

const REST_OPTIONS = [0, 30, 45, 60, 75, 90, 120, 150, 180, 240, 300];

export function RestTimeSheet({ name, value, onPick, onClose }: { name: string; value: number; onPick: (sec: number) => void; onClose: () => void }) {
  return (
    <Sheet title={`${name} 휴식 시간`} onClose={onClose}>
      <p className="t-caption c-2">세트를 완료하면 이 시간만큼 휴식 타이머가 자동으로 돌아요.</p>
      <div className="option-grid">
        {REST_OPTIONS.map((sec) => (
          <button
            key={sec}
            type="button"
            className={`option${value === sec ? ' is-on' : ''}`}
            onClick={() => {
              onPick(sec);
              onClose();
            }}
          >
            {sec === 0 ? '끔' : formatSeconds(sec)}
          </button>
        ))}
      </div>
    </Sheet>
  );
}

const PLATE_CLASS: Record<number, string> = {
  25: 'p25',
  20: 'p20',
  15: 'p15',
  10: 'p10',
  5: 'p5',
  2.5: 'p2',
  1.25: 'p1',
};

export function PlateSheet({
  weightKg,
  barKg,
  onBarChange,
  onClose,
}: {
  weightKg: number;
  barKg: number;
  onBarChange: (kg: number) => void;
  onClose: () => void;
}) {
  const { plates, remainder } = platesPerSide(weightKg, barKg);
  return (
    <Sheet title="원판 계산기" onClose={onClose}>
      <p className="t-stat num center">{trimKg(weightKg)}kg</p>
      <div className="segmented" role="radiogroup" aria-label="봉 무게">
        {[20, 15, 10].map((kg) => (
          <button key={kg} type="button" role="radio" aria-checked={barKg === kg} className={barKg === kg ? 'is-on' : ''} onClick={() => onBarChange(kg)}>
            봉 {kg}kg
          </button>
        ))}
      </div>
      <div className="barbell" aria-hidden="true">
        <span className="bar-sleeve" />
        {plates.map((p, i) => (
          <span key={i} className={`plate ${PLATE_CLASS[p]}`}>
            {trimKg(p)}
          </span>
        ))}
        <span className="bar-end" />
      </div>
      <p className="center">
        {weightKg <= barKg ? (
          '빈 봉으로 하면 돼요.'
        ) : (
          <>
            한쪽에 <strong>{plates.map(trimKg).join(' + ')}</strong> kg
          </>
        )}
      </p>
      {remainder > 0 && <p className="t-caption c-3 center">가진 원판으로는 {trimKg(remainder)}kg가 남아요.</p>}
    </Sheet>
  );
}

export function NoteSheet({ name, value, onSave, onClose }: { name: string; value: string; onSave: (v: string) => void; onClose: () => void }) {
  const [text, setText] = useState(value);
  return (
    <Sheet
      title={`${name} 메모`}
      onClose={onClose}
      footer={
        <button
          type="button"
          className="btn btn-primary btn-lg btn-block"
          onClick={() => {
            onSave(text.trim());
            onClose();
          }}
        >
          저장
        </button>
      }
    >
      <textarea
        className="text-input textarea"
        rows={4}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="예: 의자 높이 4, 그립 넓게"
        autoFocus
      />
    </Sheet>
  );
}
