import { useRef } from 'react';
import { Sheet } from '../components/Sheet';
import { useToast } from '../components/Toast';
import { canVibrate, cue } from '../lib/cues';
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
      <p className="t-caption c-3 center">헬린이 v{__APP_VERSION__}</p>
    </Sheet>
  );
}
