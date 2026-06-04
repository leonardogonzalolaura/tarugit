import { useState, useEffect, useRef } from 'react';

export interface SavedRepo {
  id: string;
  path: string;
  name: string;
  addedAt: number;
  lastOpenedAt: number;
  currentBranch?: string;
  hasChanges?: boolean;
}

export const STORAGE_KEY = 'tarugit_repos';

function loadSavedRepos(): SavedRepo[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); }
  catch { return []; }
}

function saveRepos(repos: SavedRepo[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(repos));
}

function repoNameFromPath(path: string): string {
  return path.replace(/\\/g, '/').split('/').filter(Boolean).pop() ?? path;
}

export function useRepos(activeRepoPath: string) {
  const [repos, setRepos] = useState<SavedRepo[]>(loadSavedRepos);

  useEffect(() => {
    if (!activeRepoPath) return;
    setRepos(prev => {
      const exists = prev.find(r => r.path === activeRepoPath);
      if (!exists) return prev;
      const updated = prev.map(r =>
        r.path === activeRepoPath ? { ...r, lastOpenedAt: Date.now() } : r
      );
      saveRepos(updated);
      return updated;
    });
  }, [activeRepoPath]);

  const addRepo = (path: string) => {
    const trimmed = path.trim();
    if (!trimmed) return;
    setRepos(prev => {
      const exists = prev.find(r => r.path === trimmed);
      if (exists) {
        const updated = prev.map(r => r.path === trimmed ? { ...r, lastOpenedAt: Date.now() } : r);
        saveRepos(updated);
        return updated;
      }
      const updated = [{ id: crypto.randomUUID(), path: trimmed, name: repoNameFromPath(trimmed), addedAt: Date.now(), lastOpenedAt: Date.now() }, ...prev];
      saveRepos(updated);
      return updated;
    });
  };

  const removeRepo = (id: string) => {
    setRepos(prev => { const updated = prev.filter(r => r.id !== id); saveRepos(updated); return updated; });
  };

  const sorted = [...repos].sort((a, b) => {
    if (a.path === activeRepoPath) return -1;
    if (b.path === activeRepoPath) return 1;
    return b.lastOpenedAt - a.lastOpenedAt;
  });

  return { repos, sorted, addRepo, removeRepo };
}

// ── Modal: Agregar repositorio ────────────────────────────────────────────────

export function AddRepoModal({ onAdd, onClose }: { onAdd: (path: string) => void; onClose: () => void }) {
  const [path, setPath] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ maxWidth: '440px' }} onClick={e => e.stopPropagation()}>
        <div className="modal-icon">📂</div>
        <h3 className="modal-title">Agregar Repositorio</h3>
        <p className="modal-desc">Ingresa la ruta de la carpeta del repositorio Git local:</p>
        <form onSubmit={e => { e.preventDefault(); if (path.trim()) onAdd(path.trim()); }} style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <input
            ref={inputRef}
            className="repo-input"
            style={{ margin: 0, width: '100%', fontSize: '12px', padding: '9px 12px' }}
            placeholder="C:\ruta\al\repositorio o /home/user/repo"
            value={path}
            onChange={e => setPath(e.target.value)}
          />
          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn-primary" disabled={!path.trim()}>📂 Abrir Repositorio</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Modal: Clonar repositorio ─────────────────────────────────────────────────

export function CloneRepoModal({ onClone, onClose }: { onClone: (url: string, path: string) => void; onClose: () => void }) {
  const [url, setUrl] = useState('');
  const [targetPath, setTargetPath] = useState('');
  const urlRef = useRef<HTMLInputElement>(null);

  useEffect(() => { urlRef.current?.focus(); }, []);

  useEffect(() => {
    if (!url) return;
    try {
      const repoName = url.replace(/\.git$/, '').split('/').pop() ?? '';
      if (repoName) setTargetPath(prev => prev || repoName);
    } catch { }
  }, [url]);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ maxWidth: '480px' }} onClick={e => e.stopPropagation()}>
        <div className="modal-icon">📥</div>
        <h3 className="modal-title">Clonar Repositorio</h3>
        <p className="modal-desc">Clona un repositorio remoto en tu máquina:</p>
        <form onSubmit={e => { e.preventDefault(); if (url.trim() && targetPath.trim()) onClone(url.trim(), targetPath.trim()); }} style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div>
            <label style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '5px' }}>URL del repositorio</label>
            <input ref={urlRef} className="repo-input" style={{ margin: 0, width: '100%' }} placeholder="https://github.com/usuario/repo.git" value={url} onChange={e => setUrl(e.target.value)} />
          </div>
          <div>
            <label style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '5px' }}>Carpeta destino</label>
            <input className="repo-input" style={{ margin: 0, width: '100%' }} placeholder="C:\proyectos\mi-repo" value={targetPath} onChange={e => setTargetPath(e.target.value)} />
          </div>
          <div className="modal-actions" style={{ marginTop: '4px' }}>
            <button type="button" className="btn-secondary" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn-primary" disabled={!url.trim() || !targetPath.trim()}>⬇️ Clonar</button>
          </div>
        </form>
      </div>
    </div>
  );
}
