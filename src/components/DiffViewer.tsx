import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { EditorView, basicSetup } from 'codemirror';
import { EditorState } from '@codemirror/state';
import { keymap, GutterMarker, gutter } from '@codemirror/view';
import { javascript } from '@codemirror/lang-javascript';
import { json } from '@codemirror/lang-json';
import { python } from '@codemirror/lang-python';
import { html } from '@codemirror/lang-html';
import { xml } from '@codemirror/lang-xml';
import { markdown } from '@codemirror/lang-markdown';
import { rust } from '@codemirror/lang-rust';
import { sql } from '@codemirror/lang-sql';
import { yaml } from '@codemirror/lang-yaml';
import { java } from '@codemirror/lang-java';
import { cpp } from '@codemirror/lang-cpp';
import { php } from '@codemirror/lang-php';
import * as Diff from 'diff';
import { FileHierarchyModal } from './FileHierarchyModal';

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

function getCodeMirrorLang(filePath: string) {
  if (!filePath) return undefined;
  const ext = filePath.split('.').pop()?.toLowerCase() || '';
  const map: Record<string, () => import('@codemirror/language').LanguageSupport> = {
    js: () => javascript({ typescript: false }),
    jsx: () => javascript({ jsx: true }),
    ts: () => javascript({ typescript: true }),
    tsx: () => javascript({ jsx: true, typescript: true }),
    html: () => html(), htm: () => html(),
    css: () => html(), scss: () => html(), // css via html() for basic highlighting
    py: () => python(), python: () => python(),
    java: () => java(),
    c: () => cpp(), cpp: () => cpp(), h: () => cpp(),
    rs: () => rust(), rust: () => rust(),
    json: () => json(),
    yaml: () => yaml(), yml: () => yaml(),
    xml: () => xml(),
    sql: () => sql(),
    md: () => markdown(), markdown: () => markdown(),
    php: () => php(),
  };
  return map[ext]?.();
}

function lineChanges(original: string, current: string): ('unchanged' | 'add' | 'mod')[] {
  if (original === current) return [];
  const parts = Diff.diffLines(original, current);
  const result: ('unchanged' | 'add' | 'mod')[] = [];
  let prevRemoved = false;
  for (const part of parts) {
    const n = part.value.replace(/\n$/, '').split('\n').length;
    if (n === 0) continue;
    if (part.added) {
      for (let i = 0; i < n; i++) result.push(prevRemoved ? 'mod' : 'add');
      prevRemoved = false;
    } else if (part.removed) {
      prevRemoved = true;
    } else {
      for (let i = 0; i < n; i++) result.push('unchanged');
      prevRemoved = false;
    }
  }
  return result;
}

const diffTheme = EditorView.theme({
  '.cm-diff-line-add .cm-line': { backgroundColor: 'rgba(61,214,140,0.10)' },
  '.cm-diff-line-mod .cm-line': { backgroundColor: 'rgba(255,193,7,0.10)' },
});

class DiffGutterMarker extends GutterMarker {
  constructor(readonly type: 'add' | 'mod') { super(); }
  toDOM() {
    const span = document.createElement('span');
    span.className = `cm-diff-gutter cm-diff-gutter-${this.type}`;
    span.textContent = this.type === 'add' ? '+' : '~';
    return span;
  }
}

let diffMapGlobal = new Map<number, 'add' | 'mod'>();

class EmptyMarker extends GutterMarker {
  toDOM() { const s = document.createElement('span'); s.style.width = '22px'; return s; }
}

