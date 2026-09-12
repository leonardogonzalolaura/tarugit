import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { BranchInfo } from '../types';
import { formatDate } from './history/utils';
import { BranchCombo } from './ui/BranchCombo';

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

  const handleSwap = () => {
    const b = baseBranch;
    setBaseBranch(targetBranch);
    setTargetBranch(b);
    setComparison(null);
  };

  const statusInfo = (() => {
    if (!comparison) return null;
    const { ahead, behind } = comparison;
    if (ahead === 0 && behind === 0) return { label: 'Sincronizadas', color: 'var(--green)', bg: 'var(--green-bg)', border: 'var(--green-border)', icon: '✓' };
    if (ahead > 0 && behind === 0) return { label: 'Adelantada', color: 'var(--green)', bg: 'var(--green-bg)', border: 'var(--green-border)', icon: '↑' };
    if (ahead === 0 && behind > 0) return { label: 'Atrasada', color: 'var(--yellow)', bg: 'var(--yellow-bg)', border: 'var(--yellow)', icon: '↓' };
    return { label: 'Divergidas', color: 'var(--accent)', bg: 'rgba(110,127,255,0.08)', border: 'var(--accent-dim)', icon: '⇅' };
  })();

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 820, maxHeight: '85vh', display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px 10px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 26, height: 26, borderRadius: 6, background: 'var(--accent-glow)', border: '1px solid var(--accent-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)', fontSize: 12 }}>⇄</span>
            Comparar ramas
            <span style={{ fontSize: 10, fontWeight: 500, color: 'var(--text-muted)', background: 'var(--bg-hover)', border: '1px solid var(--border)', padding: '1px 6px', borderRadius: 999 }}>{localBranches.length} locales</span>
          </h3>
          <button className="btn-close" onClick={onClose}>✕</button>
        </div>

        <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 10, background: 'var(--bg-surface)', flexShrink: 0 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: .3, whiteSpace: 'nowrap' }}>Base (referencia){baseBranch === currentBranch && <span style={{ fontWeight: 500, textTransform: 'none', letterSpacing: 0, color: 'var(--accent)', marginLeft: 6 }}>· actual</span>}</label>
              <BranchCombo
                branches={localBranches.map(b => b.name)}
                value={baseBranch}
                onChange={(v) => { setBaseBranch(v); setComparison(null); }}
              />
            </div>

            <button
              onClick={handleSwap}
              disabled={!targetBranch}
              title="Intercambiar base y comparar"
              style={{
                width: 32, height: 32, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-elevated)', color: 'var(--text-secondary)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: targetBranch ? 'pointer' : 'not-allowed', flexShrink: 0, marginBottom: 2,
              }}
            >
              ⇄
            </button>

            <div style={{ flex: 1, minWidth: 0 }}>
              <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: .3 }}>Comparar con</label>
              <BranchCombo
                branches={otherBranches.map(b => b.name)}
                value={targetBranch}
                onChange={(v) => { setTargetBranch(v); setComparison(null); }}
                placeholder={otherBranches.length === 0 ? 'No hay otras ramas' : 'Seleccionar...'}
              />
            </div>

            <button className="btn-primary" onClick={handleCompare} disabled={loading || !baseBranch || !targetBranch || baseBranch === targetBranch} style={{ padding: '7px 14px', whiteSpace: 'nowrap', minWidth: 110, marginBottom: 2 }}>
              {loading ? <span className="spinner-sm" /> : '↔'} Comparar
            </button>
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', lineHeight: 1.4 }}>
            <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{baseBranch || '—'}</span> es la referencia · <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{targetBranch || '—'}</span> se compara contra la base · <kbd style={{ fontFamily: 'var(--font-mono)', fontSize: 9, background: 'var(--bg-elevated)', border: '1px solid var(--border)', padding: '1px 4px', borderRadius: 3 }}>⇄</kbd> intercambia
          </div>
        </div>

        <div style={{ flex: 1, overflow: 'auto', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {error && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', color: 'var(--red)', padding: '10px 12px', background: 'var(--red-bg)', border: '1px solid var(--red-border)', borderRadius: 8, fontSize: 12 }}>
              <span style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--red)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, flexShrink: 0 }}>!</span>
              <span style={{ flex: 1, minWidth: 0, wordBreak: 'break-word' }}>{error}</span>
            </div>
          )}

          {loading && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg-elevated)', color: 'var(--text-muted)', fontSize: 12 }}>
              <span className="spinner-sm" /> Comparando <strong style={{ color: 'var(--text-primary)' }}>{baseBranch}</strong> ↔ <strong style={{ color: 'var(--text-primary)' }}>{targetBranch}</strong>...
            </div>
          )}

          {comparison && (
            <>
              {statusInfo && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 8, background: statusInfo.bg, border: `1px solid ${statusInfo.border}`, color: statusInfo.color, fontSize: 12 }}>
                  <span style={{ width: 22, height: 22, borderRadius: '50%', background: statusInfo.color, color: statusInfo.bg === 'var(--green-bg)' ? '#000' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{statusInfo.icon}</span>
                  <span style={{ fontWeight: 600 }}>{statusInfo.label}</span>
                  <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>· {comparison.base_branch} ↔ {comparison.target_branch}</span>
                  <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-secondary)' }}>{comparison.ahead} ahead · {comparison.behind} behind</span>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div style={{ padding: '12px 14px', borderRadius: 10, background: 'var(--green-bg)', border: '1px solid var(--green-border)', display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: .3 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--green)' }} /> Solo en base
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{comparison.base_branch}</div>
                  <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--green)', lineHeight: 1 }}>{comparison.ahead}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>commits adelante</div>
                </div>
                <div style={{ padding: '12px 14px', borderRadius: 10, background: 'var(--red-bg)', border: '1px solid var(--red-border)', display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: .3 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--red)' }} /> Solo en comparar
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{comparison.target_branch}</div>
                  <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--red)', lineHeight: 1 }}>{comparison.behind}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>commits atrás</div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 260, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--green)' }} />
                    Solo en <code style={{ color: 'var(--green)', fontSize: 11, background: 'var(--green-bg)', padding: '1px 4px', borderRadius: 4 }}>{comparison.base_branch}</code>
                    <span style={{ background: 'var(--green-bg)', color: 'var(--green)', border: '1px solid var(--green-border)', padding: '1px 6px', borderRadius: 999, fontSize: 10, fontWeight: 700 }}>{comparison.base_commits.length}</span>
                  </div>
                  {comparison.base_commits.length === 0 ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', border: '1px dashed var(--green-border)', borderRadius: 8, background: 'var(--green-bg)', color: 'var(--green)', fontSize: 11 }}>
                      <span style={{ width: 18, height: 18, borderRadius: '50%', background: 'var(--green)', color: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10 }}>✓</span>
                      Está al día — sin commits exclusivos
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 260, overflow: 'auto', paddingRight: 2 }}>
                      {comparison.base_commits.map(c => (
                        <div key={c.id} title={`${c.id}\n${c.message}`} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '7px 10px', borderRadius: 6, background: 'var(--bg-surface)', border: '1px solid var(--border)', transition: 'border-color .12s' }} onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--green-border)')} onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}>
                          <span style={{ fontSize: 10, color: 'var(--green)', fontFamily: 'var(--font-mono)', background: 'var(--green-bg)', border: '1px solid var(--green-border)', padding: '1px 5px', borderRadius: 4, flexShrink: 0 }}>{c.id.slice(0, 7)}</span>
                          <span style={{ flex: 1, fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-primary)' }}>{c.message.split('\n')[0]}</span>
                          <span style={{ fontSize: 10, color: 'var(--text-muted)', flexShrink: 0, maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.author}</span>
                          <span style={{ fontSize: 9, color: 'var(--text-muted)', flexShrink: 0, fontFamily: 'var(--font-mono)' }}>{formatDate(c.timestamp)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div style={{ flex: 1, minWidth: 260, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--red)' }} />
                    Solo en <code style={{ color: 'var(--red)', fontSize: 11, background: 'var(--red-bg)', padding: '1px 4px', borderRadius: 4 }}>{comparison.target_branch}</code>
                    <span style={{ background: 'var(--red-bg)', color: 'var(--red)', border: '1px solid var(--red-border)', padding: '1px 6px', borderRadius: 999, fontSize: 10, fontWeight: 700 }}>{comparison.target_commits.length}</span>
                  </div>
                  {comparison.target_commits.length === 0 ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', border: '1px dashed var(--red-border)', borderRadius: 8, background: 'var(--red-bg)', color: 'var(--red)', fontSize: 11 }}>
                      <span style={{ width: 18, height: 18, borderRadius: '50%', background: 'var(--red)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10 }}>✓</span>
                      Está al día — sin commits exclusivos
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 260, overflow: 'auto', paddingRight: 2 }}>
                      {comparison.target_commits.map(c => (
                        <div key={c.id} title={`${c.id}\n${c.message}`} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '7px 10px', borderRadius: 6, background: 'var(--bg-surface)', border: '1px solid var(--border)', transition: 'border-color .12s' }} onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--red-border)')} onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}>
                          <span style={{ fontSize: 10, color: 'var(--red)', fontFamily: 'var(--font-mono)', background: 'var(--red-bg)', border: '1px solid var(--red-border)', padding: '1px 5px', borderRadius: 4, flexShrink: 0 }}>{c.id.slice(0, 7)}</span>
                          <span style={{ flex: 1, fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-primary)' }}>{c.message.split('\n')[0]}</span>
                          <span style={{ fontSize: 10, color: 'var(--text-muted)', flexShrink: 0, maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.author}</span>
                          <span style={{ fontSize: 9, color: 'var(--text-muted)', flexShrink: 0, fontFamily: 'var(--font-mono)' }}>{formatDate(c.timestamp)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {!comparison && !loading && !error && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '28px 16px', border: '1px dashed var(--border)', borderRadius: 8, background: 'var(--bg-elevated)', color: 'var(--text-muted)', textAlign: 'center' }}>
              <span style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--accent-glow)', border: '1px solid var(--accent-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)', fontSize: 14 }}>⇄</span>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>Selecciona dos ramas y presiona Comparar</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Verás cuántos commits tiene cada una por separado y su divergencia</div>
            </div>
          )}
        </div>

        <div style={{ padding: '10px 16px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Tip: <kbd style={{ fontFamily: 'var(--font-mono)', fontSize: 9, background: 'var(--bg-elevated)', border: '1px solid var(--border)', padding: '1px 4px', borderRadius: 3 }}>Esc</kbd> cerrar · <kbd style={{ fontFamily: 'var(--font-mono)', fontSize: 9, background: 'var(--bg-elevated)', border: '1px solid var(--border)', padding: '1px 4px', borderRadius: 3 }}>⇄</kbd> intercambiar</span>
          <button className="btn-secondary" onClick={onClose} style={{ fontSize: 12, padding: '6px 12px' }}>Cerrar</button>
        </div>
      </div>
    </div>
  );
}
