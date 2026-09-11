import { useState, useEffect, useRef, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { BranchInfo } from '../types';
import { toast } from './Toast';

interface HomologarModalProps {
  repoPath: string;
  currentBranch: string;
  onClose: () => void;
  onRefresh?: () => void;
  onConflictOperation?: (op: { type: 'rebase' }) => void;
}

function BranchCombo({ branches, value, onChange, exclude }: {
  branches: string[];
  value: string;
  onChange: (v: string) => void;
  exclude?: string | string[];
}) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState('');
  const [hl, setHl] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  const list = branches.filter(b => {
    if (exclude === undefined) return true;
    return Array.isArray(exclude) ? !exclude.includes(b) : b !== exclude;
  });

  const filtered = filter
    ? list.filter(b => b.toLowerCase().includes(filter.toLowerCase()))
    : list;

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  return (
    <div style={{ flex: 1, position: 'relative', minWidth: 0 }} ref={ref}>
      <div
        className="pr-combo-trigger"
        onClick={() => { setOpen(v => !v); setFilter(''); setHl(0); }}
      >
        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12 }}>{value || 'Seleccionar...'}</span>
        <span style={{ fontSize: 9, color: 'var(--text-muted)', flexShrink: 0 }}>▼</span>
      </div>
      {open && (
        <div className="pr-combo-dropdown" style={{ top: '100%', bottom: 'auto', marginTop: 4 }}>
          <input
            className="pr-combo-search"
            placeholder="Filtrar ramas..."
            value={filter}
            autoFocus
            onChange={e => { setFilter(e.target.value); setHl(0); }}
            onKeyDown={e => {
              if (e.key === 'ArrowDown') { e.preventDefault(); setHl(i => Math.min(i + 1, filtered.length - 1)); }
              if (e.key === 'ArrowUp') { e.preventDefault(); setHl(i => Math.max(i - 1, 0)); }
              if (e.key === 'Enter' && filtered[hl]) { onChange(filtered[hl]); setOpen(false); }
              if (e.key === 'Escape') { e.stopPropagation(); setOpen(false); }
            }}
          />
          <div className="pr-combo-list">
            {filtered.length === 0 ? (
              <div className="pr-combo-empty">Sin resultados</div>
            ) : (
              filtered.map((b, i) => (
                <div
                  key={b}
                  className={`pr-combo-item${i === hl ? ' hl' : ''}${b === value ? ' selected' : ''}`}
                  onClick={() => { onChange(b); setOpen(false); }}
                  onMouseEnter={() => setHl(i)}
                >{b}</div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function HomologarModal({ repoPath, currentBranch, onClose, onRefresh, onConflictOperation }: HomologarModalProps) {
  const [branches, setBranches] = useState<BranchInfo[]>([]);
  const [baseBranch, setBaseBranch] = useState('master');
  const [homologBranches, setHomologBranches] = useState<string[]>(currentBranch ? [currentBranch] : []);
  const [pickerValue, setPickerValue] = useState('');
  const [masterStatus, setMasterStatus] = useState<'loading' | 'synced' | 'behind' | 'no-remote'>('loading');
  const [behindCount, setBehindCount] = useState(0);
  const [running, setRunning] = useState(false);
  const [step, setStep] = useState('');
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [branchResults, setBranchResults] = useState<Record<string, 'pending' | 'running' | 'success' | 'error' | 'conflict'>>({});
  const modalRef = useRef<HTMLDivElement>(null);

  const localBranches = branches.filter(b => !b.is_remote).map(b => b.name);

  const loadBranches = useCallback(async () => {
    try {
      const result = await invoke<BranchInfo[]>('list_branches', { repoPath });
      setBranches(result);
      const locals = result.filter(b => !b.is_remote).map(b => b.name);
      setHomologBranches(prev => prev.filter(b => locals.includes(b)));
      if (!locals.includes(baseBranch)) {
        const candidates = locals.filter(b => /^(main|master)$/.test(b));
        if (candidates.length > 0) setBaseBranch(candidates[0]);
        else if (locals.length > 0) setBaseBranch(locals[0]);
      }
    } catch (e) {
      toast.error(`Error cargando ramas: ${e}`);
    }
  }, [repoPath, baseBranch]);

  const checkMasterStatus = useCallback(async (branch: string) => {
    if (!repoPath) return;
    try {
      const status = await invoke<{ ahead: number; behind: number; has_remote: boolean }>('get_branch_remote_status', {
        repoPath,
        branchName: branch,
      });
      if (!status.has_remote) {
        setMasterStatus('no-remote');
        return;
      }
      if (status.behind > 0) {
        setMasterStatus('behind');
        setBehindCount(status.behind);
      } else {
        setMasterStatus('synced');
      }
    } catch {
      setMasterStatus('no-remote');
    }
  }, [repoPath]);

  useEffect(() => {
    loadBranches();
    modalRef.current?.focus();
  }, [loadBranches]);

  useEffect(() => {
    setHomologBranches(currentBranch ? [currentBranch] : []);
  }, [currentBranch]);

  useEffect(() => {
    setMasterStatus('loading');
    checkMasterStatus(baseBranch);
  }, [baseBranch, checkMasterStatus]);

  const switchIfNeeded = async (target: string) => {
    const status = await invoke<{ current_branch: string }>('get_repo_status', { repoPath }).catch(() => null);
    const current = status?.current_branch ?? currentBranch;
    if (current !== target) {
      await invoke('switch_branch', { repoPath, branchName: target });
    }
  };

  const promptDeleteTempBranch = async (tempBranch: string) => {
    const ok = window.confirm(
      `Se creó la rama temporal "${tempBranch}" con el respaldo de "${baseBranch}" local.\n\n¿Eliminarla?`
    );
    if (ok) {
      try {
        await invoke('delete_branch', { repoPath, branchName: tempBranch });
        toast.success(`Rama temporal "${tempBranch}" eliminada.`);
      } catch (e) {
        toast.error(`No se pudo eliminar la rama temporal "${tempBranch}": ${e}`);
      }
    } else {
      toast.info(`Rama temporal "${tempBranch}" conservada. Puedes eliminarla luego.`);
    }
  };

  const addHomologBranch = (branch: string) => {
    if (!branch) return;
    if (branch === baseBranch) {
      toast.warning('La rama base no puede agregarse a las ramas a homologar.');
      return;
    }
    setHomologBranches(prev => prev.includes(branch) ? prev : [...prev, branch]);
    setPickerValue('');
  };

  const removeHomologBranch = (branch: string) => {
    setHomologBranches(prev => prev.filter(b => b !== branch));
  };

  const handleSyncMaster = async () => {
    setRunning(true);
    setStep(`Sincronizando "${baseBranch}" desde el remoto...`);
    setProgress({ current: 0, total: 1 });
    try {
      const result = await invoke<{ message: string; temp_branch: string | null }>('sync_branch_from_remote', {
        repoPath,
        branchName: baseBranch,
      });
      toast.success(result.message);
      if (result.temp_branch) {
        await promptDeleteTempBranch(result.temp_branch);
      }
      await loadBranches();
      await checkMasterStatus(baseBranch);
      setProgress({ current: 1, total: 1 });
    } catch (e) {
      toast.error(`Error al sincronizar "${baseBranch}": ${e}`);
    } finally {
      setRunning(false);
      setStep('');
      setTimeout(() => setProgress({ current: 0, total: 0 }), 1200);
    }
  };

  const handleHomologAll = async () => {
    if (running) return;
    if (homologBranches.length === 0) {
      toast.warning('Agrega al menos una rama a homologar.');
      return;
    }
    if (homologBranches.includes(baseBranch)) {
      toast.warning('La rama base no puede estar en las ramas a homologar. Elige ramas distintas.');
      return;
    }
    setRunning(true);
    setStep('Validando estado de master...');
    setProgress({ current: 0, total: homologBranches.length });
    setBranchResults(Object.fromEntries(homologBranches.map(b => [b, 'pending' as const])));
    try {
      const status = await invoke<{ ahead: number; behind: number; has_remote: boolean }>('get_branch_remote_status', {
        repoPath,
        branchName: baseBranch,
      });
      if (status.has_remote && status.behind > 0) {
        setStep(`"${baseBranch}" está ${status.behind} commit(s) detrás del remoto. Preguntando...`);
        const ok = window.confirm(`"${baseBranch}" está ${status.behind} commit(s) detrás del remoto.\n\n¿Actualizar "${baseBranch}" desde el remoto antes del rebase?`);
        if (ok) {
          setStep(`Sincronizando "${baseBranch}" desde el remoto...`);
          const result = await invoke<{ message: string; temp_branch: string | null }>('sync_branch_from_remote', {
            repoPath,
            branchName: baseBranch,
          });
          if (result.temp_branch) {
            await promptDeleteTempBranch(result.temp_branch);
          }
          await loadBranches();
        } else {
          toast.info(`Continuando con "${baseBranch}" local actual.`);
        }
      } else if (status.has_remote) {
        toast.info(`"${baseBranch}" ya está sincronizada con el remoto.`);
      }

      const originalBranch = currentBranch;
      const okBranches: string[] = [];
      const failedBranches: string[] = [];

      for (let i = 0; i < homologBranches.length; i++) {
        const branch = homologBranches[i];
        setStep(`Homologando "${branch}" sobre "${baseBranch}" (${i + 1}/${homologBranches.length})...`);
        setBranchResults(prev => ({ ...prev, [branch]: 'running' }));
        try {
          await switchIfNeeded(branch);
          await invoke<string>('rebase_branches', { repoPath, branchName: baseBranch });
          okBranches.push(branch);
          setBranchResults(prev => ({ ...prev, [branch]: 'success' }));
          setProgress({ current: i + 1, total: homologBranches.length });
          toast.success(`Rama "${branch}" homologada con "${baseBranch}".`);
        } catch (e) {
          const errStr = String(e);
          if (errStr.toLowerCase().includes('conflict')) {
            setBranchResults(prev => ({ ...prev, [branch]: 'conflict' }));
            setProgress({ current: i + 1, total: homologBranches.length });
            onConflictOperation?.({ type: 'rebase' });
            onRefresh?.();
            onClose();
            return;
          }
          failedBranches.push(branch);
          setBranchResults(prev => ({ ...prev, [branch]: 'error' }));
          setProgress({ current: i + 1, total: homologBranches.length });
          toast.error(`Error al homologar "${branch}": ${errStr}`);
        }
      }

      if (originalBranch && originalBranch !== baseBranch) {
        try {
          await switchIfNeeded(originalBranch);
        } catch (e) {
          toast.error(`No se pudo volver a "${originalBranch}": ${e}`);
        }
      }

      if (okBranches.length > 0) {
        toast.success(`${okBranches.length} rama(s) homologada(s): ${okBranches.join(', ')}`);
      }
      if (failedBranches.length > 0) {
        toast.error(`Rama(s) con error: ${failedBranches.join(', ')}`);
      }
      onRefresh?.();
      onClose();
    } catch (e) {
      toast.error(`Error durante la homologación: ${e}`);
      setRunning(false);
      setStep('');
    }
  };

  const canRun = !running && homologBranches.length > 0 && baseBranch && !homologBranches.includes(baseBranch);

  const homologLabel = homologBranches.length === 0
    ? 'Homologar ramas'
    : homologBranches.length === 1
      ? 'Homologar 1 rama'
      : `Homologar ${homologBranches.length} ramas`;

  const percent = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;
  const phase: 'validating' | 'syncing' | 'rebasing' | 'idle' = !running ? 'idle'
    : step.includes('Validando') ? 'validating'
    : step.includes('Sincronizando') ? 'syncing'
    : step.includes('Homologando') ? 'rebasing'
    : 'validating';

  const renderStatus = () => {
    if (masterStatus === 'loading') return { text: 'Consultando estado...', color: 'var(--text-muted)', icon: '⏳' };
    if (masterStatus === 'no-remote') return { text: 'Sin remoto configurado', color: 'var(--text-muted)', icon: '🚫' };
    if (masterStatus === 'behind') return { text: `${behindCount} commit(s) detrás del remoto`, color: 'var(--yellow)', icon: '↓' };
    return { text: 'Sincronizada con el remoto', color: 'var(--green)', icon: '✓' };
  };

  const status = renderStatus();

  return (
    <div className="modal-backdrop" onClick={running ? undefined : onClose}>
      <div
        ref={modalRef}
        className="modal"
        tabIndex={-1}
        onClick={e => e.stopPropagation()}
        style={{ maxWidth: 520, padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: '85vh' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px 10px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
            <svg viewBox="0 0 16 16" width="15" height="15" fill="currentColor" style={{ color: 'var(--accent)', flexShrink: 0 }}>
              <path d="M5.45 5.975A5.5 5.5 0 0 1 6.5 3.55V1.75a.75.75 0 0 1 1.5 0v10a.75.75 0 0 1-1.5 0v-2.5a3.5 3.5 0 0 0-3.5 3.5.75.75 0 0 1-1.5 0 5 5 0 0 1 3.45-4.775ZM3 12a1 1 0 1 0 0 2 1 1 0 0 0 0-2Zm5-1.5a1 1 0 1 0 0 2 1 1 0 0 0 0-2ZM12 2a1 1 0 0 0-1 1v.5a5.5 5.5 0 0 1-3.45 5.025.75.75 0 1 0 .5 1.415A7 7 0 0 0 12.5 5.25V4.5h.25a.75.75 0 0 1 .75.75v1a.25.25 0 0 0 .5 0v-1A1.75 1.75 0 0 0 12.5 3.5H12V3a1 1 0 0 0-1-1Z"/>
            </svg>
            Homologar ramas
            {homologBranches.length > 0 && (
              <span style={{ fontSize: 10, fontWeight: 700, background: 'var(--accent-glow)', color: 'var(--accent)', border: '1px solid var(--accent-dim)', padding: '1px 6px', borderRadius: 999, lineHeight: 1.6 }}>
                {homologBranches.length}
              </span>
            )}
          </h3>
          <button className="btn-close" onClick={onClose} disabled={running} style={{ opacity: running ? 0.4 : 1 }}>✕</button>
        </div>

        {running && progress.total > 0 && (
          <div className="hm-progress">
            <div className="hm-stepper">
              <span className={`hm-step ${phase === 'validating' ? 'active' : (phase === 'syncing' || phase === 'rebasing') ? 'done' : ''}`}>① Validar</span>
              <span className="hm-step-sep">—</span>
              <span className={`hm-step ${phase === 'syncing' ? 'active' : phase === 'rebasing' ? 'done' : ''}`}>② Sincronizar</span>
              <span className="hm-step-sep">—</span>
              <span className={`hm-step ${phase === 'rebasing' ? 'active' : ''}`}>③ Homologar</span>
              <span className="hm-progress-count">{progress.current}/{progress.total} · {percent}%</span>
            </div>
            <div className="hm-progress-track">
              <div className={`hm-progress-fill ${percent === 100 ? 'done' : ''}`} style={{ width: `${percent}%` }} />
            </div>
            <div className="hm-progress-step">
              <span className="spinner-sm" style={{ flexShrink: 0 }} /> <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{step}</span>
            </div>
            {progress.total > 1 && (
              <div className="hm-branch-status-list">
                {homologBranches.map(b => {
                  const s = branchResults[b] || 'pending';
                  const icon = s === 'pending' ? '○' : s === 'running' ? '⟳' : s === 'success' ? '✓' : s === 'conflict' ? '⚠' : '✕';
                  const label = s === 'pending' ? 'pendiente' : s === 'running' ? 'en curso' : s === 'success' ? 'homologada' : s === 'conflict' ? 'conflicto' : 'error';
                  return (
                    <div key={b} className={`hm-branch-row ${s}`}>
                      <span className="hm-branch-icon">{s === 'running' ? <span className="spinner-sm" style={{ width: 10, height: 10, borderWidth: 1.5 }} /> : icon}</span>
                      <span className="hm-branch-name" title={b}>{b}</span>
                      <span className="hm-branch-state">{label}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 14, overflow: 'auto', flex: 1, minHeight: 0, opacity: running ? 0.55 : 1, pointerEvents: running ? 'none' : 'auto' }}>
          <div className="hm-help-card">
            <strong style={{ color: 'var(--text-primary)', fontSize: 11 }}>¿Cómo funciona?</strong>
            <div style={{ marginTop: 4, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <div>• <strong style={{ color: 'var(--text-primary)' }}>Rama base</strong> <span style={{ color: 'var(--text-secondary)' }}>aporta los cambios</span> <code className="hm-code">master</code> → referencia.</div>
              <div>• <strong style={{ color: 'var(--text-primary)' }}>A homologar</strong> <span style={{ color: 'var(--text-secondary)' }}>reciben los cambios vía rebase.</span></div>
            </div>
          </div>

          <div className="hm-field-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <label className="hm-field-label">Rama base</label>
              <BranchCombo branches={localBranches} value={baseBranch} onChange={setBaseBranch} exclude={homologBranches.length > 0 ? homologBranches : undefined} />
            </div>
            <div className="hm-status-row">
              <span style={{ fontSize: 13, color: status.color }}>{status.icon}</span>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                <strong style={{ color: 'var(--text-primary)' }}>{baseBranch}</strong> · {status.text}
              </span>
              <button
                className="btn-edit"
                onClick={handleSyncMaster}
                disabled={running || masterStatus === 'no-remote'}
                title="Actualizar rama base desde el remoto"
                style={{ fontSize: 11, padding: '4px 10px', whiteSpace: 'nowrap', flexShrink: 0 }}
              >
                {running && step.startsWith('Sincronizando') ? <span className="spinner-sm" /> : '↻'} Actualizar
              </button>
            </div>
          </div>

          <div className="hm-field-card">
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
              <label className="hm-field-label" style={{ paddingTop: 7 }}>
                A homologar
                {homologBranches.length > 0 && <span className="hm-field-count">· {homologBranches.length}</span>}
              </label>
              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <BranchCombo
                  branches={localBranches}
                  value={pickerValue}
                  onChange={addHomologBranch}
                  exclude={[baseBranch, ...homologBranches]}
                />
                {homologBranches.length > 0 ? (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {homologBranches.map(b => {
                      const s = branchResults[b];
                      const isDone = s === 'success';
                      const isError = s === 'error' || s === 'conflict';
                      return (
                        <span
                          key={b}
                          title={`Rama "${b}" a homologar. Clic en × para quitarla.`}
                          className={`hm-chip ${isDone ? 'done' : isError ? 'error' : ''}`}
                        >
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{b}</span>
                          <button
                            className="hm-chip-close"
                            onClick={() => removeHomologBranch(b)}
                            title={`Quitar "${b}"`}
                            disabled={running}
                          >
                            ×
                          </button>
                        </span>
                      );
                    })}
                  </div>
                ) : (
                  <div className="hm-empty">Selecciona al menos una rama para homologar</div>
                )}
                {homologBranches.length > 1 && !running && (
                  <button className="hm-link-btn" onClick={() => setHomologBranches([])}>Limpiar todo</button>
                )}
              </div>
            </div>
          </div>
        </div>

        <div style={{ padding: '10px 16px 12px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: 8, flexShrink: 0 }}>
          <button className="btn-secondary" onClick={onClose} disabled={running} style={{ fontSize: 12, padding: '7px 14px' }}>
            Cancelar
          </button>
          <button
            className="btn-primary"
            onClick={handleHomologAll}
            disabled={!canRun}
            style={{ fontSize: 12, padding: '7px 14px', whiteSpace: 'nowrap', minWidth: 150 }}
            title={!canRun ? (homologBranches.length === 0 ? 'Agrega al menos una rama a homologar' : 'La rama base no puede estar en las ramas a homologar') : undefined}
          >
            {running ? <span className="spinner-sm" style={{ borderColor: 'rgba(255,255,255,.3)', borderTopColor: '#fff' }} /> : '🔁'} {running ? 'Homologando...' : homologLabel}
          </button>
        </div>

        <div style={{ padding: '7px 16px', borderTop: '1px solid var(--border)', fontSize: 10, color: 'var(--text-muted)', flexShrink: 0, lineHeight: 1.5 }}>
          "Actualizar" sincroniza la rama base desde el remoto. "Homologar" rebasea cada rama sobre la base y al terminar vuelves a tu rama original.
        </div>
      </div>
    </div>
  );
}