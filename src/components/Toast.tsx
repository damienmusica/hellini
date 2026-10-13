import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { Icon, type IconName } from './Icon';

interface Toast {
  id: number;
  title: string;
  body?: string;
  icon?: IconName;
  tone?: 'default' | 'gold' | 'success';
}

const ToastContext = createContext<(t: Omit<Toast, 'id'>) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const seq = useRef(0);

  const show = useCallback((t: Omit<Toast, 'id'>) => {
    const id = ++seq.current;
    setToasts((list) => [...list.slice(-2), { ...t, id }]);
    window.setTimeout(() => setToasts((list) => list.filter((x) => x.id !== id)), 2800);
  }, []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div className="toast-stack" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.tone ?? 'default'}`}>
            {t.icon && (
              <span className="toast-icon">
                <Icon name={t.icon} size={20} />
              </span>
            )}
            <div>
              <p className="toast-title">{t.title}</p>
              {t.body && <p className="toast-body">{t.body}</p>}
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
