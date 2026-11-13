// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface InconsistencyOccurrence {
  line: number;       // 1-based
  lineContent: string;
}

export interface DuplicateDeclaration {
  type: 'duplicate-declaration';
  identifier: string;
  keyword: string;
  occurrences: InconsistencyOccurrence[];
}

export interface DuplicateLine {
  type: 'duplicate-line';
  lineText: string;
  occurrences: InconsistencyOccurrence[];
}

export type Inconsistency = DuplicateDeclaration | DuplicateLine;

// ---------------------------------------------------------------------------
// Language detection
// ---------------------------------------------------------------------------

type Language = 'scala' | 'csharp' | 'typescript' | 'python' | 'sql' | 'unknown';

function detectLanguage(filePath: string): Language {
  const ext = filePath.replace(/\\/g, '/').split('/').pop()?.split('.').pop()?.toLowerCase() ?? '';
  switch (ext) {
    case 'scala': return 'scala';
    case 'cs':    return 'csharp';
    case 'ts':
    case 'tsx':
    case 'js':
    case 'jsx':   return 'typescript';
    case 'py':    return 'python';
    case 'sql':   return 'sql';
    default:      return 'unknown';
  }
}

// ---------------------------------------------------------------------------
// Line helpers
// ---------------------------------------------------------------------------

function isCommentLine(trimmed: string): boolean {
  return (
    trimmed.startsWith('//') ||
    trimmed.startsWith('#')  ||
    trimmed.startsWith('--') ||
    trimmed.startsWith('/*') ||
    trimmed.startsWith('*')
  );
}

function isStructuralLine(trimmed: string): boolean {
  // Sin ninguna letra o dígito — solo puntuación/símbolos
  if (!/[a-zA-Z0-9_$]/.test(trimmed)) return true;
  // Empieza con cierre de bloque
  if (/^[}\])]/.test(trimmed)) return true;
  return false;
}

interface JsxScanState {
  /** Estamos dentro de una etiqueta JSX aún sin cerrar (`<button` …). */
  inTag: boolean;
  /** Profundidad de `{ … }` dentro de atributos (`onClick={() => …}`). */
  exprDepth: number;
}

/**
 * Marca si la línea forma parte de markup JSX/HTML: una etiqueta completa,
 * el inicio de una etiqueta multilínea (`<button`) o sus atributos.
 * Esas líneas se repiten legítimamente entre hermanos y no deben alertarse.
 */