const diffGutter = gutter({
  class: 'cm-diff-gutter-wrap',
  lineMarker(view, line) {
    const lineNo = view.state.doc.lineAt(line.from).number;
    const t = diffMapGlobal.get(lineNo);
    return t ? new DiffGutterMarker(t) : null;
  },
  initialSpacer() { return new EmptyMarker(); },
});

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
  const [showHierarchy, setShowHierarchy] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef<(val: string) => void>(() => {});
  const onSaveRef = useRef<() => void>(() => {});

  const handleCopy = useCallback(() => {
    if (selectedFile) navigator.clipboard.writeText(selectedFile);
  }, [selectedFile]);

  const language = selectedFile ? getLanguageForDisplay(selectedFile) : 'text';
  const cmLang = useMemo(() => selectedFile ? getCodeMirrorLang(selectedFile) : undefined, [selectedFile]);

  const changes = useMemo(() => {
    if (!isEditing || !originalContent) return [];
    return lineChanges(originalContent, fileContent);
  }, [isEditing, originalContent, fileContent]);

  const addCount = changes.filter(c => c === 'add').length;
  const modCount = changes.filter(c => c === 'mod').length;
  const isDirty = originalContent !== fileContent;

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

  const handleDiscard = () => {
    const view = viewRef.current;
    if (view) {
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: originalContent }
      });
    }
    setFileContent(originalContent);
  };

  onChangeRef.current = useCallback((val: string) => {
    setFileContent(val);
  }, []);

  onSaveRef.current = handleSave;

  useEffect(() => {
    if (!isEditing || !containerRef.current) return;

    const onChange = (val: string) => onChangeRef.current(val);
    const onSave = () => onSaveRef.current();

    const extensions: any[] = [
      basicSetup,
      diffTheme,
      diffGutter,
      keymap.of([{ key: 'Mod-s', run: () => { onSave(); return true; } }]),
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          onChange(update.state.doc.toString());
        }
      }),
      EditorView.theme({
        '&': { backgroundColor: 'transparent', height: '100%' },
        '.cm-scroller': { fontFamily: 'var(--font-mono), "Cascadia Code", "Fira Code", Consolas, monospace', fontSize: '13px' },
        '.cm-gutters': { backgroundColor: 'var(--bg-base)', borderRight: '1px solid var(--border)', color: 'var(--text-muted)' },
        '.cm-activeLineGutter': { backgroundColor: 'var(--bg-hover)' },
        '.cm-activeLine': { backgroundColor: 'transparent' },
        '.cm-cursor': { borderLeftColor: 'var(--text-primary)' },
        '.cm-content': { caretColor: 'var(--text-primary)' },
        '.cm-selectionBackground': { backgroundColor: 'var(--bg-selected) !important' },
        '.cm-selectionMatch': { backgroundColor: 'var(--bg-hover) !important' },
        '.cm-diff-gutter-wrap': { width: '22px', minWidth: '22px' },
        '.cm-diff-gutter': { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '100%', fontSize: '11px', fontWeight: 700 },
        '.cm-diff-gutter-add': { color: 'var(--green)' },
        '.cm-diff-gutter-mod': { color: '#ffc107' },
      }),
    ];

    if (cmLang) extensions.push(cmLang);

    const state = EditorState.create({
      doc: fileContent,
      extensions,
    });

    const view = new EditorView({ state, parent: containerRef.current });
    viewRef.current = view;

    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, [isEditing, cmLang]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const map = new Map<number, 'add' | 'mod'>();
    for (let i = 0; i < changes.length; i++) {
      if (changes[i] !== 'unchanged') map.set(i + 1, changes[i] as 'add' | 'mod');
    }
    diffMapGlobal = map;
    view.requestMeasure();
  }, [changes]);

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

  const viewAddCount = (diffContent.match(/^\+/gm) ?? []).length;
  const viewDelCount = (diffContent.match(/^-/gm) ?? []).length;

  return (
    <div className="diff-panel">
      <div className="diff-header">
        <div className="diff-file-path">
          {dir && <span className="diff-dir">{dir}/</span>}
          <span className="diff-filename">{filename}</span>
          <span className="diff-language-badge">{language}</span>
        </div>
        <div className="diff-stats">
          {!isEditing && viewAddCount > 0 && <span className="diff-stat-add">+{viewAddCount}</span>}
          {!isEditing && viewDelCount > 0 && <span className="diff-stat-del">-{viewDelCount}</span>}
          {isEditing && isDirty && <span className="diff-stat-mod">~{addCount + modCount}</span>}
          {isEditing && (
            <div className={`edit-indicator ${isDirty ? 'edit-dirty' : ''}`}>
              <svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor" style={{ marginRight: 4 }}>
                <path d="M11.013 1.427a1.75 1.75 0 0 1 2.474 0l1.086 1.086a1.75 1.75 0 0 1 0 2.474l-8.61 8.61c-.21.21-.47.364-.756.445l-3.251.93a.75.75 0 0 1-.927-.928l.929-3.25a1.75 1.75 0 0 1 .445-.758l8.61-8.61Zm.97 1.03a.25.25 0 0 0-.354 0L3.27 10.855a.25.25 0 0 0-.064.108l-.62 2.172 2.173-.62a.25.25 0 0 0 .108-.064l8.22-8.22a.25.25 0 0 0 0-.354Z"/>
              </svg>
              <span>Editando{isDirty ? ' *' : ''}</span>
            </div>
          )}
        </div>
        <div className="diff-actions">
          {!isEditing && (
            <>
              <button className="btn-edit" onClick={handleCopy} title="Copiar ruta">
                <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
                  <path d="M0 6.75C0 5.784.784 5 1.75 5h1.5a.75.75 0 0 1 0 1.5h-1.5a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-1.5a.75.75 0 0 1 1.5 0v1.5A1.75 1.75 0 0 1 9.25 16h-7.5A1.75 1.75 0 0 1 0 14.25Z"/>
                  <path d="M5 1.75C5 .784 5.784 0 6.75 0h7.5C15.216 0 16 .784 16 1.75v7.5A1.75 1.75 0 0 1 14.25 11h-7.5A1.75 1.75 0 0 1 5 9.25Zm1.75-.25a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-7.5a.25.25 0 0 0-.25-.25Z"/>
                </svg>
              </button>
              <button className="btn-edit" onClick={() => setShowHierarchy(true)} title="Ver jerarquía">
                <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
                  <path d="M1.75 1A1.75 1.75 0 0 0 0 2.75v2.5C0 6.216.784 7 1.75 7h2.5A1.75 1.75 0 0 0 6 5.25v-2.5A1.75 1.75 0 0 0 4.25 1ZM8 12.25A2.25 2.25 0 0 1 10.25 10h2.5A2.25 2.25 0 0 1 15 12.25v.5a2.25 2.25 0 0 1-2.25 2.25h-2.5A2.25 2.25 0 0 1 8 12.75ZM14 4.75A2.75 2.75 0 1 0 8.5 6.5L7.36 9.2a3.25 3.25 0 0 1 .98.68l1.16-2.78A2.75 2.75 0 0 0 14 4.75Z"/>
                </svg>
              </button>
            </>
          )}
          {!isEditing && (
            <button 
              className="btn-edit" 
              onClick={async () => {
                await loadCurrentFileContent();
                setIsEditing(true);
              }}
              title="Editar archivo"
            >
              <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
                <path d="M11.013 1.427a1.75 1.75 0 0 1 2.474 0l1.086 1.086a1.75 1.75 0 0 1 0 2.474l-8.61 8.61c-.21.21-.47.364-.756.445l-3.251.93a.75.75 0 0 1-.927-.928l.929-3.25a1.75 1.75 0 0 1 .445-.758l8.61-8.61Zm.97 1.03a.25.25 0 0 0-.354 0L3.27 10.855a.25.25 0 0 0-.064.108l-.62 2.172 2.173-.62a.25.25 0 0 0 .108-.064l8.22-8.22a.25.25 0 0 0 0-.354Z"/>
              </svg>
            </button>
          )}
          <button className="btn-close" onClick={onClose}>
            <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
              <path d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.75.75 0 1 1 1.06 1.06L9.06 8l3.22 3.22a.75.75 0 1 1-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 0 1-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06Z"/>
            </svg>
          </button>
        </div>
      </div>

      {showHierarchy && selectedFile && (
        <FileHierarchyModal path={selectedFile} onClose={() => setShowHierarchy(false)} />
      )}

      <div className="diff-body">
        {loading && !isEditing ? (
          <div className="diff-loading"><span className="spinner" /> Cargando...</div>
        ) : isEditing ? (
          <div className="edit-mode">
            {error && (
              <div className="error-message">
                <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor" style={{ marginRight: 4, flexShrink: 0 }}><path d="M6.457 1.047c.659-1.234 2.427-1.234 3.086 0l6.082 11.378A1.75 1.75 0 0 1 14.082 15H1.918a1.75 1.75 0 0 1-1.543-2.575ZM8 3.25a.75.75 0 0 0-.75.75v4.5a.75.75 0 0 0 1.5 0V4a.75.75 0 0 0-.75-.75Zm0 8.5a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z"/></svg>
                {error}
              </div>
            )}
            <div className="edit-header">
              <span className="edit-language-info">Editando {language}</span>
              {isDirty && (
                <span className="edit-changes-info" style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  +{addCount} {modCount > 0 ? `~${modCount}` : ''}
                </span>
              )}
              <span className="edit-shortcuts">
                <kbd>Ctrl+S</kbd> guardar
                {isDirty && <> | <kbd>Ctrl+Z</kbd> deshacer</>}
              </span>
            </div>
            <div className="edit-actions" style={{ marginTop: 0, marginBottom: 12 }}>
              <button 
                className="btn-secondary" 
                onClick={isDirty ? handleDiscard : handleCancel}
                disabled={saving}
              >
                {isDirty ? 'Descartar cambios' : 'Cancelar'}
              </button>
              <button 
                className="btn-primary" 
                onClick={handleSave}
                disabled={saving || !isDirty}
              >
                {saving ? 'Guardando...' : <><svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor" style={{ marginRight: 4 }}><path d="M0 1.75C0 .784.784 0 1.75 0h5.586c.464 0 .909.184 1.237.513l2.914 2.914c.329.328.513.773.513 1.237v9.586A1.75 1.75 0 0 1 10.25 16h-8.5A1.75 1.75 0 0 1 0 14.25Zm1.75-.25a.25.25 0 0 0-.25.25v12.5c0 .138.112.25.25.25h8.5a.25.25 0 0 0 .25-.25V5.164a.25.25 0 0 0-.073-.177L8.513 2.323a.25.25 0 0 0-.177-.073H8v2.5A1.75 1.75 0 0 0 9.75 6.5H11v7.75a.25.25 0 0 1-.25.25h-2.5a.75.75 0 0 1 0-1.5h1.5V8.683a.25.25 0 0 0-.22-.25l-1.75-.2a.75.75 0 0 1-.53-.97l.2-.75A.75.75 0 0 1 7.73 5.5h.77a.25.25 0 0 0 .25-.25V2.5h-.75a.75.75 0 0 1-.53-.22L6.28.732A.25.25 0 0 0 6.104.5H5.5v2.75a.75.75 0 0 1-1.5 0V.5H3.75a.25.25 0 0 0-.25.25v4.5a.75.75 0 0 1-1.5 0v-4.5A1.75 1.75 0 0 1 3.75 0h2.836c.464 0 .909.184 1.237.513l2.914 2.914c.329.328.513.773.513 1.237v9.586A1.75 1.75 0 0 1 9.25 16h-5.5A1.75 1.75 0 0 1 2 14.25.75.75 0 0 1 2.75 13.5h4a.75.75 0 0 1 .75.75.75.75 0 0 1-.75.75h-4a.25.25 0 0 0-.25.25Z"/></svg> Guardar Cambios</>}
              </button>
            </div>
            <div ref={containerRef} className="monaco-container" />
            {isDirty && (
              <div className="edit-hint">
                <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor" style={{ marginRight: 4, flexShrink: 0, color: 'var(--accent)' }}><path d="M8 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13ZM0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8Zm7.25-2.75a.75.75 0 0 1 .75-.75h.01a.75.75 0 0 1 0 1.5H8a.75.75 0 0 1-.75-.75ZM7.5 6.5a.75.75 0 0 1 .75-.75h.5a.75.75 0 0 1 .75.75v3.5h.25a.75.75 0 0 1 0 1.5h-2a.75.75 0 0 1 0-1.5h.75V8h-.25a.75.75 0 0 1-.75-.75Z"/></svg>
                En el gutter: <b style={{ color: 'var(--green)' }}>+</b> línea agregada, <b style={{ color: '#ffc107' }}>~</b> línea modificada
              </div>
            )}
          </div>
        ) : (
          renderDiffLines(diffContent)
        )}
      </div>
    </div>
  );
}