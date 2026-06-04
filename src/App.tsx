import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { RepoInfo, ActivePanel } from './types';
import { Navbar } from './components/Navbar';
import { useRepos, AddRepoModal, CloneRepoModal } from './components/RepoManager';
import { FileList } from './components/FileList';
import { DiffViewer } from './components/DiffViewer';
import { CommitPanel } from './components/CommitPanel';
import { BranchManager } from './components/BranchManager';
import { HistoryPanel } from './components/history/HistoryPanel';
import { ConflictResolver } from './components/ConflictResolver/index';
import { OperationStatusBar } from './components/OperationStatusBar';
import './App.css';

export type ConflictOperation = {
  type: 'merge' | 'rebase' | 'cherry-pick';
  originalBranch?: string;
};

function App() {
  const [, setRefreshTrigger] = useState(0);
  const [repoPath, setRepoPath] = useState('');
  const [repoInfo, setRepoInfo] = useState<RepoInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileDiff, setFileDiff] = useState('');
  const [activePanel, setActivePanel] = useState<ActivePanel>('diff');

  const [resolvingConflictFile, setResolvingConflictFile] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showCloneModal, setShowCloneModal] = useState(false);

  const [users, setUsers] = useState<{name: string; email: string}[]>(() => {
    const saved = localStorage.getItem('tarugit_users');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {}
    }
    return [{ name: "Desarrollador 1", email: "dev1@empresa.com" }];
  });

  const handleAddUser = () => {
    const name = prompt('Nombre del usuario (ej: Juan Pérez):');
    if (!name) return;
    const email = prompt('Correo del usuario (ej: juan@empresa.com):');
    if (!email) return;
    
    const newUsers = [...users, { name, email }];
    setUsers(newUsers);
    localStorage.setItem('tarugit_users', JSON.stringify(newUsers));
  };

  const { sorted: savedRepos, addRepo, removeRepo } = useRepos(repoPath);

  // Contexto de la operación que generó conflictos (merge / rebase / cherry-pick)
  const [conflictOperation, setConflictOperation] = useState<ConflictOperation | null>(null);

  // Auto-refresh cada 4 segundos cuando hay repo abierto
  useEffect(() => {
    if (!repoPath) return;
    const id = setInterval(() => { if (!loading && !resolvingConflictFile) refreshStatus(); }, 4000);
    return () => clearInterval(id);
  }, [repoPath, loading, resolvingConflictFile]);

  const refreshStatus = async () => {
    if (!repoPath) return;
    try {
      const result = await invoke<RepoInfo>('get_repo_status', { repoPath });
      setRepoInfo(result);
    } catch (_) { }
  };

  const handleOperationAborted = async () => {
    await refreshStatus();
    setResolvingConflictFile(null);
    setConflictOperation(null);
    setRefreshTrigger(prev => prev + 1);
  };

  // Abre un repositorio dado su path
  const openRepo = async (path?: string) => {
    const targetPath = path ?? repoPath;
    if (!targetPath) return;
    setLoading(true);
    try {
      const result = await invoke<RepoInfo>('open_repository', { path: targetPath });
      setRepoPath(targetPath);
      setRepoInfo(result);
      setSelectedFile(null);
      setFileDiff('');
      setActivePanel('diff');
      setResolvingConflictFile(null);
      setConflictOperation(null);
    } catch (e) {
      alert(`Error al abrir: ${e}`);
    } finally {
      setLoading(false);
    }
  };

  const cloneRepo = async (url: string, targetPath: string) => {
    setLoading(true);
    try {
      const result = await invoke<RepoInfo>('clone_repository', { url, path: targetPath });
      setRepoPath(targetPath);
      setRepoInfo(result);
      alert('✅ Repositorio clonado exitosamente');
    } catch (e) {
      alert(`Error al clonar: ${e}`);
    } finally {
      setLoading(false);
    }
  };

  const makeCommit = async (message: string, user?: { name: string; email: string }) => {
    setLoading(true);
    try {
      await invoke<string>('commit_changes', { 
        repoPath, 
        message,
        authorName: user?.name,
        authorEmail: user?.email
      });
      alert('✅ Commit realizado');
      await refreshStatus();
      setSelectedFile(null);
      setFileDiff('');
    } catch (e) {
      alert(`Error en commit: ${e}`);
    } finally {
      setLoading(false);
    }
  };

  const discardChanges = async (filePath: string) => {
    if (!confirm(`¿Descartar cambios en "${filePath}"?`)) return;
    setLoading(true);
    try {
      await invoke('discard_changes', { repoPath, filePath });
      await refreshStatus();
      if (selectedFile === filePath) { setSelectedFile(null); setFileDiff(''); }
      if (resolvingConflictFile === filePath) { setResolvingConflictFile(null); }
    } catch (e) {
      alert(`Error al descartar: ${e}`);
    } finally {
      setLoading(false);
    }
  };

  const viewDiff = async (filePath: string) => {
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
    } catch (_) {
      setFileDiff('');
    } finally {
      setLoading(false);
    }
  };

  const handleBranchSwitch = async () => {
    await refreshStatus();
    setSelectedFile(null);
    setFileDiff('');
    setResolvingConflictFile(null);
  };

  // Callback para cuando BranchManager o HistoryPanel detectan conflictos
  const handleConflictDetected = async (op: ConflictOperation) => {
    setConflictOperation(op);
    await refreshStatus();
    setSelectedFile(null);
    setFileDiff('');
    setActivePanel('diff');
    alert(`⚠️ Se detectaron conflictos durante el ${op.type}. Por favor, selecciona los archivos en conflicto en la lista de cambios pendientes para resolverlos.`);
  };

  const handleConflictResolved = async () => {
    setConflictOperation(null);
    setResolvingConflictFile(null);
    setSelectedFile(null);
    setFileDiff('');
    await refreshStatus();
  };

  return (
    <div className="app">
      <Navbar
        repoInfo={repoInfo}
        activePanel={activePanel}
        onPanelChange={setActivePanel}
        repos={savedRepos}
        activeRepoPath={repoPath}
        onSelectRepo={(path) => openRepo(path)}
        onRemoveRepo={removeRepo}
        onAddRepo={() => setShowAddModal(true)}
        onCloneRepo={() => setShowCloneModal(true)}
      />

      {/* Modales de repositorio */}
      {showAddModal && (
        <AddRepoModal
          onAdd={(path) => { addRepo(path); openRepo(path); setShowAddModal(false); }}
          onClose={() => setShowAddModal(false)}
        />
      )}
      {showCloneModal && (
        <CloneRepoModal
          onClone={(url, path) => { cloneRepo(url, path); addRepo(path); setShowCloneModal(false); }}
          onClose={() => setShowCloneModal(false)}
        />
      )}

      {/* Barra de estado de operación en curso */}
      {repoPath && (
        <OperationStatusBar
          repoPath={repoPath}
          onOperationAborted={handleOperationAborted}
          onOperationContinued={() => {
            refreshStatus();
            setRefreshTrigger(prev => prev + 1);
          }}
        />
      )}


      <div className="layout">
        {/* Columna izquierda colapsable */}
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
              <div className="file-section">
                <div className="file-section-header">
                  <span className="file-section-title">📁 Cambios pendientes</span>
                  <span className="file-section-count">{repoInfo.files.length}</span>
                </div>
                <FileList
                  files={repoInfo.files}
                  selectedFile={selectedFile}
                  loading={loading}
                  onSelectFile={viewDiff}
                  onDiscardFile={discardChanges}
                />
              </div>
              <CommitPanel
                fileCount={repoInfo.files.length}
                loading={loading}
                onCommit={makeCommit}
                users={users}
                onAddUser={handleAddUser}
              />
            </>
          )}
        </div>

        {/* Columna derecha: panel activo */}
        <div className="right-col">
          {activePanel === 'diff' && (
            <DiffViewer
              selectedFile={selectedFile}
              diffContent={fileDiff}
              loading={loading}
              onClose={() => { setSelectedFile(null); setFileDiff(''); }}
            />
          )}
          {activePanel === 'branches' && repoInfo && (
            <BranchManager
              repoPath={repoPath}
              currentBranch={repoInfo.current_branch}
              hasUncommittedChanges={repoInfo.files && repoInfo.files.length > 0}
              onBranchSwitch={handleBranchSwitch}
              onConflictOperation={(op) => handleConflictDetected(op)}
            />
          )}
          {activePanel === 'history' && repoInfo && (
            <HistoryPanel
              repoPath={repoPath}
              currentBranch={repoInfo.current_branch}
              onRefresh={handleBranchSwitch}
              onConflictOperation={(op) => handleConflictDetected(op)}
            />
          )}
        </div>
      </div>

      {/* ConflictResolver como overlay full-screen */}
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
    </div>
  );
}

export default App;
