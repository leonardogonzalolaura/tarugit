import { useEffect, useCallback, useState, useRef } from 'react';
import { ConflictFileBlock } from '../ConflictResolver.types';

interface ConflictFocusModalProps {
  blocks: ConflictFileBlock[];
  currentIndex: number;
  onClose: () => void;
  onSelectConflict: (index: number) => void;
  onAcceptOurs: (blockId: string) => void;
  onAcceptTheirs: (blockId: string) => void;
  onAcceptBoth: (blockId: string) => void;
  onIgnore: (blockId: string) => void;
  onUpdateContent: (blockId: string, value: string) => void;
  allResolved?: boolean;
  onSaveAndContinue?: () => void;
}

const SvgClose = () => <svg width="12" height="12" viewBox="0 0 16 16" fill="currentcolor"><path d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.749.749 0 0 1 1.275.326.749.749 0 0 1-.215.734L9.06 8l3.22 3.22a.749.749 0 0 1-.326 1.275.749.749 0 0 1-.734-.215L8 9.06l-3.22 3.22a.751.751 0 0 1-1.042-.018.751.751 0 0 1-.018-1.042L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06Z"/></svg>;
const SvgArrowLeft = () => <svg width="10" height="10" viewBox="0 0 16 16" fill="currentcolor"><path d="M7.78 12.53a.75.75 0 0 1-1.06 0L2.22 8.03a.75.75 0 0 1 0-1.06l4.5-4.5a.749.749 0 0 1 1.275.326.749.749 0 0 1-.215.734L5.06 7h8.19a.75.75 0 0 1 0 1.5H5.06l2.72 2.72a.75.75 0 0 1 0 1.06Z"/></svg>;
const SvgArrowRight = () => <svg width="10" height="10" viewBox="0 0 16 16" fill="currentcolor"><path d="M8.22 2.97a.75.75 0 0 1 1.06 0l4.5 4.5a.75.75 0 0 1 0 1.06l-4.5 4.5a.751.751 0 0 1-1.042-.018.751.751 0 0 1-.018-1.042L10.94 9.5H2.75a.75.75 0 0 1 0-1.5h8.19L8.22 4.03a.75.75 0 0 1 0-1.06Z"/></svg>;
const SvgPencil = () => <svg width="10" height="10" viewBox="0 0 16 16" fill="currentcolor"><path d="M11.013 1.427a1.75 1.75 0 0 1 2.474 0l1.086 1.086a1.75 1.75 0 0 1 0 2.474l-8.61 8.61c-.21.21-.47.364-.756.445l-3.251.93a.75.75 0 0 1-.927-.928l.929-3.25a1.75 1.75 0 0 1 .445-.758l8.61-8.61Zm1.414 1.06a.25.25 0 0 0-.354 0L4.513 10.08a.25.25 0 0 0-.064.108l-.562 1.967 1.967-.562a.25.25 0 0 0 .108-.064l7.147-7.147a.25.25 0 0 0 0-.354l-1.086-1.086Z"/></svg>;
const SvgLink = () => <svg width="10" height="10" viewBox="0 0 16 16" fill="currentcolor"><path d="M7.775 3.275a.75.75 0 0 0 1.06 1.06l1.25-1.25a2 2 0 1 1 2.83 2.83l-2.5 2.5a2 2 0 0 1-2.83 0 .75.75 0 0 0-1.06 1.06 3.5 3.5 0 0 0 4.95 0l2.5-2.5a3.5 3.5 0 0 0-4.95-4.95l-1.25 1.25Zm-4.69 9.64a2 2 0 0 1 0-2.83l2.5-2.5a2 2 0 0 1 2.83 0 .75.75 0 0 0 1.06-1.06 3.5 3.5 0 0 0-4.95 0l-2.5 2.5a3.5 3.5 0 0 0 4.95 4.95l1.25-1.25a.75.75 0 0 0-1.06-1.06l-1.25 1.25a2 2 0 0 1-2.83 0Z"/></svg>;
const SvgX = () => <svg width="10" height="10" viewBox="0 0 16 16" fill="currentcolor"><path d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.749.749 0 0 1 1.275.326.749.749 0 0 1-.215.734L9.06 8l3.22 3.22a.749.749 0 0 1-.326 1.275.749.749 0 0 1-.734-.215L8 9.06l-3.22 3.22a.751.751 0 0 1-1.042-.018.751.751 0 0 1-.018-1.042L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06Z"/></svg>;

