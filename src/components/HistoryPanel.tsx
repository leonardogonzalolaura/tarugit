import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { CommitInfo, BranchInfo } from '../types';

interface HistoryPanelProps {
  repoPath: string;
  currentBranch: string;
  onRefresh?: () => void;
  onConflictOperation?: (op: { type: 'cherry-pick'; originalBranch: string }) => void;
}

function renderDiffLines(raw: string) {
  if (!raw || raw === 'NO_CHANGES') {
    return <div className="diff-empty"><span>📄</span><p>Este commit no tiene cambios de contenido</p></div>;
  }
  const lines = raw.split('\n');
  return (
    <div className="diff-lines">
      {lines.map((line, i) => {
        const first = line[0];
        let cls = 'diff-line-ctx';
        if (first === '+') cls = 'diff-line-add';
        else if (first === '-') cls = 'diff-line-del';
        else if (first === '@') cls = 'diff-line-hunk';
        return (
          <div key={i} className={`diff-line ${cls}`}>
            <span className="diff-line-num">{i + 1}</span>
            <span className="diff-line-marker">{first === '+' || first === '-' ? first : ' '}</span>
            <span className="diff-line-text">{line.slice(1)}</span>
          </div>
        );
      })}
    </div>
  );
}

// ── Modal centrado para Cherry-Pick ────────────────────────────────────────────
interface CherryPickModalProps {
  commitId: string;
  branches: BranchInfo[];
  currentBranch: string;
  onPick: (targetBranch: string) => void;
  onClose: () => void;
}

