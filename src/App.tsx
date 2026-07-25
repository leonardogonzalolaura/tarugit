import { useState, useCallback, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Navbar } from './components/Navbar';
import { TitleBar } from './components/TitleBar';
import { useRepos, AddRepoModal, CloneRepoModal } from './components/RepoManager';
import { FileList } from './components/FileList';
import { DiffViewer } from './components/DiffViewer';
import { CommitPanel } from './components/CommitPanel';
import { HistoryPanel, ExtendedCommitInfo } from './components/history/HistoryPanel';
import { FileDiffViewer } from './components/history/FileDiffViewer';
import { FileHistoryModal } from './components/history/FileHistoryModal';
import { BranchGraph } from './components/graph/BranchGraph';
import { formatDate } from './components/history/utils';
import { FileDiff, StashInfo } from './types';
import { ConflictResolver } from './components/ConflictResolver/index';
import { OperationStatusBar } from './components/OperationStatusBar';
import { Footer } from './components/Footer';
import { StashPanel } from './components/StashPanel';
import { CreateStashModal } from './components/CreateStashModal';
import { TagPanel } from './components/TagPanel';
import { ActionsPanel } from './components/ActionsPanel';
import { ToastContainer, toast } from './components/Toast';
import { ErrorBoundary } from './components/ErrorBoundary';
import { UserModal } from './components/UserModal';
import { QuickRepoModal } from './components/QuickRepoModal';
import { CherryPickQuickModal } from './components/CherryPickQuickModal';
import { ShortcutHelpModal } from './components/ShortcutHelpModal';
import { SyncModal } from './components/SyncModal';
import { QuickBranchModal } from './components/QuickBranchModal';
import { BatchDeleteBranchesModal } from './components/BatchDeleteBranchesModal';
import { useRepository } from './hooks/useRepository';
import { useUsers } from './hooks/useUsers';
import { useStash } from './hooks/useStash';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import './App.css';

