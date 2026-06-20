import { useState, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Navbar } from './components/Navbar';
import { useRepos, AddRepoModal, CloneRepoModal } from './components/RepoManager';
import { FileList } from './components/FileList';
import { DiffViewer } from './components/DiffViewer';
import { CommitPanel } from './components/CommitPanel';
import { HistoryPanel, ExtendedCommitInfo } from './components/history/HistoryPanel';
import { FileDiffViewer } from './components/history/FileDiffViewer';
import { formatDate } from './components/history/utils';
import { ConflictResolver } from './components/ConflictResolver/index';
import { OperationStatusBar } from './components/OperationStatusBar';
import { Footer } from './components/Footer';
import { StashPanel } from './components/StashPanel';
import { CreateStashModal } from './components/CreateStashModal';
import { TagPanel } from './components/TagPanel';
import { ToastContainer, toast } from './components/Toast';
import { ErrorBoundary } from './components/ErrorBoundary';
import { UserModal } from './components/UserModal';
import { useRepository } from './hooks/useRepository';
import { useUsers } from './hooks/useUsers';
import { useStash } from './hooks/useStash';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import './App.css';

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
    handleAddUser, saveNewUser,
  } = useUsers();

  const {
    stashes, setStashes, showStashModal, setShowStashModal,
    handleSaveStash,
  } = useStash();

  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileDiff, setFileDiff] = useState('');
  const [leftTab, setLeftTab] = useState<'changes' | 'history' | 'stash' | 'tags'>('changes');
  const [activePanel, setActivePanel] = useState<'diff' | 'branches'>('diff');
  const [selectedCommitInfo, setSelectedCommitInfo] = useState<ExtendedCommitInfo | null>(null);
  const [commitFileDiffs, setCommitFileDiffs] = useState<{ path: string; diff: string; additions: number; deletions: number }[]>([]);
  const [resolvingConflictFile, setResolvingConflictFile] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showCloneModal, setShowCloneModal] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{ message: string; onConfirm: () => void } | null>(null);

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

  const handleStashSave = useCallback(async (message: string, includeUntracked: boolean, filesToStash: string[] | null) => {
    await handleSaveStash(repoPath, message, includeUntracked, filesToStash, refreshAll);
  }, [repoPath, handleSaveStash, refreshAll]);

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

  useKeyboardShortcuts({
    'ctrl+b': () => setSidebarCollapsed(v => !v),
    'ctrl+1': () => setLeftTab('changes'),
    'ctrl+2': () => setLeftTab('history'),
    'ctrl+3': () => setLeftTab('stash'),
    'ctrl+4': () => setLeftTab('tags'),
  });

  return (
    <ErrorBoundary>
      <div className="app">
        <ToastContainer />
        <Navbar
          repoInfo={repoInfo}
          repos={savedRepos}
          activeRepoPath={repoPath}
          onSelectRepo={openRepoWithReset}
          onAddRepo={() => setShowAddModal(true)}
          onCloneRepo={() => setShowCloneModal(true)}
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
          <div className={`left-col${sidebarCollapsed ? ' left-col--collapsed' : ''}`}>
            <button
              className="sidebar-toggle"
              onClick={() => setSidebarCollapsed(v => !v)}
              title={sidebarCollapsed ? 'Expandir panel' : 'Colapsar panel'}
            >
              {sidebarCollapsed ? '›' : '‹'}
            </button>

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
                        files={repoInfo.files}
                        selectedFile={selectedFile}
                        loading={loading}
                        onSelectFile={viewDiff}
                        onDiscardFile={discardChanges}
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
                      onClick={() => { setSelectedCommitInfo(null); setCommitFileDiffs([]); }}
                    >✕</button>
                  </div>
                  <div className="diff-body" style={{ padding: '10px' }}>
                    <FileDiffViewer fileDiffs={commitFileDiffs} loading={false} />
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
        />
      </div>
    </ErrorBoundary>
  );
}

export default App;
