import { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import Editor, { OnMount } from '@monaco-editor/react';

interface DiffViewerProps {
  selectedFile: string | null;
  diffContent: string;
  loading: boolean;
  onClose: () => void;
  repoPath?: string;
  onFileSaved?: () => void;
}


function getLanguageForDisplay(filePath: string): string {
  if (!filePath) return 'text';
  const extension = filePath.split('.').pop()?.toLowerCase() || '';
  const languageMap: Record<string, string> = {
    'js': 'JavaScript', 'jsx': 'React', 'ts': 'TypeScript', 'tsx': 'TypeScript React',
    'html': 'HTML', 'htm': 'HTML', 'css': 'CSS', 'scss': 'SCSS',
    'py': 'Python', 'java': 'Java', 'c': 'C', 'cpp': 'C++', 'cs': 'C#',
    'go': 'Go', 'rs': 'Rust', 'php': 'PHP', 'rb': 'Ruby',
    'swift': 'Swift', 'kt': 'Kotlin', 'scala': 'Scala',
    'json': 'JSON', 'yaml': 'YAML', 'yml': 'YAML', 'xml': 'XML',
    'sql': 'SQL', 'md': 'Markdown', 'conf': 'Config', 'config': 'Config', 'txt': 'Text',
  };
  return languageMap[extension] || 'Text';
}

// Mapa de extensión → lenguaje Monaco
function getMonacoLanguage(filePath: string): string {
  if (!filePath) return 'plaintext';
  const extension = filePath.split('.').pop()?.toLowerCase() || '';
  const monacoMap: Record<string, string> = {
    'js': 'javascript', 'jsx': 'javascript', 'ts': 'typescript', 'tsx': 'typescript',
    'html': 'html', 'htm': 'html', 'css': 'css', 'scss': 'scss',
    'py': 'python', 'java': 'java', 'c': 'c', 'cpp': 'cpp', 'cs': 'csharp',
    'go': 'go', 'rs': 'rust', 'php': 'php', 'rb': 'ruby',
    'swift': 'swift', 'kt': 'kotlin', 'scala': 'scala',
    'json': 'json', 'yaml': 'yaml', 'yml': 'yaml', 'xml': 'xml',
    'sql': 'sql', 'md': 'markdown', 'sh': 'shell', 'bash': 'shell',
    'toml': 'ini', 'conf': 'ini', 'config': 'ini',
  };
  return monacoMap[extension] || 'plaintext';
}

// Renderizar líneas de diff con colores (verde/rojo)
function renderDiffLines(raw: string) {
  if (!raw || raw === 'NO_CHANGES') {
    return (
      <div className="diff-empty">
        <span>📄</span>
        <p>No hay cambios en este archivo</p>
      </div>
    );
  }

  const lines = raw.split('\n');

  return (
    <div className="diff-lines">
      {lines.map((line, i) => {
        const first = line[0];
        let cls = 'diff-line-ctx';
        if (first === '+') cls = 'diff-line-add';
        else if (first === '-') cls = 'diff-line-del';
        else if (first === '@') cls = 'diff-line-hunk';

        return (
          <div key={i} className={`diff-line ${cls}`}>
            <span className="diff-line-num">{i + 1}</span>
            <span className="diff-line-marker">{first === '+' || first === '-' ? first : ' '}</span>
            <span className="diff-line-text">{line.slice(1)}</span>
          </div>
        );
      })}
    </div>
  );
}

export function DiffViewer({ selectedFile, diffContent, loading, onClose, repoPath, onFileSaved }: DiffViewerProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [fileContent, setFileContent] = useState('');
  const [originalContent, setOriginalContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const language = selectedFile ? getLanguageForDisplay(selectedFile) : 'text';
  const monacoLanguage = selectedFile ? getMonacoLanguage(selectedFile) : 'plaintext';

  const GITIGNORE_TEMPLATE = `# Dependencies
node_modules/
.pnp
.pnp.js

# Build outputs
dist/
build/
target/
*.tsbuildinfo

# Environment files
.env
.env.local
.env.*.local

# IDE
.vscode/
.idea/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Logs
*.log
npm-debug.log*
`;

  const DEFAULT_TEMPLATES: Record<string, string> = {
    '.gitignore': GITIGNORE_TEMPLATE,
  };

  const loadCurrentFileContent = async () => {
    if (!selectedFile || !repoPath) return;
    
    try {
      const content = await invoke<string>('read_file_content', { 
        repoPath, 
        filePath: selectedFile
      });
      setOriginalContent(content);
      setFileContent(content);
      setError(null);
    } catch (err) {
      // If file doesn't exist, provide a default template for known files
      const template = DEFAULT_TEMPLATES[selectedFile];
      if (template) {
        setOriginalContent(template);
        setFileContent(template);
        setError(null);
      } else {
        console.error('Error al cargar archivo:', err);
        setError('No se pudo cargar el contenido del archivo');
      }
    }
  };

  const handleSave = async () => {
    if (!selectedFile || !repoPath) return;
    
    setSaving(true);
    setError(null);
    
    try {
      await invoke('write_file_content', {
        repoPath,
        filePath: selectedFile,
        content: fileContent
      });
      
      setIsEditing(false);
      
      if (onFileSaved) {
        onFileSaved();
      }
      
    } catch (err) {
      console.error('Error al guardar:', err);
      setError('Error al guardar el archivo');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setFileContent('');
    setOriginalContent('');
    setError(null);
  };

  if (!selectedFile) {
    return (
      <div className="welcome-panel">
        <div className="welcome-icon">
          <span style={{ color: 'pink', fontSize: '48px' }}>♉</span>
        </div>
        <h2 className="welcome-title">Bienvenido a TaruGit</h2>
        <p className="welcome-sub">Selecciona un archivo para ver sus cambios</p>
        <div className="welcome-features">
          <div className="feature-card">
            <span>🎨</span>
            <span>Diff con colores</span>
          </div>
          <div className="feature-card">
            <span>🌿</span>
            <span>Gestión de ramas</span>
          </div>
          <div className="feature-card">
            <span>🕓</span>
            <span>Historial de commits</span>
          </div>
          <div className="feature-card">
            <span>⚡</span>
            <span>Motor en Rust</span>
          </div>
        </div>
      </div>
    );
  }

  const parts = selectedFile.replace(/\\/g, '/').split('/');
  const filename = parts.pop() ?? selectedFile;
  const dir = parts.join('/');

  const addCount = (diffContent.match(/^\+/gm) ?? []).length;
  const delCount = (diffContent.match(/^-/gm) ?? []).length;

  return (
    <div className="diff-panel">
      <div className="diff-header">
        <div className="diff-file-path">
          {dir && <span className="diff-dir">{dir}/</span>}
          <span className="diff-filename">{filename}</span>
          <span className="diff-language-badge">{language}</span>
        </div>
        <div className="diff-stats">
          {!isEditing && addCount > 0 && <span className="diff-stat-add">+{addCount}</span>}
          {!isEditing && delCount > 0 && <span className="diff-stat-del">-{delCount}</span>}
          {isEditing && (
            <div className="edit-indicator">
              <span>✏️ Editando</span>
            </div>
          )}
        </div>
        <div className="diff-actions">
          {!isEditing && (
            <button 
              className="btn-edit" 
              onClick={() => {
                setIsEditing(true);
                loadCurrentFileContent();
              }}
              title="Editar archivo"
            >
              ✏️
            </button>
          )}
          <button className="btn-close" onClick={onClose}>✕</button>
        </div>
      </div>

      <div className="diff-body">
        {loading && !isEditing ? (
          <div className="diff-loading"><span className="spinner" /> Cargando...</div>
        ) : isEditing ? (
          <div className="edit-mode">
            {error && (
              <div className="error-message">
                ⚠️ {error}
              </div>
            )}
            <div className="edit-header">
              <span className="edit-language-info">Editando {language}</span>
              <span className="edit-shortcuts">
                <kbd>Ctrl+S</kbd> guardar | <kbd>Tab</kbd> indentar
              </span>
            </div>
            <div className="monaco-container">
              <Editor
                height="100%"
                language={monacoLanguage}
                value={fileContent}
                theme="vs-dark"
                onChange={(val) => setFileContent(val ?? '')}
                options={{
                  fontSize: 13,
                  fontFamily: 'var(--font-mono), "Cascadia Code", "Fira Code", Consolas, monospace',
                  lineHeight: 1.6,
                  minimap: { enabled: false },
                  scrollBeyondLastLine: false,
                  wordWrap: 'on',
                  tabSize: 2,
                  automaticLayout: true,
                  padding: { top: 12, bottom: 12 },
                  scrollbar: { verticalScrollbarSize: 8, horizontalScrollbarSize: 8 },
                  suggest: { showWords: false },
                  quickSuggestions: false,
                }}
                onMount={((editor, monaco) => {
                  editor.focus();
                  // Ctrl+S para guardar desde Monaco
                  editor.addCommand(
                    monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS,
                    () => handleSave()
                  );
                }) as OnMount}
              />
            </div>
            <div className="edit-actions">
              <button 
                className="btn-secondary" 
                onClick={handleCancel}
                disabled={saving}
              >
                Cancelar
              </button>
              <button 
                className="btn-primary" 
                onClick={handleSave}
                disabled={saving || fileContent === originalContent}
              >
                {saving ? 'Guardando...' : '💾 Guardar Cambios'}
              </button>
            </div>
            <div className="edit-hint">
              💡 Tip: Usa <kbd>Ctrl+S</kbd> para guardar | <kbd>Tab</kbd> para indentar
            </div>
          </div>
        ) : (
          renderDiffLines(diffContent)
        )}
      </div>
    </div>
  );
}