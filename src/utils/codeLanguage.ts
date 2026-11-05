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
import type { LanguageSupport } from '@codemirror/language';

export function getLanguageForDisplay(filePath: string): string {
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

export function getCodeMirrorLang(filePath?: string): LanguageSupport | undefined {
  if (!filePath) return undefined;
  const ext = filePath.split('.').pop()?.toLowerCase() || '';
  const map: Record<string, () => LanguageSupport> = {
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
