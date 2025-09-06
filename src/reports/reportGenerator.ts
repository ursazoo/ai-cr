import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { homedir } from 'os';

export interface ProjectInfo {
  projectGroupId: string;
  projectGroupName: string;
  projectName: string;
  developerName: string;
  developerUserId: string;
}

export interface RuleViolation {
  ruleId: string;
  categoryId: string;
  title: string;
  description: string;
  severity: 'critical' | 'major' | 'minor' | 'info';
  line?: number;
  column?: number;
  codeSnippet?: string;
  suggestion?: string;
}

export interface ReviewResult {
  filePath: string;
  ruleResults: string[]; // 保持向后兼容
  ruleViolations?: RuleViolation[]; // 新增：详细的规则违反信息
  aiResults: string;
}

export interface CleanProjectInfo {
  projectGroupName: string;
  projectName: string;
  developerName: string;
}

export interface JsonReportData {
  projectInfo: CleanProjectInfo;
  statistics: {
    severityDistribution: {
      critical: number;
      major: number;
      minor: number;
      info: number;
    };
    categoryDistribution: Record<string, number>;
  };
  files: Array<{
    filePath: string;
    ruleViolations: RuleViolation[];
    aiResults: string;
    issueCount: number;
  }>;
  summary: {
    topCategories: Array<{
      categoryId: string;
      categoryName: string;
      count: number;
    }>;
    criticalIssues: RuleViolation[];
  };
}

export class ReportGenerator {
  private reportsDir = '.ai-cr-reports';

  constructor() {
    this.ensureReportsDirectory();
    this.ensureGitignoreEntry();
  }

  /**
   * 读取项目信息配置
   */
  private getProjectInfo(): ProjectInfo {
    // TODO: 规范格式
    try {
      // 尝试读取项目配置文件
      const configPaths = [
        '.ai-cr.config.json',
        'ai-cr.config.json',
        '.ai-cr-config.json'
      ];

      // 读取全局配置获取开发者信息
      const globalConfig = this.getGlobalConfig();
      const defaultDeveloperName = globalConfig?.userInfo?.name || this.getGitUsername();
      const defaultDeveloperUserId = globalConfig?.userInfo?.id || 'unknown';

      for (const configPath of configPaths) {
        if (fs.existsSync(configPath)) {
          const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
          if (config.project) {
            // 新格式配置
            if (config.project.projectGroupId) {
              return {
                projectGroupId: config.project.projectGroupId,
                projectGroupName: config.project.projectGroupName || '未知项目组',
                projectName: config.project.projectName || config.project.name || '未知项目',
                // 优先使用项目配置中的开发者信息，如果没有则使用全局配置
                developerName: config.project.developerName || defaultDeveloperName,
                developerUserId: config.project.developerUserId || defaultDeveloperUserId
              };
            }
            // 兼容旧格式配置
            else if (config.project.name || config.project.group) {
              return {
                projectGroupId: 'unknown',
                projectGroupName: config.project.group || '未知项目组',
                projectName: config.project.name || '未知项目',
                // 使用全局配置中的开发者信息
                developerName: defaultDeveloperName,
                developerUserId: defaultDeveloperUserId
              };
            }
          }
        }
      }

      // 如果没有配置文件，返回默认信息
      return {
        projectGroupId: 'unknown',
        projectGroupName: '未知项目组',
        projectName: this.getProjectNameFromPackageJson(),
        // 使用全局配置中的开发者信息
        developerName: defaultDeveloperName,
        developerUserId: defaultDeveloperUserId
      };
    } catch (error) {
      console.warn('读取项目配置失败，使用默认信息:', error);
      return {
        projectGroupId: 'unknown',
        projectGroupName: '未知项目组', 
        projectName: this.getProjectNameFromPackageJson(),
        developerName: this.getGitUsername(),
        developerUserId: 'unknown'
      };
    }
  }

  /**
   * 获取全局配置
   */
  private getGlobalConfig(): any {
    try {
      const globalConfigPath = path.join(homedir(), '.ai-cr', 'config.json');
      if (fs.existsSync(globalConfigPath)) {
        return JSON.parse(fs.readFileSync(globalConfigPath, 'utf-8'));
      }
    } catch (error) {
      console.warn('读取全局配置失败:', error);
    }
    return null;
  }

