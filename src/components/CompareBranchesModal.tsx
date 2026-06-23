import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { BranchInfo } from '../types';
import { formatDate } from './history/utils';

interface CommitSummary {
  id: string;
  message: string;
  author: string;
  timestamp: number;
}

interface BranchComparison {
  base_branch: string;
  target_branch: string;
  ahead: number;
  behind: number;
  base_commits: CommitSummary[];
  target_commits: CommitSummary[];
}

interface CompareBranchesModalProps {
  repoPath: string;
  branches: BranchInfo[];
  currentBranch: string;
  onClose: () => void;
}

export function CompareBranchesModal({ repoPath, branches, currentBranch, onClose }: CompareBranchesModalProps) {
  const [baseBranch, setBaseBranch] = useState(currentBranch);
  const [targetBranch, setTargetBranch] = useState('');
  const [comparison, setComparison] = useState<BranchComparison | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const localBranches = branches.filter(b => !b.is_remote);

  useEffect(() => {
    const others = localBranches.filter(b => b.name !== currentBranch);
    if (others.length > 0 && !targetBranch) {
      setTargetBranch(others[0].name);
    }
  }, [branches, currentBranch]);

  const handleCompare = async () => {
    if (!baseBranch || !targetBranch) return;
    setLoading(true);
    setError(null);
    try {
      const result = await invoke<BranchComparison>('compare_branches', {
        repoPath,
        baseBranch,
        targetBranch,
      });
      setComparison(result);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  // Auto-compare on mount
  useEffect(() => {
    if (baseBranch && targetBranch) {
      handleCompare();
    }
  }, []);

  const otherBranches = localBranches.filter(b => b.name !== baseBranch);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 680, maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
        <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
          <h3 className="modal-title" style={{ fontSize: 14, margin: 0 }}>🔀 Comparar Ramas</h3>
          <button className="btn-close" onClick={onClose}>✕</button>
        </div>

        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 12, alignItems: 'flex-end' }}>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Base</label>
            <select value={baseBranch} onChange={e => {
              setBaseBranch(e.target.value);
              setComparison(null);
            }} style={{
              width: '100%', padding: '7px 10px', borderRadius: 6,
              border: '1px solid var(--border)', background: 'var(--bg-base)',
              color: 'var(--text-primary)', fontSize: 12, fontFamily: 'var(--font-mono)',
            }}>
              {localBranches.map(b => (
                <option key={b.name} value={b.name}>{b.name}{b.name === currentBranch ? ' (actual)' : ''}</option>
              ))}
            </select>
          </div>
          <div style={{ fontSize: 18, color: 'var(--text-muted)', padding: '0 4px 6px' }}>vs</div>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Comparar con</label>
            <select value={targetBranch} onChange={e => {
              setTargetBranch(e.target.value);
              setComparison(null);
            }} style={{
              width: '100%', padding: '7px 10px', borderRadius: 6,
              border: '1px solid var(--border)', background: 'var(--bg-base)',
              color: 'var(--text-primary)', fontSize: 12, fontFamily: 'var(--font-mono)',
            }}>
              {otherBranches.length === 0 ? (
                <option value="">No hay otras ramas</option>
              ) : (
                otherBranches.map(b => (
                  <option key={b.name} value={b.name}>{b.name}</option>
                ))
              )}
            </select>
          </div>
          <button className="btn-primary" onClick={handleCompare} disabled={loading || !baseBranch || !targetBranch || baseBranch === targetBranch} style={{ marginBottom: 2 }}>
            {loading ? <span className="spinner-sm" /> : '📊'} Comparar
          </button>
        </div>

        <div style={{ flex: 1, overflow: 'auto', padding: '12px 16px' }}>
          {error && (
            <div style={{ color: 'var(--red)', padding: 12, background: 'var(--red-bg)', borderRadius: 6, marginBottom: 12 }}>
              ⚠️ {error}
            </div>
          )}

          {comparison && (
            <>
              {/* Summary badges */}
              <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
                <div style={{
                  flex: 1, padding: '12px 16px', borderRadius: 8,
                  background: 'var(--green-bg)', border: '1px solid var(--green-border)',
                }}>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2 }}>{comparison.base_branch}</div>
                  <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--green)' }}>+{comparison.ahead}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>commits ahead</div>
                </div>
                <div style={{
                  flex: 1, padding: '12px 16px', borderRadius: 8,
                  background: 'var(--red-bg)', border: '1px solid var(--red-border)',
                }}>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2 }}>{comparison.target_branch}</div>
                  <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--red)' }}>+{comparison.behind}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>commits behind</div>
                </div>
              </div>

              {/* Base commits */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ color: 'var(--green)' }}>◉</span>
                  Commits solo en <code style={{ color: 'var(--accent)', fontSize: 11 }}>{comparison.base_branch}</code>
                  <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>({comparison.base_commits.length})</span>
                </div>
                {comparison.base_commits.length === 0 ? (
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', padding: '8px 12px' }}>Está al día — no hay commits adicionales</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {comparison.base_commits.map(c => (
                      <div key={c.id} style={{
                        display: 'flex', gap: 8, alignItems: 'center',
                        padding: '6px 10px', borderRadius: 4,
                        background: 'var(--bg-surface)',
                      }}>
                        <span style={{ fontSize: 10, color: 'var(--green)', fontFamily: 'var(--font-mono)', width: 48, flexShrink: 0 }}>{c.id.slice(0, 7)}</span>
                        <span style={{ flex: 1, fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.message.split('\n')[0]}</span>
                        <span style={{ fontSize: 10, color: 'var(--text-muted)', flexShrink: 0 }}>{c.author}</span>
                        <span style={{ fontSize: 9, color: 'var(--text-muted)', flexShrink: 0 }}>{formatDate(c.timestamp)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Target commits */}
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ color: 'var(--red)' }}>◉</span>
                  Commits solo en <code style={{ color: 'var(--accent)', fontSize: 11 }}>{comparison.target_branch}</code>
                  <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>({comparison.target_commits.length})</span>
                </div>
                {comparison.target_commits.length === 0 ? (
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', padding: '8px 12px' }}>Está al día — no hay commits adicionales</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {comparison.target_commits.map(c => (
                      <div key={c.id} style={{
                        display: 'flex', gap: 8, alignItems: 'center',
                        padding: '6px 10px', borderRadius: 4,
                        background: 'var(--bg-surface)',
                      }}>
                        <span style={{ fontSize: 10, color: 'var(--red)', fontFamily: 'var(--font-mono)', width: 48, flexShrink: 0 }}>{c.id.slice(0, 7)}</span>
                        <span style={{ flex: 1, fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.message.split('\n')[0]}</span>
                        <span style={{ fontSize: 10, color: 'var(--text-muted)', flexShrink: 0 }}>{c.author}</span>
                        <span style={{ fontSize: 9, color: 'var(--text-muted)', flexShrink: 0 }}>{formatDate(c.timestamp)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {!comparison && !loading && !error && (
            <div className="panel-empty" style={{ padding: 32 }}>
              Selecciona dos ramas y presiona "Comparar"
            </div>
          )}
        </div>

        <div style={{ padding: '10px 16px', borderTop: '1px solid var(--border)', textAlign: 'right' }}>
          <button className="btn-secondary" onClick={onClose}>Cerrar</button>
        </div>
      </div>
    </div>
  );
}
