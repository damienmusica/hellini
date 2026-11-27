import { useState } from 'react';
import { findExercise } from '../data/exercises';
import { instantiateProgram, programFacts, PROGRAMS, recommendProgram, type Experience, type Place, type Program } from '../data/programs';
import { Icon } from '../components/Icon';
import { useStore } from '../lib/store';

interface Choice<T> {
  value: T;
  title: string;
  desc: string;
}

const EXPERIENCE: Choice<Experience>[] = [
  { value: 'new', title: '처음이에요', desc: '헬스장 기구도 아직 낯설어요' },
  { value: 'some', title: '조금 해봤어요', desc: '6개월 미만, 띄엄띄엄 했어요' },
  { value: 'regular', title: '꾸준히 해왔어요', desc: '기본 종목 자세는 알아요' },
];

const DAYS: Choice<number>[] = [
  { value: 2, title: '주 2회', desc: '가볍게 습관부터' },
  { value: 3, title: '주 3회', desc: '초보에게 가장 좋은 빈도' },
  { value: 4, title: '주 4회', desc: '본격적으로' },
  { value: 5, title: '주 5회', desc: '운동이 일상' },
  { value: 6, title: '거의 매일', desc: '주 6회 이상' },
];

const PLACES: Choice<Place>[] = [
  { value: 'gym', title: '헬스장', desc: '바벨·덤벨·머신을 쓸 수 있어요' },
  { value: 'home', title: '집', desc: '기구 없이 맨몸으로' },
];

function Options<T>({ items, value, onPick }: { items: Choice<T>[]; value: T | null; onPick: (v: T) => void }) {
  return (
    <div className="choice-list" role="radiogroup">
      {items.map((c) => (
        <button
          key={String(c.value)}
          type="button"
          role="radio"
          aria-checked={value === c.value}
          className={`choice${value === c.value ? ' is-on' : ''}`}
          onClick={() => onPick(c.value)}
        >
          <span className="choice-text">
            <span className="t-headline">{c.title}</span>
            <span className="t-caption c-2">{c.desc}</span>
          </span>
          <span className={`check-dot${value === c.value ? ' is-on' : ''}`}>{value === c.value && <Icon name="check" size={16} strokeWidth={3} />}</span>
        </button>
      ))}
    </div>
  );
}

export function ProgramPreview({ program }: { program: Program }) {
  return (
    <div className="program-preview">
      <div className="program-tags">
        <span className="tag">{program.level}</span>
        <span className="tag">{program.purpose}</span>
        <span className="tag">{program.days}</span>
        <span className="tag">회당 약 {programFacts(program).minutes}분</span>
        <span className="tag">{programFacts(program).equipment.join('·') || '맨몸'}</span>
      </div>
      <p className="c-2">{program.description}</p>
      {program.routines.map((r) => (
        <div key={r.name} className="program-routine">
          <p className="t-headline">{r.name}</p>
          <ul>
            {r.rows.map(([id, sets, reps]) => {
              const info = findExercise(id);
              return (
                <li key={id}>
                  <span>{info?.name}</span>
                  <span className="c-3 num">
                    {sets}세트 × {info?.kind === 'time' ? `${reps}초` : `${reps}회`}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}

export function Onboarding() {
  const { dispatch } = useStore();
  const [step, setStep] = useState(0);
  const [experience, setExperience] = useState<Experience | null>(null);
  const [days, setDays] = useState<number | null>(null);
  const [place, setPlace] = useState<Place | null>(null);
  const [programId, setProgramId] = useState<string | null>(null);

  const recommended = experience && days && place ? recommendProgram(experience, days, place) : null;
  const program = PROGRAMS.find((p) => p.id === (programId ?? recommended?.id)) ?? recommended;

  const finish = (p: Program | null) => {
    dispatch({ type: 'onboarding/complete', routines: p ? instantiateProgram(p, Date.now()) : [], weeklyGoal: days ?? 3 });
  };

  const pick = <T,>(set: (v: T) => void) => (v: T) => {
    set(v);
    window.setTimeout(() => setStep((s) => s + 1), 180);
  };

  return (
    <section className="onboarding">
      {step > 0 && (
        <header className="onboarding-head">
          <button type="button" className="icon-btn" aria-label="이전" onClick={() => setStep((s) => s - 1)}>
            <Icon name="chevronLeft" size={22} />
          </button>
          <div className="steps" aria-label={`${step}/4 단계`}>
            {[1, 2, 3, 4].map((i) => (
              <span key={i} className={i <= step ? 'is-on' : ''} />
            ))}
          </div>
          <span style={{ width: 36 }} />
        </header>
      )}

      {step === 0 && (
        <div className="onboarding-welcome">
          <div className="welcome-mark">
            <Icon name="dumbbell" size={48} strokeWidth={2.4} />
          </div>
          <h1 className="t-title">헬린이</h1>
          <p className="t-headline c-2">
            오늘 뭐 할지 고민 없이,
            <br />
            기록하면서 조금씩 강해지기
          </p>
          <ul className="welcome-points">
            <li>
              <Icon name="list" size={18} /> 나에게 맞는 루틴 추천
            </li>
            <li>
              <Icon name="timer" size={18} /> 세트 체크하면 휴식 타이머 자동 시작
            </li>
            <li>
              <Icon name="trophy" size={18} /> 지난 기록과 비교하고 새 기록 축하
            </li>
          </ul>
          <button type="button" className="btn btn-primary btn-lg btn-block" onClick={() => setStep(1)}>
            시작하기
          </button>
          <p className="t-caption c-3 center">질문 3개면 끝나요 · 기록은 이 기기에만 저장돼요</p>
        </div>
      )}

      {step === 1 && (
        <div className="onboarding-step">
          <h1 className="t-title">운동은 얼마나 해봤어요?</h1>
          <Options items={EXPERIENCE} value={experience} onPick={pick(setExperience)} />
        </div>
      )}

      {step === 2 && (
        <div className="onboarding-step">
          <h1 className="t-title">일주일에 몇 번 할 수 있어요?</h1>
          <p className="c-2">처음엔 무리하지 않는 게 오래 가는 비결이에요.</p>
          <Options items={DAYS} value={days} onPick={pick(setDays)} />
        </div>
      )}

      {step === 3 && (
        <div className="onboarding-step">
          <h1 className="t-title">어디서 운동해요?</h1>
          <Options items={PLACES} value={place} onPick={pick(setPlace)} />
        </div>
      )}

      {step === 4 && program && (
        <div className="onboarding-step">
          <span className="t-overline accent">추천 프로그램</span>
          <h1 className="t-title">{program.name}</h1>
          <ProgramPreview program={program} />
          <details className="other-programs">
            <summary>다른 프로그램 보기</summary>
            <div className="chip-wrap">
              {PROGRAMS.map((p) => (
                <button key={p.id} type="button" className={`chip${p.id === program.id ? ' is-on' : ''}`} onClick={() => setProgramId(p.id)}>
                  {p.name}
                </button>
              ))}
            </div>
          </details>
          <div className="onboarding-cta">
            <button type="button" className="btn btn-primary btn-lg btn-block" onClick={() => finish(program)}>
              이 프로그램으로 시작
            </button>
            <button type="button" className="btn btn-ghost btn-block" onClick={() => finish(null)}>
              루틴 없이 시작할게요
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
