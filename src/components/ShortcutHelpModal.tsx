import { useEffect } from 'react';

interface ShortcutItem {
  keys: string;
  label: string;
}

const shortcuts: ShortcutItem[] = [
  { keys: 'Ctrl + 1', label: 'Pestaña: Cambios' },
  { keys: 'Ctrl + 2', label: 'Pestaña: Historial' },
  { keys: 'Ctrl + 3', label: 'Pestaña: Stash' },
  { keys: 'Ctrl + 4', label: 'Pestaña: Tags' },
  { keys: 'Ctrl + 5', label: 'Actions (panel central)' },
  { keys: 'Ctrl + Tab', label: 'Siguiente pestaña' },
  { keys: 'Ctrl + Shift + Tab', label: 'Pestaña anterior' },
  { keys: 'Ctrl + B', label: 'Colapsar/expandir barra lateral' },
  { keys: 'Ctrl + Shift + B', label: 'Crear rama' },
  { keys: 'Ctrl + P', label: 'Buscador de repositorios' },
  { keys: 'Ctrl + Shift + S', label: 'Abrir modal de sincronización' },
  { keys: 'Ctrl + E', label: 'Cherry-pick rápido' },
  { keys: 'Ctrl + Shift + D', label: 'Comparar ramas' },
  { keys: 'Ctrl + ?', label: 'Mostrar esta ayuda' },
];

interface ShortcutHelpModalProps {
  onClose: () => void;
}

export function ShortcutHelpModal({ onClose }: ShortcutHelpModalProps) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 460, maxHeight: '80vh' }}>
        <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
          <h3 className="modal-title" style={{ fontSize: 14, margin: 0 }}>⌨ Atajos de teclado</h3>
          <button className="btn-close" onClick={onClose}>✕</button>
        </div>

        <div style={{ padding: '8px 0', overflow: 'auto' }}>
          {shortcuts.map((s, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '8px 16px',
                fontSize: 13,
              }}
            >
              <span style={{ color: 'var(--text-secondary)' }}>{s.label}</span>
              <kbd style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                padding: '3px 8px',
                borderRadius: 4,
                background: 'var(--bg-surface)',
                border: '1px solid var(--border)',
                color: 'var(--text-primary)',
                whiteSpace: 'nowrap',
              }}>{s.keys}</kbd>
            </div>
          ))}
        </div>

        <div style={{ padding: '10px 16px', borderTop: '1px solid var(--border)', textAlign: 'center', fontSize: 11, color: 'var(--text-muted)' }}>
          Presiona <kbd style={{ fontFamily: 'var(--font-mono)', fontSize: 11, padding: '2px 6px', borderRadius: 3, background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>ESC</kbd> para cerrar
        </div>
      </div>
    </div>
  );
}