function scanJsxLine(line: string, state: JsxScanState, continued: boolean): boolean {
  if (continued) return false;

  let isTagLine = state.inTag;
  let i = 0;

  while (i < line.length) {
    const ch = line[i];

    if (state.inTag) {
      isTagLine = true;
      if (ch === '/' && line[i + 1] === '/') break;
      if (ch === '"' || ch === "'") { i = skipQuoted(line, i, ch); continue; }
      if (ch === '{') { state.exprDepth++; i++; continue; }
      if (ch === '}') { state.exprDepth = Math.max(0, state.exprDepth - 1); i++; continue; }
      if (ch === '>' && state.exprDepth === 0) { state.inTag = false; i++; continue; }
      i++;
      continue;
    }

    if (ch === '/' && line[i + 1] === '/') break;
    if (ch === '"' || ch === "'") { i = skipQuoted(line, i, ch); continue; }
    if (ch === '`') {
      const end = line.indexOf('`', i + 1);
      i = end === -1 ? line.length : end + 1;
      continue;
    }

    if (ch === '<' && /[A-Za-z/>]/.test(line[i + 1] ?? '')) {
      // Solo tratamos `<` como inicio de JSX en posiciones plausibles
      // (inicio de línea, tras `(`, `{`, `=`, `=>`, `&&`, `,`…), para no
      // confundir comparaciones (`a < b`) con etiquetas.
      const before = line.slice(0, i).trimEnd();
      const prevCh = before.slice(-1);
      const prevWord = before.match(/(\w+)$/)?.[1];
      const jsxPosition =
        before.length === 0 ||
        /[([{=,:?&|>+!]/.test(prevCh) ||
        prevWord === 'return' ||
        prevWord === 'yield';

      if (jsxPosition) {
        state.inTag = true;
        state.exprDepth = 0;
        isTagLine = true;
      }
    }
    i++;
  }

  return isTagLine;
}

function leadingIndent(line: string): number {
  let indent = 0;
  for (const ch of line) {
    if (ch === ' ') indent++;
    else if (ch === '\t') indent += 4;
    else break;
  }
  return indent;
}

function normalizeStatement(line: string): string {
  return line.trim().replace(/\s+/g, ' ');
}

// Línea que, aunque esté en el mismo scope, no aporta como "duplicado":
// control de flujo suelto o palabras clave de SQL.
const CONTROL_ONLY = /^(?:else|elif|try|finally|do|default|begin|end|commit|rollback|go)\b\s*[{:]?;?$/i;
const CONTROL_HEADER = /^(?:if|elif|else|for|foreach|while|do|try|catch|finally|switch|match|case|default|loop|guard)\b/;
const SQL_NOISE = /^(?:commit|rollback|begin(?:\s+transaction)?|end(?:\s+transaction)?|go)\s*;?$/i;

// Prefijos que indican declaración o control de flujo: no son asignaciones
// simples, y ya se cubren (o se ignoran) por otras vías.
const NON_ASSIGNMENT_PREFIX = /^(?:val|var|const|let|def|class|object|trait|type|import|from|using|interface|enum|readonly|public|private|protected|internal|static|async|function|export|return|throw|if|elif|else|for|foreach|while|do|try|catch|finally|switch|match|case|default|new|yield|await|break|continue|goto|pass|select|update|insert|delete|with)\b/i;

/** Índice del `=` de asignación, ignorando `==`, `===`, `=>`, `<=`, `>=`, `!=`. */
function assignmentOperatorIndex(line: string): number {
  for (let i = 0; i < line.length; i++) {
    if (line[i] !== '=') continue;
    const prev = line[i - 1];
    const next = line[i + 1];
    if (next === '=' || next === '>') continue;
    if (prev === '=' || prev === '!' || prev === '<' || prev === '>') continue;
    return i;
  }
  return -1;
}

// Solo las asignaciones aportan como "línea duplicada": `campo = valor`,
// `this.campo = valor`, `a.b[c] = valor`, argumentos nombrados multilínea…
// Llamadas (`foo(...)`), control de flujo y markup se ignoran para no generar ruido.
function isAssignmentStatement(line: string): boolean {
  if (NON_ASSIGNMENT_PREFIX.test(line)) return false;

  const eq = assignmentOperatorIndex(line);
  if (eq === -1) return false;

  // Operador compuesto (`x += 1`): el lado izquierdo real es `x`.
  const left = line.slice(0, eq).replace(/[+\-*/%&|^]$/, '').trim();
  const right = line.slice(eq + 1).trim();
  if (!right) return false;

  return /^(?:this|self|super|[A-Za-z_$][\w$]*)(?:\s*(?:\.\s*[A-Za-z_$][\w$]*|\[[^\]]*\]))*(?:\s*:\s*.+)?$/.test(left);
}

function isDuplicateLineCandidate(line: string, lang: Language): boolean {
  const normalized = normalizeStatement(line);
  // Evita ruido de líneas demasiado cortas (`pass`, `GO`, `x = 1`…)
  if (normalized.length < 6) return false;
  if (CONTROL_ONLY.test(normalized)) return false;
  // Cabeceras de bloque: `if (...) {`, `for x in y:`, etc.
  if (CONTROL_HEADER.test(normalized) && /[{:]\s*$/.test(normalized)) return false;
  if (lang === 'sql' && SQL_NOISE.test(normalized)) return false;
  // Solo asignaciones: evita marcar `useEffect(() => {`, `return (`, `foo();`…
  return isAssignmentStatement(normalized);
}

// Líneas que continúan la firma/cabecera anterior y por tanto NO cierran
// un scope basado en indentación (firmas multilínea, llaves en línea aparte…).
function isContinuationLine(trimmed: string): boolean {
  if (/^[)\]}]/.test(trimmed)) return true;
  if (/^(?:\{|\[)/.test(trimmed)) return true;
  if (/^[.,]/.test(trimmed)) return true;
  if (/^(?:else|catch|finally|yield|extends|with|where)\b/.test(trimmed)) return true;
  if (/^(?:=>|<-|=|\+|-|\*|\/|&&|\|\|)/.test(trimmed)) return true;
  return false;
}

// ---------------------------------------------------------------------------
// Per-language keyword patterns
// [keyword, regex] — grupo 1 captura el identificador
// Los patrones más específicos deben ir ANTES que los genéricos
// ---------------------------------------------------------------------------

type KeywordPattern = [keyword: string, pattern: RegExp];

// Prefijo de modificadores Scala: `private[this]`, `private[pkg]`,
// `override`, `implicit`, `lazy`, `final`, `sealed`, `case`, anotaciones…
const SCALA_MODIFIERS = String.raw`(?:(?:private|protected)(?:\s*\[[^\]]*\])?|override|implicit|lazy|final|abstract|sealed|case)\s+`;
const SCALA_ANNOTATIONS = String.raw`(?:@[\w.]+(?:\([^)]*\))?\s+)*`;
const SCALA_PREFIX = `${SCALA_ANNOTATIONS}(?:${SCALA_MODIFIERS})*`;

const scalaPattern = (body: string) => new RegExp(`^\\s*${SCALA_PREFIX}${body}`);

const SCALA_SCOPE_OPENERS: RegExp[] = [
  scalaPattern(String.raw`def\s+`),
  scalaPattern(String.raw`class\s+`),
  scalaPattern(String.raw`object\s+`),
  scalaPattern(String.raw`trait\s+`),
];

const SCALA_PATTERNS: KeywordPattern[] = [
  ['import', /^\s*import\s+([\w$.{}*]+(?:\.[{\w*,\s}]+)?)/],
  ['val',    scalaPattern(String.raw`val\s+([a-zA-Z_$][\w$]*)`)],
  ['var',    scalaPattern(String.raw`var\s+([a-zA-Z_$][\w$]*)`)],
  ['def',    scalaPattern(String.raw`def\s+([a-zA-Z_$][\w$]*)`)],
  ['class',  scalaPattern(String.raw`class\s+([a-zA-Z_$][\w$]*)`)],
  ['object', scalaPattern(String.raw`object\s+([a-zA-Z_$][\w$]*)`)],
  ['trait',  scalaPattern(String.raw`trait\s+([a-zA-Z_$][\w$]*)`)],
  ['type',   /^\s*type\s+([a-zA-Z_$][\w$]*)/],
];

const CSHARP_PATTERNS: KeywordPattern[] = [
  ['using',     /^\s*using\s+([\w.]+)\s*;/],
  ['class',     /^\s*(?:(?:public|private|protected|internal|static|abstract|sealed|partial)\s+)*class\s+([a-zA-Z_][\w]*)/],
  ['interface', /^\s*(?:(?:public|private|protected|internal)\s+)*interface\s+([a-zA-Z_][\w]*)/],
  ['enum',      /^\s*(?:(?:public|private|protected|internal)\s+)*enum\s+([a-zA-Z_][\w]*)/],
  ['const',     /^\s*(?:(?:public|private|protected|internal|static)\s+)*const\s+\S+\s+([a-zA-Z_][\w]*)/],
  ['readonly',  /^\s*(?:(?:public|private|protected|internal|static)\s+)*readonly\s+\S+\s+([a-zA-Z_][\w]*)/],
  ['void',      /^\s*(?:(?:public|private|protected|internal|static|async|virtual|override)\s+)*void\s+([a-zA-Z_][\w]*)\s*[(<]/],
  ['var',       /^\s*var\s+([a-zA-Z_][\w]*)\s*=/],
  ['int',       /^\s*(?:(?:public|private|protected|internal|static)\s+)*int\s+([a-zA-Z_][\w]*)\s*[=;({]/],
  ['string',    /^\s*(?:(?:public|private|protected|internal|static)\s+)*string\s+([a-zA-Z_][\w]*)\s*[=;({]/],
  ['bool',      /^\s*(?:(?:public|private|protected|internal|static)\s+)*bool\s+([a-zA-Z_][\w]*)\s*[=;({]/],
  ['double',    /^\s*(?:(?:public|private|protected|internal|static)\s+)*double\s+([a-zA-Z_][\w]*)\s*[=;({]/],
  ['float',     /^\s*(?:(?:public|private|protected|internal|static)\s+)*float\s+([a-zA-Z_][\w]*)\s*[=;({]/],
  ['long',      /^\s*(?:(?:public|private|protected|internal|static)\s+)*long\s+([a-zA-Z_][\w]*)\s*[=;({]/],
];

const TS_PATTERNS: KeywordPattern[] = [
  ['import',          /^\s*import\s+.*\s+from\s+['"]([^'"]+)['"]/],
  ['export const',    /^\s*export\s+const\s+([a-zA-Z_$][\w$]*)/],
  ['export function', /^\s*export\s+(?:async\s+)?function\s+([a-zA-Z_$][\w$]*)/],
  ['export default',  /^\s*export\s+default\s+(?:function\s+)?([a-zA-Z_$][\w$]*)/],
  ['const',           /^\s*const\s+([a-zA-Z_$][\w$]*)/],
  ['let',             /^\s*let\s+([a-zA-Z_$][\w$]*)/],
  ['var',             /^\s*var\s+([a-zA-Z_$][\w$]*)/],
  ['function',        /^\s*(?:async\s+)?function\s+([a-zA-Z_$][\w$]*)/],
  ['class',           /^\s*(?:abstract\s+)?class\s+([a-zA-Z_$][\w$]*)/],
  ['interface',       /^\s*interface\s+([a-zA-Z_$][\w$]*)/],
  ['type',            /^\s*type\s+([a-zA-Z_$][\w$]*)\s*=/],
];

const PYTHON_PATTERNS: KeywordPattern[] = [
  ['import', /^\s*import\s+([\w.]+)/],
  ['from',   /^\s*from\s+([\w.]+)\s+import/],
  ['def',    /^\s*def\s+([a-zA-Z_][\w]*)/],
  ['class',  /^\s*class\s+([a-zA-Z_][\w]*)/],
  // Solo top-level (sin indentación)
  ['=',      /^([a-zA-Z_][\w]*)\s*=/],
];

const SQL_PATTERNS: KeywordPattern[] = [
  ['CREATE TABLE',     /CREATE\s+(?:OR\s+REPLACE\s+)?TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([`"[\w.]+)/i],
  ['CREATE VIEW',      /CREATE\s+(?:OR\s+REPLACE\s+)?VIEW\s+([`"[\w.]+)/i],
  ['CREATE PROCEDURE', /CREATE\s+(?:OR\s+REPLACE\s+)?PROCEDURE\s+([`"[\w.]+)/i],
  ['CREATE FUNCTION',  /CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+([`"[\w.]+)/i],
  ['DECLARE',          /DECLARE\s+@?([a-zA-Z_][\w]*)/i],
  ['CREATE INDEX',     /CREATE\s+(?:UNIQUE\s+)?INDEX\s+([`"[\w.]+)/i],
];

// Keywords que definen un nuevo scope (bloque hijo)
const SCOPE_OPENERS: Record<Language, RegExp[]> = {
  scala: SCALA_SCOPE_OPENERS,
  csharp: [
    /^\s*(?:(?:public|private|protected|internal|static|abstract|sealed|partial)\s+)*class\s+/,
    /^\s*(?:(?:public|private|protected|internal|static|async|virtual|override|partial|sealed|abstract|extern|new)\s+)*(?:void|Task(?:<[^>]*>)?|[A-Za-z_][\w<>\[\],.?]*)\s+\w+\s*[(<]/,
    /^\s*(?:(?:public|private|protected|internal|static)\s+)*interface\s+/,
    /^\s*(?:(?:public|private|protected|internal)\s+)*[A-Z][\w]*\s*\(/,
  ],
  typescript: [
    /^\s*(?:export\s+)?(?:async\s+)?function\s+/,
    /^\s*(?:export\s+)?(?:abstract\s+)?class\s+/,
    /^\s*(?:(?:public|private|protected|static|async|override)\s+)*\w+\s*\([^)]*\)\s*[:({]/,
  ],
  python: [
    /^\s*def\s+/,
    /^\s*class\s+/,
  ],
  sql:     [],
  unknown: [],
};

function getPatternsForLanguage(lang: Language): KeywordPattern[] {
  switch (lang) {
    case 'scala':      return SCALA_PATTERNS;
    case 'csharp':     return CSHARP_PATTERNS;
    case 'typescript': return TS_PATTERNS;
    case 'python':     return PYTHON_PATTERNS;
    case 'sql':        return SQL_PATTERNS;
    default:           return [];
  }
}

// Keywords cuya duplicación es relevante independientemente del scope
// (imports, tipos de primer nivel)
const GLOBAL_KEYWORDS = new Set([
  'import', 'using', 'from',
  'class', 'interface', 'trait', 'object', 'enum',
]);

// En Scala cada rama `case` de un match es un scope propio: dos líneas
// iguales en ramas distintas no son una inconsistencia.
const CASE_CLAUSE: Partial<Record<Language, RegExp>> = {
  scala: /^\s*case\b.*=>/,
};

// ---------------------------------------------------------------------------
// Brace counting with per-file state
//
// Ignora llaves dentro de strings (incluidos `"""..."""` y template literals)
// y comentarios (`//`, `/* ... */`), que si no desalinean todos los scopes.
// ---------------------------------------------------------------------------

function skipQuoted(line: string, start: number, quote: string): number {
  let i = start + 1;
  while (i < line.length) {
    if (line[i] === '\\') { i += 2; continue; }
    if (line[i] === quote) return i + 1;
    i++;
  }
  return i;
}

// ¿El `/` en `start` inicia un literal de regex y no una división?
// Solo cuenta en posiciones donde un valor no puede terminar: inicio de línea,
// tras operadores/paréntesis/coma, o tras palabras clave como `return`.
function isRegexStart(line: string, start: number): boolean {
  const before = line.slice(0, start).trimEnd();
  if (before.length === 0) return true;
  const prevChar = before[before.length - 1];
  if (/[([{,;:=!&|?+\-*%^~]/.test(prevChar)) return true;
  const prevWord = before.match(/([A-Za-z_$][\w$]*)$/)?.[1];
  return (
    prevWord !== undefined &&
    /^(?:return|case|typeof|instanceof|in|of|new|delete|void|yield|await|do|else)$/.test(prevWord)
  );
}

// Salta un literal de regex (`/.../flags`), respetando escapes y clases `[...]`
// donde `/` no cierra el literal. Evita contar `{`, `}` o `(` del regex.
function skipRegex(line: string, start: number): number {
  let i = start + 1;
  let inClass = false;
  while (i < line.length) {
    const ch = line[i];
    if (ch === '\\') { i += 2; continue; }
    if (ch === '[') { inClass = true; i++; continue; }
    if (ch === ']') { inClass = false; i++; continue; }
    if (ch === '/' && !inClass) {
      i++;
      while (i < line.length && /[a-z]/i.test(line[i])) i++;
      return i;
    }
    i++;
  }
  return i;
}

interface BraceCount {
  open: number;
  close: number;
  /** Mínimo delta acumulado de llaves dentro de la línea (<= 0). */
  minDelta: number;
  /** Aperturas (1) y cierres (-1) de paréntesis, en orden. */
  parenEvents: Array<1 | -1>;
  /** La línea empieza dentro de un string multilínea o comentario de bloque. */
  continued: boolean;
}

function createBraceCounter(lang: Language) {
  let inBlockComment = false;
  let tripleDelimiter: '"""' | "'''" | null = null;
  let inTemplateString = false;
  const supportsTripleQuotes = lang === 'scala' || lang === 'python';

  return (line: string): BraceCount => {
    const continued = inBlockComment || tripleDelimiter !== null || inTemplateString;
    let open = 0;
    let close = 0;
    let delta = 0;
    let minDelta = 0;
    const parenEvents: Array<1 | -1> = [];
    let i = 0;

    while (i < line.length) {
      const ch = line[i];
      const next = line[i + 1];

      if (inBlockComment) {
        if (ch === '*' && next === '/') { inBlockComment = false; i += 2; }
        else i++;
        continue;
      }

      if (tripleDelimiter !== null) {
        if (line.startsWith(tripleDelimiter, i)) { tripleDelimiter = null; i += 3; }
        else i++;
        continue;
      }

      if (inTemplateString) {
        if (ch === '\\') { i += 2; continue; }
        if (ch === '`') { inTemplateString = false; i++; continue; }
        i++;
        continue;
      }

      if (ch === '/' && next === '/') break;
      if (ch === '/' && next === '*') { inBlockComment = true; i += 2; continue; }

      // Literales de regex (solo JS/TS): sus `{`, `}`, `(` y `)` no cuentan
      if (lang === 'typescript' && ch === '/' && isRegexStart(line, i)) {
        i = skipRegex(line, i);
        continue;
      }

      if (supportsTripleQuotes && line.startsWith('"""', i)) {
        tripleDelimiter = '"""';
        i += 3;
        continue;
      }

      if (supportsTripleQuotes && line.startsWith("'''", i)) {
        tripleDelimiter = "'''";
        i += 3;
        continue;
      }

      if (lang === 'typescript' && ch === '`') {
        inTemplateString = true;
        i++;
        continue;
      }

      if (ch === '"') {
        i = skipQuoted(line, i, '"');
        continue;
      }

      if (ch === "'") {
        if (lang === 'scala') {
          // Char literal escapado: '\n'
          if (next === '\\') { i = skipQuoted(line, i, "'"); continue; }
          // Char literal simple: 'a'
          if (line[i + 2] === "'") { i += 3; continue; }
          // Symbol literal: 'foo
          i++;
          while (i < line.length && /[\w$]/.test(line[i])) i++;
          continue;
        }
        i = skipQuoted(line, i, "'");
        continue;
      }

      if (ch === '(') { parenEvents.push(1); i++; continue; }
      if (ch === ')') { parenEvents.push(-1); i++; continue; }

      if (ch === '{') { open++; delta++; }
      else if (ch === '}') { close++; delta--; minDelta = Math.min(minDelta, delta); }
      i++;
    }

    return { open, close, minDelta, parenEvents, continued };
  };
}

// ---------------------------------------------------------------------------
// Scope tracking
//
// - Lenguajes con llaves (Scala, C#, TypeScript): scopes por profundidad de
//   `{` `}`. En Scala/C#/TypeScript también se abre un scope por indentación
//   cuando la declaración no lleva `{` en la misma línea (firmas multilínea,
//   Scala 3 braceless, llave de C# en línea aparte…).
// - Python: scopes por indentación (toda línea que termina en `:`).
// - SQL: todo el archivo en scope 0.
//
// Las declaraciones locales se agrupan por scope: dos `val x` en scopes
// distintos NO son inconsistencias.
// ---------------------------------------------------------------------------

interface ScopeFrame {
  id: number;
  mode: 'brace' | 'indent';
  /** Para mode='brace': profundidad de llaves justo antes de abrir el bloque. */
  depth: number;
  /** Para mode='indent': indentación de la línea que abrió el bloque. */
  indent: number;
}

interface DeclarationGroup {
  keyword: string;
  identifier: string;
  occurrences: InconsistencyOccurrence[];
}

interface StatementGroup {
  text: string;
  occurrences: InconsistencyOccurrence[];
}

// ---------------------------------------------------------------------------
// Main analysis function
// ---------------------------------------------------------------------------

export function analyzeInconsistencies(content: string, filePath: string): Inconsistency[] {
  const lang = detectLanguage(filePath);
  if (lang === 'unknown') return [];

  const patterns   = getPatternsForLanguage(lang);
  const openers    = SCOPE_OPENERS[lang];
  const lines      = content.replace(/\r\n/g, '\n').split('\n');
  const countBraces = createBraceCounter(lang);

  const usesBraceScopes  = lang !== 'python' && lang !== 'sql';
  const usesIndentScopes = lang === 'scala' || lang === 'csharp' || lang === 'typescript' || lang === 'python';
  const caseClause       = CASE_CLAUSE[lang];

  // Stack de scopes. Scope 0 = nivel de archivo.
  let scopeCounter = 0;
  const scopeStack: ScopeFrame[] = [{ id: 0, mode: 'brace', depth: 0, indent: -1 }];
  let braceDepth = 0;

  // Cada paréntesis multilínea (`new Foo(...)`, `copy(...)`, etc.) agrupa sus
  // propias líneas: los argumentos iguales en llamadas distintas no colisionan.
  let expressionCounter = 0;
  const expressionStack: number[] = [];

  const declarationMap = new Map<string, DeclarationGroup>();
  const statementMap   = new Map<string, StatementGroup>();
  // Solo relevante en TSX/JSX: permite ignorar etiquetas y atributos multilínea
  const jsxState: JsxScanState = { inTag: false, exprDepth: 0 };

  const currentScopeId = () => scopeStack[scopeStack.length - 1].id;

  const record = (target: 'declaration' | 'statement', key: string, occurrence: InconsistencyOccurrence) => {
    if (target === 'declaration') {
      let group = declarationMap.get(key);
      if (!group) {
        const [, keyword, identifier] = key.split('\u0000');
        group = { keyword, identifier, occurrences: [] };
        declarationMap.set(key, group);
      }
      group.occurrences.push(occurrence);
    } else {
      let group = statementMap.get(key);
      if (!group) {
        group = { text: key.split('\u0000')[1], occurrences: [] };
        statementMap.set(key, group);
      }
      group.occurrences.push(occurrence);
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const lineContent = lines[i];
    const trimmed     = lineContent.trim();
    const blank       = trimmed.length === 0;
    const comment     = !blank && isCommentLine(trimmed);
    const indent      = leadingIndent(lineContent);
    const { open, close, minDelta, parenEvents, continued } = countBraces(lineContent);
    // Línea que no es código real: vacía, comentario o dentro de un string multilínea
    const ignorable = blank || comment || continued;
    // Etiquetas JSX y sus atributos (incluidas las multilínea): no son código duplicable
    const jsxTagLine = lang === 'typescript' && scanJsxLine(lineContent, jsxState, continued);

    // ---- 1) Cerrar scopes de indentación que terminan en esta línea ----
    if (usesIndentScopes && !ignorable && !isContinuationLine(trimmed)) {
      while (scopeStack.length > 1) {
        const top = scopeStack[scopeStack.length - 1];
        if (top.mode === 'indent' && indent <= top.indent) scopeStack.pop();
        else break;
      }
    }

    // ---- 2) Procesar declaraciones / statements de la línea ----
    if (!ignorable && !jsxTagLine && !isStructuralLine(trimmed)) {
      const scopeId = currentScopeId();
      const expressionId = expressionStack.length > 0
        ? expressionStack[expressionStack.length - 1]
        : null;
      let matchedDeclaration = false;

      for (const [keyword, pattern] of patterns) {
        const match = pattern.exec(lineContent);
        if (!match) continue;

        const raw        = match[1] ?? '';
        const identifier = raw.replace(/^[`"[\s]+|[`"\]\s]+$/g, '').trim();
        if (!identifier) break;

        // Para keywords globales (import, class, etc.) siempre scope 0
        const effectiveScopeId = GLOBAL_KEYWORDS.has(keyword) ? 0 : scopeId;
        record('declaration', `${effectiveScopeId}\u0000${keyword}\u0000${identifier}`, {
          line: i + 1,
          lineContent,
        });
        matchedDeclaration = true;
        break; // solo el primer patrón que matchea por línea
      }

      // Líneas duplicadas: asignaciones, argumentos nombrados, llamadas, etc.
      // Se excluyen las que ya se reportaron como declaración para no duplicar.
      if (!matchedDeclaration && isDuplicateLineCandidate(trimmed, lang)) {
        const normalized = normalizeStatement(trimmed);
        const contextId = expressionId !== null ? `expr${expressionId}` : `scope${scopeId}`;
        record('statement', `${contextId}\u0000${normalized}`, {
          line: i + 1,
          lineContent,
        });
      }
    }

    // ---- 3) Abrir scopes sin llaves (firma multilínea, Scala 3, case, Python) ----
    const opensScope = !ignorable && openers.some(re => re.test(lineContent));
    const opensCase  = !ignorable && caseClause !== undefined && caseClause.test(lineContent);

    if (opensCase && open === 0 && usesIndentScopes) {
      // Rama `case`: su cuerpo vive en un scope propio hasta el siguiente case
      scopeStack.push({ id: ++scopeCounter, mode: 'indent', depth: braceDepth, indent });
    } else if (opensScope && open === 0 && usesIndentScopes) {
      // Firma multilínea / cuerpo sin llaves: scope por indentación
      scopeStack.push({ id: ++scopeCounter, mode: 'indent', depth: braceDepth, indent });
    } else if (lang === 'python' && !ignorable && /:\s*(?:#.*)?$/.test(lineContent)) {
      // En Python cualquier línea que termina en `:` abre bloque
      scopeStack.push({ id: ++scopeCounter, mode: 'indent', depth: braceDepth, indent });
    }

    // ---- 4) Actualizar profundidad de llaves y ajustar scopes de bloque ----
    if (usesBraceScopes) {
      // Profundidad mínima alcanzada al aplicar los cierres de la línea
      const reachableDepth = Math.max(0, braceDepth + minDelta);

      // Cerrar los bloques que terminan en esta línea (incluye `} else {`).
      // Los scopes de indentación (case, firmas multilínea) también mueren si
      // se cierra el bloque de llaves que los contenía.
      while (scopeStack.length > 1) {
        const top = scopeStack[scopeStack.length - 1];
        if (top.mode === 'brace' && reachableDepth <= top.depth) scopeStack.pop();
        else if (top.mode === 'indent' && top.depth >= 0 && reachableDepth < top.depth) scopeStack.pop();
        else break;
      }

      const finalDepth = Math.max(0, braceDepth + open - close);

      // Cualquier bloque `{` que quede abierto al final de la línea define un
      // nuevo scope (métodos, clases, lambdas, callbacks, bloques if/for…)
      if (open > 0 && finalDepth > reachableDepth) {
        scopeStack.push({ id: ++scopeCounter, mode: 'brace', depth: reachableDepth, indent: -1 });
      }

      braceDepth = finalDepth;
    }

    // ---- 5) Actualizar grupos de paréntesis multilínea ----
    for (const event of parenEvents) {
      if (event === 1) expressionStack.push(++expressionCounter);
      else if (expressionStack.length > 0) expressionStack.pop();
    }
  }

  const result: Inconsistency[] = [];

  for (const group of declarationMap.values()) {
    if (group.occurrences.length < 2) continue;
    result.push({
      type: 'duplicate-declaration',
      identifier: group.identifier,
      keyword: group.keyword,
      occurrences: group.occurrences,
    });
  }

  for (const group of statementMap.values()) {
    if (group.occurrences.length < 2) continue;
    result.push({
      type: 'duplicate-line',
      lineText: group.text,
      occurrences: group.occurrences,
    });
  }

  result.sort((a, b) => a.occurrences[0].line - b.occurrences[0].line);
  return result;
}
