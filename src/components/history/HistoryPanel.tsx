import { useState, useEffect, useRef, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { BranchInfo } from '../../types';
import { CherryPickModal } from './CherryPickModal';
import { FileDiffViewer } from './FileDiffViewer';
import { CommitItem } from './CommitItem';
import { SquashForm } from './SquashForm';
import { formatDate } from './utils';

export interface ExtendedCommitInfo {
  id: string;
  message: string;
  author: string;
  timestamp: number;
}

interface FileDiff {
  path: string;
  diff: string;
  additions: number;
  deletions: number;
}

interface HistoryPanelProps {
  repoPath: string;
  currentBranch: string;
  onRefresh?: () => void;
  onConflictOperation?: (op: { type: 'cherry-pick'; originalBranch: string }) => void;
  /** Cuando es true, oculta el panel de diff interno y llama onCommitSelect */
  compactMode?: boolean;
  onCommitSelect?: (commit: ExtendedCommitInfo | null, fileDiffs: FileDiff[]) => void;
}

export function HistoryPanel({ repoPath, currentBranch, onRefresh, onConflictOperation, compactMode = false, onCommitSelect }: HistoryPanelProps) {
  const [commits, setCommits] = useState<ExtendedCommitInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedCommit, setSelectedCommit] = useState<string | null>(null);
  const [fileDiffs, setFileDiffs] = useState<FileDiff[]>([]);
  const [loadingDiff, setLoadingDiff] = useState(false);
  const [branches, setBranches] = useState<BranchInfo[]>([]);
  const [selectedCommits, setSelectedCommits] = useState<Set<string>>(new Set());
  const [showCherryModal, setShowCherryModal] = useState(false);
  const [showSquashForm, setShowSquashForm] = useState(false);
  const [squashing, setSquashing] = useState(false);
  const [isApplyingCherryPick, setIsApplyingCherryPick] = useState(false);

  // Resize
  const [listWidth, setListWidth] = useState(30);
  const isDragging = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, []);

  const onMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging.current || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const pct = ((e.clientX - rect.left) / rect.width) * 100;
    setListWidth(Math.min(Math.max(pct, 20), 80));
  }, []);

  const onMouseUp = useCallback(() => {
    if (!isDragging.current) return;
    isDragging.current = false;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }, []);

  useEffect(() => {
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    return () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
  }, [onMouseMove, onMouseUp]);

  useEffect(() => {
    loadHistory();
    loadBranches();
  }, [repoPath, currentBranch]);

  const loadHistory = async () => {
    if (!repoPath) return;
    setLoading(true);
    try {
      const result = await invoke<ExtendedCommitInfo[]>('get_commit_history_with_timestamp', { repoPath });
      setCommits(result);
    } catch (e) {
      console.error('Error cargando historial:', e);
      setCommits([]);
    } finally {
      setLoading(false);
    }
  };

  const loadBranches = async () => {
    if (!repoPath) return;
    try {
      const result = await invoke<BranchInfo[]>('list_branches', { repoPath });
      setBranches(result);
    } catch (_) {}
  };

  const loadCommitDiff = async (commitId: string): Promise<FileDiff[]> => {
    setLoadingDiff(true);
    try {
      const result = await invoke<FileDiff[]>('get_commit_diff_structured', { repoPath, commitId });
      const diffs = result || [];
      setFileDiffs(diffs);
      return diffs;
    } catch (e) {
      console.error('Error cargando diff:', e);
      setFileDiffs([]);
      return [];
    } finally {
      setLoadingDiff(false);
    }
  };

  const handleSelectCommit = async (commit: ExtendedCommitInfo) => {
    if (selectedCommit === commit.id) {
      setSelectedCommit(null);
      setFileDiffs([]);
      onCommitSelect?.(null, []);
      return;
    }
    setSelectedCommit(commit.id);
    const diffs = await loadCommitDiff(commit.id);
    onCommitSelect?.(commit, diffs ?? []);
  };

  const handleToggleSelection = (commitId: string) => {
    setSelectedCommits(prev => {
      const newSet = new Set(prev);
      if (newSet.has(commitId)) newSet.delete(commitId);
      else newSet.add(commitId);
      return newSet;
    });
  };

  const handleCherryPick = async (targetBranch: string, commitIds: string[]) => {
    if (isApplyingCherryPick) return;
    setIsApplyingCherryPick(true);
    setLoadingDiff(true);
    try {
      await invoke('switch_branch', { repoPath, branchName: targetBranch });
      const orderedCommits = [...commitIds].reverse();
      let hasConflict = false;
      for (const commitId of orderedCommits) {
        try {
          await invoke<string>('cherry_pick_commit', { repoPath, commitId });
        } catch (e: any) {
          const errStr = String(e);
          if (errStr.includes('CONFLICT') || errStr.toLowerCase().includes('conflict') || errStr.includes('CHERRY_PICK_IN_PROGRESS')) {
            hasConflict = true;
            break;
          } else {
            throw e;
          }
        }
      }
      if (hasConflict) {
        onConflictOperation?.({ type: 'cherry-pick', originalBranch: currentBranch });
        setTimeout(() => onRefresh?.(), 500);
        alert(`⚠️ Cherry-pick detectó conflictos. Revisa la lista de cambios pendientes.`);
      } else {
        await invoke('switch_branch', { repoPath, branchName: currentBranch });
        alert(`✅ Cherry-Pick exitoso: ${commitIds.length} commit(s) aplicado(s) en "${targetBranch}"`);
        setSelectedCommits(new Set());
        await loadHistory();
        onRefresh?.();
      }
    } catch (e) {
      const errStr = String(e);
      if (!errStr.includes('CONFLICT')) {
        try { await invoke('switch_branch_force', { repoPath, branchName: currentBranch }); } catch (_) {}
        alert(`⚠️ Error en Cherry-Pick:\n${e}`);
        onRefresh?.();
      }
    } finally {
      setIsApplyingCherryPick(false);
      setLoadingDiff(false);
      setShowCherryModal(false);
    }
  };

  const handleSquash = async (count: number, message: string) => {
    if (!confirm(`¿Deseas unir (Squash) los últimos ${count} commits con el mensaje "${message}"?`)) return;
    setSquashing(true);
    try {
      const result = await invoke<string>('squash_commits', { repoPath, count, message });
      alert(`✅ Squash exitoso:\n${result}`);
      setShowSquashForm(false);
      await loadHistory();
      setSelectedCommit(null);
      setFileDiffs([]);
      setSelectedCommits(new Set());
    } catch (e) {
      alert(`Error al realizar squash:\n${e}`);
    } finally {
      setSquashing(false);
    }
  };

  const filtered = search
    ? commits.filter(c =>
        c.message.toLowerCase().includes(search.toLowerCase()) ||
        c.author.toLowerCase().includes(search.toLowerCase()) ||
        c.id.toLowerCase().includes(search.toLowerCase())
      )
    : commits;

  const selectedCount = selectedCommits.size;
  const selectedCommitData = selectedCommit ? commits.find(c => c.id === selectedCommit) : null;

  return (
    <div className="history-layout" ref={containerRef}>
      {showCherryModal && selectedCommits.size > 0 && (
        <CherryPickModal
          commits={commits.filter(c => selectedCommits.has(c.id))}
          branches={branches}
          currentBranch={currentBranch}
          onPick={handleCherryPick}
          onClose={() => setShowCherryModal(false)}
        />
      )}

      {/* Panel de lista de commits */}
      <div
        className="history-list-col"
        style={compactMode ? { width: '100%', flex: 1 } : { width: `${listWidth}%`, minWidth: 0, flex: 'none' }}
      >
        <div className="panel-header" style={{ padding: '8px 12px 6px' }}>
          <h2 className="panel-title">🕓 Historial</h2>
          <div className="panel-header-right" style={{ display: 'flex', gap: '6px' }}>
            {selectedCount > 0 && (
              <button
                className="btn-primary"
                style={{ padding: '3px 8px', fontSize: '10px' }}
                onClick={() => setShowCherryModal(true)}
                disabled={isApplyingCherryPick}
              >
                {isApplyingCherryPick ? <span className="spinner-sm" /> : '🍒'} Cherry-Pick ({selectedCount})
              </button>
            )}
            {commits.length >= 2 && (
              <button
                className={`btn-secondary ${showSquashForm ? 'active' : ''}`}
                style={{ 
                  padding: '3px 6px', 
                  fontSize: '10px', 
                  color: selectedCount >= 2 ? 'var(--yellow)' : 'var(--text-muted)', 
                  borderColor: selectedCount >= 2 ? 'rgba(251,191,36,0.2)' : 'transparent',
                  cursor: selectedCount >= 2 ? 'pointer' : 'not-allowed'
                }}
                onClick={() => {
                  if (selectedCount >= 2) {
                    setShowSquashForm(!showSquashForm);
                  } else {
                    alert('Por favor selecciona con el checkbox al menos 2 commits para hacer squash.');
                  }
                }}
              >
                💥 Squash {selectedCount >= 2 ? `(${selectedCount})` : ''}
              </button>
            )}
            <span className="panel-badge">{commits.length}</span>
            <button className="btn-icon" onClick={loadHistory} title="Recargar">↻</button>
          </div>
        </div>

        {showSquashForm && (() => {
          let maxIdx = -1;
          commits.forEach((c, idx) => {
            if (selectedCommits.has(c.id) && idx > maxIdx) maxIdx = idx;
          });
          const count = maxIdx + 1;
          const commitsToSquash = commits.slice(0, count);
          return (
            <SquashForm
              commitsToSquash={commitsToSquash}
              onSquash={handleSquash}
              onCancel={() => setShowSquashForm(false)}
              isSquashing={squashing}
            />
          );
        })()}

        <div style={{ padding: '0 10px 6px' }}>
          <input
            className="search-input"
            placeholder="Buscar commit, autor o hash..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {selectedCount > 0 && (
            <div style={{ marginTop: '6px', fontSize: '10px', color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
              <span>✓ {selectedCount} seleccionado(s)</span>
              <button className="btn-close" style={{ padding: '1px 5px', fontSize: '9px' }} onClick={() => setSelectedCommits(new Set())}>
                Limpiar
              </button>
            </div>
          )}
        </div>

        {loading ? (
          <div className="panel-loading"><span className="spinner" /> Cargando...</div>
        ) : filtered.length === 0 ? (
          <div className="panel-empty">{search ? 'Sin resultados' : 'No hay commits'}</div>
        ) : (
          <div className="commit-list">
            {filtered.map((commit, idx) => (
              <CommitItem
                key={commit.id}
                commit={commit}
                idx={idx}
                isFirst={idx === 0}
                isSelected={selectedCommit === commit.id}
                isChecked={selectedCommits.has(commit.id)}
                totalCommits={filtered.length}
                onSelectCommit={handleSelectCommit}
                onToggleSelection={handleToggleSelection}
              />
            ))}
          </div>
        )}
      </div>

      {/* Divisor y panel de diff — solo en modo NO compacto */}
      {!compactMode && selectedCommit && (
        <>
          <div
            onMouseDown={onMouseDown}
            style={{
              width: '5px',
              flexShrink: 0,
              cursor: 'col-resize',
              background: 'var(--border)',
              transition: 'background 0.15s',
              position: 'relative',
              zIndex: 10,
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--accent)')}
            onMouseLeave={e => (e.currentTarget.style.background = isDragging.current ? 'var(--accent)' : 'var(--border)')}
          />
          <div className="commit-diff-col" style={{ flex: 1, minWidth: 0, width: 'auto' }}>
            <div className="diff-header" style={{ padding: '10px 14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="diff-file-path" style={{ fontWeight: 'bold', marginBottom: '3px' }}>
                    {selectedCommitData?.message.split('\n')[0]}
                  </div>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                    {selectedCommitData?.id}
                  </div>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '3px' }}>
                    📅 {selectedCommitData ? formatDate(selectedCommitData.timestamp) : 'Fecha desconocida'}
                  </div>
                </div>
                <button className="btn-close" onClick={() => { setSelectedCommit(null); setFileDiffs([]); }} style={{ marginLeft: '10px' }}>✕</button>
              </div>
            </div>
            <div className="diff-body" style={{ padding: '10px' }}>
              <FileDiffViewer fileDiffs={fileDiffs} loading={loadingDiff} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
