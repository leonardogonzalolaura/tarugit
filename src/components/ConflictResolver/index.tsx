import { useState, useEffect } from 'react';
import { useConflictData } from './hooks/useConflictData';
import { useSyncScroll } from './hooks/useSyncScroll';
import { useConflictOperations } from './hooks/useConflictOperations';
import { ThreeWayMergeViewer } from './components/ThreeWayMergeViewer';
import { PostResolveModal } from './components/PostResolveModal';
import { ConflictFileBlock, OperationContext, LayoutMode } from './ConflictResolver.types';
import { getConflictStats } from './utils/conflictParser';

interface ConflictResolverProps {
  repoPath: string;
  filePath: string;
  onResolved: () => void;
  onCancel: () => void;
  operationContext?: OperationContext;
}

const SvgBolt = () => <svg width="12" height="12" viewBox="0 0 16 16" fill="currentcolor"><path d="M6.906.664a.75.75 0 0 1 .603.366l5.5 9.5A.75.75 0 0 1 12.5 11.5H9l-.406 3.836a.75.75 0 0 1-1.422-.366l-1-8.5a.75.75 0 0 1 .578-.845L9.1 7.51 8.49 2.955 7.5 3.885 7.078 2.31a.75.75 0 0 1-.172-1.646Z"/></svg>;
const SvgSave = () => <svg width="11" height="11" viewBox="0 0 16 16" fill="currentcolor"><path d="M2 1a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V4.414a1 1 0 0 0-.293-.707l-2.414-2.414A1 1 0 0 0 11.586 1H2Zm0 1h.5v2.5A1.5 1.5 0 0 0 4 6h5a1.5 1.5 0 0 0 1.5-1.5V2.414l2 2V14H12V9.5a1.5 1.5 0 0 0-1.5-1.5h-5A1.5 1.5 0 0 0 4 9.5V14H2V2Zm2 0h4v2H4V2Zm6 0h.5v2.5a.5.5 0 0 1-.5.5H9V2.5a.5.5 0 0 1 .5-.5H10ZM5.5 10h5a.5.5 0 0 1 .5.5V14H5v-3.5a.5.5 0 0 1 .5-.5Z"/></svg>;
const SvgClose = () => <svg width="11" height="11" viewBox="0 0 16 16" fill="currentcolor"><path d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.749.749 0 0 1 1.275.326.749.749 0 0 1-.215.734L9.06 8l3.22 3.22a.749.749 0 0 1-.326 1.275.749.749 0 0 1-.734-.215L8 9.06l-3.22 3.22a.751.751 0 0 1-1.042-.018.751.751 0 0 1-.018-1.042L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06Z"/></svg>;
const SvgLayoutSide = () => <svg width="12" height="12" viewBox="0 0 16 16" fill="currentcolor"><path d="M1 2.75C1 1.784 1.784 1 2.75 1h10.5c.966 0 1.75.784 1.75 1.75v10.5A1.75 1.75 0 0 1 13.25 15H2.75A1.75 1.75 0 0 1 1 13.25Zm1.75-.25a.25.25 0 0 0-.25.25v10.5c0 .138.112.25.25.25H5V2.5Zm10 10.75V5.5H6.5v7.75c0 .138.112.25.25.25h6.5a.25.25 0 0 0 .25-.25Z"/></svg>;
const SvgLayoutDiff = () => <svg width="12" height="12" viewBox="0 0 16 16" fill="currentcolor"><path d="M1 2.75C1 1.784 1.784 1 2.75 1h10.5c.966 0 1.75.784 1.75 1.75v10.5A1.75 1.75 0 0 1 13.25 15H2.75A1.75 1.75 0 0 1 1 13.25Zm1.75-.25a.25.25 0 0 0-.25.25v10.5c0 .138.112.25.25.25H5V2.5Zm3.25 0V8h8V2.75a.25.25 0 0 0-.25-.25Zm-.25 6.25v4.5c0 .138.112.25.25.25h5.5a.25.25 0 0 0 .25-.25V9.5Z"/></svg>;
const SvgLayoutVert = () => <svg width="12" height="12" viewBox="0 0 16 16" fill="currentcolor"><path d="M1 2.75C1 1.784 1.784 1 2.75 1h10.5c.966 0 1.75.784 1.75 1.75v10.5A1.75 1.75 0 0 1 13.25 15H2.75A1.75 1.75 0 0 1 1 13.25Zm1.75-.25a.25.25 0 0 0-.25.25v10.5c0 .138.112.25.25.25h10.5a.25.25 0 0 0 .25-.25V2.75a.25.25 0 0 0-.25-.25Z"/></svg>;