export function ConflictFocusModal({
  blocks,
  currentIndex,
  onClose,
  onSelectConflict,
  onAcceptOurs,
  onAcceptTheirs,
  onAcceptBoth,
  onIgnore,
  onUpdateContent,
  allResolved,
  onSaveAndContinue
}: ConflictFocusModalProps) {
  const conflictBlocks = blocks.filter(b => b.type === 'conflict');
  const current = conflictBlocks[currentIndex];
  const total = conflictBlocks.length;

  const goPrev = useCallback(() => {
    if (currentIndex > 0) onSelectConflict(currentIndex - 1);
  }, [currentIndex, onSelectConflict]);

  const goNext = useCallback(() => {
    if (currentIndex < total - 1) onSelectConflict(currentIndex + 1);
  }, [currentIndex, total, onSelectConflict]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // No interceptar flechas si estamos editando el textarea
      const ae = document.activeElement as HTMLElement | null;
      const isEditing = ae?.tagName === 'TEXTAREA' && ae.classList.contains('cr-focus-textarea');
      if (isEditing && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) return;
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') goPrev();
      if (e.key === 'ArrowRight') goNext();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose, goPrev, goNext]);

  // Estado local: mientras está enfocado NO sincronizamos al padre (evita el rebote a los ~450ms)
  const [localValue, setLocalValue] = useState(current?.content ?? '');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isFocusedRef = useRef(false);
  const latestValueRef = useRef(current?.content ?? '');

  useEffect(() => {
    if (!isFocusedRef.current) {
      setLocalValue(current?.content ?? '');
      latestValueRef.current = current?.content ?? '';
    }
  }, [current?.id, current?.content]);

  if (!current) return null;

  const isPending = !current.resolution || current.resolution === 'pending';
  const statusClass = isPending ? 'pending' : 'resolved';

  const flushToParent = (val: string) => {
    if (val !== current.content) onUpdateContent(current.id, val);
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    latestValueRef.current = val;
    setLocalValue(val);
    // No flush al padre aquí — solo en blur/guardar — para no provocar re-render que bota el foco
  };

  const handleBlur = () => {
    isFocusedRef.current = false;
    flushToParent(latestValueRef.current);
  };

  const isLast = currentIndex === total - 1;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal cr-focus-modal" onClick={e => e.stopPropagation()}>
        <div className="cr-focus-header">
          <div className="cr-focus-title">
            Conflicto {currentIndex + 1}/{total}
            <span className={`cr-focus-status ${statusClass}`}>
              {isPending ? 'Pendiente' : 'Resuelto'}
            </span>
            <div className="cr-focus-dots">
              {conflictBlocks.map((b, idx) => {
                const pending = !b.resolution || b.resolution === 'pending';
                return (
                  <button
                    key={b.id}
                    className={`cr-focus-dot ${pending ? 'pending' : 'resolved'}${idx === currentIndex ? ' active' : ''}`}
                    onClick={() => onSelectConflict(idx)}
                    title={`Conflicto ${idx + 1}: ${pending ? 'Pendiente' : 'Resuelto'}`}
                    aria-label={`Ir a conflicto ${idx + 1}`}
                  />
                );
              })}
            </div>
          </div>
          <div className="cr-focus-nav">
            <button className="cr-focus-nav-btn" onClick={goPrev} disabled={currentIndex === 0} title="Anterior">
              <SvgArrowLeft />
            </button>
            <button className="cr-focus-nav-btn" onClick={goNext} disabled={isLast} title={isLast ? 'Último conflicto' : 'Siguiente'}>
              <SvgArrowRight />
            </button>
            <button className="cr-focus-nav-btn close" onClick={onClose} title="Cerrar (Esc)">
              <SvgClose />
            </button>
          </div>
        </div>

        <div className="cr-focus-columns-header">
          <div className="cr-focus-col-label ours"><SvgArrowLeft /> Local</div>
          <div className="cr-focus-col-label result"><SvgPencil /> Resultado</div>
          <div className="cr-focus-col-label theirs">Entrante <SvgArrowRight /></div>
        </div>

        <div className="cr-focus-columns">
          <div className="cr-focus-cell ours">
            <div className="cr-focus-code">
              {current.oursContent?.split('\n').map((line, i) => (
                <div key={i} className="cr-focus-line ours">{line || ' '}</div>
              ))}
            </div>
          </div>

          <div className="cr-focus-cell result">
            <textarea
              ref={textareaRef}
              value={localValue}
              onChange={handleChange}
              onFocus={() => { isFocusedRef.current = true; }}
              onBlur={handleBlur}
              onMouseDown={e => e.stopPropagation()}
              onClick={e => e.stopPropagation()}
              className="cr-focus-textarea"
            />
          </div>

          <div className="cr-focus-cell theirs">
            <div className="cr-focus-code">
              {current.theirsContent?.split('\n').map((line, i) => (
                <div key={i} className="cr-focus-line theirs">{line || ' '}</div>
              ))}
            </div>
          </div>
        </div>

        <div className="cr-focus-actions">
          <button className="cr-focus-act-btn ours" onClick={() => onAcceptOurs(current.id)}>
            <SvgArrowLeft /> Aceptar Local
          </button>
          <button className="cr-focus-act-btn both" onClick={() => onAcceptBoth(current.id)}>
            <SvgLink /> Aceptar Ambos
          </button>
          <button className="cr-focus-act-btn theirs" onClick={() => onAcceptTheirs(current.id)}>
            Aceptar Entrante <SvgArrowRight />
          </button>
          <button className="cr-focus-act-btn ignore" onClick={() => onIgnore(current.id)}>
            <SvgX /> Ignorar
          </button>
        </div>

        {allResolved && onSaveAndContinue && (
          <div className="cr-focus-done">
            <span className="cr-focus-done-icon">✓</span>
            <div className="cr-focus-done-text">
              <strong>Se terminaron de resolver los conflictos</strong>
              <span> {total}/{total} resueltos · Guarda para aplicar al archivo</span>
            </div>
            <button className="btn-primary cr-focus-save" onClick={() => { onSaveAndContinue(); }}>
              Guardar y continuar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
