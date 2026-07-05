import { useState, useEffect, useCallback, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';

interface PullRequestUser {
  login: string;
  avatar_url: string;
}

interface PullRequestRef {
  ref: string;
  sha: string;
}

interface PullRequestLabel {
  name: string;
  color: string;
}

interface PullRequest {
  number: number;
  title: string;
  body: string | null;
  state: string;
  draft: boolean;
  user: PullRequestUser;
  head: PullRequestRef;
  base: PullRequestRef;
  created_at: string;
  updated_at: string;
  merged_at: string | null;
  merge_commit_sha: string | null;
  html_url: string;
  mergeable: boolean | null;
  merged_by: PullRequestUser | null;
  labels: PullRequestLabel[];
}

interface PullRequestFile {
  path: string;
  status: string;
  additions: number;
  deletions: number;
}

interface PullRequestCommit {
  sha: string;
  message: string;
  author_name: string;
  author_email: string;
  date: string;
}

const PAGE_SIZE = 20;

function prStateIcon(pr: PullRequest): string {
  if (pr.draft) return '🟣';
  if (pr.merged_at) return '🔒';
  if (pr.state === 'closed') return '❌';
  return '🟢';
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return 'hoy';
  if (days === 1) return 'ayer';
  if (days < 7) return `hace ${days} días`;
  return d.toLocaleDateString('es-ES', { month: 'short', day: 'numeric' });
}

interface PullRequestsPanelProps {
  repoPath: string;
  token: string;
  currentBranch?: string;
  remoteInfo: string;
}

export function PullRequestsPanel({ repoPath, token, currentBranch, remoteInfo }: PullRequestsPanelProps) {
  const [prs, setPrs] = useState<PullRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filterState, setFilterState] = useState<'open' | 'closed' | 'all'>('open');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(0);
  const [expandedPr, setExpandedPr] = useState<number | null>(null);
  const [prFiles, setPrFiles] = useState<PullRequestFile[]>([]);
  const [prCommits, setPrCommits] = useState<PullRequestCommit[]>([]);
  const [prDetailTab, setPrDetailTab] = useState<'files' | 'commits'>('files');
  const [prDetailLoading, setPrDetailLoading] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [merging, setMerging] = useState(false);
  const [showMergeMenu, setShowMergeMenu] = useState<number | null>(null);

  const fetchPrs = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const result = await invoke<PullRequest[]>('list_pull_requests', {
        repoPath,
        token,
        state: filterState === 'all' ? null : filterState,
        page: page + 1,
      });
      setPrs(result);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [repoPath, token, filterState, page]);

  useEffect(() => {
    fetchPrs();
  }, [fetchPrs]);

  const handleTogglePr = async (pr: PullRequest) => {
    if (expandedPr === pr.number) {
      setExpandedPr(null);
      return;
    }
    setExpandedPr(pr.number);
    setPrDetailTab('files');
    setPrDetailLoading(true);
    try {
      const [files, commits] = await Promise.all([
        invoke<PullRequestFile[]>('get_pull_request_files', { repoPath, token, number: pr.number }),
        invoke<PullRequestCommit[]>('get_pull_request_commits', { repoPath, token, number: pr.number }),
      ]);
      setPrFiles(files ?? []);
      setPrCommits(commits ?? []);
    } catch {
      setPrFiles([]);
      setPrCommits([]);
    } finally {
      setPrDetailLoading(false);
    }
  };

  const handleMerge = async (prNumber: number, method: string) => {
    setMerging(true);
    setShowMergeMenu(null);
    try {
      await invoke<{ merged: boolean; message: string; sha?: string }>('merge_pull_request', {
        repoPath,
        token,
        number: prNumber,
        method,
      });
      await fetchPrs();
      setExpandedPr(null);
    } catch (e) {
      setError(String(e));
    } finally {
      setMerging(false);
    }
  };

  const handleUpdateState = async (prNumber: number, state: string) => {
    try {
      await invoke('update_pull_request', { repoPath, token, number: prNumber, state });
      await fetchPrs();
      setExpandedPr(null);
    } catch (e) {
      setError(String(e));
    }
  };

  const filteredPrs = searchQuery
    ? prs.filter(pr =>
        pr.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        `#${pr.number}`.includes(searchQuery) ||
        pr.user.login.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : prs;

  const totalPages = Math.ceil(filteredPrs.length / PAGE_SIZE);

  const mergeMethods = [
    { value: 'merge', label: 'Create merge commit' },
    { value: 'squash', label: 'Squash and merge' },
    { value: 'rebase', label: 'Rebase and merge' },
  ];

  useEffect(() => {
    if (!showCreateModal) return;
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') setShowCreateModal(false); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [showCreateModal]);

  return (
    <div className="pr-panel">
      {showCreateModal && (
        <div className="modal-backdrop" onClick={() => setShowCreateModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 560, width: '90%' }}>
            <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
              <h3 className="modal-title" style={{ fontSize: 14, margin: 0 }}>New Pull Request</h3>
              <button className="btn-close" onClick={() => setShowCreateModal(false)}>✕</button>
            </div>
            <CreatePullRequestForm
              repoPath={repoPath}
              token={token}
              currentBranch={currentBranch}
              onCreated={() => { setShowCreateModal(false); fetchPrs(); }}
              onCancel={() => setShowCreateModal(false)}
            />
          </div>
        </div>
      )}

      <div className="pr-header">
        <div className="pr-header-title">
          <span>🔀 Pull Requests</span>
          <span className="actions-remote">{remoteInfo}</span>
        </div>
        <button className="btn-primary" onClick={() => setShowCreateModal(true)}
          style={{ fontSize: 12, padding: '6px 14px' }}>
          + New PR
        </button>
      </div>

      {error && (
        <div className="actions-error">
          <span>⚠ {error}</span>
        </div>
      )}

      <div className="pr-filters">
        <div className="pr-filter-pills">
          {(['open', 'closed', 'all'] as const).map(s => (
            <button
              key={s}
              className={`pr-filter-pill${filterState === s ? ' active' : ''}`}
              onClick={() => { setFilterState(s); setPage(0); }}
            >
              {s === 'open' ? '🟢 Open' : s === 'closed' ? '❌ Closed' : 'All'}
            </button>
          ))}
        </div>
        <input
          type="text"
          placeholder="Buscar por título, # o autor..."
          value={searchQuery}
          onChange={e => { setSearchQuery(e.target.value); setPage(0); }}
          className="actions-search-input"
          style={{ width: 240 }}
        />
      </div>

      {loading && prs.length === 0 ? (
        <div className="actions-loading"><span className="spinner" /> Cargando...</div>
      ) : prs.length === 0 && !error ? (
        <div className="actions-empty">No hay pull requests {filterState !== 'all' ? filterState : ''}</div>
      ) : filteredPrs.length === 0 ? (
        <div className="actions-empty">Sin resultados para "{searchQuery}"</div>
      ) : (
        <div className="actions-list" style={{ gap: 0 }}>
          {filteredPrs.map(pr => {
            const isExpanded = expandedPr === pr.number;
            return (
              <div key={pr.number} className="pr-item">
                <div className="pr-item-header" onClick={() => handleTogglePr(pr)}>
                  <span className="pr-item-icon">{prStateIcon(pr)}</span>
                  <div className="pr-item-info">
                    <div className="pr-item-title">
                      <span className="pr-item-text">{pr.title}</span>
                      <span className="pr-item-number">#{pr.number}</span>
                      {pr.draft && <span className="pr-item-draft">Draft</span>}
                    </div>
                    <div className="pr-item-meta">
                      <span className="pr-item-author">{pr.user.login}</span>
                      <span className="actions-run-sep">·</span>
                      <span className="pr-item-branches">{pr.head.ref} → {pr.base.ref}</span>
                      <span className="actions-run-sep">·</span>
                      <span className="pr-item-date">{formatDate(pr.created_at)}</span>
                    </div>
                    {pr.labels.length > 0 && (
                      <div className="pr-item-labels">
                        {pr.labels.map(l => (
                          <span key={l.name} className="pr-label" style={{ background: `#${l.color}22`, color: `#${l.color}`, border: `1px solid #${l.color}44` }}>
                            {l.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <span className="actions-run-chevron">{isExpanded ? '▼' : '▶'}</span>
                </div>
                {isExpanded && (
                  <div className="pr-detail">
                    {prDetailLoading ? (
                      <div className="actions-loading" style={{ padding: 16 }}><span className="spinner" /> Cargando...</div>
                    ) : (
                      <>
                        {pr.body && (
                          <div className="pr-detail-body">
                            <div className="pr-detail-body-text">{pr.body}</div>
                          </div>
                        )}
                        <div className="pr-detail-tabs">
                          <button
                            className={`pr-detail-tab${prDetailTab === 'files' ? ' active' : ''}`}
                            onClick={() => setPrDetailTab('files')}
                          >
                            Files Changed ({prFiles.length})
                          </button>
                          <button
                            className={`pr-detail-tab${prDetailTab === 'commits' ? ' active' : ''}`}
                            onClick={() => setPrDetailTab('commits')}
                          >
                            Commits ({prCommits.length})
                          </button>
                        </div>
                        {prDetailTab === 'files' ? (
                          <div className="pr-detail-files">
                            {prFiles.length === 0 ? (
                              <div className="actions-empty" style={{ padding: 12, fontSize: 12 }}>Sin archivos</div>
                            ) : (
                              prFiles.map(f => (
                                <div key={f.path} className="pr-file">
                                  <span className="pr-file-status" data-status={f.status}>
                                    {f.status === 'added' ? 'A' : f.status === 'removed' ? 'D' : 'M'}
                                  </span>
                                  <span className="pr-file-path">{f.path}</span>
                                  <span className="pr-file-stats">
                                    <span className="commit-modal-file-adds">+{f.additions}</span>
                                    <span className="commit-modal-file-dels">-{f.deletions}</span>
                                  </span>
                                </div>
                              ))
                            )}
                          </div>
                        ) : (
                          <div className="pr-detail-commits">
                            {prCommits.length === 0 ? (
                              <div className="actions-empty" style={{ padding: 12, fontSize: 12 }}>Sin commits</div>
                            ) : (
                              prCommits.map(c => (
                                <div key={c.sha} className="pr-commit">
                                  <span className="pr-commit-sha">{c.sha.slice(0, 7)}</span>
                                  <span className="pr-commit-msg">{c.message.split('\n')[0]}</span>
                                  <span className="pr-commit-author">{c.author_name}</span>
                                </div>
                              ))
                            )}
                          </div>
                        )}
                        <div className="pr-detail-actions">
                          {pr.state === 'open' && (
                            <div style={{ position: 'relative' }}>
                              <button
                                className="btn-primary"
                                onClick={() => setShowMergeMenu(showMergeMenu === pr.number ? null : pr.number)}
                                disabled={merging}
                                style={{ background: 'var(--green)', color: '#000', fontSize: 12, padding: '6px 16px' }}
                              >
                                {merging ? 'Merging...' : '▼ Merge'}
                              </button>
                              {showMergeMenu === pr.number && (
                                <div className="pr-merge-menu">
                                  {mergeMethods.map(m => (
                                    <button
                                      key={m.value}
                                      className="pr-merge-option"
                                      onClick={() => handleMerge(pr.number, m.value)}
                                    >
                                      {m.label}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                          {pr.state === 'open' && (
                            <button
                              className="btn-secondary"
                              onClick={() => handleUpdateState(pr.number, 'closed')}
                              style={{ fontSize: 12, padding: '6px 16px' }}
                            >
                              Close PR
                            </button>
                          )}
                          {pr.state === 'closed' && !pr.merged_at && (
                            <button
                              className="btn-primary"
                              onClick={() => handleUpdateState(pr.number, 'open')}
                              style={{ fontSize: 12, padding: '6px 16px' }}
                            >
                              Reopen
                            </button>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {totalPages > 1 && filteredPrs.length > 0 && (
        <div className="actions-pagination">
          <button className="actions-page-btn" disabled={page === 0} onClick={() => setPage(p => Math.max(0, p - 1))}>
            ‹ Anterior
          </button>
          <span className="actions-page-info">
            {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filteredPrs.length)} de {filteredPrs.length}
          </span>
          <button className="actions-page-btn" disabled={page >= totalPages - 1} onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}>
            Siguiente ›
          </button>
        </div>
      )}
    </div>
  );
}

function BranchCombo({ branches, value, onChange, label }: {
  branches: string[];
  value: string;
  onChange: (v: string) => void;
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState('');
  const [hl, setHl] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  const filtered = filter
    ? branches.filter(b => b.toLowerCase().includes(filter.toLowerCase()))
    : branches;

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  return (
    <div style={{ flex: 1, position: 'relative' }} ref={ref}>
      <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 3 }}>{label}</label>
      <div
        className="pr-combo-trigger"
        onClick={() => { setOpen(v => !v); setFilter(''); setHl(0); }}
      >
        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value || 'Seleccionar...'}</span>
        <span style={{ fontSize: 9, color: 'var(--text-muted)', flexShrink: 0 }}>▼</span>
      </div>
      {open && (
        <div className="pr-combo-dropdown">
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
              if (e.key === 'Escape') setOpen(false);
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

function CreatePullRequestForm({ repoPath, token, currentBranch, onCreated, onCancel }: {
  repoPath: string;
  token: string;
  currentBranch?: string;
  onCreated: () => void;
  onCancel: () => void;
}) {
  const [branches, setBranches] = useState<string[]>([]);
  const [head, setHead] = useState(currentBranch || '');
  const [base, setBase] = useState('');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [draft, setDraft] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validation, setValidation] = useState<{
    ahead_by: number; behind_by: number;
    has_existing_pr: boolean; existing_pr_number: number | null; existing_pr_title: string | null;
    mergeable: boolean | null;
  } | null>(null);
  const [validating, setValidating] = useState(false);

  useEffect(() => {
    invoke<{ name: string; is_current: boolean; is_remote: boolean }[]>('list_branches', { repoPath })
      .then(b => {
        const names = b.map(bi => bi.name);
        setBranches(names);
        if (!base && names.length > 0) {
          const defaultBase = names.find(n => n === 'main' || n === 'master');
          setBase(defaultBase || names[0]);
        }
      })
      .catch(() => {});
  }, [repoPath]);

  useEffect(() => {
    if (!head || !base || head === base || !token) {
      setValidation(null);
      return;
    }
    setValidating(true);
    invoke<{
      ahead_by: number; behind_by: number;
      has_existing_pr: boolean; existing_pr_number: number | null; existing_pr_title: string | null;
      mergeable: boolean | null;
    }>('check_pr_readiness', { repoPath, token, head, base })
      .then(setValidation)
      .catch(() => setValidation(null))
      .finally(() => setValidating(false));
  }, [head, base, token, repoPath]);

  const handleCreate = async () => {
    if (!title.trim() || !head || !base) return;
    setCreating(true);
    setError(null);
    try {
      await invoke('create_pull_request', {
        repoPath,
        token,
        title: title.trim(),
        body: body.trim() || null,
        head,
        base,
        draft: draft || null,
      });
      onCreated();
    } catch (e) {
      setError(String(e));
    } finally {
      setCreating(false);
    }
  };

  const canCreate = !creating && title.trim() && head && base && head !== base
    && validation !== null && !validation.has_existing_pr;

  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
      {error && <div className="actions-error" style={{ margin: 0 }}>⚠ {error}</div>}

      {validation && (
        <div className="pr-validation">
          {head === base ? (
            <div className="pr-validation-msg error">Las ramas head y base deben ser diferentes</div>
          ) : validation.has_existing_pr ? (
            <div className="pr-validation-msg error">
              ⚠️ Ya existe un PR abierto para {head} → {base}:
              <span className="pr-validation-link"> #{validation.existing_pr_number} – {validation.existing_pr_title}</span>
            </div>
          ) : validation.ahead_by === 0 && validation.behind_by === 0 ? (
            <div className="pr-validation-msg" style={{ background: 'var(--yellow-bg)', border: '1px solid rgba(251,191,36,.3)', color: 'var(--yellow)' }}>
              ⚠️ <strong>{head}</strong> y <strong>{base}</strong> están idénticas — no hay cambios nuevos
            </div>
          ) : validation.ahead_by === 0 && validation.behind_by > 0 ? (
            <div className="pr-validation-msg" style={{ background: 'var(--yellow-bg)', border: '1px solid rgba(251,191,36,.3)', color: 'var(--yellow)' }}>
              ⚠️ <strong>{head}</strong> está detrás de <strong>{base}</strong> por {validation.behind_by} commit{validation.behind_by !== 1 ? 's' : ''} — ¿tal vez tienes las ramas intercambiadas?
            </div>
          ) : (
            <div className="pr-validation-msg success">
              ✅ {validation.ahead_by} commit{validation.ahead_by !== 1 ? 's' : ''} adelante de <strong>{base}</strong>
              {validation.behind_by > 0 && (
                <span style={{ marginLeft: 8, color: 'var(--yellow)' }}>
                  · ⚠️ {validation.behind_by} commit{validation.behind_by !== 1 ? 's' : ''} detrás
                </span>
              )}
              {validation.mergeable === false && (
                <span style={{ marginLeft: 8, color: 'var(--red)' }}>
                  · ⚠️ Posibles conflictos de merge
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {validating && !validation && (
        <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center' }}>Verificando ramas...</div>
      )}

      <div style={{ display: 'flex', gap: 8 }}>
        <BranchCombo branches={branches} value={head} onChange={setHead} label="Head branch" />
        <BranchCombo branches={branches} value={base} onChange={setBase} label="Base branch" />
      </div>
      <div>
        <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 3 }}>Title</label>
        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="PR title"
          className="actions-search-input"
          onKeyDown={e => { if (e.key === 'Enter' && canCreate) handleCreate(); }}
        />
      </div>
      <div>
        <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 3 }}>Description</label>
        <textarea
          value={body}
          onChange={e => setBody(e.target.value)}
          placeholder="Optional description"
          className="pr-textarea"
          rows={4}
        />
      </div>
      <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer' }}>
        <input type="checkbox" checked={draft} onChange={e => setDraft(e.target.checked)} />
        Draft PR
      </label>
      <div className="modal-actions" style={{ marginTop: 4 }}>
        <button className="btn-secondary" onClick={onCancel} style={{ fontSize: 12 }}>Cancel</button>
        <button className="btn-primary" onClick={handleCreate} disabled={!canCreate}
          style={{ fontSize: 12 }}>
          {creating ? 'Creating...' : 'Create Pull Request'}
        </button>
      </div>
    </div>
  );
}
