import { FileStatus } from '../types';

interface FileListProps {
  files: FileStatus[];
  selectedFile: string | null;
  loading: boolean;
  onSelectFile: (path: string) => void;
  onDiscardFile: (path: string) => void;
}

const STATUS_META: Record<string, { icon: string; label: string; cls: string }> = {
  modified:  { icon: '✏️',  label: 'M', cls: 'status-modified'  },
  untracked: { icon: '❓',  label: 'U', cls: 'status-untracked' },
  deleted:   { icon: '🗑️', label: 'D', cls: 'status-deleted'   },
  conflicted: { icon: '⚠️', label: 'C', cls: 'status-conflicted' },
  unknown:   { icon: '📄',  label: '?', cls: 'status-unknown'   },
};

export function FileList({ files, selectedFile, loading, onSelectFile, onDiscardFile }: FileListProps) {
  if (files.length === 0) {
    return (
      <div className="file-list-empty">
        <span style={{ fontSize: 36 }}>✨</span>
        <p>Sin cambios pendientes</p>
      </div>
    );
  }

  const conflicted = files.filter(f => f.status === 'conflicted');
  const normal = files.filter(f => f.status !== 'conflicted');

  const renderFileRow = (file: FileStatus) => {
    const meta = STATUS_META[file.status] ?? STATUS_META.unknown;
    const isSelected = selectedFile === file.path;

    const parts = file.path.replace(/\\/g, '/').split('/');
    const filename = parts.pop() ?? file.path;
    const dir = parts.join('/');

    return (
      <div
        key={file.path}
        className={`file-item ${isSelected ? 'selected' : ''}`}
        onClick={() => onSelectFile(file.path)}
        style={file.status === 'conflicted' ? { borderLeft: '3px solid var(--red)' } : {}}
      >
        <span className={`file-status-badge ${meta.cls}`}>{meta.label}</span>
        <div className="file-names">
          {dir && <span className="file-dir">{dir}/</span>}
          <span className="file-name">{filename}</span>
        </div>
        <button
          className="btn-discard"
          onClick={(e) => { e.stopPropagation(); onDiscardFile(file.path); }}
          disabled={loading}
          title="Descartar cambios"
        >
          🗑
        </button>
      </div>
    );
  };

  return (
    <div className="file-list-sections" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Sección especial de conflictos */}
      {conflicted.length > 0 && (
        <div className="conflicted-files-section" style={{
          background: 'rgba(248, 113, 113, 0.05)',
          border: '1px solid rgba(248, 113, 113, 0.15)',
          borderRadius: 'var(--radius-sm)',
          padding: '8px 4px 10px'
        }}>
          <div style={{
            color: 'var(--red)',
            fontSize: '11px',
            fontWeight: 'bold',
            letterSpacing: '0.5px',
            padding: '2px 8px 8px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}>
            <span>⚠️</span> ARCHIVOS CON CONFLICTO ({conflicted.length})
          </div>
          <div className="file-list" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {conflicted.map(renderFileRow)}
          </div>
        </div>
      )}

      {/* Sección estándar de cambios pendientes */}
      {normal.length > 0 && (
        <div className="normal-files-section">
          {conflicted.length > 0 && (
            <div style={{
              color: 'var(--text-secondary)',
              fontSize: '11px',
              fontWeight: 'bold',
              letterSpacing: '0.5px',
              padding: '2px 8px 8px'
            }}>
              📁 OTROS CAMBIOS ({normal.length})
            </div>
          )}
          <div className="file-list" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {normal.map(renderFileRow)}
          </div>
        </div>
      )}
    </div>
  );
}