  /**
   * 从package.json获取项目名称
   */
  private getProjectNameFromPackageJson(): string {
    try {
      if (fs.existsSync('package.json')) {
        const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf-8'));
        return packageJson.name || '未知项目';
      }
    } catch {
      // 忽略错误
    }
    
    // 使用当前目录名作为项目名
    return path.basename(process.cwd());
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
    const projectInfo = this.getProjectInfo();
    
    // 统计规则违反情况
    const ruleIssues = results.reduce((sum, r) => {
      return sum + (r.ruleViolations?.length || r.ruleResults.length);
    }, 0);
    
    const filesWithIssues = results.filter(r => 
      (r.ruleViolations?.length || 0) > 0 || r.ruleResults.length > 0
    ).length;
    
    const aiProcessed = results.filter(r => r.aiResults && !r.aiResults.includes('static 模式下跳过')).length;
    const cached = results.filter(r => r.aiResults && r.aiResults.includes('此结果来自缓存')).length;
    
    // 按严重程度统计
    const severityStats = this.calculateSeverityStats(results);
    const categoryStats = this.calculateCategoryStats(results);
    
    let markdown = `# AI 代码审查报告

## 📋 项目信息

| 项目信息 | 详情 |
|----------|------|
| 项目组名称 | ${projectInfo.projectGroupName} |
| 项目名称 | ${projectInfo.projectName} |
| 开发者姓名 | ${projectInfo.developerName} |

---

**生成时间**: ${timestamp}  

## 📊 统计概览

### 基础统计
| 指标 | 数值 |
|------|------|
| 检查文件 | ${totalFiles} |
| 规则问题 | ${ruleIssues} |
| 问题文件 | ${filesWithIssues} |
| AI处理 | ${aiProcessed} |
| 缓存命中 | ${cached} |

### 问题严重程度分布
| 级别 | 数量 | 图标 |
|------|------|------|
| 严重 (Critical) | ${severityStats.critical} | 🚨 |
| 重要 (Major) | ${severityStats.major} | ⚠️ |
| 一般 (Minor) | ${severityStats.minor} | 💡 |
| 提示 (Info) | ${severityStats.info} | ℹ️ |

### 问题分类分布
| 分类ID | 分类名称 | 数量 |
|--------|----------|------|${Object.entries(categoryStats).map(([categoryId, count]) => 
`| ${categoryId} | ${this.getCategoryName(categoryId)} | ${count} |`).join('\n')}

---

`;

    results.forEach((result, index) => {
      markdown += `## ${index + 1}. ${result.filePath}\n\n`;
      
      // 显示规则违反详情
      if (result.ruleViolations && result.ruleViolations.length > 0) {
        markdown += `### 📋 规则检查 (${result.ruleViolations.length} 个问题)\n\n`;
        
        // 按严重程度分组
        const groupedByCategory = this.groupViolationsByCategory(result.ruleViolations);
        
        for (const [categoryId, violations] of Object.entries(groupedByCategory)) {
          const categoryName = this.getCategoryName(categoryId);
          const severityIcon = this.getSeverityIcon(violations[0]?.severity || 'info');
          
          markdown += `#### ${severityIcon} ${categoryName}\n\n`;
          
          violations.forEach(violation => {
            markdown += `**[${violation.categoryId}-${violation.ruleId}] ${violation.title}**\n`;
            markdown += `- **描述**: ${violation.description}\n`;
            if (violation.line) {
              markdown += `- **位置**: 第 ${violation.line} 行${violation.column ? `, 第 ${violation.column} 列` : ''}\n`;
            }
            if (violation.codeSnippet) {
              markdown += `- **代码片段**:\n  \`\`\`\n  ${violation.codeSnippet}\n  \`\`\`\n`;
            }
            if (violation.suggestion) {
              markdown += `- **建议**: ${violation.suggestion}\n`;
            }
            markdown += '\n';
          });
        }
      } else if (result.ruleResults.length === 0) {
        markdown += '### 📋 规则检查\n✅ 规则检查通过\n\n';
      } else {
        // 兼容旧格式
        markdown += `### 📋 规则检查 (${result.ruleResults.length} 个问题)\n\n`;
        result.ruleResults.forEach(issue => {
          markdown += `❌ ${issue}\n`;
        });
        markdown += '\n';
      }

      if (mode === 'ai' || mode === 'full') {
        markdown += `### 🤖 AI 审查\n\n${result.aiResults}\n\n`;
      }

      markdown += '---\n\n';
    });

    return markdown;
  }

  /**
   * 生成JSON格式的报告数据
   */
  private generateJsonReport(results: ReviewResult[]): JsonReportData {
    const projectInfo = this.getProjectInfo();
    
    const severityStats = this.calculateSeverityStats(results);
    const categoryStats = this.calculateCategoryStats(results);
    
    // 收集所有严重问题
    const criticalIssues: RuleViolation[] = [];
    results.forEach(result => {
      if (result.ruleViolations) {
        criticalIssues.push(...result.ruleViolations.filter(v => v.severity === 'critical'));
      }
    });
    
    // 按数量排序分类
    const topCategories = Object.entries(categoryStats)
      .map(([categoryId, count]) => ({
        categoryId,
        categoryName: this.getCategoryName(categoryId),
        count
      }))
      .sort((a, b) => b.count - a.count);

    return {
      // metadata: {
      //   generatedAt: timestamp,
      //   reviewMode: mode,
      //   toolVersion: 'cr v1.0.0',
      //   totalFiles,
      //   totalIssues: ruleIssues,
      //   filesWithIssues,
      //   aiProcessed,
      //   cacheHits: cached
      // },
      projectInfo: {
        projectGroupName: projectInfo.projectGroupName,
        projectName: projectInfo.projectName,
        developerName: projectInfo.developerName
      },
      statistics: {
        severityDistribution: severityStats,
        categoryDistribution: categoryStats
      },
      files: results.map(result => ({
        filePath: result.filePath,
        ruleViolations: result.ruleViolations || [],
        aiResults: result.aiResults,
        issueCount: result.ruleViolations?.length || result.ruleResults.length
      })),
      summary: {
        topCategories,
        criticalIssues
      }
    };
  }

