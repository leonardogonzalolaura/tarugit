import { ConflictFileBlock } from '../ConflictResolver.types';

interface ConflictBlockRowProps {
  block: ConflictFileBlock;
  conflictNumber: number;
  totalConflicts: number;
  onHoverEnter: () => void;
  onHoverLeave: () => void;
  onAcceptOurs: () => void;
  onAcceptTheirs: () => void;
  onAcceptBoth: () => void;
  onIgnore: () => void;
  onUpdateContent: (val: string) => void;
  pane: 'ours' | 'result' | 'theirs';
}

const SvgArrowLeft = () => <svg width="9" height="9" viewBox="0 0 16 16" fill="currentcolor"><path d="M7.78 12.53a.75.75 0 0 1-1.06 0L2.22 8.03a.75.75 0 0 1 0-1.06l4.5-4.5a.749.749 0 0 1 1.275.326.749.749 0 0 1-.215.734L5.06 7h8.19a.75.75 0 0 1 0 1.5H5.06l2.72 2.72a.75.75 0 0 1 0 1.06Z"/></svg>;
const SvgArrowRight = () => <svg width="9" height="9" viewBox="0 0 16 16" fill="currentcolor"><path d="M8.22 2.97a.75.75 0 0 1 1.06 0l4.5 4.5a.75.75 0 0 1 0 1.06l-4.5 4.5a.751.751 0 0 1-1.042-.018.751.751 0 0 1-.018-1.042L10.94 9.5H2.75a.75.75 0 0 1 0-1.5h8.19L8.22 4.03a.75.75 0 0 1 0-1.06Z"/></svg>;
const SvgLink = () => <svg width="9" height="9" viewBox="0 0 16 16" fill="currentcolor"><path d="M7.775 3.275a.75.75 0 0 0 1.06 1.06l1.25-1.25a2 2 0 1 1 2.83 2.83l-2.5 2.5a2 2 0 0 1-2.83 0 .75.75 0 0 0-1.06 1.06 3.5 3.5 0 0 0 4.95 0l2.5-2.5a3.5 3.5 0 0 0-4.95-4.95l-1.25 1.25Zm-4.69 9.64a2 2 0 0 1 0-2.83l2.5-2.5a2 2 0 0 1 2.83 0 .75.75 0 0 0 1.06-1.06 3.5 3.5 0 0 0-4.95 0l-2.5 2.5a3.5 3.5 0 0 0 4.95 4.95l1.25-1.25a.75.75 0 0 0-1.06-1.06l-1.25 1.25a2 2 0 0 1-2.83 0Z"/></svg>;
const SvgX = () => <svg width="9" height="9" viewBox="0 0 16 16" fill="currentcolor"><path d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.749.749 0 0 1 1.275.326.749.749 0 0 1-.215.734L9.06 8l3.22 3.22a.749.749 0 0 1-.326 1.275.749.749 0 0 1-.734-.215L8 9.06l-3.22 3.22a.751.751 0 0 1-1.042-.018.751.751 0 0 1-.018-1.042L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06Z"/></svg>;

export function ConflictBlockRow({
  block,
  conflictNumber,
  totalConflicts,
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

  const pendingClass = isPending ? 'pending' : 'resolved';

  return (
    <div
      onMouseEnter={onHoverEnter}
      onMouseLeave={onHoverLeave}
      data-conflict-block={block.id}
      className={`cr-block conflict ${pendingClass} ${pane}`}
    >
      <div className={`cr-block-badge ${pendingClass}`}>
        {isPending ? `CONFLICTO ${conflictNumber}/${totalConflicts}` : `RESUELTO`}
      </div>

      <div className="cr-block-content">
        {pane === 'result' ? (
          <textarea
            value={block.content}
            onChange={e => onUpdateContent(e.target.value)}
            className="cr-block-textarea"
          />
        ) : (
          <div className="cr-block-text">
            {(pane === 'ours' ? block.oursContent : block.theirsContent)?.split('\n').map((line, li) => (
              <div key={li} className={`cr-block-line ${pane}`}>{line || ' '}</div>
            ))}
          </div>
        )}

        {pane === 'result' && (
          <div className="cr-block-actions">
            <button className="cr-block-act-btn ours" onClick={onAcceptOurs}>
              <SvgArrowLeft /> Aceptar Local
            </button>
            <button className="cr-block-act-btn both" onClick={onAcceptBoth}>
              <SvgLink /> Aceptar Ambos
            </button>
            <button className="cr-block-act-btn theirs" onClick={onAcceptTheirs}>
              Aceptar Entrante <SvgArrowRight />
            </button>
            <button className="cr-block-act-btn ignore" onClick={onIgnore}>
              <SvgX /> Ignorar
            </button>
          </div>
        )}

        {pane !== 'result' && <div className="cr-block-spacer" />}
      </div>
    </div>
  );
}
