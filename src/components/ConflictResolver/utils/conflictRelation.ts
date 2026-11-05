export type BlockRelation =
  | 'identical'
  | 'result-contains-theirs'
  | 'theirs-contains-result'
  | 'different';

const normalizeLines = (text?: string): string[] =>
  (text ?? '')
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0);

const hasMeaningfulLine = (lines: string[]): boolean =>
  lines.some(line => line.length > 1);

/**
 * Clasifica la relación entre el contenido del resultado y el entrante.
 * Se usa para avisar cuando el resultado ya incluye todo lo entrante
 * (Aceptar Ambos duplicaría el contenido) o viceversa.
 */
export function getBlockRelation(result?: string, theirs?: string): BlockRelation {
  const resultLines = normalizeLines(result);
  const theirsLines = normalizeLines(theirs);

  if (resultLines.join('\n') === theirsLines.join('\n')) return 'identical';

  // Si un lado está vacío no hay contenido que comparar; evitar avisos engañosos.
  if (resultLines.length === 0 || theirsLines.length === 0) return 'different';

  // Evita falsos positivos con líneas triviales sueltas como "}" o ");".
  if (!hasMeaningfulLine(resultLines) && !hasMeaningfulLine(theirsLines)) return 'different';

  const resultSet = new Set(resultLines);
  const theirsSet = new Set(theirsLines);

  const resultHasAllTheirs = theirsLines.every(line => resultSet.has(line));
  const theirsHasAllResult = resultLines.every(line => theirsSet.has(line));

  if (resultHasAllTheirs && theirsHasAllResult) return 'identical';
  if (resultHasAllTheirs) return 'result-contains-theirs';
  if (theirsHasAllResult) return 'theirs-contains-result';
  return 'different';
}

export interface RelationMeta {
  tone: 'identical' | 'duplicate' | 'superset';
  label: string;
  hint?: string;
}

export const RELATION_META: Record<BlockRelation, RelationMeta | null> = {
  identical: { tone: 'identical', label: 'Mismo contenido que el entrante' },
  'result-contains-theirs': {
    tone: 'duplicate',
    label: 'El resultado ya incluye lo entrante',
    hint: 'Aceptar Ambos duplicaría el contenido'
  },
  'theirs-contains-result': { tone: 'superset', label: 'Lo entrante ya incluye el resultado' },
  different: null
};

export interface DuplicateLine {
  /** Contenido de la línea repetida (sin espacios en los extremos). */
  line: string;
  /** Índice de la primera línea del grupo repetido (0-based). */
  index: number;
  /** Total de repeticiones consecutivas. */
  occurrences: number;
}

/**
 * Detecta líneas iguales repetidas de forma consecutiva dentro de un bloque.
 * Ignora líneas vacías para no marcar saltos de línea normales.
 */
export function findDuplicateLines(text?: string): DuplicateLine[] {
  const lines = (text ?? '').replace(/\r\n/g, '\n').split('\n');
  const duplicates: DuplicateLine[] = [];
  let i = 0;

  while (i < lines.length) {
    const current = lines[i].trim();
    if (!current) {
      i++;
      continue;
    }

    let j = i + 1;
    while (j < lines.length && lines[j].trim() === current) j++;

    if (j - i > 1) {
      duplicates.push({ line: current, index: i, occurrences: j - i });
    }
    i = j;
  }

  return duplicates;
}

const truncate = (value: string, max = 60): string =>
  value.length > max ? `${value.slice(0, max - 1)}…` : value;

export function describeDuplicateLines(duplicates: DuplicateLine[]): string {
  if (duplicates.length === 0) return '';

  if (duplicates.length === 1) {
    const { line, occurrences } = duplicates[0];
    const label = occurrences === 2 ? 'Línea duplicada' : `${occurrences} líneas iguales consecutivas`;
    return `${label}: ${truncate(line)}`;
  }

  return `${duplicates.length} grupos de líneas duplicadas consecutivas`;
}

/**
 * Devuelve los índices (0-based) de las líneas del resultado que ya existen
 * en el contenido entrante. Sirve para señalar qué filas se duplicarían al
 * pulsar "Aceptar Ambos".
 */
export function findOverlapLines(result?: string, theirs?: string): number[] {
  const resultLines = (result ?? '').replace(/\r\n/g, '\n').split('\n');
  const theirsLines = (theirs ?? '')
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean);

  if (theirsLines.length === 0) return [];

  const theirsSet = new Set(theirsLines);
  const matches: number[] = [];

  resultLines.forEach((line, index) => {
    const trimmed = line.trim();
    if (trimmed && theirsSet.has(trimmed)) matches.push(index);
  });

  return matches;
}

