import { useState, useEffect, useCallback, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { FileDiff, BranchInfo } from '../types';
import { PullRequestsPanel } from './PullRequestsPanel';
import { toast } from './Toast';

interface WorkflowRun {
  id: number;
  name: string;
  head_branch: string;
  head_sha: string;
  head_commit_message: string;
  head_commit_author_name: string;
  head_commit_author_email: string;
  status: string;
  conclusion: string | null;
  run_number: number;
  created_at: string;
  updated_at: string;
  html_url: string;
  workflow_name: string | null;
}

interface WorkflowRunJob {
  id: number;
  name: string;
  status: string;
  conclusion: string | null;
  started_at: string;
  completed_at: string | null;
  steps: WorkflowRunStep[];
}

interface WorkflowRunStep {
  name: string;
  status: string;
  conclusion: string | null;
  number: number;
}

const TOKEN_KEY = 'tarugit_github_token';
const PAGE_SIZE = 20;

function formatDuration(start: string, end?: string): string {
  const s = new Date(start).getTime();
  const e = end ? new Date(end).getTime() : Date.now();
  const diff = Math.max(0, Math.floor((e - s) / 1000));
  if (diff < 60) return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ${diff % 60}s`;
  return `${Math.floor(diff / 3600)}h ${Math.floor((diff % 3600) / 60)}m`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('es-ES', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function statusIcon(status: string, conclusion?: string | null): string {
  if (status === 'in_progress' || status === 'queued' || status === 'pending') return '🟡';
  if (conclusion === 'success') return '✅';
  if (conclusion === 'failure') return '❌';
  if (conclusion === 'cancelled') return '⏹';
  if (conclusion === 'skipped') return '⏭';
  if (conclusion === 'timed_out') return '⏰';
  if (status === 'completed' && !conclusion) return '❓';
  return '⚪';
}

function stepIcon(status: string, conclusion?: string | null): string {
  if (status === 'in_progress') return '🟡';
  if (conclusion === 'success') return '✅';
  if (conclusion === 'failure') return '❌';
  if (conclusion === 'cancelled' || conclusion === 'skipped') return '⏭';
  return '⚪';
}

interface ActionsPanelProps {
  repoPath: string;
  currentBranch?: string;
}

export function ActionsPanel({ repoPath, currentBranch }: ActionsPanelProps) {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY) || '');
  const [inputToken, setInputToken] = useState('');
  const [runs, setRuns] = useState<WorkflowRun[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedRun, setExpandedRun] = useState<number | null>(null);
  const [expandedJobs, setExpandedJobs] = useState<WorkflowRunJob[]>([]);
  const [jobsLoading, setJobsLoading] = useState(false);
  const [remoteInfo, setRemoteInfo] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(0);
  const [expandedJobsSet, setExpandedJobsSet] = useState<Set<number>>(new Set());
  const [copiedRunId, setCopiedRunId] = useState<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const jobsIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [activeTab, setActiveTab] = useState<'runs' | 'pulls'>('runs');
  const [commitModalSha, setCommitModalSha] = useState<string | null>(null);
  const [commitModalFiles, setCommitModalFiles] = useState<FileDiff[]>([]);
  const [commitModalLoading, setCommitModalLoading] = useState(false);
  const [branches, setBranches] = useState<BranchInfo[]>([]);
  const [selectedBranches, setSelectedBranches] = useState<Set<string>>(new Set());
  const [branchDropdownOpen, setBranchDropdownOpen] = useState(false);
  const branchDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!commitModalSha) return;
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') setCommitModalSha(null); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [commitModalSha]);

  const hasInProgress = runs.some(r => r.status === 'in_progress' || r.status === 'queued' || r.status === 'pending');

  const filteredRuns = runs.filter(r => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (r.workflow_name ?? '').toLowerCase().includes(q)
      || r.name.toLowerCase().includes(q)
      || r.head_branch.toLowerCase().includes(q)
      || r.head_commit_message.toLowerCase().includes(q)
      || `#${r.run_number}`.includes(q);
  });

  const displayRuns = selectedBranches.size === 0
    ? filteredRuns
    : filteredRuns.filter(r => selectedBranches.has(r.head_branch));

  const totalPages = Math.ceil(displayRuns.length / PAGE_SIZE);
  const pagedRuns = displayRuns.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  useEffect(() => {
    if (!repoPath || !token) return;
    invoke<string>('get_github_remote_info', { repoPath })
      .then(setRemoteInfo)
      .catch(() => setRemoteInfo(''));
  }, [repoPath, token]);

  useEffect(() => {
    if (!repoPath) return;
    invoke<BranchInfo[]>('list_branches', { repoPath }).then(setBranches).catch(() => {});
  }, [repoPath]);

  useEffect(() => {
    if (!branchDropdownOpen) return;
    const h = (e: MouseEvent) => {
      if (branchDropdownRef.current && !branchDropdownRef.current.contains(e.target as Node)) {
        setBranchDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [branchDropdownOpen]);

  const fetchRuns = useCallback(async (t: string) => {
    if (!repoPath || !t) return;
    setLoading(true);
    setError(null);
    try {
      const result = await invoke<WorkflowRun[]>('list_workflow_runs', {
        repoPath,
        token: t,
        branch: null,
      });
      setRuns(result);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [repoPath]);

  useEffect(() => {
    if (!token) return;
    fetchRuns(token);
  }, [token, fetchRuns]);

  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (hasInProgress && token) {
      intervalRef.current = setInterval(() => fetchRuns(token), 10000);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [hasInProgress, token, fetchRuns]);

  useEffect(() => {
    if (jobsIntervalRef.current) clearInterval(jobsIntervalRef.current);
    const expandedRunData = runs.find(r => r.id === expandedRun);
    const isInProgress = expandedRunData && (
      expandedRunData.status === 'in_progress' ||
      expandedRunData.status === 'queued' ||
      expandedRunData.status === 'pending'
    );
    if (token && expandedRun !== null && isInProgress) {
      jobsIntervalRef.current = setInterval(async () => {
        try {
          const jobs = await invoke<WorkflowRunJob[]>('get_workflow_run_jobs', {
            repoPath, runId: expandedRun, token,
          });
          setExpandedJobs(jobs);
        } catch {}
      }, 10000);
    }
    return () => { if (jobsIntervalRef.current) clearInterval(jobsIntervalRef.current); };
  }, [hasInProgress, expandedRun, token, repoPath, runs]);

  const handleSaveToken = () => {
    const trimmed = inputToken.trim();
    if (!trimmed) return;
    localStorage.setItem(TOKEN_KEY, trimmed);
    setToken(trimmed);
    setInputToken('');
  };

  const handleClearToken = () => {
    localStorage.removeItem(TOKEN_KEY);
    setToken('');
    setRuns([]);
    setError(null);
  };

  const handleViewCommit = async (sha: string) => {
    setCommitModalSha(sha);
    setCommitModalLoading(true);
    setCommitModalFiles([]);
    try {
      const diffs = await invoke<FileDiff[]>('get_commit_diff_structured', { repoPath, commitId: sha });
      setCommitModalFiles(diffs ?? []);
    } catch {
      setCommitModalFiles([]);
    } finally {
      setCommitModalLoading(false);
    }
  };

  const toggleJob = (jobId: number) => {
    setExpandedJobsSet(prev => {
      const next = new Set(prev);
      if (next.has(jobId)) next.delete(jobId);
      else next.add(jobId);
      return next;
    });
  };

  const handleToggleRun = async (runId: number) => {
    if (expandedRun === runId) {
      setExpandedRun(null);
      setExpandedJobs([]);
      return;
    }
    setExpandedRun(runId);
    setJobsLoading(true);
    try {
      const jobs = await invoke<WorkflowRunJob[]>('get_workflow_run_jobs', {
        repoPath,
        runId,
        token,
      });
      setExpandedJobs(jobs);
    } catch {
      setExpandedJobs([]);
    } finally {
      setJobsLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="actions-panel">
        <div className="actions-setup">
          <h3 style={{ margin: '0 0 8px', fontSize: 14, fontWeight: 600 }}>GitHub Actions</h3>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 12px' }}>
            Necesitas un token de GitHub para ver los workflows.
          </p>
          <ol style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 12px', paddingLeft: 20, lineHeight: 1.8 }}>
            <li>Ve a <strong>github.com/settings/tokens</strong></li>
            <li>Genera un token con scope <strong>repo</strong> o <strong>public_repo</strong></li>
            <li>Pégalo abajo</li>
          </ol>
          <div style={{ display: 'flex', gap: 6 }}>
            <input
              type="password"
              placeholder="ghp_..."
              value={inputToken}
              onChange={e => setInputToken(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleSaveToken(); }}
              style={{
                flex: 1, padding: '8px 10px', fontSize: 13,
                border: '1px solid var(--border)', borderRadius: 4,
                background: 'var(--bg-surface)', color: 'var(--text-primary)',
                fontFamily: 'var(--font-mono)',
              }}
            />
            <button className="btn-primary" onClick={handleSaveToken} disabled={!inputToken.trim()}
              style={{ fontSize: 12, padding: '8px 14px', whiteSpace: 'nowrap' }}>
              Guardar
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="actions-panel">
      <div className="actions-header">
        <div className="actions-tabs">
          <button
            className={`actions-tab${activeTab === 'runs' ? ' active' : ''}`}
            onClick={() => setActiveTab('runs')}
          >⚡ Runs</button>
          <button
            className={`actions-tab${activeTab === 'pulls' ? ' active' : ''}`}
            onClick={() => setActiveTab('pulls')}
          >🔀 PRs</button>
          {remoteInfo && <span className="actions-remote" style={{ marginLeft: 8 }}>{remoteInfo}</span>}
          {activeTab === 'runs' && branches.length > 0 && (
            <div ref={branchDropdownRef} style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 4, marginLeft: 8 }}>
              <svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor">
                <path d="M9.5 3.25a2.25 2.25 0 1 1 3 2.122V6A2.5 2.5 0 0 1 10 8.5H6a1 1 0 0 0-1 1v1.128a2.25 2.25 0 1 1-1.5 0V5.372a2.25 2.25 0 1 1 1.5 0v1.836A2.5 2.5 0 0 1 6 7h4a1 1 0 0 0 1-1v-.628A2.25 2.25 0 0 1 9.5 3.25Zm-6 0a.75.75 0 1 0 1.5 0 .75.75 0 0 0-1.5 0Zm8.25-.75a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5ZM4.25 12a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Z"/>
              </svg>
              <button
                onClick={() => setBranchDropdownOpen(v => !v)}
                style={{
                  fontSize: 11,
                  background: 'transparent',
                  border: '1px solid var(--border)',
                  borderRadius: 4,
                  color: 'var(--text-primary)',
                  padding: '2px 6px',
                  cursor: 'pointer',
                  fontFamily: 'var(--font-mono)',
                  maxWidth: 150,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {selectedBranches.size === 0
                  ? 'Todas las ramas'
                  : selectedBranches.size === 1 && selectedBranches.has(currentBranch ?? '')
                    ? `${currentBranch} (actual)`
                    : `${selectedBranches.size} rama${selectedBranches.size !== 1 ? 's' : ''}`}
                <span style={{ marginLeft: 4, fontSize: 8 }}>▼</span>
              </button>
              {branchDropdownOpen && (
                <div
                  style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    marginTop: 4,
                    zIndex: 100,
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border)',
                    borderRadius: 6,
                    boxShadow: 'var(--shadow-lg)',
                    maxHeight: 250,
                    overflowY: 'auto',
                    minWidth: 180,
                    padding: '4px 0',
                  }}
                >
                  <div
                    onClick={() => setSelectedBranches(new Set())}
                    style={{
                      padding: '6px 10px',
                      fontSize: 11,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      color: selectedBranches.size === 0 ? 'var(--accent)' : 'var(--text-primary)',
                      fontWeight: selectedBranches.size === 0 ? 600 : 400,
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor">
                      <path d="M2 2.5A2.5 2.5 0 0 1 4.5 0h8.75a.75.75 0 0 1 .75.75v12.5a.75.75 0 0 1-.75.75h-2.5a.75.75 0 0 1 0-1.5h1.75v-2h-8a1 1 0 0 0-.714 1.7.75.75 0 1 1-1.072 1.05A2.495 2.495 0 0 1 2 11.5Zm10.5-1h-8a1 1 0 0 0-1 1v6.708A2.486 2.486 0 0 1 4.5 9h8Z"/>
                    </svg>
                    Todas las ramas
                  </div>
                  <div style={{ height: 1, background: 'var(--border)', margin: '2px 0' }} />
                  {branches.filter(b => !b.is_remote).map(b => {
                    const isSelected = selectedBranches.has(b.name);
                    return (
                      <div
                        key={b.name}
                        onClick={() => {
                          setSelectedBranches(prev => {
                            const next = new Set(prev);
                            if (next.has(b.name)) next.delete(b.name);
                            else next.add(b.name);
                            return next;
                          });
                        }}
                        style={{
                          padding: '5px 10px',
                          fontSize: 11,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          fontFamily: 'var(--font-mono)',
                          background: isSelected ? 'var(--bg-hover)' : 'transparent',
                          color: 'var(--text-primary)',
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                        onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {}}
                          style={{ accentColor: 'var(--accent)', margin: 0 }}
                        />
                        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {b.name}
                        </span>
                        {b.name === currentBranch && (
                          <span style={{ fontSize: 10, color: 'var(--text-muted)', flexShrink: 0 }}>actual</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
        <div className="actions-header-actions">
          {activeTab === 'runs' && (
            <button className="btn-edit" onClick={() => fetchRuns(token)} title="Actualizar"
              style={{
                padding: '4px 8px', fontSize: 13,
                animation: loading ? 'spin 0.6s linear infinite' : 'none',
              }}>
              ↻
            </button>
          )}
          <button className="btn-edit" onClick={handleClearToken} title="Cambiar token"
            style={{ padding: '4px 8px', fontSize: 13 }}>
            🔑
          </button>
        </div>
      </div>

      {activeTab === 'pulls' ? (
        <PullRequestsPanel
          repoPath={repoPath}
          token={token}
          currentBranch={currentBranch}
          remoteInfo={remoteInfo}
        />
      ) : (
        <>
      {error && (
        <div className="actions-error">
          <span>⚠ {error}</span>
        </div>
      )}

      <div className="actions-search">
        <input
          type="text"
          placeholder="Buscar por workflow, rama, mensaje..."
          value={searchQuery}
          onChange={e => { setSearchQuery(e.target.value); setPage(0); }}
          className="actions-search-input"
        />
      </div>

      {loading && runs.length === 0 ? (
        <div className="actions-loading"><span className="spinner" /> Cargando...</div>
      ) : runs.length === 0 ? (
        <div className="actions-empty">
          {error ? 'Error al cargar' : 'No se encontraron workflow runs'}
        </div>
      ) : filteredRuns.length === 0 ? (
        <div className="actions-empty">
          No hay runs que coincidan con "{searchQuery}"
        </div>
      ) : (
        <>
          <div className="actions-list">
            {pagedRuns.map(run => {
              const isExpanded = expandedRun === run.id;
              return (
                <div key={run.id} className="actions-run">
                  <div className="actions-run-header" onClick={() => handleToggleRun(run.id)}>
                    <span className="actions-run-icon">{statusIcon(run.status, run.conclusion)}</span>
                    <div className="actions-run-info">
                      <div className="actions-run-name">
                        <span className="actions-run-workflow">{run.workflow_name || run.name}</span>
                        <span className="actions-run-branch">#{run.run_number}</span>
                      </div>
                      <div className="actions-run-meta">
                        <span className="actions-run-branch-label">{run.head_branch}</span>
                        <span className="actions-run-sep">·</span>
                        <span
                          className="actions-run-sha"
                          onClick={e => { e.stopPropagation(); handleViewCommit(run.head_sha); }}
                          title="Ver detalles del commit"
                        >{run.head_sha.slice(0, 7)}</span>
                        <span className="actions-run-sep">·</span>
                        <span className="actions-run-commit">{run.head_commit_message.split('\n')[0]}</span>
                        <span className="actions-run-sep">·</span>
                        <span className="actions-run-author">{run.head_commit_author_name}</span>
                      </div>
                    </div>
                    <div className="actions-run-right">
                      <span className="actions-run-duration">{formatDuration(run.created_at, run.updated_at)}</span>
                      <span className="actions-run-date">{formatDate(run.created_at)}</span>
                      <button
                        className="actions-copy-btn"
                        onClick={e => {
                          e.stopPropagation();
                          navigator.clipboard.writeText(run.html_url);
                          setCopiedRunId(run.id);
                          toast.success('Link copiado');
                          setTimeout(() => setCopiedRunId(null), 1500);
                        }}
                        title={copiedRunId === run.id ? 'Copiado' : 'Copiar enlace del run'}
                        style={{
                          color: copiedRunId === run.id ? 'var(--green, #3cc864)' : undefined,
                          opacity: copiedRunId === run.id ? 1 : undefined,
                        }}
                      >{copiedRunId === run.id ? '✅' : '🔗'}</button>
                    </div>
                    <span className="actions-run-chevron">{isExpanded ? '▼' : '▶'}</span>
                  </div>
                  {isExpanded && (
                    <div className="actions-run-detail">
                      {jobsLoading ? (
                        <div className="actions-loading" style={{ padding: 12 }}><span className="spinner" /> Cargando jobs...</div>
                      ) : expandedJobs.length === 0 ? (
                        <div className="actions-empty" style={{ padding: 12, fontSize: 12 }}>Sin jobs</div>
                      ) : (
                        expandedJobs.map(job => {
                          const jobExpanded = expandedJobsSet.has(job.id);
                          return (
                            <div key={job.id} className="actions-job">
                              <div className="actions-job-header" onClick={() => toggleJob(job.id)}>
                                <span className="actions-job-chevron">{jobExpanded ? '▼' : '▶'}</span>
                                <span className="actions-job-icon">{stepIcon(job.status, job.conclusion)}</span>
                                <span className="actions-job-name">{job.name}</span>
                                <span className="actions-job-duration">{formatDuration(job.started_at, job.completed_at ?? undefined)}</span>
                              </div>
                              {jobExpanded && (
                                <div className="actions-steps">
                                  {job.steps.length === 0 ? (
                                    <div className="actions-step-empty">Job saltado — sin pasos ejecutados</div>
                                  ) : (
                                    job.steps.map(step => (
                                      <div key={step.number} className="actions-step">
                                        <span className="actions-step-icon">{stepIcon(step.status, step.conclusion)}</span>
                                        <span className="actions-step-name">{step.name}</span>
                                      </div>
                                    ))
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {totalPages > 1 && (
            <div className="actions-pagination">
              <button
                className="actions-page-btn"
                disabled={page === 0}
                onClick={() => setPage(p => Math.max(0, p - 1))}
              >‹ Anterior</button>
              <span className="actions-page-info">
                {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, displayRuns.length)} de {displayRuns.length}
              </span>
              <button
                className="actions-page-btn"
                disabled={page >= totalPages - 1}
                onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              >Siguiente ›</button>
            </div>
          )}
        </>
      )}

      {commitModalSha && (
        <div className="modal-backdrop" onClick={() => setCommitModalSha(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 700, maxHeight: '80vh', width: '90%' }}>
            <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '12px 16px', borderBottom: '1px solid var(--border)', gap: 12 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={(() => { const run = runs.find(r => r.head_sha.startsWith(commitModalSha)); return run ? run.head_commit_message.split('\n')[0] : commitModalSha.slice(0, 7); })()}>
                  {(() => {
                    const run = runs.find(r => r.head_sha.startsWith(commitModalSha));
                    return run ? run.head_commit_message.split('\n')[0] : commitModalSha.slice(0, 7);
                  })()}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', gap: 8, flexWrap: 'nowrap', overflow: 'hidden' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }}>{commitModalSha.slice(0, 7)}</span>
                  {(() => {
                    const run = runs.find(r => r.head_sha.startsWith(commitModalSha));
                    return run ? (
                      <>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>👤 {run.head_commit_author_name}</span>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>🌿 {run.head_branch}</span>
                      </>
                    ) : null;
                  })()}
                </div>
              </div>
              <button className="btn-close" onClick={() => setCommitModalSha(null)}>✕</button>
            </div>
            <div style={{ padding: '12px 16px', overflow: 'auto', maxHeight: 'calc(80vh - 100px)' }}>
              {commitModalLoading ? (
                <div className="actions-loading"><span className="spinner" /> Cargando cambios...</div>
              ) : commitModalFiles.length === 0 ? (
                <div className="actions-empty">Sin archivos modificados</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {commitModalFiles.map(f => (
                    <div key={f.path} className="commit-modal-file">
                      <div className="commit-modal-file-header">
                        <span className="commit-modal-file-path" title={f.path}>
                          {(() => {
                            const parts = f.path.replace(/\\/g, '/').split('/');
                            const filename = parts.pop() ?? f.path;
                            const dir = parts.join('/');
                            return (
                              <>
                                {dir && <span className="commit-modal-file-dir">{dir}/</span>}
                                <span className="commit-modal-file-name">{filename}</span>
                              </>
                            );
                          })()}
                        </span>
                        <span className="commit-modal-file-stats">
                          <span className="commit-modal-file-adds">+{f.additions}</span>
                          <span className="commit-modal-file-dels">-{f.deletions}</span>
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
        </>
      )}

    </div>
  );
}