export function ConflictResolver({ repoPath, filePath, onResolved, onCancel, operationContext }: ConflictResolverProps) {
  const [blocks, setBlocks] = useState<ConflictFileBlock[]>([]);
  const [hoveredBlockId, setHoveredBlockId] = useState<string | null>(null);
  const [layout, setLayout] = useState<LayoutMode>('side');

  const { loading: loadingData, error, loadConflict } = useConflictData(repoPath, filePath, setBlocks);
  const { oursRef, resultRef, theirsRef, scrollInfo, syncScroll, jumpToBlock } = useSyncScroll();
  const { saveResolution, postAction, loading: saving, showPostModal, setShowPostModal, busy } = useConflictOperations(repoPath, filePath);

  useEffect(() => {
    loadConflict();
  }, [repoPath, filePath]);

  const { resolvedCount, totalConflicts } = getConflictStats(blocks);
  const allResolved = resolvedCount === totalConflicts;

  const updateBlock = (blockId: string, updater: (block: ConflictFileBlock) => ConflictFileBlock) => {
    setBlocks(prev => prev.map(b => b.id === blockId ? updater(b) : b));
  };

  const acceptOurs = (blockId: string) => updateBlock(blockId, b => ({ ...b, content: b.oursContent || '', resolution: 'ours' }));
  const acceptTheirs = (blockId: string) => updateBlock(blockId, b => ({ ...b, content: b.theirsContent || '', resolution: 'theirs' }));
  const acceptBoth = (blockId: string) => updateBlock(blockId, b => ({ ...b, content: [b.oursContent, b.theirsContent].filter(Boolean).join('\n'), resolution: 'both' }));
  const ignoreBlock = (blockId: string) => updateBlock(blockId, b => ({ ...b, content: '', resolution: 'ignore' }));
  const updateContent = (blockId: string, value: string) => updateBlock(blockId, b => ({ ...b, content: value, resolution: 'custom' }));

  const handleSave = async () => {
    const result = await saveResolution(blocks);
    if (result.success && result.stillConflicted === 0) {
      // Modal ya se muestra automáticamente
    } else if (result.success && result.stillConflicted > 0) {
      alert(result.message);
      onResolved();
    }
  };

  const handlePostAction = async (action: 'continue' | 'abort' | 'done') => {
    const result = await postAction(action, operationContext);
    if (result.success) {
      setShowPostModal(false);
      onResolved();
    } else if (result.hasNextConflict) {
      alert(result.message);
      setShowPostModal(false);
      onResolved();
    }
  };

  if (loadingData && !blocks.length) {
    return <div className="diff-loading"><span className="spinner" /> Cargando conflictos...</div>;
  }

  if (error) {
    return (
      <div className="panel-empty" style={{ padding: '40px', textAlign: 'center' }}>
        <h3><SvgBolt /> Error cargando conflictos</h3>
        <p>{error}</p>
        <button className="btn-secondary" onClick={onCancel}>Regresar</button>
      </div>
    );
  }

  const filename = filePath.split(/[/\\]/).pop() ?? filePath;

  return (
    <>
      {showPostModal && (
        <PostResolveModal
          operationContext={operationContext}
          onAction={handlePostAction}
          busy={busy}
          onClose={() => setShowPostModal(false)}
        />
      )}

      <div className="cr">
        <div className="cr-header">
          <div className="cr-header-left">
            <span className="cr-file-icon"><SvgBolt /></span>
            <span className="cr-filename">{filename}</span>
            <div className="cr-progress">
              <div className="cr-progress-bar-bg">
                <div className={`cr-progress-bar-fill${allResolved ? ' done' : ''}`} style={{ width: `${(resolvedCount / totalConflicts) * 100}%` }} />
              </div>
              <span className="cr-progress-label">{resolvedCount}/{totalConflicts}</span>
            </div>
          </div>
          <div className="cr-header-actions">
            <div style={{ display: 'flex', gap: 2, marginRight: 6, borderRight: '1px solid var(--border)', paddingRight: 6 }}>
              {(['side', 'diff-result', 'vertical'] as const).map(m => (
                <button
                  key={m}
                  className={`cr-hdr-btn${layout === m ? ' active-layout' : ''}`}
                  onClick={() => setLayout(m)}
                  title={m === 'side' ? 'Lado a lado (3 paneles)' : m === 'diff-result' ? 'Diferencias + Resultado' : 'Vertical'}
                  style={{ padding: '3px 6px', border: layout === m ? '1px solid var(--accent)' : '1px solid transparent' }}
                >
                  {m === 'side' ? <SvgLayoutSide /> : m === 'diff-result' ? <SvgLayoutDiff /> : <SvgLayoutVert />}
                </button>
              ))}
            </div>
            <button className="cr-hdr-btn" onClick={onCancel}><SvgClose /> Cancelar</button>
            <button className={`cr-hdr-btn save${allResolved ? ' all-resolved' : ''}`} onClick={handleSave} disabled={saving}>
              <SvgSave /> {allResolved ? 'Guardar Resolución' : 'Guardar'}
            </button>
          </div>
        </div>

        <ThreeWayMergeViewer
          layout={layout}
          blocks={blocks}
          scrollRefs={{ oursRef, resultRef, theirsRef }}
          scrollInfo={scrollInfo}
          syncScroll={syncScroll}
          jumpToBlock={jumpToBlock}
          hoveredBlockId={hoveredBlockId}
          onHoverChange={setHoveredBlockId}
          onAcceptOurs={acceptOurs}
          onAcceptTheirs={acceptTheirs}
          onAcceptBoth={acceptBoth}
          onIgnore={ignoreBlock}
          onUpdateContent={updateContent}
          operationContext={operationContext}
        />
      </div>
    </>
  );
}
