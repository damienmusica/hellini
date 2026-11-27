import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { Icon, type IconName } from './Icon';

interface Toast {
  id: number;
  title: string;
  body?: string;
  icon?: IconName;
  tone?: 'default' | 'gold' | 'success';
  /** 짧은 실행 취소 같은 한 가지 동작. 있으면 조금 더 오래 떠 있는다 */
  action?: { label: string; onClick: () => void };
}

const ToastContext = createContext<(t: Omit<Toast, 'id'>) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const seq = useRef(0);

  const show = useCallback((t: Omit<Toast, 'id'>) => {
    const id = ++seq.current;
    setToasts((list) => [...list.slice(-2), { ...t, id }]);
    window.setTimeout(() => setToasts((list) => list.filter((x) => x.id !== id)), t.action ? 6000 : 2800);
  }, []);

  const dismiss = (id: number) => setToasts((list) => list.filter((x) => x.id !== id));

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div className="toast-stack" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.tone ?? 'default'}${t.action ? ' has-action' : ''}`}>
            {t.icon && (
              <span className="toast-icon">
                <Icon name={t.icon} size={20} />
              </span>
            )}
            <div className="toast-text">
              <p className="toast-title">{t.title}</p>
              {t.body && <p className="toast-body">{t.body}</p>}
            </div>
            {t.action && (
              <button
                type="button"
                className="btn btn-sm btn-tinted btn-pill"
                onClick={() => {
                  t.action!.onClick();
                  dismiss(t.id);
                }}
              >
                {t.action.label}
              </button>
            )}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
