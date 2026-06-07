import { useState, useEffect } from 'react';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
}

let toastListener: ((message: string, type: ToastType, duration?: number) => void) | null = null;

export const toast = {
  success: (msg: string, duration?: number) => toastListener?.(msg, 'success', duration),
  error: (msg: string, duration?: number) => toastListener?.(msg, 'error', duration),
  info: (msg: string, duration?: number) => toastListener?.(msg, 'info', duration),
  warning: (msg: string, duration?: number) => toastListener?.(msg, 'warning', duration),
  show: (msg: string, type: ToastType = 'info', duration?: number) => toastListener?.(msg, type, duration),
};

// Auto-override window.alert for absolute compatibility with zero code changes
if (typeof window !== 'undefined') {
  //const originalAlert = window.alert;
  window.alert = (msg: any) => {
    const msgStr = String(msg);
    // If it's a confirmation like confirm(), window.alert is sometimes used just to inform.
    // Let's check emojis or text keywords to determine the styling:
    let type: ToastType = 'info';
    if (msgStr.includes('✅') || msgStr.toLowerCase().includes('exito') || msgStr.toLowerCase().includes('éxito') || msgStr.toLowerCase().includes('completado')) {
      type = 'success';
    } else if (msgStr.includes('❌') || msgStr.includes('⚠️') || msgStr.toLowerCase().includes('error') || msgStr.toLowerCase().includes('falló') || msgStr.toLowerCase().includes('invalid')) {
      type = 'error';
    } else if (msgStr.toLowerCase().includes('advertencia') || msgStr.toLowerCase().includes('cuidado')) {
      type = 'warning';
    }

    toast.show(msgStr, type);
    // Keep a console log for debugging
    console.log(`[Alert Override] (${type}): ${msgStr}`);
  };
}

export function ToastContainer() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    toastListener = (message: string, type: ToastType, duration = 4500) => {
      const id = crypto.randomUUID();
      setToasts(prev => [...prev, { id, message, type }]);

      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id));
      }, duration);
    };

    return () => {
      toastListener = null;
    };
  }, []);

  if (toasts.length === 0) return null;

  return (
    <>
      <style>{`
        @keyframes toast-in {
          from {
            transform: translateY(16px) scale(0.95);
            opacity: 0;
          }
          to {
            transform: translateY(0) scale(1);
            opacity: 1;
          }
        }
      `}</style>
      <div style={{
        position: 'fixed',
        bottom: '48px', // justo arriba del footer
        right: '24px',
        zIndex: 99999,
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        maxWidth: '380px',
        width: '100%',
        pointerEvents: 'none'
      }}>
      {toasts.map(t => {
        let bg = 'rgba(30, 41, 59, 0.95)'; // Slate default
        let border = '1px solid var(--border)';
        let leftBorderColor = 'var(--text-muted)';
        let icon = 'ℹ️';

        if (t.type === 'success') {
          bg = 'rgba(16, 185, 129, 0.15)'; // Emerald tint
          border = '1px solid rgba(16, 185, 129, 0.3)';
          leftBorderColor = '#10b981'; // Green
          icon = '✅';
        } else if (t.type === 'error') {
          bg = 'rgba(239, 68, 68, 0.15)'; // Red tint
          border = '1px solid rgba(239, 68, 68, 0.3)';
          leftBorderColor = '#ef4444'; // Red
          icon = '❌';
        } else if (t.type === 'warning') {
          bg = 'rgba(245, 158, 11, 0.15)'; // Amber tint
          border = '1px solid rgba(245, 158, 11, 0.3)';
          leftBorderColor = '#f59e0b'; // Amber
          icon = '⚠️';
        }

        return (
          <div
            key={t.id}
            style={{
              display: 'flex',
              alignItems: 'start',
              gap: '10px',
              padding: '12px 16px',
              background: bg,
              border: border,
              borderLeft: `4px solid ${leftBorderColor}`,
              borderRadius: '6px',
              color: 'var(--text-primary)',
              fontSize: '12px',
              boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.3), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
              backdropFilter: 'blur(8px)',
              pointerEvents: 'auto',
              animation: 'toast-in 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards',
              transition: 'all 0.2s ease',
              lineHeight: '1.4'
            }}
          >
            <span style={{ fontSize: '14px', flexShrink: 0, marginTop: '1px' }}>{icon}</span>
            <div style={{ flex: 1, wordBreak: 'break-word', fontWeight: 500 }}>
              {t.message.replace(/^[✅❌⚠️ℹ️]\s*/, '')} {/* Quitar emoji duplicado si ya lo tiene el mensaje */}
            </div>
            <button
              onClick={() => setToasts(prev => prev.filter(x => x.id !== t.id))}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                fontSize: '10px',
                padding: '0 2px',
                lineHeight: 1,
                alignSelf: 'start',
                marginTop: '2px',
                opacity: 0.7
              }}
              onMouseEnter={e => e.currentTarget.style.opacity = '1'}
              onMouseLeave={e => e.currentTarget.style.opacity = '0.7'}
            >
              ✕
            </button>
          </div>
        );
      })}
    </div>
    </>
  );
}
