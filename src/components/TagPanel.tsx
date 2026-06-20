import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { toast } from './Toast';

interface TagInfo {
  name: string;
  commit_id: string;
  message: string;
}

interface TagPanelProps {
  repoPath: string;
}

export function TagPanel({ repoPath }: TagPanelProps) {
  const [tags, setTags] = useState<TagInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [newTagMessage, setNewTagMessage] = useState('');
  const [showCreate, setShowCreate] = useState(false);

  const loadTags = useCallback(async () => {
    setLoading(true);
    try {
      const result = await invoke<TagInfo[]>('list_tags', { repoPath });
      setTags(result);
    } catch (e) {
      console.error('Error loading tags:', e);
    } finally {
      setLoading(false);
    }
  }, [repoPath]);

  useEffect(() => { loadTags(); }, [loadTags]);

  const handleCreate = async () => {
    if (!newTagName.trim()) return;
    setLoading(true);
    try {
      await invoke('create_tag', {
        repoPath,
        tagName: newTagName.trim(),
        message: newTagMessage.trim() || null,
      });
      toast.success(`Tag '${newTagName}' creado`);
      setNewTagName('');
      setNewTagMessage('');
      setShowCreate(false);
      await loadTags();
    } catch (e) {
      toast.error(`Error al crear tag: ${e}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (tagName: string) => {
    setLoading(true);
    try {
      await invoke('delete_tag', { repoPath, tagName });
      toast.success(`Tag '${tagName}' eliminado`);
      await loadTags();
    } catch (e) {
      toast.error(`Error al eliminar tag: ${e}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div className="panel-header" style={{ padding: '7px 10px 5px' }}>
        <span className="panel-title" style={{ fontSize: 11, fontWeight: 600 }}>🏷️ Tags</span>
        <button className="btn-icon" style={{ width: 24, height: 24, fontSize: 13 }}
          onClick={() => setShowCreate(!showCreate)} title="Crear tag">+</button>
      </div>

      {showCreate && (
        <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <input
            className="search-input"
            placeholder="Nombre del tag (ej: v1.0.0)"
            value={newTagName}
            onChange={e => setNewTagName(e.target.value)}
            style={{ fontSize: 11, padding: '5px 8px' }}
            autoFocus
          />
          <input
            className="search-input"
            placeholder="Mensaje (opcional)"
            value={newTagMessage}
            onChange={e => setNewTagMessage(e.target.value)}
            style={{ fontSize: 11, padding: '5px 8px' }}
          />
          <div style={{ display: 'flex', gap: '6px' }}>
            <button className="btn-primary" onClick={handleCreate}
              disabled={loading || !newTagName.trim()}
              style={{ flex: 1, fontSize: 11, padding: '5px' }}>Crear</button>
            <button className="btn-secondary" onClick={() => setShowCreate(false)}
              style={{ fontSize: 11, padding: '5px 10px' }}>Cancelar</button>
          </div>
        </div>
      )}

      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 6px' }}>
        {loading && tags.length === 0 ? (
          <div className="panel-loading"><span className="spinner-sm" /> Cargando tags...</div>
        ) : tags.length === 0 ? (
          <div className="panel-empty">Sin tags</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {tags.map(tag => (
              <div key={tag.name}
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  padding: '5px 8px', borderRadius: 'var(--radius-sm)',
                  border: '1px solid transparent', fontSize: 11,
                  transition: 'all 0.12s'
                }}
                className="file-item"
              >
                <span>🏷️</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {tag.name}
                  </div>
                  {tag.message && (
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {tag.message}
                    </div>
                  )}
                  {tag.commit_id && (
                    <div style={{ fontSize: 9, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                      {tag.commit_id.slice(0, 8)}
                    </div>
                  )}
                </div>
                <button className="btn-discard" title="Eliminar tag"
                  onClick={(e) => { e.stopPropagation(); if (confirm(`¿Eliminar tag "${tag.name}"?`)) handleDelete(tag.name); }}
                  style={{ opacity: 0.3, fontSize: 11 }}>🗑️</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
