import { useEffect, useRef } from 'react';

type ModalSize = 'sm' | 'md' | 'lg';

const sizeMap: Record<ModalSize, number> = {
  sm: 400,
  md: 480,
  lg: 560,
};

interface ModalProps {
  size?: ModalSize;
  maxWidth?: number;
  maxHeight?: string;
  title?: React.ReactNode;
  badge?: React.ReactNode;
  onClose: () => void;
  disableBackdropClose?: boolean;
  children: React.ReactNode;
  footer?: React.ReactNode;
  hint?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export function Modal({
  size = 'md',
  maxWidth,
  maxHeight = '85vh',
  title,
  badge,
  onClose,
  disableBackdropClose,
  children,
  footer,
  hint,
  className,
  style,
}: ModalProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    ref.current?.focus();
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !disableBackdropClose) onClose();
    };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose, disableBackdropClose]);

  const width = maxWidth ?? sizeMap[size];

  return (
    <div className="modal-backdrop" onClick={disableBackdropClose ? undefined : onClose}>
      <div
        ref={ref}
        className={`modal ${className ?? ''}`}
        tabIndex={-1}
        onClick={e => e.stopPropagation()}
        style={{
          maxWidth: width,
          maxHeight,
          padding: 0,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          ...style,
        }}
      >
        {title !== undefined && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px 10px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
              {title}
              {badge}
            </h3>
            <button className="btn-close" onClick={onClose} disabled={!!disableBackdropClose} style={{ opacity: disableBackdropClose ? 0.4 : 1 }}>✕</button>
          </div>
        )}
        <div style={{ flex: 1, minHeight: 0, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
          {children}
        </div>
        {footer && (
          <div style={{ padding: '10px 16px 12px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: 8, flexShrink: 0 }}>
            {footer}
          </div>
        )}
        {hint && (
          <div style={{ padding: '7px 16px', borderTop: '1px solid var(--border)', fontSize: 10, color: 'var(--text-muted)', flexShrink: 0, lineHeight: 1.5 }}>
            {hint}
          </div>
        )}
      </div>
    </div>
  );
}
