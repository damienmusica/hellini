import { useRef } from 'react';
import { canVibrate, cue } from '../lib/cues';
import {
  describeSets,
  doneSets,
  formatDate,
  formatDuration,
  formatTime,
  formatVolume,
  sessionVolume,
  sessionsThisWeek,
} from '../lib/stats';
import { exportFileName, parseState } from '../lib/storage';
import { useStore } from '../lib/store';

export function History() {
  const { state, dispatch } = useStore();
  const fileRef = useRef<HTMLInputElement>(null);
  const now = Date.now();

  const exportData = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = exportFileName();
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const importData = async (file: File) => {
    try {
      const parsed = parseState(JSON.parse(await file.text()));
      if (!parsed) {
        window.alert('헬린이 백업 파일이 아니에요.');
        return;
      }
      const msg = `루틴 ${parsed.routines.length}개, 기록 ${parsed.history.length}개로 지금 데이터를 바꿀까요?`;
      if (window.confirm(msg)) dispatch({ type: 'state/replace', state: parsed });
    } catch {
      window.alert('파일을 읽지 못했어요.');
    }
  };

  return (
    <section className="screen">
      <header className="screen-header">
        <h1>기록</h1>
      </header>

      <div className="stat-row">
        <div className="stat">
          <span className="stat-value">{sessionsThisWeek(state.history, now)}회</span>
          <span className="stat-label">이번 주</span>
        </div>
        <div className="stat">
          <span className="stat-value">{state.history.length}회</span>
          <span className="stat-label">누적</span>
        </div>
      </div>

      {state.history.length === 0 ? (
        <p className="card empty muted">운동을 마치면 여기에 기록이 쌓여요.</p>
      ) : (
        <ul className="card-list">
          {state.history.map((s) => {
            const volume = sessionVolume(s);
            return (
              <li key={s.id}>
                <details className="card history-item">
                  <summary>
                    <span className="history-date">
                      {formatDate(s.startedAt)} {formatTime(s.startedAt)}
                    </span>
                    <span className="history-title">{s.routineName}</span>
                    <span className="muted small">
                      {formatDuration((s.endedAt ?? s.startedAt) - s.startedAt)} · {doneSets(s)}세트
                      {volume > 0 ? ` · ${formatVolume(volume)}` : ''}
                    </span>
                  </summary>
                  <ul className="plain-list history-detail">
                    {s.exercises.map((e) => (
                      <li key={e.id}>
                        <strong>{e.name}</strong>
                        <span className="muted">{describeSets(e)}</span>
                      </li>
                    ))}
                  </ul>
                  <button
                    type="button"
                    className="btn btn-sm btn-danger-ghost"
                    onClick={() => {
                      if (window.confirm('이 기록을 삭제할까요?')) dispatch({ type: 'history/delete', id: s.id });
                    }}
                  >
                    기록 삭제
                  </button>
                </details>
              </li>
            );
          })}
        </ul>
      )}

      <h2 className="section-title">설정</h2>
      <div className="card settings">
        <label className="check">
          <input
            type="checkbox"
            checked={state.settings.sound}
            onChange={(e) => dispatch({ type: 'settings/update', patch: { sound: e.target.checked } })}
          />
          <span>신호음</span>
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={state.settings.vibrate}
            disabled={!canVibrate}
            onChange={(e) => dispatch({ type: 'settings/update', patch: { vibrate: e.target.checked } })}
          />
          <span>진동{canVibrate ? '' : ' (이 기기 브라우저는 지원하지 않아요)'}</span>
        </label>
        <button type="button" className="btn btn-sm" onClick={() => cue('end', state.settings)}>
          신호 테스트
        </button>
        <p className="muted small">아이폰은 무음 모드에서 신호음이 나지 않아요. 운동 중에는 화면이 꺼지지 않게 유지해요.</p>
      </div>

      <h2 className="section-title">백업</h2>
      <div className="card settings">
        <p className="muted small">
          기록은 이 기기 브라우저에만 저장돼요. 아이폰 사파리는 홈 화면에 추가하지 않으면 오래 안 쓴 데이터를 지울 수 있으니, 가끔 내보내기로
          백업해 두세요.
        </p>
        <div className="btn-row">
          <button type="button" className="btn" onClick={exportData}>
            내보내기
          </button>
          <button type="button" className="btn" onClick={() => fileRef.current?.click()}>
            가져오기
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
      </div>
      <p className="muted small center">헬린이 v{__APP_VERSION__}</p>
    </section>
  );
}
