import { useRef, useState } from 'react';
import { findExercise } from '../data/exercises';
import { Icon } from '../components/Icon';
import { Sheet } from '../components/Sheet';
import { useToast } from '../components/Toast';
import { canVibrate, cue } from '../lib/cues';
import { notifyPermission, notifySupport, requestNotify } from '../lib/notify';
import { MAIN_PLACE_ID, markAvailable } from '../lib/places';
import { GOAL_LABEL } from '../lib/body';
import { ProfileSheet } from './Body';
import { defaultState, exportFileName, parseState } from '../lib/storage';
import { formatDate } from '../lib/stats';
import { useStore } from '../lib/store';
import { formatSeconds } from '../lib/timer';

const REST_CHOICES = [60, 90, 120, 180];
const GOAL_CHOICES = [2, 3, 4, 5, 6];

function Switch({ checked, onChange, disabled, label }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean; label: string }) {
  return (
    <span className="switch">
      <input type="checkbox" role="switch" aria-label={label} checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span />
    </span>
  );
}

export function SettingsSheet({ onClose }: { onClose: () => void }) {
  const { state, dispatch } = useStore();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const s = state.settings;
  const set = (patch: Partial<typeof s>) => dispatch({ type: 'settings/update', patch });
  const [placeId, setPlaceId] = useState<string | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const openPlace = placeId ? state.places.find((p) => p.id === placeId) : undefined;
  const support = notifySupport();
  const notifyOn = !!s.restNotify && support === 'ok' && notifyPermission() === 'granted';
  const notifyCaption =
    support === 'ios-install'
      ? '아이폰은 공유 → 홈 화면에 추가한 앱에서 켤 수 있어요'
      : support === 'unsupported'
        ? '이 브라우저는 알림을 지원하지 않아요'
        : notifyPermission() === 'denied'
          ? '브라우저 설정에서 알림이 꺼져 있어요'
          : '화면을 끄거나 다른 앱을 보는 중에 휴식이 끝나면 알려요. 앱을 완전히 닫으면 안 와요';
  const toggleNotify = async (on: boolean) => {
    if (!on) {
      set({ restNotify: false });
      return;
    }
    const ok = await requestNotify();
    set({ restNotify: ok });
    if (!ok) toast({ icon: 'info', title: '알림 권한이 없어 켜지 못했어요' });
  };

  const exportData = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = exportFileName();
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    set({ lastBackupAt: Date.now() });
    toast({ tone: 'success', icon: 'download', title: '백업 파일을 저장했어요' });
  };

  const importData = async (file: File) => {
    try {
      const parsed = parseState(JSON.parse(await file.text()));
      if (!parsed) {
        window.alert('헬린이 백업 파일이 아니에요.');
        return;
      }
      if (window.confirm(`루틴 ${parsed.routines.length}개, 기록 ${parsed.history.length}개로 지금 데이터를 바꿀까요?`)) {
        dispatch({ type: 'state/replace', state: { ...parsed, onboarded: true } });
        toast({ tone: 'success', icon: 'upload', title: '백업을 불러왔어요' });
      }
    } catch {
      window.alert('파일을 읽지 못했어요.');
    }
  };

  return (
    <Sheet title="설정" onClose={onClose} size="full">
      <h3 className="settings-label">알림</h3>
      <div className="group">
        <label className="group-row">
          <span className="group-row-main">
            <span>신호음</span>
            <span className="t-caption c-3">휴식 끝·3초 전 알림. 아이폰은 무음 모드에서 안 나요</span>
          </span>
          <Switch label="신호음" checked={s.sound} onChange={(sound) => set({ sound })} />
        </label>
        <label className="group-row">
          <span className="group-row-main">
            <span>진동</span>
            <span className="t-caption c-3">{canVibrate ? '버튼·타이머 진동' : '이 브라우저는 진동을 지원하지 않아요'}</span>
          </span>
          <Switch label="진동" checked={s.vibrate && canVibrate} disabled={!canVibrate} onChange={(vibrate) => set({ vibrate })} />
        </label>
        <label className="group-row">
          <span className="group-row-main">
            <span>휴식 끝 알림</span>
            <span className="t-caption c-3">{notifyCaption}</span>
          </span>
          <Switch label="휴식 끝 알림" checked={notifyOn} disabled={support !== 'ok' || notifyPermission() === 'denied'} onChange={(v) => void toggleNotify(v)} />
        </label>
        <button type="button" className="group-row" onClick={() => cue('end', s)}>
          <span className="group-row-main">신호 테스트</span>
        </button>
      </div>

      <h3 className="settings-label">운동</h3>
      <div className="group">
        <div className="group-row stacked">
          <span>주간 목표</span>
          <div className="segmented">
            {GOAL_CHOICES.map((g) => (
              <button key={g} type="button" className={s.weeklyGoal === g ? 'is-on' : ''} onClick={() => set({ weeklyGoal: g })}>
                {g}회
              </button>
            ))}
          </div>
        </div>
        <div className="group-row stacked">
          <span>새 종목 기본 휴식</span>
          <div className="segmented">
            {REST_CHOICES.map((r) => (
              <button key={r} type="button" className={s.defaultRestSec === r ? 'is-on' : ''} onClick={() => set({ defaultRestSec: r })}>
                {formatSeconds(r)}
              </button>
            ))}
          </div>
        </div>
        <div className="group-row stacked">
          <span>바벨 봉 무게 (원판 계산)</span>
          <div className="segmented">
            {[20, 15, 10].map((kg) => (
              <button key={kg} type="button" className={s.barKg === kg ? 'is-on' : ''} onClick={() => set({ barKg: kg })}>
                {kg}kg
              </button>
            ))}
          </div>
        </div>
      </div>

      <h3 className="settings-label">내 몸</h3>
      <div className="group">
        <button type="button" className="group-row" onClick={() => setProfileOpen(true)}>
          <span className="group-row-main">
            <span>프로필 · 목표</span>
            <span className="t-caption c-3">
              {[state.profile.sex ? (state.profile.sex === 'male' ? '남' : '여') : null, state.profile.heightCm ? `${state.profile.heightCm}cm` : null, state.profile.goal ? GOAL_LABEL[state.profile.goal] : null]
                .filter(Boolean)
                .join(' · ') || '체성분 기록은 기록 탭 → 몸에서'}
            </span>
          </span>
          <Icon name="chevronRight" size={18} />
        </button>
      </div>
      {profileOpen && <ProfileSheet onClose={() => setProfileOpen(false)} />}

      <h3 className="settings-label">장소</h3>
      <p className="t-caption c-3 settings-note">운동 중 "기구가 없어요"로 바꾼 종목은 장소마다 기억해요. 여기서 되돌릴 수 있어요.</p>
      <div className="group">
        {state.places
          .filter((p) => !p.temp)
          .map((p) => (
            <button key={p.id} type="button" className="group-row" onClick={() => setPlaceId(p.id)}>
              <span className="group-row-main">
                <span>{p.name}</span>
                <span className="t-caption c-3">
                  {p.equipment ? p.equipment.join(' · ') : '기구 제한 없음'}
                  {p.unavailable.length > 0 ? ` · 없는 기구 ${p.unavailable.length}종목` : ''}
                </span>
              </span>
              <Icon name="chevronRight" size={18} />
            </button>
          ))}
      </div>
      {openPlace && (
        <Sheet title={openPlace.name} onClose={() => setPlaceId(null)}>
          {openPlace.unavailable.length === 0 ? (
            <p className="c-2">이 장소에서 뺀 종목이 없어요.</p>
          ) : (
            <div className="group">
              {openPlace.unavailable.map((id) => {
                const to = openPlace.swaps[id];
                return (
                  <div key={id} className="group-row">
                    <span className="group-row-main">
                      <span>{findExercise(id)?.name ?? id}</span>
                      <span className="t-caption c-3">{to ? `시작할 때 ${findExercise(to)?.name ?? to}(으)로 바꿈` : '기구 없음'}</span>
                    </span>
                    <button type="button" className="btn btn-sm btn-secondary btn-pill" onClick={() => dispatch({ type: 'place/save', place: markAvailable(openPlace, id) })}>
                      다시 있어요
                    </button>
                  </div>
                );
              })}
            </div>
          )}
          {openPlace.id !== MAIN_PLACE_ID && (
            <button
              type="button"
              className="btn btn-danger-text btn-block"
              onClick={() => {
                if (window.confirm(`'${openPlace.name}' 장소를 지울까요? 여기서 한 기록은 남아요.`)) {
                  dispatch({ type: 'place/delete', id: openPlace.id });
                  setPlaceId(null);
                }
              }}
            >
              장소 삭제
            </button>
          )}
        </Sheet>
      )}

      <h3 className="settings-label">데이터</h3>
      <p className="t-caption c-3 settings-note">
        기록은 이 기기 브라우저에만 저장돼요. 아이폰은 홈 화면에 추가해 두고, 가끔 백업해 주세요.
        {s.lastBackupAt ? ` 마지막 백업: ${formatDate(s.lastBackupAt)}` : ''}
      </p>
      <div className="group">
        <button type="button" className="group-row" onClick={exportData}>
          <span className="group-row-main">백업 파일 내보내기</span>
        </button>
        <button type="button" className="group-row" onClick={() => fileRef.current?.click()}>
          <span className="group-row-main">백업 불러오기</span>
        </button>
        <button
          type="button"
          className="group-row danger-row"
          onClick={() => {
            if (window.confirm('모든 루틴과 기록을 지우고 처음부터 시작할까요? 되돌릴 수 없어요.')) {
              dispatch({ type: 'state/replace', state: defaultState() });
              onClose();
            }
          }}
        >
          <span className="group-row-main">모든 데이터 지우기</span>
        </button>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file) void importData(file);
        }}
      />
      <p className="t-caption c-3 center">헬린이 v{__APP_VERSION__} · 빌드 {__BUILD_ID__}</p>
    </Sheet>
  );
}