function CommitDiffLines({ diff }: { diff: string }) {
  if (!diff) return <div className="hds-empty">Sin cambios</div>;

  const lines = diff.split('\n').filter(line => {
    if (line.startsWith('diff --git ') || line.startsWith('index ') || line.startsWith('--- ') || line.startsWith('+++ ')) return false;
    return true;
  });

  let lineNum = 0;
  const lineData = lines.map(line => {
    const first = line[0];
    if (first === '@') {
      const match = line.match(/@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
      if (match) lineNum = parseInt(match[1], 10) - 1;
      return { content: line, type: 'hunk' as const, num: '' };
    }
    if (first === '+') { lineNum++; return { content: line, type: 'add' as const, num: lineNum }; }
    if (first === '-') return { content: line, type: 'del' as const, num: '' };
    lineNum++;
    return { content: line, type: 'ctx' as const, num: lineNum };
  });

  return (
    <div className="hds-lines">
      {lineData.map((ld, i) => (
        <div key={i} className={`hds-line hds-line-${ld.type}`}>
          <span className="hds-ln">{ld.num}</span>
          <span className="hds-ln-marker">{ld.content[0] === '+' || ld.content[0] === '-' ? ld.content[0] : ' '}</span>
          <span className="hds-ln-text">{ld.content.slice(1)}</span>
        </div>
      ))}
    </div>
  );
}

function App() {
  const { sorted: savedRepos, addRepo } = useRepos('');

  const {
    repoPath, repoInfo, loading, setLoading,
    conflictOperation, setConflictOperation,
    refreshStatus, openRepo, cloneRepo,
    handleBranchSwitch, handleConflictDetected, handleOperationAborted,
  } = useRepository(addRepo);

  const {
    users, showUserModal, newUserName, newUserEmail,
    setShowUserModal, setNewUserName, setNewUserEmail,
    handleAddUser, saveNewUser, defaultAuthorIndex, setDefaultAuthorIndex, deleteUser,
  } = useUsers();

  const {
    stashes, setStashes, showStashModal, setShowStashModal,
    handleSaveStash,
  } = useStash();

  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileDiff, setFileDiff] = useState('');
  const [leftTab, setLeftTab] = useState<'changes' | 'history' | 'stash' | 'tags' | 'graph' | 'actions'>('changes');
  const [selectedDiffFile, setSelectedDiffFile] = useState<string | null>(null);
  const [activePanel, setActivePanel] = useState<'diff' | 'branches'>('diff');
  const [selectedCommitInfo, setSelectedCommitInfo] = useState<ExtendedCommitInfo | null>(null);
  const [commitFileDiffs, setCommitFileDiffs] = useState<{ path: string; diff: string; additions: number; deletions: number }[]>([]);
  const [resolvingConflictFile, setResolvingConflictFile] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showCloneModal, setShowCloneModal] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{ message: string; onConfirm: () => void } | null>(null);
  const [fileHistoryPath, setFileHistoryPath] = useState<string | null>(null);
  const [selectedStash, setSelectedStash] = useState<StashInfo | null>(null);
  const [stashDiffs, setStashDiffs] = useState<FileDiff[]>([]);
  const [stashLoading, setStashLoading] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(350);
  const [isResizing, setIsResizing] = useState(false);
  const [hdsFileListWidth, setHdsFileListWidth] = useState(25);
  const [hdsResizing, setHdsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const fileListRef = useRef<HTMLDivElement>(null);
  const [lastCommitMessage, setLastCommitMessage] = useState('');
  const [showQuickRepo, setShowQuickRepo] = useState(false);
  const [showCherryQuick, setShowCherryQuick] = useState(false);
  const [showShortcutHelp, setShowShortcutHelp] = useState(false);
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [showQuickBranch, setShowQuickBranch] = useState(false);
  const [showBatchDelete, setShowBatchDelete] = useState(false);

  useEffect(() => {
    document.documentElement.style.setProperty('--sidebar-w', `${sidebarWidth}px`);
  }, [sidebarWidth]);

  useEffect(() => {
    if (!sidebarCollapsed && repoInfo && leftTab === 'changes') {
      const timer = setTimeout(() => fileListRef.current?.focus(), 50);
      return () => clearTimeout(timer);
    }
  }, [sidebarCollapsed, repoInfo, leftTab]);

  useEffect(() => {
    if (!repoPath) return;
    invoke<string>('get_last_commit_message', { repoPath }).then(setLastCommitMessage).catch(() => setLastCommitMessage(''));
  }, [repoPath]);

  useEffect(() => {
    if (!isResizing) return;
    const onMove = (e: MouseEvent) => {
      const w = Math.max(180, Math.min(500, e.clientX));
      setSidebarWidth(w);
    };
    const onUp = () => setIsResizing(false);
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    return () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
  }, [isResizing]);

  const makeCommit = useCallback(async (message: string, user?: { name: string; email: string }, amend?: boolean) => {
    setLoading(true);
    try {
      await invoke<string>('commit_changes', {
        repoPath, message,
        authorName: user?.name,
        authorEmail: user?.email,
        amend: amend ?? false,
      });
      toast.success(amend ? 'Commit amendado correctamente' : 'Commit realizado');
      await refreshStatus();
      setSelectedFile(null);
      setFileDiff('');
    } catch (e) {
      toast.error(`Error en commit: ${e}`);
    } finally {
      setLoading(false);
    }
  }, [repoPath, refreshStatus, setLoading]);

  const discardChanges = useCallback(async (filePath: string) => {
    setConfirmAction({
      message: `¿Descartar cambios en "${filePath}"?`,
      onConfirm: async () => {
        setConfirmAction(null);
        setLoading(true);
        try {
          await invoke('discard_changes', { repoPath, filePath });
          await refreshStatus();
          if (selectedFile === filePath) { setSelectedFile(null); setFileDiff(''); }
          if (resolvingConflictFile === filePath) { setResolvingConflictFile(null); }
          toast.success(`Cambios descartados en "${filePath}"`);
        } catch (e) {
          toast.error(`Error al descartar: ${e}`);
        } finally {
          setLoading(false);
        }
      }
    });
  }, [repoPath, refreshStatus, selectedFile, resolvingConflictFile, setLoading]);

  const viewDiff = useCallback(async (filePath: string) => {
    setSelectedFile(filePath);
    setActivePanel('diff');

    const fileItem = repoInfo?.files.find(f => f.path === filePath);
    if (fileItem?.status === 'conflicted') {
      setResolvingConflictFile(filePath);
      return;
    }

    setResolvingConflictFile(null);
    setLoading(true);
    try {
      const diff = await invoke<string>('get_file_diff', { repoPath, filePath });
      setFileDiff(diff);
    } catch {
      setFileDiff('');
    } finally {
      setLoading(false);
    }
  }, [repoInfo, repoPath, setLoading]);

  const handleConflictResolved = useCallback(async () => {
    setConflictOperation(null);
    setResolvingConflictFile(null);
    setSelectedFile(null);
    setFileDiff('');
    await refreshStatus();
  }, [refreshStatus, setConflictOperation]);

  const handleFileSaved = useCallback(async () => {
    await refreshStatus();
    if (selectedFile) {
      try {
        const diff = await invoke<string>('get_file_diff', { repoPath, filePath: selectedFile });
        setFileDiff(diff);
      } catch { setFileDiff(''); }
    }
  }, [refreshStatus, selectedFile, repoPath]);

  const refreshAll = useCallback(async () => {
    const result = await refreshStatus();
    if (result?.stashes) setStashes(result.stashes);
  }, [refreshStatus, setStashes]);

  useEffect(() => {
    if (repoPath) refreshAll();
  }, [repoPath, refreshAll]);

  const handleStashSave = useCallback(async (message: string, includeUntracked: boolean, filesToStash: string[] | null) => {
    await handleSaveStash(repoPath, message, includeUntracked, filesToStash, refreshAll);
  }, [repoPath, handleSaveStash, refreshAll]);

  const handleFileHistory = useCallback((path: string) => {
    setFileHistoryPath(path);
  }, []);

  const handleSelectStash = useCallback(async (stash: StashInfo) => {
    setSelectedStash(stash);
    if (!repoPath) return;
    setStashLoading(true);
    try {
      const diffs = await invoke<FileDiff[]>('get_stash_diff', { repoPath, stashIndex: stash.index });
      setStashDiffs(diffs ?? []);
    } catch (e) {
      console.error('Error cargando diff del stash:', e);
      setStashDiffs([]);
    } finally {
      setStashLoading(false);
    }
  }, [repoPath]);

  const handleCloseStash = useCallback(() => {
    setSelectedStash(null);
    setStashDiffs([]);
  }, []);

  const openRepoWithReset = useCallback(async (path: string) => {
    await openRepo(path);
    setSelectedFile(null);
    setFileDiff('');
    setActivePanel('diff');
    setLeftTab('changes');
    setResolvingConflictFile(null);
  }, [openRepo]);

  const handleClone = useCallback(async (url: string, path: string) => {
    await cloneRepo(url, path);
    setShowCloneModal(false);
  }, [cloneRepo]);

  useKeyboardShortcuts([
    { key: 'b', ctrl: true, handler: () => setSidebarCollapsed(v => !v) },
    { key: 'b', ctrl: true, shift: true, handler: () => { if (repoPath) window.dispatchEvent(new CustomEvent('create-branch')); } },
    { key: '1', ctrl: true, handler: () => setLeftTab('changes') },
    { key: '2', ctrl: true, handler: () => setLeftTab('history') },
    { key: '3', ctrl: true, handler: () => setLeftTab('stash') },
    { key: '4', ctrl: true, handler: () => setLeftTab('tags') },
    { key: '5', ctrl: true, handler: () => setLeftTab('actions') },
    { key: 'k', ctrl: true, shift: true, handler: () => setLeftTab('actions') },
    { key: 'p', ctrl: true, handler: () => setShowQuickRepo(v => !v) },
    { key: 'Tab', ctrl: true, handler: () => setLeftTab(t => { if (t === 'graph') return 'changes'; return t === 'changes' ? 'history' : t === 'history' ? 'stash' : t === 'stash' ? 'tags' : t === 'tags' ? 'actions' : 'changes'; }) },
    { key: 'Tab', ctrl: true, shift: true, handler: () => setLeftTab(t => { if (t === 'graph') return 'actions'; return t === 'actions' ? 'tags' : t === 'tags' ? 'stash' : t === 'stash' ? 'history' : t === 'history' ? 'changes' : 'actions'; }) },
    { key: 'e', ctrl: true, handler: () => { if (repoPath) setShowCherryQuick(true); } },
    { key: 's', ctrl: true, shift: true, handler: () => { if (repoPath) setShowSyncModal(true); } },
    { key: 'd', ctrl: true, shift: true, handler: () => { if (repoPath) window.dispatchEvent(new CustomEvent('open-compare-branches')); } },
    { key: 'l', ctrl: true, handler: () => { if (repoPath) setShowQuickBranch(v => !v); } },
    { key: 'Delete', ctrl: true, shift: true, handler: () => { if (repoPath) setShowBatchDelete(v => !v); } },
    { key: '/', ctrl: true, handler: () => setShowShortcutHelp(v => !v) },
  ]);

  return (
    <ErrorBoundary>
      <div className="app">
        <TitleBar />
        <ToastContainer />
        <Navbar
          repoInfo={repoInfo}
          repos={savedRepos}
          activeRepoPath={repoPath}
          onSelectRepo={openRepoWithReset}
          onAddRepo={() => setShowAddModal(true)}
          onCloneRepo={() => setShowCloneModal(true)}
          showGraph={leftTab === 'graph'}
          onShowGraph={() => setLeftTab(t => t === 'graph' ? 'changes' : 'graph')}
          showActions={leftTab === 'actions'}
          onShowActions={() => setLeftTab(t => t === 'actions' ? 'changes' : 'actions')}
        />

        {showAddModal && (
          <AddRepoModal
            onAdd={(path) => { addRepo(path); openRepoWithReset(path); setShowAddModal(false); }}
            onClose={() => setShowAddModal(false)}
          />
        )}
        {showCloneModal && (
          <CloneRepoModal
            onClone={(url, path) => { handleClone(url, path); addRepo(path); }}
            onClose={() => setShowCloneModal(false)}
          />
        )}

        {showStashModal && repoInfo && (
          <CreateStashModal
            files={repoInfo.files}
            onSave={handleStashSave}
            onClose={() => setShowStashModal(false)}
          />
        )}

        {repoPath && (
          <OperationStatusBar
            repoPath={repoPath}
            onOperationAborted={handleOperationAborted}
            onOperationContinued={() => { refreshAll(); }}
          />
        )}

        {showUserModal && (
          <UserModal
            newUserName={newUserName}
            newUserEmail={newUserEmail}
            onNameChange={setNewUserName}
            onEmailChange={setNewUserEmail}
            onSave={saveNewUser}
            onClose={() => setShowUserModal(false)}
          />
        )}

        <div className="layout">
          <div ref={sidebarRef} className={`left-col${sidebarCollapsed ? ' left-col--collapsed' : ''}`}
            style={{ width: sidebarCollapsed ? 24 : sidebarWidth, minWidth: sidebarCollapsed ? 24 : sidebarWidth }}>
            <button
              className="sidebar-toggle"
              onClick={() => setSidebarCollapsed(v => !v)}
              title={sidebarCollapsed ? 'Expandir panel' : 'Colapsar panel'}
            >
              {sidebarCollapsed ? '›' : '‹'}
            </button>
            {!sidebarCollapsed && (
              <div className={`sidebar-resize-handle${isResizing ? ' active' : ''}`}
                onMouseDown={(e) => { e.preventDefault(); setIsResizing(true); }}
              />
            )}

            {!sidebarCollapsed && repoInfo && (
              <>
                <div className="left-tabs">
                  <button
                    className={`left-tab-btn${leftTab === 'changes' ? ' active' : ''}`}
                    onClick={() => setLeftTab('changes')}
                  >
                    Cambios
                    {repoInfo.files.length > 0 && (
                      <span className="left-tab-badge">{repoInfo.files.length}</span>
                    )}
                  </button>
                  <button
                    className={`left-tab-btn${leftTab === 'history' ? ' active' : ''}`}
                    onClick={() => setLeftTab('history')}
                  >
                    Historial
                  </button>
                <button
                  className={`left-tab-btn${leftTab === 'stash' ? ' active' : ''}`}
                  onClick={() => setLeftTab('stash')}
                >
                  Stash
                  {stashes.length > 0 && (
                    <span className="left-tab-badge">{stashes.length}</span>
                  )}
                </button>
                <button
                  className={`left-tab-btn${leftTab === 'tags' ? ' active' : ''}`}
                  onClick={() => setLeftTab('tags')}
                >
                  Tags
                </button>
              </div>

                {leftTab === 'changes' && (
                  <>
                    <div className="file-section">
                      <FileList
                        ref={fileListRef}
                        files={repoInfo.files}
                        selectedFile={selectedFile}
                        loading={loading}
                        onSelectFile={viewDiff}
                        onDiscardFile={discardChanges}
                        onFileHistory={handleFileHistory}
                        repoPath={repoPath}
                        onRefresh={refreshStatus}
                      />
                    </div>
                    <CommitPanel
                      fileCount={repoInfo.files.length}
                      loading={loading}
                      onCommit={makeCommit}
                      users={users}
                      onAddUser={handleAddUser}
                      onStashClick={() => setShowStashModal(true)}
                      defaultAuthorIndex={defaultAuthorIndex}
                      onSetDefaultAuthor={setDefaultAuthorIndex}
                      onDeleteUser={deleteUser}
                      lastCommitMessage={lastCommitMessage}
                    />
                  </>
                )}

                {leftTab === 'history' && (
                  <div className="left-history">
                    <HistoryPanel
                      repoPath={repoPath}
                      currentBranch={repoInfo.current_branch}
                      onRefresh={handleBranchSwitch}
                      onConflictOperation={handleConflictDetected}
                      compactMode
                      onCommitSelect={(commit, diffs) => {
                        setSelectedCommitInfo(commit);
                        setCommitFileDiffs(diffs);
                        setSelectedDiffFile(diffs && diffs.length > 0 ? diffs[0].path : null);
                      }}
                    />
                  </div>
                )}

              {leftTab === 'stash' && (
                <div className="left-history">
                  <StashPanel
                    repoPath={repoPath}
                    stashes={stashes}
                    loading={loading}
                    onRefresh={refreshAll}
                    onSelectStash={handleSelectStash}
                    selectedStashId={selectedStash?.id ?? null}
                  />
                </div>
              )}

              {leftTab === 'tags' && (
                <div className="left-history">
                  <TagPanel repoPath={repoPath} />
                </div>
              )}

              </>
            )}
          </div>

          <div className="right-col">
            {leftTab === 'history' && (
              selectedCommitInfo ? (
                <div className="diff-panel">
                  <div className="diff-header">
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="diff-file-path" style={{ fontWeight: 600, marginBottom: 2 }}>
                        {selectedCommitInfo.message.split('\n')[0]}
                      </div>
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', display: 'flex', gap: 12 }}>
                        <span>{selectedCommitInfo.id.slice(0, 12)}</span>
                        <span>👤 {selectedCommitInfo.author}</span>
                        <span>📅 {formatDate(selectedCommitInfo.timestamp)}</span>
                      </div>
                    </div>
                    <button
                      className="btn-close"
                      onClick={() => { setSelectedCommitInfo(null); setCommitFileDiffs([]); setSelectedDiffFile(null); }}
                    >✕</button>
                  </div>
                  <div className="history-diff-split"
                    onMouseMove={e => {
                      if (!hdsResizing) return;
                      const rect = e.currentTarget.getBoundingClientRect();
                      const pct = ((e.clientX - rect.left) / rect.width) * 100;
                      setHdsFileListWidth(Math.min(Math.max(pct, 15), 50));
                    }}
                    onMouseUp={() => { if (hdsResizing) { setHdsResizing(false); document.body.style.cursor = ''; document.body.style.userSelect = ''; } }}
                    onMouseLeave={() => { if (hdsResizing) { setHdsResizing(false); document.body.style.cursor = ''; document.body.style.userSelect = ''; } }}
                  >
                    <div className="hds-file-list" style={{ width: `${hdsFileListWidth}%`, minWidth: `${hdsFileListWidth}%` }}>
                      <div className="hds-fl-header">
                        <span className="hds-fl-count">{commitFileDiffs.length} archivo{commitFileDiffs.length !== 1 ? 's' : ''}</span>
                      </div>
                      <div className="hds-fl-body">
                        {commitFileDiffs.map(f => {
                          const parts = f.path.replace(/\\/g, '/').split('/');
                          const filename = parts.pop() ?? f.path;
                          const dir = parts.join('/');
                          return (
                            <div
                              key={f.path}
                              className={`hds-fl-item${selectedDiffFile === f.path ? ' selected' : ''}`}
                              onClick={() => setSelectedDiffFile(f.path)}
                            >
                              <span className="hds-fl-path">
                                {dir ? <span className="hds-fl-dir">{dir}/</span> : null}
                                <span className="hds-fl-name">{filename}</span>
                              </span>
                              <span className="hds-fl-stats">
                                {f.additions > 0 && <span className="hds-fl-add">+{f.additions}</span>}
                                {f.deletions > 0 && <span className="hds-fl-del">-{f.deletions}</span>}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    <div
                      className="hds-divider"
                      onMouseDown={e => { e.preventDefault(); setHdsResizing(true); document.body.style.cursor = 'col-resize'; document.body.style.userSelect = 'none'; }}
                    />
                    <div className="hds-diff-content">
                      {commitFileDiffs.filter(f => f.path === selectedDiffFile).map(f => (
                        <div key={f.path} style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                          <div className="hds-dc-header">
                            <span className="hds-dc-path" title={f.path}>{f.path}</span>
                            <button className="hds-dc-copy" onClick={() => navigator.clipboard.writeText(f.path)} title="Copiar ruta">
                              <svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor">
                                <path d="M0 6.75C0 5.784.784 5 1.75 5h1.5a.75.75 0 0 1 0 1.5h-1.5a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-1.5a.75.75 0 0 1 1.5 0v1.5A1.75 1.75 0 0 1 9.25 16h-7.5A1.75 1.75 0 0 1 0 14.25Z"/>
                                <path d="M5 1.75C5 .784 5.784 0 6.75 0h7.5C15.216 0 16 .784 16 1.75v7.5A1.75 1.75 0 0 1 14.25 11h-7.5A1.75 1.75 0 0 1 5 9.25Zm1.75-.25a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-7.5a.25.25 0 0 0-.25-.25Z"/>
                              </svg>
                            </button>
                          </div>
                          <CommitDiffLines diff={f.diff} />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="diff-empty">
                  <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                    <div style={{ fontSize: 32, marginBottom: 8 }}>🕓</div>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>Selecciona un commit</div>
                    <div style={{ fontSize: 11, marginTop: 4 }}>para ver sus cambios aquí</div>
                  </div>
                </div>
              )
            )}

            {leftTab === 'stash' && (
              selectedStash ? (
                <div className="diff-panel">
                  <div className="diff-header" style={{ padding: '8px 12px', gap: 8 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="diff-file-path" style={{ fontWeight: 600, marginBottom: 2, fontSize: 12 }}>
                        {selectedStash.name}
                      </div>
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: 2 }}>
                        {selectedStash.message}
                      </div>
                    </div>
                    <button className="btn-close" onClick={handleCloseStash}>
                      <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
                        <path d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.75.75 0 1 1 1.06 1.06L9.06 8l3.22 3.22a.75.75 0 1 1-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 0 1-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06Z"/>
                      </svg>
                    </button>
                  </div>
                  <div className="diff-body" style={{ padding: '8px' }}>
                    <FileDiffViewer fileDiffs={stashDiffs} loading={stashLoading} />
                  </div>
                </div>
              ) : (
                <div className="diff-empty">
                  <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                    <div style={{ fontSize: 32, marginBottom: 8 }}>
                      <svg viewBox="0 0 16 16" width="32" height="32" fill="currentColor">
                        <path d="M1.75 1A1.75 1.75 0 0 0 0 2.75v10.5C0 14.216.784 15 1.75 15h12.5A1.75 1.75 0 0 0 16 13.25v-8.5A1.75 1.75 0 0 0 14.25 3H7.5a.25.25 0 0 1-.2-.1l-.9-1.2C6.07 1.26 5.55 1 5 1H1.75Z"/>
                      </svg>
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>Selecciona un stash</div>
                    <div style={{ fontSize: 11, marginTop: 4 }}>para ver sus cambios aquí</div>
                  </div>
                </div>
              )
            )}

            {leftTab === 'changes' && activePanel === 'diff' && (
              <DiffViewer
                selectedFile={selectedFile}
                diffContent={fileDiff}
                loading={loading}
                onClose={() => { setSelectedFile(null); setFileDiff(''); }}
                repoPath={repoPath}
                onFileSaved={handleFileSaved}
              />
            )}

            {leftTab === 'graph' && (
              <BranchGraph repoPath={repoPath} />
            )}

            {leftTab === 'actions' && repoPath && (
              <ActionsPanel repoPath={repoPath} currentBranch={repoInfo?.current_branch} />
            )}
          </div>
        </div>

        {resolvingConflictFile && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'var(--bg-base)', display: 'flex', flexDirection: 'column' }}>
            <ConflictResolver
              repoPath={repoPath}
              filePath={resolvingConflictFile}
              operationContext={conflictOperation ?? undefined}
              onResolved={handleConflictResolved}
              onCancel={() => {
                setResolvingConflictFile(null);
                setConflictOperation(null);
              }}
            />
          </div>
        )}

        {fileHistoryPath && repoPath && (
          <FileHistoryModal
            repoPath={repoPath}
            filePath={fileHistoryPath}
            onClose={() => setFileHistoryPath(null)}
          />
        )}

        {showQuickRepo && (
          <QuickRepoModal
            repos={savedRepos}
            activeRepoPath={repoPath}
            onSelect={(path) => { openRepoWithReset(path); setShowQuickRepo(false); }}
            onClose={() => setShowQuickRepo(false)}
          />
        )}

        {showCherryQuick && repoPath && (
          <CherryPickQuickModal
            repoPath={repoPath}
            currentBranch={repoInfo?.current_branch}
            onClose={() => setShowCherryQuick(false)}
            onRefresh={refreshAll}
          />
        )}

        {showShortcutHelp && (
          <ShortcutHelpModal onClose={() => setShowShortcutHelp(false)} />
        )}

        {showSyncModal && repoPath && repoInfo?.current_branch && (
          <SyncModal
            repoPath={repoPath}
            currentBranch={repoInfo.current_branch}
            onClose={() => setShowSyncModal(false)}
            onRefresh={refreshAll}
          />
        )}

        {showQuickBranch && repoPath && (
          <QuickBranchModal
            repoPath={repoPath}
            currentBranch={repoInfo?.current_branch ?? ''}
            hasUncommittedChanges={(repoInfo?.files?.length ?? 0) > 0}
            onBranchSwitch={refreshAll}
            onConflictOperation={handleConflictDetected}
            onClose={() => setShowQuickBranch(false)}
          />
        )}

        {showBatchDelete && repoPath && (
          <BatchDeleteBranchesModal
            repoPath={repoPath}
            currentBranch={repoInfo?.current_branch ?? ''}
            onClose={() => setShowBatchDelete(false)}
            onRefresh={refreshAll}
          />
        )}

        {confirmAction && (
          <div className="modal-backdrop" onClick={() => setConfirmAction(null)}>
            <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 400 }}>
              <h3 className="modal-title" style={{ fontSize: 15 }}>Confirmar</h3>
              <p className="modal-desc" style={{ whiteSpace: 'pre-wrap' }}>{confirmAction.message}</p>
              <div className="modal-actions">
                <button className="btn-secondary" onClick={() => setConfirmAction(null)}>Cancelar</button>
                <button className="btn-primary" onClick={confirmAction.onConfirm} style={{ background: 'var(--red)', color: 'white' }}>Confirmar</button>
              </div>
            </div>
          </div>
        )}

        <Footer
          repoPath={repoPath}
          currentBranch={repoInfo?.current_branch}
          fileCount={repoInfo?.files?.length ?? 0}
          onOpenShortcuts={() => setShowShortcutHelp(true)}
        />
      </div>
    </ErrorBoundary>
  );
}

export default App;
