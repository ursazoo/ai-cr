import { execSync } from 'child_process';
import * as fs from 'fs';

export interface FileWithContext {
  filePath: string;
  content: string;
}

export async function getChangedFilesWithContext(): Promise<FileWithContext[]> {
  try {
    let gitCommand: string;
    
    // 检查是否为初始提交
    try {
      execSync('git rev-parse HEAD~1', { encoding: 'utf-8', stdio: 'pipe' });
      gitCommand = 'git diff --name-only HEAD~1';
    } catch {
      // 初始提交场景：获取当前提交的所有文件
      gitCommand = 'git ls-tree -r --name-only HEAD';
    }
    
    const diffFiles = execSync(gitCommand, { encoding: 'utf-8' })
      .split('\n')
      .filter(Boolean)
      .filter(file => fs.existsSync(file));

    return diffFiles.map(filePath => {
      const content = fs.readFileSync(filePath, 'utf-8');
      return { filePath, content };
    });
  } catch (error) {
    console.warn('Git 操作失败，返回空数组:', error);
    return [];
  }
}