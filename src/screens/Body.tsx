import { useMemo, useState } from 'react';
import { LineChart } from '../components/Charts';
import { Icon } from '../components/Icon';
import { Sheet } from '../components/Sheet';
import { useToast } from '../components/Toast';
import { bodyTrend, GOAL_DESC, GOAL_LABEL, latestBody, nutritionTargets, recommendGoal } from '../lib/body';
import { uid } from '../lib/id';
import { dayStart, formatDate, formatShortDate, relativeDay, trimKg } from '../lib/stats';
import { useStore } from '../lib/store';
import type { BodyLog, Goal, Profile } from '../lib/types';

const GOALS: Goal[] = ['recomp', 'bulk', 'cut', 'maintain'];

function toDateInput(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function fromDateInput(s: string): number {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d).getTime();
}

function num(v: string): number | undefined {
  const n = parseFloat(v);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

/** 기록 탭 → 몸. 체성분 기록, 추세, 영양 목표. 데이터는 이 기기에만 남는다 */
export function BodyView() {
  const { state, dispatch } = useStore();
  const now = Date.now();
  const [adding, setAdding] = useState<BodyLog | 'new' | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const latest = latestBody(state.body);
  const nutrition = useMemo(() => nutritionTargets(state.profile, latest, state.settings.weeklyGoal, now), [state.profile, latest, state.settings.weeklyGoal, now]);
  const trend = useMemo(() => bodyTrend(state.body, state.profile.goal, now), [state.body, state.profile.goal, now]);
  const rec = recommendGoal(state.profile.sex, latest?.bodyFatPct);

  const points = useMemo(
    () =>
      [...state.body].reverse().map((b) => ({
        x: b.date,
        y: b.weightKg,
        valueText: `${trimKg(b.weightKg)}kg${b.bodyFatPct !== undefined ? ` · ${b.bodyFatPct}%` : ''}`,
        caption: formatDate(b.date),
      })),
    [state.body],
  );
  const fatPoints = useMemo(
    () =>
      [...state.body]
        .reverse()
        .filter((b) => b.bodyFatPct !== undefined)
        .map((b) => ({ x: b.date, y: b.bodyFatPct!, valueText: `${b.bodyFatPct}%`, caption: formatDate(b.date) })),
    [state.body],
  );

  return (
    <>
      {latest ? (
        <div className="stat-tiles">
          <div className="card">
            <span className="t-overline c-3">체중</span>
            <span className="t-stat">{trimKg(latest.weightKg)}kg</span>
          </div>
          <div className="card">
            <span className="t-overline c-3">체지방률</span>
            <span className="t-stat">{latest.bodyFatPct !== undefined ? `${latest.bodyFatPct}%` : '—'}</span>
          </div>
          <div className="card">
            <span className="t-overline c-3">골격근</span>
            <span className="t-stat">{latest.skeletalMuscleKg !== undefined ? `${trimKg(latest.skeletalMuscleKg)}kg` : '—'}</span>
          </div>
        </div>
      ) : (
        <div className="card empty-card">
          <Icon name="scale" size={32} />
          <p className="t-headline">체성분을 넣으면 더 똑똑해져요</p>
          <p className="t-caption c-2">인바디 결과의 체중·체지방률·골격근량을 적어 두면 영양 목표, 체중 추세, 체중 대비 근력을 계산해요. 이 기기에만 저장돼요.</p>
        </div>
      )}

      <div className="btn-row">
        <button type="button" className="btn btn-primary btn-lg" onClick={() => setAdding('new')}>
          <Icon name="plus" size={18} /> 체성분 기록
        </button>
        <button type="button" className="btn btn-secondary btn-lg" onClick={() => setProfileOpen(true)}>
          <Icon name="edit" size={18} /> 프로필 · 목표
        </button>
      </div>

      {latest && (
        <div className="card goal-card">
          <div className="row-between">
            <span className="t-overline c-3">지금 단계</span>
            <span className="tag">{state.profile.goal ? GOAL_LABEL[state.profile.goal] : '목표 없음'}</span>
          </div>
          {state.profile.goal && <p className="t-caption c-2">{GOAL_DESC[state.profile.goal]}</p>}
          {rec && rec.goal !== state.profile.goal && (
            <p className="ex-flag">
              <Icon name="sparkle" size={16} />
              <span>
                추천: <strong>{GOAL_LABEL[rec.goal]}</strong> — {rec.reason}
              </span>
              <button type="button" className="btn btn-sm btn-secondary btn-pill" onClick={() => dispatch({ type: 'profile/update', patch: { goal: rec.goal } })}>
                적용
              </button>
            </p>
          )}
          {trend && <p className={`trend trend-${trend.tone}`}>{trend.message}</p>}
        </div>
      )}

      {latest && (
        <div className="card">
          <h3 className="t-headline">하루 영양 목표</h3>
          {nutrition ? (
            <>
              <div className="mini-stats">
                <span>
                  <strong className="num">{nutrition.kcal.toLocaleString('ko-KR')}</strong>
                  <small>kcal</small>
                </span>
                <span>
                  <strong className="num">{nutrition.proteinG}g</strong>
                  <small>단백질</small>
                </span>
                <span>
                  <strong className="num">{nutrition.tdee.toLocaleString('ko-KR')}</strong>
                  <small>유지 열량</small>
                </span>
              </div>
              <p className="t-caption c-3">
                기초대사량 {nutrition.bmr.toLocaleString('ko-KR')}kcal ({nutrition.method === 'katch' ? '제지방량 기준' : '성별·나이·키 기준'}) × 주 {state.settings.weeklyGoal}회 활동. 단백질은 체중 kg당 {state.profile.goal === 'cut' ? '2.0' : '1.8'}g. 대략의 출발점이고 2~3주 체중 추세로 맞춰요.
              </p>
            </>
          ) : (
            <p className="t-caption c-2">체지방률을 넣거나, 프로필에 성별·출생연도·키를 넣으면 계산돼요.</p>
          )}
        </div>
      )}

      {points.length >= 2 && (
        <div className="card">
          <h3 className="t-headline">체중 추이</h3>
          <LineChart points={points} label="체중 추이" xLabel={formatShortDate} />
          {fatPoints.length >= 2 && (
            <>
              <h3 className="t-headline">체지방률 추이</h3>
              <LineChart points={fatPoints} label="체지방률 추이" xLabel={formatShortDate} />
            </>
          )}
        </div>
      )}

      {state.body.length > 0 && (
        <ul className="group detail-list">
          {state.body.map((b) => (
            <li key={b.id}>
              <button type="button" className="group-row" onClick={() => setAdding(b)}>
                <span className="group-row-main">
                  <span className="t-caption c-3">
                    {formatDate(b.date)} · {relativeDay(b.date, now)}
                  </span>
                  <span>
                    {trimKg(b.weightKg)}kg
                    {b.bodyFatPct !== undefined ? ` · 체지방 ${b.bodyFatPct}%` : ''}
                    {b.skeletalMuscleKg !== undefined ? ` · 골격근 ${trimKg(b.skeletalMuscleKg)}kg` : ''}
                    {b.waistCm !== undefined ? ` · 허리 ${trimKg(b.waistCm)}cm` : ''}
                  </span>
                  {b.note && <span className="t-caption c-2">{b.note}</span>}
                </span>
                <Icon name="chevronRight" size={16} className="c-3" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {adding && <BodySheet initial={adding === 'new' ? undefined : adding} onClose={() => setAdding(null)} />}
      {profileOpen && <ProfileSheet onClose={() => setProfileOpen(false)} />}
    </>
  );
}

function Field({ label, unit, value, onChange, step = '0.1', required }: { label: string; unit: string; value: string; onChange: (v: string) => void; step?: string; required?: boolean }) {
  return (
    <label className="field">
      <span className="t-caption c-2">
        {label} ({unit}){required ? '' : ' · 선택'}
      </span>
      <input className="text-input num" type="number" inputMode="decimal" step={step} min="0" value={value} onChange={(e) => onChange(e.target.value)} placeholder={required ? '' : '비워도 돼요'} />
    </label>
  );
}

export function BodySheet({ initial, onClose }: { initial?: BodyLog; onClose: () => void }) {
  const { dispatch } = useStore();
  const toast = useToast();
  const [date, setDate] = useState(toDateInput(initial?.date ?? Date.now()));
  const [weight, setWeight] = useState(initial ? String(initial.weightKg) : '');
  const [fat, setFat] = useState(initial?.bodyFatPct !== undefined ? String(initial.bodyFatPct) : '');
  const [muscle, setMuscle] = useState(initial?.skeletalMuscleKg !== undefined ? String(initial.skeletalMuscleKg) : '');
  const [waist, setWaist] = useState(initial?.waistCm !== undefined ? String(initial.waistCm) : '');
  const [note, setNote] = useState(initial?.note ?? '');
  const w = num(weight);

  return (
    <Sheet
      title={initial ? '체성분 기록 고치기' : '체성분 기록'}
      onClose={onClose}
      footer={
        <button
          type="button"
          className="btn btn-primary btn-lg btn-block"
          disabled={!w || !date}
          onClick={() => {
            dispatch({
              type: 'body/save',
              log: {
                id: initial?.id ?? uid(),
                date: dayStart(fromDateInput(date)),
                weightKg: w!,
                bodyFatPct: num(fat),
                skeletalMuscleKg: num(muscle),
                waistCm: num(waist),
                note: note.trim() || undefined,
              },
            });
            toast({ tone: 'success', icon: 'check', title: initial ? '고쳤어요' : '체성분을 기록했어요' });
            onClose();
          }}
        >
          저장
        </button>
      }
    >
      <p className="t-caption c-2">인바디 결과지의 숫자를 그대로 적어요. 체중만 있어도 되고, 체지방률이 있으면 영양 목표가 더 정확해져요.</p>
      <label className="field">
        <span className="t-caption c-2">측정일</span>
        <input className="text-input" type="date" value={date} max={toDateInput(Date.now())} onChange={(e) => setDate(e.target.value)} />
      </label>
      <Field label="체중" unit="kg" value={weight} onChange={setWeight} required />
      <Field label="체지방률" unit="%" value={fat} onChange={setFat} />
      <Field label="골격근량" unit="kg" value={muscle} onChange={setMuscle} />
      <Field label="허리둘레" unit="cm" value={waist} onChange={setWaist} />
      <label className="field">
        <span className="t-caption c-2">메모 · 선택</span>
        <input className="text-input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="예: 건강검진 인바디, 아침 공복" />
      </label>
      {initial && (
        <button
          type="button"
          className="btn btn-danger-text btn-block"
          onClick={() => {
            if (window.confirm('이 체성분 기록을 지울까요?')) {
              dispatch({ type: 'body/delete', id: initial.id });
              onClose();
            }
          }}
        >
          기록 삭제
        </button>
      )}
    </Sheet>
  );
}

export function ProfileSheet({ onClose }: { onClose: () => void }) {
  const { state, dispatch } = useStore();
  const p = state.profile;
  const set = (patch: Partial<Profile>) => dispatch({ type: 'profile/update', patch });
  const [year, setYear] = useState(p.birthYear ? String(p.birthYear) : '');
  const [height, setHeight] = useState(p.heightCm ? String(p.heightCm) : '');
  const latest = latestBody(state.body);
  const rec = recommendGoal(p.sex, latest?.bodyFatPct);

  return (
    <Sheet title="프로필 · 목표" onClose={onClose}>
      <p className="t-caption c-2">전부 선택이에요. 성별·나이·키는 체지방률이 없을 때 기초대사량 계산에만 써요. 이 기기에만 저장돼요.</p>
      <div className="group-row stacked">
        <span>성별</span>
        <div className="segmented" role="radiogroup" aria-label="성별">
          {(['male', 'female'] as const).map((s) => (
            <button key={s} type="button" role="radio" aria-checked={p.sex === s} className={p.sex === s ? 'is-on' : ''} onClick={() => set({ sex: p.sex === s ? undefined : s })}>
              {s === 'male' ? '남' : '여'}
            </button>
          ))}
        </div>
      </div>
      <label className="field">
        <span className="t-caption c-2">출생연도</span>
        <input
          className="text-input num"
          type="number"
          inputMode="numeric"
          value={year}
          onChange={(e) => setYear(e.target.value)}
          onBlur={() => set({ birthYear: num(year) && num(year)! > 1900 ? Math.round(num(year)!) : undefined })}
          placeholder="예: 1994"
        />
      </label>
      <label className="field">
        <span className="t-caption c-2">키 (cm)</span>
        <input className="text-input num" type="number" inputMode="decimal" step="0.1" value={height} onChange={(e) => setHeight(e.target.value)} onBlur={() => set({ heightCm: num(height) })} placeholder="예: 175.8" />
      </label>
      <div className="group-row stacked">
        <span>지금 단계</span>
        <div className="goal-grid" role="radiogroup" aria-label="목표">
          {GOALS.map((g) => (
            <button key={g} type="button" role="radio" aria-checked={p.goal === g} className={`chip${p.goal === g ? ' is-on' : ''}`} onClick={() => set({ goal: p.goal === g ? undefined : g })}>
              {GOAL_LABEL[g]}
            </button>
          ))}
        </div>
        {p.goal && <span className="t-caption c-3">{GOAL_DESC[p.goal]}</span>}
        {rec && <span className="t-caption c-2">추천: {GOAL_LABEL[rec.goal]} — {rec.reason}</span>}
      </div>
      <p className="t-caption c-3">세트·무게 제안은 목표와 상관없이 지난 기록만 봐요. 목표는 영양 목표와 체중 추세 판단에만 써요.</p>
    </Sheet>
  );
}
