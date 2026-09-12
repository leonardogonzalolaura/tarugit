import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

interface BranchComboProps {
  branches: string[];
  value: string;
  onChange: (v: string) => void;
  exclude?: string | string[];
  placeholder?: string;
  disabled?: boolean;
}

export function BranchCombo({ branches, value, onChange, exclude, placeholder = 'Seleccionar...', disabled }: BranchComboProps) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState('');
  const [hl, setHl] = useState(0);
  const [pos, setPos] = useState<{ top: number; left: number; width: number; maxHeight: number }>({ top: 0, left: 0, width: 0, maxHeight: 260 });
  const ref = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const list = branches.filter(b => {
    if (exclude === undefined) return true;
    return Array.isArray(exclude) ? !exclude.includes(b) : b !== exclude;
  });

  const filtered = filter
    ? list.filter(b => b.toLowerCase().includes(filter.toLowerCase()))
    : list;

  useEffect(() => {
    const h = (e: MouseEvent) => {
      const target = e.target as Node;
      if (ref.current && ref.current.contains(target)) return;
      if (dropdownRef.current && dropdownRef.current.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  useEffect(() => {
    if (!open || !ref.current) return;
    const update = () => {
      if (!ref.current) return;
      const r = ref.current.getBoundingClientRect();
      const bottomSpace = window.innerHeight - r.bottom - 8;
      const topSpace = r.top - 8;
      let top = r.bottom + 4;
      let maxHeight = Math.min(260, Math.max(120, bottomSpace));
      if (bottomSpace < 180 && topSpace > bottomSpace) {
        maxHeight = Math.min(260, Math.max(120, topSpace - 4));
        top = Math.max(8, r.top - maxHeight - 4);
      }
      setPos({ top, left: r.left, width: r.width, maxHeight });
    };
    update();
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [open, filtered.length]);

  return (
    <div style={{ flex: 1, position: 'relative', minWidth: 140, opacity: disabled ? 0.6 : 1, pointerEvents: disabled ? 'none' : 'auto' }} ref={ref}>
      <div
        className="pr-combo-trigger"
        onClick={() => { if (disabled) return; setOpen(v => !v); setFilter(''); setHl(0); }}
        title={value || placeholder}
      >
        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12 }}>{value || placeholder}</span>
        <span style={{ fontSize: 9, color: 'var(--text-muted)', flexShrink: 0 }}>▼</span>
      </div>
      {open && createPortal(
        <div
          ref={dropdownRef}
          className="pr-combo-dropdown"
          style={{ position: 'fixed', top: pos.top, left: pos.left, width: pos.width, maxHeight: pos.maxHeight, zIndex: 10000, marginTop: 0 }}
        >
          <input
            className="pr-combo-search"
            placeholder="Filtrar ramas..."
            value={filter}
            autoFocus
            onChange={e => { setFilter(e.target.value); setHl(0); }}
            onKeyDown={e => {
              if (e.key === 'ArrowDown') { e.preventDefault(); setHl(i => Math.min(i + 1, filtered.length - 1)); }
              if (e.key === 'ArrowUp') { e.preventDefault(); setHl(i => Math.max(i - 1, 0)); }
              if (e.key === 'Enter' && filtered[hl]) { onChange(filtered[hl]); setOpen(false); }
              if (e.key === 'Escape') { e.stopPropagation(); setOpen(false); }
            }}
          />
          <div className="pr-combo-list">
            {filtered.length === 0 ? (
              <div className="pr-combo-empty">Sin resultados</div>
            ) : (
              filtered.map((b, i) => (
                <div
                  key={b}
                  className={`pr-combo-item${i === hl ? ' hl' : ''}${b === value ? ' selected' : ''}`}
                  onClick={() => { onChange(b); setOpen(false); }}
                  onMouseEnter={() => setHl(i)}
                >{b}</div>
              ))
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
