import { useEffect, useRef, useState, memo } from 'react';
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

function ConflictBlockRowInner({
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

  // Estado local para el textarea del panel Resultado: evita que cada tecla
  // dispare un re-render del padre que desmonte el <textarea> y robe el foco.
  // Sincroniza hacia arriba inmediatamente pero mantiene el valor local
  // mientras está enfocado para preservar cursor/selección.
  const [localValue, setLocalValue] = useState(block.content);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isFocusedRef = useRef(false);
  const latestValueRef = useRef(block.content);

  // Sincroniza cuando el bloque cambia de identidad o cuando el contenido
  // es cambiado externamente (Aceptar Local/Entrante/Both/Ignorar) y el
  // textarea NO está enfocado. Mientras está enfocado NO tocamos nada,
  // ni siquiera con debounce, para evitar el rebote a los ~450ms.
  useEffect(() => {
    if (!isFocusedRef.current) {
      setLocalValue(block.content);
      latestValueRef.current = block.content;
    }
  }, [block.id, block.content, block.oursContent, block.theirsContent]);

  const flushToParent = (val: string) => {
    if (val !== block.content) onUpdateContent(val);
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    latestValueRef.current = val;
    setLocalValue(val);
    // Intencionalmente NO llamamos a onUpdateContent aquí.
    // El padre solo se actualiza al hacer blur o al guardar (que lee el DOM),
    // así no hay re-render del padre mientras escribes y el foco no se pierde.
  };

  const handleBlur = () => {
    isFocusedRef.current = false;
    flushToParent(latestValueRef.current);
  };

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
            ref={textareaRef}
            value={localValue}
            onChange={handleChange}
            onFocus={() => { isFocusedRef.current = true; }}
            onBlur={handleBlur}
            onMouseDown={e => e.stopPropagation()}
            onMouseEnter={e => e.stopPropagation()}
            onClick={e => e.stopPropagation()}
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

export const ConflictBlockRow = memo(ConflictBlockRowInner, (prev, next) => {
  // Para pane result, ignora cambios de hovered si el foco está en textarea
  // pero memo compara props; si block es igual y pane igual, evita re-render
  return (
    prev.block === next.block &&
    prev.conflictNumber === next.conflictNumber &&
    prev.totalConflicts === next.totalConflicts &&
    prev.pane === next.pane
    // on* handlers son estables vía useCallback en padre, no necesitan comparación profunda
  );
});
