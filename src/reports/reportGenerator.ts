import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

export interface ReviewResult {
  filePath: string;
  ruleResults: string[];
  aiResults: string;
}

export class ReportGenerator {
  private reportsDir = '.ai-cr-reports';

  constructor() {
    this.ensureReportsDirectory();
    this.ensureGitignoreEntry();
  }

  /**
   * 确保报告目录存在
   */
  private ensureReportsDirectory(): void {
    if (!fs.existsSync(this.reportsDir)) {
      fs.mkdirSync(this.reportsDir, { recursive: true });
      console.log(`📁 创建报告目录: ${this.reportsDir}`);
    }
  }

  /**
   * 确保 .gitignore 中包含报告目录
   */
  private ensureGitignoreEntry(): void {
    const gitignorePath = '.gitignore';
    const ignoreEntry = '.ai-cr-reports/';

    let gitignoreContent = '';
    if (fs.existsSync(gitignorePath)) {
      gitignoreContent = fs.readFileSync(gitignorePath, 'utf-8');
    }

    // 检查是否已经包含该条目
    if (!gitignoreContent.includes(ignoreEntry)) {
      const newContent = gitignoreContent.trim() + '\n\n# AI Code Review Reports\n' + ignoreEntry + '\n';
      fs.writeFileSync(gitignorePath, newContent);
      console.log(`📝 已将 ${ignoreEntry} 添加到 .gitignore`);
    }
  }

  /**
   * 获取当前 Git 用户名
   */
  private getGitUsername(): string {
    try {
      const username = execSync('git config user.name', { encoding: 'utf-8' }).trim();
      return username || 'unknown';
    } catch {
      return 'unknown';
    }
  }

  /**
   * 生成报告文件名
   */
  private generateReportFileName(): string {
    const username = this.getGitUsername();
    const timestamp = new Date().toISOString().slice(0, 16).replace(/[-T:]/g, '');
    return `${username}_${timestamp}.md`;
  }

  /**
   * 生成 Markdown 格式的报告内容
   */
  private generateMarkdownReport(results: ReviewResult[], mode: string): string {
    const timestamp = new Date().toLocaleString('zh-CN');
    const totalFiles = results.length;
    const ruleIssues = results.reduce((sum, r) => sum + r.ruleResults.length, 0);
    
    let markdown = `# AI 代码审查报告

**生成时间**: ${timestamp}  
**审查模式**: ${mode}  
**检查文件**: ${totalFiles} 个  
**规则问题**: ${ruleIssues} 个  

---

`;

    results.forEach((result, index) => {
      markdown += `## ${index + 1}. ${result.filePath}

### 📋 规则检查
`;
      
      if (result.ruleResults.length === 0) {
        markdown += '✅ 规则检查通过\n\n';
      } else {
        result.ruleResults.forEach(issue => {
          markdown += `❌ ${issue}\n`;
        });
        markdown += '\n';
      }

      if (mode === 'ai' || mode === 'full') {
        markdown += `### 🤖 AI 审查

${result.aiResults}

`;
      }

      markdown += '---\n\n';
    });

    markdown += `## 📊 总结

- **总文件数**: ${totalFiles}
- **规则问题**: ${ruleIssues}
- **审查完成时间**: ${timestamp}

> 📁 报告保存位置: \`${this.reportsDir}\`  
> 🔧 工具版本: ai-cr v1.0.0
`;

    return markdown;
  }

  /**
   * 保存审查报告
   */
  public saveReport(results: ReviewResult[], mode: string): string {
    const fileName = this.generateReportFileName();
    const filePath = path.join(this.reportsDir, fileName);
    const content = this.generateMarkdownReport(results, mode);

    fs.writeFileSync(filePath, content, 'utf-8');
    
    return filePath;
  }
}