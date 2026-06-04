export interface FileStatus {
  path: string;
  status: string;
}

export interface RepoInfo {
  current_branch: string;
  files: FileStatus[];
  has_commits: boolean;
}

export interface BranchInfo {
  name: string;
  is_current: boolean;
  is_remote: boolean;
}

export interface CommitInfo {
  id: string;
  message: string;
  author: string;
}



export type ActivePanel = 'diff' | 'branches' | 'history';
