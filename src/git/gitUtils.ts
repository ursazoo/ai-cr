interface GitCommit {
  hash: string;
  author: string;
  message: string;
  files: string[];
}

export class GitUtils {
  static async getLatestCommit(): Promise<GitCommit> {
    throw new Error('Not implemented');
  }

  static async getDiffForCommit(_commitHash: string): Promise<string> {
    throw new Error('Not implemented');
  }

  static async getChangedFiles(_commitHash: string): Promise<string[]> {
    throw new Error('Not implemented');
  }
}