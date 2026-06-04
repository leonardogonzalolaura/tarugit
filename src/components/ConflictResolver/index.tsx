import { useState, useEffect } from 'react';
//import { invoke } from '@tauri-apps/api/core';
import { useConflictData } from './hooks/useConflictData';
import { useSyncScroll } from './hooks/useSyncScroll';
import { useConflictOperations } from './hooks/useConflictOperations';
import { ThreeWayMergeViewer } from './components/ThreeWayMergeViewer';
import { PostResolveModal } from './components/PostResolveModal';
import { ConflictFileBlock, OperationContext } from './ConflictResolver.types';
import { getConflictStats } from './utils/conflictParser';

interface ConflictResolverProps {
  repoPath: string;
  filePath: string;
  onResolved: () => void;
  onCancel: () => void;
  operationContext?: OperationContext;
}

export function ConflictResolver({ repoPath, filePath, onResolved, onCancel, operationContext }: ConflictResolverProps) {
  const [blocks, setBlocks] = useState<ConflictFileBlock[]>([]);
  const [hoveredBlockId, setHoveredBlockId] = useState<string | null>(null);

  const { loading: loadingData, error, loadConflict } = useConflictData(repoPath, filePath, setBlocks);
  const { oursRef, resultRef, theirsRef, scrollInfo, syncScroll, jumpToBlock } = useSyncScroll();
  const { saveResolution, postAction, loading: saving, showPostModal, setShowPostModal, busy } = useConflictOperations(repoPath, filePath);

  useEffect(() => {
    loadConflict();
  }, [repoPath, filePath]);

  const { resolvedCount, totalConflicts } = getConflictStats(blocks);
  const allResolved = resolvedCount === totalConflicts;

  // Handlers para acciones sobre bloques
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
        <h3>⚠️ Error cargando conflictos</h3>
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

      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg-base)' }}>
        {/* Header con progreso */}
        <div style={{ padding: '10px 16px', background: 'var(--bg-surface)', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span>⚡ Conflictos:</span>
            <span style={{ fontFamily: 'var(--font-mono)' }}>{filename}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{ width: '80px', height: '6px', background: 'var(--border)', borderRadius: '3px', overflow: 'hidden' }}>
                <div style={{ width: `${(resolvedCount / totalConflicts) * 100}%`, height: '100%', background: allResolved ? 'var(--green)' : 'var(--accent)' }} />
              </div>
              <span style={{ fontSize: '11px' }}>{resolvedCount}/{totalConflicts} resueltos</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn-secondary" onClick={onCancel}>Cancelar</button>
            <button className="btn-primary" onClick={handleSave} disabled={saving} style={{ background: allResolved ? 'var(--green)' : 'var(--accent)' }}>
              {allResolved ? '✅ Guardar Resolución' : '💾 Guardar'}
            </button>
          </div>
        </div>

        <ThreeWayMergeViewer
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
