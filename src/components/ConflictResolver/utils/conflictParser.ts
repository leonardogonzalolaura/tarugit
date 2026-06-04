import { ConflictFileBlock } from '../ConflictResolver.types';

export function parseConflictBlocks(text: string): ConflictFileBlock[] {
  const lines = text.split('\n');
  const result: ConflictFileBlock[] = [];
  let currentBlockLines: string[] = [];
  let state: 'normal' | 'ours' | 'theirs' = 'normal';
  let oursBlockLines: string[] = [];
  let theirsBlockLines: string[] = [];

  const flushNormal = () => {
    if (currentBlockLines.length > 0) {
      result.push({
        id: `clean-${Math.random().toString(36).slice(2)}`,
        type: 'clean',
        content: currentBlockLines.join('\n')
      });
      currentBlockLines = [];
    }
  };

  for (const line of lines) {
    if (line.startsWith('<<<<<<<')) {
      flushNormal();
      state = 'ours';
    } else if (line.startsWith('=======')) {
      state = 'theirs';
    } else if (line.startsWith('>>>>>>>')) {
      result.push({
        id: `conflict-${Math.random().toString(36).slice(2)}`,
        type: 'conflict',
        content: oursBlockLines.join('\n'),
        oursContent: oursBlockLines.join('\n'),
        theirsContent: theirsBlockLines.join('\n'),
        resolution: 'pending'
      });
      oursBlockLines = [];
      theirsBlockLines = [];
      state = 'normal';
    } else {
      if (state === 'normal') currentBlockLines.push(line);
      else if (state === 'ours') oursBlockLines.push(line);
      else if (state === 'theirs') theirsBlockLines.push(line);
    }
  }
  flushNormal();
  return result;
}

export function mergeBlocks(blocks: ConflictFileBlock[]): string {
  return blocks.map(b => b.content).join('\n');
}

export function getConflictStats(blocks: ConflictFileBlock[]) {
  const conflictBlocks = blocks.filter(b => b.type === 'conflict');
  const resolvedCount = conflictBlocks.filter(b => b.resolution && b.resolution !== 'pending').length;
  return { conflictBlocks, resolvedCount, totalConflicts: conflictBlocks.length };
}