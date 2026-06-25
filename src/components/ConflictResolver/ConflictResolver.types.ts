export type BlockResolution = 'pending' | 'ours' | 'theirs' | 'both' | 'ignore' | 'custom';
export type LayoutMode = 'side' | 'diff-result' | 'vertical';

export interface ConflictFileBlock {
  id: string;
  type: 'clean' | 'conflict';
  content: string;
  oursContent?: string;
  theirsContent?: string;
  resolution?: BlockResolution;
}

export interface ConflictData {
  ours: string;
  theirs: string;
  base: string;
  raw: string;
}

export interface OperationContext {
  type: 'merge' | 'rebase' | 'cherry-pick';
  originalBranch?: string;
}

export interface ScrollInfo {
  scrollTop: number;
  totalHeight: number;
  containerHeight: number;
}