  /**
   * 公开的生成Markdown内容方法
   */
  public generateMarkdownContent(results: ReviewResult[], mode: string): string {
    return this.generateMarkdownReport(results, mode);
  }

  /**
   * 公开的生成JSON内容方法
   */
  public generateJsonContent(results: ReviewResult[]): JsonReportData {
    return this.generateJsonReport(results);
  }

  /**
   * 按严重程度统计
   */
  private calculateSeverityStats(results: ReviewResult[]) {
    const stats = { critical: 0, major: 0, minor: 0, info: 0 };
    
    results.forEach(result => {
      if (result.ruleViolations) {
        result.ruleViolations.forEach(violation => {
          stats[violation.severity] = (stats[violation.severity] || 0) + 1;
        });
      }
    });
    
    return stats;
  }

  /**
   * 按分类统计
   */
  private calculateCategoryStats(results: ReviewResult[]) {
    const stats: Record<string, number> = {};
    
    results.forEach(result => {
      if (result.ruleViolations) {
        result.ruleViolations.forEach(violation => {
          stats[violation.categoryId] = (stats[violation.categoryId] || 0) + 1;
        });
      }
    });
    
    return stats;
  }

  /**
   * 按分类分组违反规则
   */
  private groupViolationsByCategory(violations: RuleViolation[]) {
    return violations.reduce((groups, violation) => {
      const category = violation.categoryId;
      if (!groups[category]) {
        groups[category] = [];
      }
      groups[category].push(violation);
      return groups;
    }, {} as Record<string, RuleViolation[]>);
  }

  /**
   * 获取分类名称
   */
  private getCategoryName(categoryId: string): string {
    const categoryMap: Record<string, string> = {
      'readability': '可读性与可维护性',
      'architecture': '架构与模块边界', 
      'security': '安全',
      'performance': '性能模式'
    };
    
    return categoryMap[categoryId] || categoryId;
  }

  /**
   * 获取严重程度图标
   */
  private getSeverityIcon(severity: string): string {
    const iconMap: Record<string, string> = {
      'critical': '🚨',
      'major': '⚠️',
      'minor': '💡',
      'info': 'ℹ️'
    };
    
    return iconMap[severity] || '❓';
  }

  /**
   * 保存审查报告（同时保存markdown和JSON格式）
   */
  public saveReport(results: ReviewResult[], mode: string): { 
    markdownPath: string; 
    jsonPath: string;
    jsonData: JsonReportData;
    markdownContent: string;
  } {
    const baseFileName = this.generateReportFileName();
    const nameWithoutExt = baseFileName.replace('.md', '');
    
    // 生成文件路径
    const markdownPath = path.join(this.reportsDir, `${nameWithoutExt}.md`);
    const jsonPath = path.join(this.reportsDir, `${nameWithoutExt}.json`);
    
    // 生成内容
    const markdownContent = this.generateMarkdownReport(results, mode);
    const jsonData = this.generateJsonReport(results);

    // 保存文件
    fs.writeFileSync(markdownPath, markdownContent, 'utf-8');
    fs.writeFileSync(jsonPath, JSON.stringify(jsonData, null, 2), 'utf-8');
    
    console.log(`📄 Markdown报告已保存: ${markdownPath}`);
    console.log(`🗄️  JSON数据已保存: ${jsonPath}`);
    
    return {
      markdownPath,
      jsonPath,
      jsonData,
      markdownContent
    };
  }

  /**
   * 仅保存markdown报告（保持向后兼容）
   */
  public saveMarkdownReport(results: ReviewResult[], mode: string): string {
    const fileName = this.generateReportFileName();
    const filePath = path.join(this.reportsDir, fileName);
    const content = this.generateMarkdownReport(results, mode);

    fs.writeFileSync(filePath, content, 'utf-8');
    
    return filePath;
  }

  /**
   * 仅保存JSON报告
   */
  public saveJsonReport(results: ReviewResult[]): { 
    jsonPath: string; 
    jsonData: JsonReportData;
  } {
    const baseFileName = this.generateReportFileName();
    const nameWithoutExt = baseFileName.replace('.md', '');
    const jsonPath = path.join(this.reportsDir, `${nameWithoutExt}.json`);
    
    const jsonData = this.generateJsonReport(results);
    fs.writeFileSync(jsonPath, JSON.stringify(jsonData, null, 2), 'utf-8');
    
    return {
      jsonPath,
      jsonData
    };
  }
}