import { ConflictFileBlock } from '../ConflictResolver.types';

interface ConflictBlockRowProps {
  block: ConflictFileBlock;
  conflictNumber: number;
  totalConflicts: number;
  isHovered: boolean;
  onHoverEnter: () => void;
  onHoverLeave: () => void;
  onAcceptOurs: () => void;
  onAcceptTheirs: () => void;
  onAcceptBoth: () => void;
  onIgnore: () => void;
  onUpdateContent: (val: string) => void;
  pane: 'ours' | 'result' | 'theirs';
}

export function ConflictBlockRow({
  block,
  conflictNumber,
  totalConflicts,
  isHovered,
  onHoverEnter,
  onHoverLeave,
  onAcceptOurs,
  onAcceptTheirs,
  onAcceptBoth,
  onIgnore,
  onUpdateContent,
  pane
}: ConflictBlockRowProps) {
  const isPending = !block.resolution || block.resolution === 'pending';

  const glowColor = isHovered ? 'rgba(110,127,255,0.18)' : 'transparent';
  const borderColor = isHovered
    ? 'var(--accent)'
    : isPending
      ? (pane === 'ours' ? 'var(--green-border)' : pane === 'theirs' ? 'var(--red-border)' : 'var(--accent-dim)')
      : 'var(--green-border)';
  const bgColor = isHovered
    ? glowColor
    : isPending
      ? (pane === 'ours' ? 'var(--green-bg)' : pane === 'theirs' ? 'var(--red-bg)' : 'rgba(110,127,255,0.04)')
      : 'rgba(61,214,140,0.04)';

  return (
    <div
      onMouseEnter={onHoverEnter}
      onMouseLeave={onHoverLeave}
      data-conflict-block={block.id}
      style={{ background: bgColor, border: `1px solid ${borderColor}`, borderRadius: 'var(--radius-sm)', marginBottom: '8px', position: 'relative', transition: 'all 0.15s' }}
    >
      <div style={{ position: 'absolute', top: '-10px', left: '8px', fontSize: '9px', fontWeight: 700, background: isPending ? 'var(--red)' : 'var(--green)', color: '#000', padding: '1px 6px', borderRadius: '4px', zIndex: 1 }}>
        {isPending ? `⚡ CONFLICTO ${conflictNumber}/${totalConflicts}` : `✓ RESUELTO`}
      </div>

      <div style={{ padding: '18px 8px 8px' }}>
        {pane === 'result' ? (
          <textarea
            value={block.content}
            onChange={e => onUpdateContent(e.target.value)}
            style={{ width: '100%', minHeight: `${Math.max(120, (block.content.split('\n').length) * 32)}px`, background: '#0e0e16', color: 'var(--text-primary)', border: '1px solid var(--border)', borderRadius: '4px', padding: '8px', outline: 'none', resize: 'vertical', fontFamily: 'var(--font-mono)', fontSize: '12px', lineHeight: 1.4 }}
          />
        ) : (
          <div style={{ whiteSpace: 'pre-wrap', fontFamily: 'var(--font-mono)', fontSize: '12px', lineHeight: 1.6, padding: '4px' }}>
            {(pane === 'ours' ? block.oursContent : block.theirsContent)?.split('\n').map((line, li) => (
              <div key={li} style={{ padding: '1px 4px', borderRadius: '2px', color: pane === 'ours' ? '#b9f5d8' : '#ffd0d0' }}>{line || ' '}</div>
            ))}
          </div>
        )}

        {pane === 'result' && (
          <div style={{ display: 'flex', gap: '6px', marginTop: '8px', flexWrap: 'wrap' }}>
            <button onClick={onAcceptTheirs} style={{ background: 'var(--green-bg)', border: '1px solid var(--green-border)', color: 'var(--green)', fontSize: '10px', fontWeight: 700, padding: '3px 10px', borderRadius: '4px', cursor: 'pointer' }}>⬅️ Aceptar Local</button>

            <button onClick={onAcceptBoth} style={{ background: 'rgba(167,139,250,0.12)', border: '1px solid rgba(167,139,250,0.3)', color: '#a78bfa', fontSize: '10px', fontWeight: 700, padding: '3px 10px', borderRadius: '4px', cursor: 'pointer' }}>🔗 Aceptar Ambos</button>

            <button onClick={onAcceptOurs} style={{ background: 'var(--red-bg)', border: '1px solid var(--red-border)', color: 'var(--red)', fontSize: '10px', fontWeight: 700, padding: '3px 10px', borderRadius: '4px', cursor: 'pointer' }}>Aceptar Entrante ➡️</button>

            <button onClick={onIgnore} style={{ background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-muted)', fontSize: '10px', padding: '3px 8px', borderRadius: '4px', cursor: 'pointer', marginLeft: 'auto' }}>✕ Ignorar</button>
          </div>
        )}

        {/* Espacio reservado en ours/theirs para igualar altura con el panel result */}
        {pane !== 'result' && (
          <div style={{ height: '34px', marginTop: '8px' }} />
        )}
      </div>
    </div>
  );
}
