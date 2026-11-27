import { useEffect, useId, useRef, type ReactNode } from 'react';
import { Icon } from './Icon';

interface Props {
  title?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  /** full: 화면 대부분을 차지 (목록 선택 등) */
  size?: 'auto' | 'full';
  label?: string;
}

/** 아래에서 올라오는 시트. 바깥을 누르거나 Esc로 닫힌다 */
export function Sheet({ title, onClose, children, footer, size = 'auto', label }: Props) {
  const titleId = useId();
  const panel = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  // 열릴 때 한 번만: Esc로 닫기, 뒤 화면 스크롤 막기, 포커스 이동 (안쪽 입력칸이 autoFocus면 그대로 둔다).
  // 닫히면 열었던 버튼으로 초점을 돌려준다
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeRef.current();
    };
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    if (!panel.current?.contains(document.activeElement)) panel.current?.focus({ preventScroll: true });
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      if (opener && opener.isConnected && typeof opener.focus === 'function') opener.focus({ preventScroll: true });
    };
  }, []);

  return (
    <div className="sheet-layer">
      <div className="sheet-scrim" onClick={onClose} />
      <div
        ref={panel}
        className={`sheet sheet-${size}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-label={title ? undefined : label}
        tabIndex={-1}
      >
        <div className="sheet-grabber" aria-hidden="true" />
        {title && (
          <header className="sheet-header">
            <h2 id={titleId} className="t-headline">
              {title}
            </h2>
            <button type="button" className="icon-btn" aria-label="닫기" onClick={onClose}>
              <Icon name="close" size={20} />
            </button>
          </header>
        )}
        <div className="sheet-body">{children}</div>
        {footer && <div className="sheet-footer">{footer}</div>}
      </div>
    </div>
  );
}

export interface ActionItem {
  label: string;
  icon?: Parameters<typeof Icon>[0]['name'];
  danger?: boolean;
  onSelect: () => void;
}

/** iOS 액션 시트 같은 메뉴 */
export function ActionSheet({ title, items, onClose }: { title?: string; items: ActionItem[]; onClose: () => void }) {
  return (
    <Sheet title={title} onClose={onClose} label="메뉴">
      <ul className="action-list">
        {items.map((item) => (
          <li key={item.label}>
            <button
              type="button"
              className={`action-item${item.danger ? ' is-danger' : ''}`}
              onClick={() => {
                onClose();
                item.onSelect();
              }}
            >
              {item.icon && <Icon name={item.icon} size={20} />}
              <span>{item.label}</span>
            </button>
          </li>
        ))}
      </ul>
    </Sheet>
  );
}
