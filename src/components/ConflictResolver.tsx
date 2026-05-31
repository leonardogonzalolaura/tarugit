import { useState, useEffect, useRef, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';

interface ConflictResolverProps {
  repoPath: string;
  filePath: string;
  onResolved: () => void;
  onCancel: () => void;
  operationContext?: { type: 'merge' | 'rebase' | 'cherry-pick'; originalBranch?: string };
}

interface ConflictData {
  ours: string;
  theirs: string;
  base: string;
}

// Tipo de resolución aplicada a un bloque de conflicto
type BlockResolution = 'pending' | 'ours' | 'theirs' | 'both' | 'ignore' | 'custom';

interface FileBlock {
  id: string;
  type: 'clean' | 'conflict';
  content: string;
  oursContent?: string;
  theirsContent?: string;
  resolution?: BlockResolution; // sólo para type=conflict
}

// ── Minimap de conflictos ──────────────────────────────────────────────────────
interface ConflictMinimapProps {
  blocks: FileBlock[];
  totalHeight: number;           // px totales del contenedor scrolleable
  scrollTop: number;             // scroll actual
  containerHeight: number;       // alto visible
  onJump: (index: number) => void;
}

function ConflictMinimap({ blocks, totalHeight, scrollTop, containerHeight, onJump }: ConflictMinimapProps) {
  const conflictBlocks = blocks
    .map((b, i) => ({ block: b, index: i }))
    .filter(x => x.block.type === 'conflict');

  const totalBlocks = blocks.length;

  if (conflictBlocks.length === 0) return null;

  // Calcula la posición Y relativa de cada conflicto en la minimap
  const mapHeight = Math.max(containerHeight, 60);

  const thumbTop = totalHeight > containerHeight
    ? (scrollTop / (totalHeight - containerHeight)) * (mapHeight - 40)
    : 0;
  const thumbHeight = Math.max(
    (containerHeight / Math.max(totalHeight, 1)) * mapHeight,
    24
  );

  return (
    <div style={{
      position: 'absolute',
      right: 0,
      top: 0,
      bottom: 0,
      width: '14px',
      background: 'var(--bg-base)',
      borderLeft: '1px solid var(--border)',
      display: 'flex',
      flexDirection: 'column',
      zIndex: 5,
      userSelect: 'none'
    }}>
      {/* Thumb del scroll */}
      <div style={{
        position: 'absolute',
        left: '1px',
        right: '1px',
        top: `${thumbTop}px`,
        height: `${thumbHeight}px`,
        background: 'var(--border-light)',
        borderRadius: '3px',
        opacity: 0.6,
        pointerEvents: 'none'
      }} />

      {/* Marcadores de conflicto */}
      {conflictBlocks.map(({ block, index }) => {
        const relPos = totalBlocks > 1 ? index / (totalBlocks - 1) : 0.5;
        const markerTop = relPos * (mapHeight - 6);
        const isPending = !block.resolution || block.resolution === 'pending';
        const color = isPending
          ? '#f87171'      // rojo = sin resolver
          : block.resolution === 'both'
            ? '#a78bfa'    // violeta = ambos
            : '#3dd68c';   // verde = resuelto

        return (
          <div
            key={block.id}
            title={`Conflicto ${index + 1}${isPending ? ' (pendiente)' : ' (resuelto)'}`}
            onClick={() => onJump(index)}
            style={{
              position: 'absolute',
              left: '2px',
              right: '2px',
              top: `${markerTop}px`,
              height: '4px',
              background: color,
              borderRadius: '2px',
              cursor: 'pointer',
              boxShadow: isPending ? `0 0 4px ${color}` : 'none',
              transition: 'opacity 0.2s'
            }}
          />
        );
      })}
    </div>
  );
}

// ── ConflictBlock: un bloque individual de conflicto con acciones ──────────────
interface ConflictBlockRowProps {
  block: FileBlock;
  blockIndex: number;            // índice absoluto en la lista
  conflictNumber: number;        // número de conflicto (1-based)
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

function ConflictBlockRow({
  block, conflictNumber, totalConflicts,
  isHovered, onHoverEnter, onHoverLeave,
  onAcceptOurs, onAcceptTheirs, onAcceptBoth, onIgnore,
  onUpdateContent, pane
}: ConflictBlockRowProps) {
  const isPending = !block.resolution || block.resolution === 'pending';

  const glowColor = isHovered
    ? 'rgba(110,127,255,0.18)'
    : isPending ? 'transparent' : 'transparent';

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
      style={{
        background: bgColor,
        border: `1px solid ${borderColor}`,
        borderRadius: 'var(--radius-sm)',
        marginBottom: '8px',
        position: 'relative',
        transition: 'background 0.15s, border-color 0.15s',
        boxShadow: isHovered ? `0 0 0 2px ${borderColor}33` : 'none'
      }}
    >
      {/* Badge de número de conflicto */}
      <div style={{
        position: 'absolute',
        top: '-10px',
        left: '8px',
        fontSize: '9px',
        fontWeight: 700,
        letterSpacing: '0.05em',
        background: isPending ? 'var(--red)' : 'var(--green)',
        color: '#000',
        padding: '1px 6px',
        borderRadius: '4px',
        zIndex: 1
      }}>
        {isPending ? `⚡ CONFLICTO ${conflictNumber}/${totalConflicts}` : `✓ RESUELTO`}
      </div>

      {/* Contenido del panel */}
      <div style={{ padding: '18px 8px 8px' }}>
        {pane === 'result' ? (
          // Panel central: textarea editable
          <textarea
            value={block.content}
            onChange={e => onUpdateContent(e.target.value)}
            style={{
              width: '100%',
              minHeight: `${Math.max(60, (block.content.split('\n').length) * 18)}px`,
              background: '#0e0e16',
              color: 'var(--text-primary)',
              border: '1px solid var(--border)',
              borderRadius: '4px',
              padding: '8px',
              outline: 'none',
              resize: 'vertical',
              fontFamily: 'var(--font-mono)',
              fontSize: '12px',
              lineHeight: 1.6
            }}
            placeholder="Mezcla o edita el bloque aquí..."
          />
        ) : (
          // Panel ours/theirs: solo lectura con resaltado de líneas
          <div style={{ whiteSpace: 'pre-wrap', fontFamily: 'var(--font-mono)', fontSize: '12px', lineHeight: 1.6, padding: '4px' }}>
            {(pane === 'ours' ? block.oursContent : block.theirsContent)
              ?.split('\n')
              .map((line, li) => (
                <div key={li} style={{
                  padding: '1px 4px',
                  borderRadius: '2px',
                  color: pane === 'ours' ? '#b9f5d8' : '#ffd0d0'
                }}>
                  {line || ' '}
                </div>
              ))
            }
          </div>
        )}

        {/* Botones de acción — solo en panel central */}
        {pane === 'result' && (
          <div style={{ display: 'flex', gap: '6px', marginTop: '8px', flexWrap: 'wrap' }}>
            <button
              onClick={onAcceptOurs}
              title="Usar solo los cambios locales"
              style={{
                background: 'var(--green-bg)',
                border: '1px solid var(--green-border)',
                color: 'var(--green)',
                fontSize: '10px',
                fontWeight: 700,
                padding: '3px 10px',
                borderRadius: '4px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              ⬅️ Aceptar Local
            </button>
            <button
              onClick={onAcceptBoth}
              title="Incluir ambas versiones (local + entrante)"
              style={{
                background: 'rgba(167,139,250,0.12)',
                border: '1px solid rgba(167,139,250,0.3)',
                color: '#a78bfa',
                fontSize: '10px',
                fontWeight: 700,
                padding: '3px 10px',
                borderRadius: '4px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              🔗 Aceptar Ambos
            </button>
            <button
              onClick={onAcceptTheirs}
              title="Usar solo los cambios entrantes"
              style={{
                background: 'var(--red-bg)',
                border: '1px solid var(--red-border)',
                color: 'var(--red)',
                fontSize: '10px',
                fontWeight: 700,
                padding: '3px 10px',
                borderRadius: '4px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              Aceptar Entrante ➡️
            </button>
            <button
              onClick={onIgnore}
              title="Eliminar este bloque del resultado"
              style={{
                background: 'transparent',
                border: '1px solid var(--border)',
                color: 'var(--text-muted)',
                fontSize: '10px',
                padding: '3px 8px',
                borderRadius: '4px',
                cursor: 'pointer',
                marginLeft: 'auto'
              }}
            >
              ✕ Ignorar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Componente principal ───────────────────────────────────────────────────────
export function ConflictResolver({ repoPath, filePath, onResolved, onCancel, operationContext }: ConflictResolverProps) {
  const [data, setData] = useState<ConflictData | null>(null);
  const [blocks, setBlocks] = useState<FileBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [hoveredBlockId, setHoveredBlockId] = useState<string | null>(null);
  const [showPostResolveActions, setShowPostResolveActions] = useState(false);
  const [busy, setBusy] = useState(false);

  // Refs de scroll para los 3 paneles
  const oursRef   = useRef<HTMLDivElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  const theirsRef = useRef<HTMLDivElement>(null);

  // Estado de scroll para el minimap
  const [scrollInfo, setScrollInfo] = useState({ scrollTop: 0, totalHeight: 0, containerHeight: 0 });

  useEffect(() => {
    loadConflict();
  }, [repoPath, filePath]);

  // Sincroniza scroll entre los 3 paneles
  const syncScroll = useCallback((sourceRef: React.RefObject<HTMLDivElement | null>) => {
    return () => {
      const src = sourceRef.current;
      if (!src) return;
      const ratio = src.scrollTop / Math.max(src.scrollHeight - src.clientHeight, 1);
      for (const ref of [oursRef, resultRef, theirsRef]) {
        if (ref === sourceRef || !ref.current) continue;
        const target = ref.current;
        const maxScroll = target.scrollHeight - target.clientHeight;
        target.scrollTop = ratio * maxScroll;
      }
      setScrollInfo({
        scrollTop: src.scrollTop,
        totalHeight: src.scrollHeight,
        containerHeight: src.clientHeight
      });
    };
  }, []);

  // Actualiza minimap al cambiar scroll del panel resultado
  useEffect(() => {
    const el = resultRef.current;
    if (!el) return;
    const handler = syncScroll(resultRef);
    el.addEventListener('scroll', handler);
    return () => el.removeEventListener('scroll', handler);
  }, [syncScroll]);

  const loadConflict = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await invoke<ConflictData>('get_conflict_stages', { repoPath, filePath });
      setData(res);
      const rawText = res.base || res.ours || '';
      const parsedBlocks = parseConflictBlocks(rawText);
      setBlocks(parsedBlocks);

      // Inicializar info del minimap
      setTimeout(() => {
        const el = resultRef.current;
        if (el) {
          setScrollInfo({ scrollTop: 0, totalHeight: el.scrollHeight, containerHeight: el.clientHeight });
        }
      }, 100);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  const parseConflictBlocks = (text: string): FileBlock[] => {
    const lines = text.split('\n');
    const result: FileBlock[] = [];
    let currentBlockLines: string[] = [];
    let state: 'normal' | 'ours' | 'theirs' = 'normal';
    let oursBlockLines: string[] = [];
    let theirsBlockLines: string[] = [];

    const flushNormal = () => {
      if (currentBlockLines.length > 0) {
        result.push({
          id: `clean-${Math.random().toString(36).slice(2)}`,
          type: 'clean',
          content: currentBlockLines.join('\n')
        });
        currentBlockLines = [];
      }
    };

    for (const line of lines) {
      if (line.startsWith('<<<<<<<')) {
        flushNormal();
        state = 'ours';
      } else if (line.startsWith('=======')) {
        state = 'theirs';
      } else if (line.startsWith('>>>>>>>')) {
        result.push({
          id: `conflict-${Math.random().toString(36).slice(2)}`,
          type: 'conflict',
          content: oursBlockLines.join('\n'),
          oursContent: oursBlockLines.join('\n'),
          theirsContent: theirsBlockLines.join('\n'),
          resolution: 'pending'
        });
        oursBlockLines = [];
        theirsBlockLines = [];
        state = 'normal';
      } else {
        if (state === 'normal') currentBlockLines.push(line);
        else if (state === 'ours') oursBlockLines.push(line);
        else if (state === 'theirs') theirsBlockLines.push(line);
      }
    }
    flushNormal();
    return result;
  };

  // ── Acciones sobre bloques ───────────────────────────────────────────────────

  const acceptOursBlock = (blockId: string) => {
    setBlocks(prev => prev.map(b =>
      b.id === blockId && b.type === 'conflict'
        ? { ...b, content: b.oursContent || '', resolution: 'ours' }
        : b
    ));
  };

  const acceptTheirsBlock = (blockId: string) => {
    setBlocks(prev => prev.map(b =>
      b.id === blockId && b.type === 'conflict'
        ? { ...b, content: b.theirsContent || '', resolution: 'theirs' }
        : b
    ));
  };

  const acceptBothBlock = (blockId: string) => {
    setBlocks(prev => prev.map(b => {
      if (b.id !== blockId || b.type !== 'conflict') return b;
      const combined = [b.oursContent || '', b.theirsContent || '']
        .filter(Boolean)
        .join('\n');
      return { ...b, content: combined, resolution: 'both' };
    }));
  };

  const ignoreBlock = (blockId: string) => {
    setBlocks(prev => prev.map(b =>
      b.id === blockId && b.type === 'conflict'
        ? { ...b, content: '', resolution: 'ignore' }
        : b
    ));
  };

  const handleUpdateBlockContent = (blockId: string, value: string) => {
    setBlocks(prev => prev.map(b =>
      b.id === blockId
        ? { ...b, content: value, resolution: 'custom' }
        : b
    ));
  };

  // ── Saltar a conflicto desde minimap ─────────────────────────────────────────
  const jumpToConflict = (absoluteIndex: number) => {
    const el = resultRef.current;
    if (!el) return;
    const blockEl = el.querySelector(`[data-conflict-block="${blocks[absoluteIndex]?.id}"]`) as HTMLElement | null;
    if (blockEl) {
      blockEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  // ── Guardar ──────────────────────────────────────────────────────────────────
  const handleAcceptMerge = async () => {
    const pending = blocks.filter(b => b.type === 'conflict' && (!b.resolution || b.resolution === 'pending'));
    if (pending.length > 0) {
      if (!confirm(`Aún tienes ${pending.length} bloque(s) de conflicto sin resolver. ¿Deseas guardar de todas formas?`)) return;
    }
    setLoading(true);
    try {
      const mergedText = blocks.map(b => b.content).join('\n');
      await invoke('resolve_conflict', { repoPath, filePath, mergedText });
      
      // Verificar si hay más archivos en conflicto
      const repoInfo = await invoke<any>('get_repo_status', { repoPath });
      const stillConflicted = repoInfo.files.filter((f: any) => f.status === 'conflicted').length;

      if (stillConflicted > 0) {
        // Aún hay archivos por resolver, no mostramos los botones de continuar/abortar
        alert(`✅ Archivo resuelto. Aún queda(n) ${stillConflicted} archivo(s) con conflictos en este commit.`);
        onResolved();
      } else {
        // Mostrar panel post-resolve solo si ya no hay más conflictos
        setShowPostResolveActions(true);
      }
    } catch (e) {
      alert(`Error al resolver conflicto: ${e}`);
    } finally {
      setLoading(false);
    }
  };

  // ── Acciones post-resolve ─────────────────────────────────────────────────────
  const handlePostAction = async (action: 'continue' | 'abort' | 'done') => {
    setBusy(true);
    try {
      if (!operationContext || action === 'done') {
        onResolved();
        return;
      }
      if (action === 'continue') {
        if (operationContext.type === 'rebase') {
          await invoke('rebase_continue', { repoPath });
        } else if (operationContext.type === 'cherry-pick') {
          await invoke('cherry_pick_continue', { repoPath });
        }
        // merge: no hay continue; el usuario hace commit normalmente
      } else if (action === 'abort') {
        if (operationContext.type === 'merge') {
          await invoke('merge_abort', { repoPath });
        } else if (operationContext.type === 'rebase') {
          await invoke('rebase_abort', { repoPath });
        } else if (operationContext.type === 'cherry-pick') {
          await invoke('cherry_pick_abort', { repoPath });
        }
      }
      onResolved();
    } catch (e) {
      const errStr = String(e);
      // Si al continuar el rebase/cherry-pick nos encontramos con otro conflicto en el siguiente commit:
      if (errStr.toLowerCase().includes('conflict') || errStr.toLowerCase().includes('conflicto') || errStr.toLowerCase().includes('resolve')) {
        alert('⚠️ El siguiente commit también tiene conflictos. Por favor, resuélvelos para seguir avanzando.');
        onResolved();
      } else {
        alert(`Error al ejecutar acción: ${e}`);
        setBusy(false);
      }
    }
  };

  // ── Estadísticas ─────────────────────────────────────────────────────────────
  const conflictBlocks = blocks.filter(b => b.type === 'conflict');
  const resolvedCount = conflictBlocks.filter(b => b.resolution && b.resolution !== 'pending').length;
  const totalConflicts = conflictBlocks.length;
  const allResolved = resolvedCount === totalConflicts;

  // ── Render ───────────────────────────────────────────────────────────────────
  if (loading && !data) {
    return (
      <div className="diff-loading" style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span className="spinner" /> Cargando conflictos...
      </div>
    );
  }

  if (error) {
    return (
      <div className="panel-empty" style={{ padding: '40px', textAlign: 'center' }}>
        <h3>⚠️ No se pudieron leer los bloques de conflicto</h3>
        <p style={{ color: 'var(--text-secondary)', marginTop: '8px' }}>{error}</p>
        <button className="btn-secondary" onClick={onCancel} style={{ marginTop: '16px' }}>Regresar</button>
      </div>
    );
  }

  // ── Modal post-resolve ────────────────────────────────────────────────────────
  if (showPostResolveActions) {
    return (
      <div className="modal-backdrop">
        <div className="modal">
          <div className="modal-icon">✅</div>
          <h3 className="modal-title">Conflicto resuelto</h3>
          <p className="modal-desc">
            Has guardado los cambios para este archivo. ¿Qué deseas hacer ahora?
          </p>
          
          <div className="modal-actions" style={{ flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
              {operationContext?.type === 'merge' && (
                <>
                  <button
                    className="btn-secondary"
                    style={{ flex: 1, color: 'var(--red, #f87171)', borderColor: 'rgba(248,113,113,0.3)' }}
                    onClick={() => handlePostAction('abort')}
                    disabled={busy}
                  >
                    {busy ? '...' : '🚫 Abortar Merge'}
                  </button>
                  <button
                    className="btn-primary"
                    style={{ flex: 1, background: 'var(--green-bg)', color: 'var(--green)', borderColor: 'var(--green-border)' }}
                    onClick={() => handlePostAction('done')}
                    disabled={busy}
                  >
                    📝 Hacer Commit
                  </button>
                </>
              )}
              {operationContext?.type === 'rebase' && (
                <>
                  <button
                    className="btn-secondary"
                    style={{ flex: 1, color: 'var(--red, #f87171)', borderColor: 'rgba(248,113,113,0.3)' }}
                    onClick={() => handlePostAction('abort')}
                    disabled={busy}
                  >
                    {busy ? '...' : '🚫 Abortar Rebase'}
                  </button>
                  <button
                    className="btn-primary"
                    style={{ flex: 1, background: 'var(--green-bg)', color: 'var(--green)', borderColor: 'var(--green-border)' }}
                    onClick={() => handlePostAction('continue')}
                    disabled={busy}
                  >
                    {busy ? '⏳ Procesando...' : '✅ Continuar Rebase'}
                  </button>
                </>
              )}
              {operationContext?.type === 'cherry-pick' && (
                <>
                  <button
                    className="btn-secondary"
                    style={{ flex: 1, color: 'var(--red, #f87171)', borderColor: 'rgba(248,113,113,0.3)' }}
                    onClick={() => handlePostAction('abort')}
                    disabled={busy}
                  >
                    {busy ? '...' : '🚫 Abortar'}
                  </button>
                  <button
                    className="btn-primary"
                    style={{ flex: 1, background: 'var(--green-bg)', color: 'var(--green)', borderColor: 'var(--green-border)' }}
                    onClick={() => handlePostAction('continue')}
                    disabled={busy}
                  >
                    {busy ? '⏳ Procesando...' : '✅ Continuar Cherry-Pick'}
                  </button>
                </>
              )}
              {!operationContext && (
                <button
                  className="btn-primary"
                  style={{ flex: 1, background: 'var(--green-bg)', color: 'var(--green)', borderColor: 'var(--green-border)' }}
                  onClick={() => handlePostAction('done')}
                  disabled={busy}
                >
                  ✅ Listo
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const filename = filePath.split(/[/\\]/).pop() ?? filePath;

  // Índices absolutos de bloques de conflicto (para el minimap)
  const conflictIndexMap: { [id: string]: number } = {};
  blocks.forEach((b, i) => {
    if (b.type === 'conflict') conflictIndexMap[b.id] = i;
  });

  // Contador de número de conflicto
  const conflictCounter: { [id: string]: number } = {};
  let cNum = 0;
  blocks.forEach(b => {
    if (b.type === 'conflict') conflictCounter[b.id] = ++cNum;
  });



  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      background: 'var(--bg-base)',
      color: 'var(--text-primary)'
    }}>
      {/* ── Cabecera ── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 16px',
        background: 'var(--bg-surface)',
        borderBottom: '1px solid var(--border)',
        gap: '12px',
        flexShrink: 0
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
          <span style={{ color: 'var(--yellow)', fontWeight: 'bold', flexShrink: 0 }}>⚡ Conflictos:</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{filename}</span>
          
          {/* Barra de progreso de conflictos */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
            <div style={{ width: '80px', height: '6px', background: 'var(--border)', borderRadius: '3px', overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                width: `${totalConflicts > 0 ? (resolvedCount / totalConflicts) * 100 : 0}%`,
                background: allResolved ? 'var(--green)' : 'var(--accent)',
                borderRadius: '3px',
                transition: 'width 0.3s'
              }} />
            </div>
            <span style={{ fontSize: '11px', color: allResolved ? 'var(--green)' : 'var(--text-muted)', fontWeight: 600, flexShrink: 0 }}>
              {resolvedCount}/{totalConflicts} resueltos
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
          <button className="btn-secondary" onClick={onCancel} style={{ padding: '5px 12px', fontSize: '12px' }}>
            Cancelar
          </button>
          <button
            className="btn-primary"
            onClick={handleAcceptMerge}
            style={{
              padding: '5px 14px',
              fontSize: '12px',
              background: allResolved ? 'var(--green)' : 'var(--accent)',
              borderColor: allResolved ? 'var(--green-border)' : 'var(--accent-dim)',
              color: allResolved ? '#000' : '#fff',
              fontWeight: 'bold',
              transition: 'background 0.2s'
            }}
          >
            {allResolved ? '✅ Guardar Resolución' : '💾 Guardar (con pendientes)'}
          </button>
        </div>
      </div>

      {/* ── Títulos de los 3 paneles ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1.2fr 1fr',
        gap: '2px',
        background: 'var(--border)',
        flexShrink: 0
      }}>
        <div style={{ padding: '7px 12px', background: '#0f1e16', fontSize: '11px', fontWeight: 700, color: 'var(--green)', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span>⬅️</span> Cambios Locales <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(Ours)</span>
        </div>
        <div style={{ padding: '7px 12px', background: '#111128', fontSize: '11px', fontWeight: 700, color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span>📝</span> Resultado Fusionado
          <span style={{ marginLeft: 'auto', fontSize: '10px', color: 'var(--text-muted)', fontWeight: 400 }}>
            editable
          </span>
        </div>
        <div style={{ padding: '7px 12px', background: '#1e0f0f', fontSize: '11px', fontWeight: 700, color: 'var(--red)', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span>➡️</span> Cambios Entrantes <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(Theirs)</span>
        </div>
      </div>

      {/* ── Grid de 3 paneles ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1.2fr 1fr',
        flex: 1,
        overflow: 'hidden',
        gap: '2px',
        background: 'var(--border)'
      }}>

        {/* PANEL IZQUIERDO — Ours */}
        <div style={{ display: 'flex', flexDirection: 'column', background: '#0b150f', overflow: 'hidden' }}>
          <div
            ref={oursRef}
            onScroll={syncScroll(oursRef)}
            style={{ flex: 1, overflowY: 'auto', padding: '12px 12px 12px 12px' }}
          >
            {blocks.map((b, i) => (
              b.type === 'clean' ? (
                <div key={b.id} style={{
                  whiteSpace: 'pre-wrap',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '12px',
                  lineHeight: 1.6,
                  color: 'var(--text-secondary)',
                  padding: '2px 4px',
                  marginBottom: '8px',
                  opacity: hoveredBlockId && hoveredBlockId !== b.id ? 0.4 : 1,
                  transition: 'opacity 0.15s'
                }}>
                  {b.content}
                </div>
              ) : (
                <ConflictBlockRow
                  key={b.id}
                  block={b}
                  blockIndex={i}
                  conflictNumber={conflictCounter[b.id]}
                  totalConflicts={totalConflicts}
                  isHovered={hoveredBlockId === b.id}
                  onHoverEnter={() => setHoveredBlockId(b.id)}
                  onHoverLeave={() => setHoveredBlockId(null)}
                  onAcceptOurs={() => acceptOursBlock(b.id)}
                  onAcceptTheirs={() => acceptTheirsBlock(b.id)}
                  onAcceptBoth={() => acceptBothBlock(b.id)}
                  onIgnore={() => ignoreBlock(b.id)}
                  onUpdateContent={val => handleUpdateBlockContent(b.id, val)}
                  pane="ours"
                />
              )
            ))}
          </div>
        </div>

        {/* PANEL CENTRAL — Resultado (editable + minimap) */}
        <div style={{ display: 'flex', flexDirection: 'column', background: '#0d0d18', overflow: 'hidden', position: 'relative' }}>
          <div
            ref={resultRef}
            onScroll={syncScroll(resultRef)}
            style={{ flex: 1, overflowY: 'auto', padding: '12px 26px 12px 12px' }}
          >
            {blocks.map((b, i) => (
              b.type === 'clean' ? (
                <div key={b.id} style={{
                  whiteSpace: 'pre-wrap',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '12px',
                  lineHeight: 1.6,
                  color: 'var(--text-secondary)',
                  padding: '2px 4px',
                  marginBottom: '8px',
                  opacity: hoveredBlockId && hoveredBlockId !== b.id ? 0.4 : 1,
                  transition: 'opacity 0.15s'
                }}>
                  {b.content}
                </div>
              ) : (
                <ConflictBlockRow
                  key={b.id}
                  block={b}
                  blockIndex={i}
                  conflictNumber={conflictCounter[b.id]}
                  totalConflicts={totalConflicts}
                  isHovered={hoveredBlockId === b.id}
                  onHoverEnter={() => setHoveredBlockId(b.id)}
                  onHoverLeave={() => setHoveredBlockId(null)}
                  onAcceptOurs={() => acceptOursBlock(b.id)}
                  onAcceptTheirs={() => acceptTheirsBlock(b.id)}
                  onAcceptBoth={() => acceptBothBlock(b.id)}
                  onIgnore={() => ignoreBlock(b.id)}
                  onUpdateContent={val => handleUpdateBlockContent(b.id, val)}
                  pane="result"
                />
              )
            ))}
          </div>

          {/* Minimap de conflictos en el borde derecho del panel central */}
          <ConflictMinimap
            blocks={blocks}
            totalHeight={scrollInfo.totalHeight}
            scrollTop={scrollInfo.scrollTop}
            containerHeight={scrollInfo.containerHeight}
            onJump={jumpToConflict}
          />
        </div>

        {/* PANEL DERECHO — Theirs */}
        <div style={{ display: 'flex', flexDirection: 'column', background: '#150b0b', overflow: 'hidden' }}>
          <div
            ref={theirsRef}
            onScroll={syncScroll(theirsRef)}
            style={{ flex: 1, overflowY: 'auto', padding: '12px 12px 12px 12px' }}
          >
            {blocks.map((b, i) => (
              b.type === 'clean' ? (
                <div key={b.id} style={{
                  whiteSpace: 'pre-wrap',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '12px',
                  lineHeight: 1.6,
                  color: 'var(--text-secondary)',
                  padding: '2px 4px',
                  marginBottom: '8px',
                  opacity: hoveredBlockId && hoveredBlockId !== b.id ? 0.4 : 1,
                  transition: 'opacity 0.15s'
                }}>
                  {b.content}
                </div>
              ) : (
                <ConflictBlockRow
                  key={b.id}
                  block={b}
                  blockIndex={i}
                  conflictNumber={conflictCounter[b.id]}
                  totalConflicts={totalConflicts}
                  isHovered={hoveredBlockId === b.id}
                  onHoverEnter={() => setHoveredBlockId(b.id)}
                  onHoverLeave={() => setHoveredBlockId(null)}
                  onAcceptOurs={() => acceptOursBlock(b.id)}
                  onAcceptTheirs={() => acceptTheirsBlock(b.id)}
                  onAcceptBoth={() => acceptBothBlock(b.id)}
                  onIgnore={() => ignoreBlock(b.id)}
                  onUpdateContent={val => handleUpdateBlockContent(b.id, val)}
                  pane="theirs"
                />
              )
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
