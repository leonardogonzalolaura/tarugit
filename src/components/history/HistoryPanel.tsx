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
  const [showSearch, setShowSearch] = useState(false);
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
        <div className="hp-header">
          <div className="hp-header-left">
            <span className="hp-title">Historial</span>
            <span className="hp-count">{commits.length}</span>
          </div>
          <div className="hp-header-actions">
            <button className={`hp-btn ${showSearch ? 'active' : ''}`} onClick={() => setShowSearch(v => !v)} title="Buscar">
              <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
                <path d="M6.5 1a5.5 5.5 0 1 0 3.38 9.82l2.65 2.65a.75.75 0 1 0 1.06-1.06l-2.65-2.65A5.5 5.5 0 0 0 6.5 1Zm0 1.5a4 4 0 1 1 0 8 4 4 0 0 1 0-8Z"/>
              </svg>
            </button>
            <button className="hp-btn" onClick={loadHistory} title="Recargar">
              <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
                <path d="M8 1.5a6.5 6.5 0 1 0 6.016 4.035.75.75 0 0 0-1.382-.586A5 5 0 1 1 8 3a5 5 0 0 1 3.5 1.5l-1.5 1.5h4.25V1.5l-1.28 1.28A6.5 6.5 0 0 0 8 1.5Z"/>
              </svg>
            </button>
          </div>
        </div>

        {showSearch && (
          <div className="hp-search">
            <input
              placeholder="Buscar commit, autor o hash..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              autoFocus
            />
            {search && (
              <button className="hp-search-clear" onClick={() => setSearch('')}>✕</button>
            )}
          </div>
        )}

        {selectedCount > 0 && (
          <div className="hp-toolbar">
            <button
              className="hp-tb-btn cherry"
              onClick={() => setShowCherryModal(true)}
              disabled={isApplyingCherryPick}
            >
              <svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor">
                <path d="M4 5 L8 1 L12 5 M8 1 L8 9" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Cherry-Pick ({selectedCount})
            </button>
            <button
              className="hp-tb-btn squash"
              onClick={() => {
                if (selectedCount >= 2) {
                  setShowSquashForm(!showSquashForm);
                } else {
                  alert('Selecciona al menos 2 commits para hacer squash.');
                }
              }}
            >
              <svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor">
                <path d="M4 4 L8 1 L12 4 M8 1 L8 9" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                <rect x="3" y="10" width="10" height="3" rx="1" fill="none" stroke="currentColor" strokeWidth="1.5"/>
              </svg>
              Squash {selectedCount >= 2 ? `(${selectedCount})` : ''}
            </button>
            <button className="hp-tb-btn clear" onClick={() => setSelectedCommits(new Set())}>
              Limpiar
            </button>
          </div>
        )}

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

      {!compactMode && selectedCommit && (
        <>
          <div
            className="hp-resize-handle"
            onMouseDown={onMouseDown}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--accent)')}
            onMouseLeave={e => (e.currentTarget.style.background = isDragging.current ? 'var(--accent)' : 'var(--border)')}
          />
          <div className="hp-diff-col" style={{ flex: 1, width: 'auto' }}>
            <div className="hp-diff-header">
              <div className="hp-diff-info">
                <div className="hp-diff-title">
                  {selectedCommitData?.message.split('\n')[0]}
                </div>
                <div className="hp-diff-meta">
                  {selectedCommitData?.id}
                </div>
                <div className="hp-diff-date">
                  <svg viewBox="0 0 16 16" width="11" height="11" fill="currentColor">
                    <path d="M4.75 0a.75.75 0 0 1 .75.75V2h5V.75a.75.75 0 0 1 1.5 0V2h1.25c.966 0 1.75.784 1.75 1.75v10.5A1.75 1.75 0 0 1 13.25 16H2.75A1.75 1.75 0 0 1 1 14.25V3.75C1 2.784 1.784 2 2.75 2H4V.75A.75.75 0 0 1 4.75 0ZM2.5 7.5v6.75c0 .138.112.25.25.25h10.5a.25.25 0 0 0 .25-.25V7.5H2.5Z"/>
                  </svg>
                  {selectedCommitData ? formatDate(selectedCommitData.timestamp) : 'Fecha desconocida'}
                </div>
              </div>
              <button className="hp-btn" onClick={() => { setSelectedCommit(null); setFileDiffs([]); }} title="Cerrar">
                <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
                  <path d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.75.75 0 1 1 1.06 1.06L9.06 8l3.22 3.22a.75.75 0 1 1-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 0 1-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06Z"/>
                </svg>
              </button>
            </div>
            <div className="hp-body">
              <FileDiffViewer fileDiffs={fileDiffs} loading={loadingDiff} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
