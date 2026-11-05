import { memo } from 'react';
import { ConflictFileBlock } from '../ConflictResolver.types';
import { RELATION_META, describeDuplicateLines, findDuplicateLines, findOverlapLines, getBlockRelation } from '../utils/conflictRelation';
import { ConflictCodeEditor } from './ConflictCodeEditor';

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
  filePath: string;
}

const SvgArrowLeft = () => <svg width="9" height="9" viewBox="0 0 16 16" fill="currentcolor"><path d="M7.78 12.53a.75.75 0 0 1-1.06 0L2.22 8.03a.75.75 0 0 1 0-1.06l4.5-4.5a.749.749 0 0 1 1.275.326.749.749 0 0 1-.215.734L5.06 7h8.19a.75.75 0 0 1 0 1.5H5.06l2.72 2.72a.75.75 0 0 1 0 1.06Z"/></svg>;
const SvgArrowRight = () => <svg width="9" height="9" viewBox="0 0 16 16" fill="currentcolor"><path d="M8.22 2.97a.75.75 0 0 1 1.06 0l4.5 4.5a.75.75 0 0 1 0 1.06l-4.5 4.5a.751.751 0 0 1-1.042-.018.751.751 0 0 1-.018-1.042L10.94 9.5H2.75a.75.75 0 0 1 0-1.5h8.19L8.22 4.03a.75.75 0 0 1 0-1.06Z"/></svg>;
const SvgLink = () => <svg width="9" height="9" viewBox="0 0 16 16" fill="currentcolor"><path d="M7.775 3.275a.75.75 0 0 0 1.06 1.06l1.25-1.25a2 2 0 1 1 2.83 2.83l-2.5 2.5a2 2 0 0 1-2.83 0 .75.75 0 0 0-1.06 1.06 3.5 3.5 0 0 0 4.95 0l2.5-2.5a3.5 3.5 0 0 0-4.95-4.95l-1.25 1.25Zm-4.69 9.64a2 2 0 0 1 0-2.83l2.5-2.5a2 2 0 0 1 2.83 0 .75.75 0 0 0 1.06-1.06 3.5 3.5 0 0 0-4.95 0l-2.5 2.5a3.5 3.5 0 0 0 4.95 4.95l1.25-1.25a.75.75 0 0 0-1.06-1.06l-1.25 1.25a2 2 0 0 1-2.83 0Z"/></svg>;
const SvgX = () => <svg width="9" height="9" viewBox="0 0 16 16" fill="currentcolor"><path d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.749.749 0 0 1 1.275.326.749.749 0 0 1-.215.734L9.06 8l3.22 3.22a.749.749 0 0 1-.326 1.275.749.749 0 0 1-.734-.215L8 9.06l-3.22 3.22a.751.751 0 0 1-1.042-.018.751.751 0 0 1-.018-1.042L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06Z"/></svg>;
const SvgWarning = () => <svg width="9" height="9" viewBox="0 0 16 16" fill="currentcolor"><path d="M6.457 1.047c.659-1.234 2.427-1.234 3.086 0l6.082 11.378A1.75 1.75 0 0 1 14.082 15H1.918a1.75 1.75 0 0 1-1.543-2.575Zm1.763.68a.25.25 0 0 0-.44 0L1.698 13.105a.25.25 0 0 0 .22.395h12.164a.25.25 0 0 0 .22-.395ZM8 5a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 8 5Zm0 7.5a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5Z"/></svg>;

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
  pane,
  filePath
}: ConflictBlockRowProps) {
  const isPending = !block.resolution || block.resolution === 'pending';
  const pendingClass = isPending ? 'pending' : 'resolved';
  const isResultPane = pane === 'result';

  const relationMeta = isResultPane
    ? RELATION_META[getBlockRelation(block.content, block.theirsContent)]
    : null;
  const duplicates = isResultPane ? findDuplicateLines(block.content) : [];
  const duplicateWarning = describeDuplicateLines(duplicates);
  const matchedLines = isResultPane && relationMeta?.tone === 'duplicate'
    ? findOverlapLines(block.content, block.theirsContent)
    : [];
  const extraClasses = isResultPane
    ? `${relationMeta ? ` relation-${relationMeta.tone}` : ''}${duplicates.length > 0 ? ' has-duplicates' : ''}`
    : '';

  return (
    <div
      onMouseEnter={onHoverEnter}
      onMouseLeave={onHoverLeave}
      data-conflict-block={block.id}
      className={`cr-block conflict ${pendingClass} ${pane}${extraClasses}`}
    >
      <div className={`cr-block-badge ${pendingClass}`}>
        {isPending ? `CONFLICTO ${conflictNumber}/${totalConflicts}` : `RESUELTO`}
      </div>

      <div className="cr-block-content">
        {isResultPane && (duplicates.length > 0 || relationMeta) && (
          <div className="cr-block-warnings">
            {duplicates.length > 0 && (
              <div className="cr-block-warning duplicated-lines">
                <SvgWarning />
                <span>{duplicateWarning}</span>
              </div>
            )}
            {relationMeta && (
              <div className={`cr-block-warning ${relationMeta.tone}`}>
                <span>
                  {relationMeta.label}
                  {relationMeta.hint && ` · ${relationMeta.hint}`}
                </span>
              </div>
            )}
          </div>
        )}
        {isResultPane ? (
          <ConflictCodeEditor
            value={block.content}
            filePath={filePath}
            onChange={onUpdateContent}
            className="cr-block-editor"
            ariaLabel={`Resultado del conflicto ${conflictNumber}`}
            highlightDuplicates
            matchedLines={matchedLines}
          />
        ) : (
          <ConflictCodeEditor
            key={pane}
            value={(pane === 'ours' ? block.oursContent : block.theirsContent) ?? ''}
            filePath={filePath}
            readOnly
            className="cr-block-editor"
            ariaLabel={pane === 'ours'
              ? `Contenido local del conflicto ${conflictNumber}`
              : `Contenido entrante del conflicto ${conflictNumber}`}
          />
        )}

        {isResultPane && (
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

        {!isResultPane && <div className="cr-block-spacer" />}
      </div>
    </div>
  );
}

export const ConflictBlockRow = memo(ConflictBlockRowInner, (prev, next) => {
  return (
    prev.block === next.block &&
    prev.conflictNumber === next.conflictNumber &&
    prev.totalConflicts === next.totalConflicts &&
    prev.pane === next.pane &&
    prev.filePath === next.filePath
  );
});