function CherryPickModal({ commitId, branches, currentBranch, onPick, onClose }: CherryPickModalProps) {
  const otherBranches = branches.filter(b => b.name !== currentBranch);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal"
        style={{ maxWidth: '420px', maxHeight: '80vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="modal-icon">🍒</div>
        <h3 className="modal-title">Cherry-Pick</h3>
        <p className="modal-desc" style={{ marginBottom: '4px' }}>
          Aplicar commit <code className="modal-branch">{commitId.slice(0, 7)}</code> en otra rama:
        </p>
        <div style={{
          overflowY: 'auto',
          flex: 1,
          maxHeight: '240px',
          borderRadius: 'var(--radius-sm)',
          border: '1px solid var(--border)',
          background: 'var(--bg-surface)',
          margin: '6px 0 12px'
        }}>
          {otherBranches.length === 0 ? (
            <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
              No hay otras ramas disponibles
            </div>
          ) : (
            otherBranches.map(b => (
              <div
                key={b.name}
                onClick={() => onPick(b.name)}
                style={{
                  padding: '10px 14px',
                  fontSize: '12px',
                  fontFamily: 'var(--font-mono)',
                  cursor: 'pointer',
                  color: 'var(--text-primary)',
                  borderBottom: '1px solid var(--border)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  transition: 'background 0.15s'
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <span style={{ color: 'var(--accent)', fontSize: '10px' }}>○</span>
                {b.name}
              </div>
            ))
          )}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button className="btn-secondary" onClick={onClose} style={{ padding: '5px 14px', fontSize: '12px' }}>
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}



// ── Componente principal ───────────────────────────────────────────────────────

export function HistoryPanel({ repoPath, currentBranch, onRefresh, onConflictOperation }: HistoryPanelProps) {
  const [commits, setCommits] = useState<CommitInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedCommit, setSelectedCommit] = useState<string | null>(null);
  const [commitDiff, setCommitDiff] = useState('');
  const [loadingDiff, setLoadingDiff] = useState(false);

  // Ramas disponibles para Cherry-Pick
  const [branches, setBranches] = useState<BranchInfo[]>([]);
  const [showCherryModal, setShowCherryModal] = useState(false);



  // Estados de Squash
  const [showSquashForm, setShowSquashForm] = useState(false);
  const [squashCount, setSquashCount] = useState(2);
  const [squashMessage, setSquashMessage] = useState('');
  const [squashing, setSquashing] = useState(false);

  useEffect(() => {
    loadHistory();
    loadBranches();
    setSelectedCommit(null);
    setCommitDiff('');
  }, [repoPath, currentBranch]);

  const loadHistory = async () => {
    if (!repoPath) return;
    setLoading(true);
    try {
      const result = await invoke<CommitInfo[]>('get_commit_history', { repoPath });
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
      setBranches(result.filter(b => !b.is_remote));
    } catch (_) {}
  };

  const handleSelectCommit = async (commit: CommitInfo) => {
    if (selectedCommit === commit.id) {
      setSelectedCommit(null);
      setCommitDiff('');
      setShowCherryModal(false);
      return;
    }
    setSelectedCommit(commit.id);
    setLoadingDiff(true);
    setShowCherryModal(false);
    try {
      const diff = await invoke<string>('get_commit_diff', { repoPath, commitId: commit.id });
      setCommitDiff(diff);
    } catch (e) {
      setCommitDiff('NO_CHANGES');
    } finally {
      setLoadingDiff(false);
    }
  };

  const handleCherryPickToBranch = async (targetBranch: string) => {
    if (!selectedCommit) return;
    setShowCherryModal(false);
    if (!confirm(`¿Quieres aplicar Cherry-Pick al commit ${selectedCommit.slice(0, 7)} en la rama "${targetBranch}"?`)) return;
    setLoadingDiff(true);
    try {
      // 1. Cambiar a la rama destino
      await invoke('switch_branch', { repoPath, branchName: targetBranch });

      // 2. Aplicar Cherry-Pick
      await invoke<string>('cherry_pick_commit', { repoPath, commitId: selectedCommit });

      // 3. Regresar a la rama original
      await invoke('switch_branch', { repoPath, branchName: currentBranch });

      alert(`✅ Cherry-Pick exitoso en la rama "${targetBranch}"`);
      await loadHistory();
      setSelectedCommit(null);
      setCommitDiff('');
      onRefresh?.();
    } catch (e) {
      const errStr = String(e);
      // Detectar conflicto en cherry-pick
      if (
        errStr.toLowerCase().includes('conflict') ||
        errStr.toLowerCase().includes('after resolving')
      ) {
        // Nos quedamos en la rama destino para que el ConflictResolver actúe
        onConflictOperation?.({ type: 'cherry-pick', originalBranch: currentBranch });
      } else {
        // Intentar volver a la rama original
        try { await invoke('switch_branch_force', { repoPath, branchName: currentBranch }); } catch (_) {}
        alert(`⚠️ Error al aplicar Cherry-Pick en "${targetBranch}":\n${e}`);
        onRefresh?.();
      }
    } finally {
      setLoadingDiff(false);
    }
  };


  const handleSquash = async (e: React.FormEvent) => {
    e.preventDefault();
    if (squashCount < 2) return;
    if (!squashMessage.trim()) {
      alert('Por favor ingresa un mensaje para el nuevo commit unificado.');
      return;
    }
    if (!confirm(`¿Deseas unir (Squash) los últimos ${squashCount} commits con el mensaje "${squashMessage}"?`)) return;
    setSquashing(true);
    try {
      const result = await invoke<string>('squash_commits', { repoPath, count: squashCount, message: squashMessage.trim() });
      alert(`✅ Squash exitoso:\n${result}`);
      setSquashMessage('');
      setShowSquashForm(false);
      await loadHistory();
      setSelectedCommit(null);
      setCommitDiff('');
    } catch (e) {
      alert(`Error al realizar squash:\n${e}`);
    } finally {
      setSquashing(false);
    }
  };

  const filtered = search
    ? commits.filter(
        c =>
          c.message.toLowerCase().includes(search.toLowerCase()) ||
          c.author.toLowerCase().includes(search.toLowerCase()) ||
          c.id.startsWith(search.toLowerCase())
      )
    : commits;

  const addCount = (commitDiff.match(/^\+/gm) ?? []).length;
  const delCount = (commitDiff.match(/^-/gm) ?? []).length;
  const selectedCommitData = selectedCommit ? commits.find(c => c.id === selectedCommit) : null;

  return (
    <div className="history-layout">
      {/* Modal centrado de Cherry-Pick */}
      {showCherryModal && selectedCommit && (
        <CherryPickModal
          commitId={selectedCommit}
          branches={branches}
          currentBranch={currentBranch}
          onPick={handleCherryPickToBranch}
          onClose={() => setShowCherryModal(false)}
        />
      )}



      {/* Lista de commits — siempre visible */}
      <div className="history-list-col">
        <div className="panel-header" style={{ padding: '12px 16px 8px' }}>
          <h2 className="panel-title">🕓 Historial</h2>
          <div className="panel-header-right" style={{ display: 'flex', gap: '6px' }}>
            {commits.length >= 2 && (
              <button 
                className={`btn-secondary ${showSquashForm ? 'active' : ''}`}
                style={{ padding: '4px 8px', fontSize: '11px', color: 'var(--yellow)', borderColor: 'rgba(251,191,36,0.2)' }}
                onClick={() => setShowSquashForm(!showSquashForm)}
                title="Unir últimos commits (Squash)"
              >
                💥 Squash
              </button>
            )}
            <span className="panel-badge">{commits.length} commits</span>
            <button className="btn-icon" onClick={loadHistory} title="Recargar historial">↻</button>
          </div>
        </div>

        {showSquashForm && (
          <form onSubmit={handleSquash} className="squash-commits-form" style={{
            background: 'var(--bg-surface)',
            padding: '12px',
            margin: '0 12px 10px',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border)',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
          }}>
            <div style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--yellow)' }}>💥 UNIR ÚLTIMOS COMMITS (SQUASH)</div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Cantidad de commits:</span>
              <input
                type="number"
                min="2"
                max={commits.length}
                className="search-input"
                style={{ width: '70px', margin: 0, padding: '4px 8px' }}
                value={squashCount}
                onChange={e => setSquashCount(Math.max(2, parseInt(e.target.value) || 2))}
                disabled={squashing}
              />
            </div>
            <input
              className="search-input"
              style={{ margin: 0, padding: '6px 10px' }}
              placeholder="Mensaje del nuevo commit unificado..."
              value={squashMessage}
              onChange={e => setSquashMessage(e.target.value)}
              disabled={squashing}
            />
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '4px' }}>
              <button type="button" className="btn-secondary" style={{ padding: '4px 10px', fontSize: '11px' }} onClick={() => setShowSquashForm(false)} disabled={squashing}>
                Cancelar
              </button>
              <button type="submit" className="btn-primary" style={{ padding: '4px 12px', fontSize: '11px', background: 'var(--yellow)', color: '#000', fontWeight: 'bold' }} disabled={squashing || !squashMessage.trim()}>
                {squashing ? 'Procesando...' : 'Confirmar Squash'}
              </button>
            </div>
          </form>
        )}

        <div style={{ padding: '0 12px 8px' }}>
          <input
            className="search-input"
            placeholder="Buscar por mensaje, autor o hash..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {loading ? (
          <div className="panel-loading"><span className="spinner" /> Cargando...</div>
        ) : filtered.length === 0 ? (
          <div className="panel-empty">
            {search ? 'Sin resultados' : 'No hay commits en esta rama'}
          </div>
        ) : (
          <div className="commit-list">
            {filtered.map((commit, idx) => {
              const shortId = commit.id.slice(0, 7);
              const firstLine = commit.message.split('\n')[0] ?? commit.message;
              const isFirst = idx === 0;
              const isSelected = selectedCommit === commit.id;

              return (
                <div
                  key={commit.id}
                  className={`commit-item ${isFirst ? 'latest' : ''} ${isSelected ? 'selected' : ''}`}
                  onClick={() => handleSelectCommit(commit)}
                >
                  <div className="commit-graph">
                    <div className="commit-dot" />
                    {idx < filtered.length - 1 && <div className="commit-line" />}
                  </div>
                  <div className="commit-body">
                    <div className="commit-row-top">
                      <span className="commit-hash">{shortId}</span>
                      {isFirst && <span className="commit-latest-badge">HEAD</span>}
                      <span className="commit-expand-hint">{isSelected ? '▲' : '▼'}</span>
                    </div>
                    <div className="commit-message">{firstLine}</div>
                    <div className="commit-meta">
                      <span className="commit-author">👤 {commit.author}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Panel de diff del commit — aparece a la derecha cuando hay selección */}
      {selectedCommit && (
        <div className="commit-diff-col">
          <div className="diff-header" style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '12px 16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
              <div className="diff-file-path" style={{ flex: 1, minWidth: 0 }}>
                <span className="diff-filename" style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {selectedCommitData?.message.split('\n')[0]}
                </span>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                  Hash: {selectedCommitData?.id.slice(0, 12)}
                </span>
              </div>
              <button
                className="btn-close"
                onClick={() => { setSelectedCommit(null); setCommitDiff(''); setShowCherryModal(false); }}
                style={{ marginLeft: '12px' }}
              >✕</button>
            </div>
            
            {/* Fila de acciones del commit */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', borderTop: '1px solid var(--border)', paddingTop: '8px', marginTop: '2px' }}>
              <div className="diff-stats">
                {addCount > 0 && <span className="diff-stat-add">+{addCount}</span>}
                {delCount > 0 && <span className="diff-stat-del">-{delCount}</span>}
              </div>
              
              {/* Botón cherry-pick — abre modal centrado */}
              <button
                className="btn-secondary"
                style={{ padding: '4px 10px', fontSize: '11px', color: 'var(--accent)', borderColor: 'var(--accent-dim)' }}
                onClick={() => setShowCherryModal(true)}
                title="Enviar este commit a otra rama (Cherry-Pick)"
              >
                🍒 Cherry-Pick a...
              </button>
            </div>
          </div>
          
          <div className="diff-body">
            {loadingDiff
              ? <div className="diff-loading"><span className="spinner" /> Cargando diff...</div>
              : renderDiffLines(commitDiff)
            }
          </div>
        </div>
      )}
    </div>
  );
}
