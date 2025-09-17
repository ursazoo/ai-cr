import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { homedir } from 'os';
import { CodeFormatter } from '../utils/codeFormatter.js';
import { MarkdownBuilder } from '../utils/markdownBuilder.js';

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
  filePath?: string;
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

    // 使用 MarkdownBuilder 构建报告
    const builder = MarkdownBuilder.create();

    // 标题和项目信息
    builder
      .addHeading('AI 代码审查报告', 1)
      .addSection()
      .addHeading('📋 项目信息', 2)
      .addSection()
      .addTable(
        [
          { key: 'info', header: '项目信息' },
          { key: 'detail', header: '详情' }
        ],
        [
          { info: '项目组名称', detail: projectInfo.projectGroupName },
          { info: '项目名称', detail: projectInfo.projectName },
          { info: '开发者姓名', detail: projectInfo.developerName }
        ]
      )
      .addHorizontalRule()
      .addKeyValue('生成时间', timestamp)
      .addSection()
      .addHeading('📊 统计概览', 2)
      .addSection();

    // 基础统计表格
    builder
      .addHeading('基础统计', 3)
      .addTable(
        [
          { key: 'metric', header: '指标' },
          { key: 'value', header: '数值' }
        ],
        [
          { metric: '检查文件', value: totalFiles },
          { metric: '规则问题', value: ruleIssues },
          { metric: '问题文件', value: filesWithIssues },
          { metric: 'AI处理', value: aiProcessed },
          { metric: '缓存命中', value: cached }
        ]
      );

    // 严重程度分布表格
    builder
      .addHeading('问题严重程度分布', 3)
      .addTable(
        [
          { key: 'level', header: '级别' },
          { key: 'count', header: '数量' },
          { key: 'icon', header: '图标' }
        ],
        [
          { level: '严重 (Critical)', count: severityStats.critical, icon: '🚨' },
          { level: '重要 (Major)', count: severityStats.major, icon: '⚠️' },
          { level: '一般 (Minor)', count: severityStats.minor, icon: '💡' },
          { level: '提示 (Info)', count: severityStats.info, icon: 'ℹ️' }
        ]
      );

    // 问题分类分布表格
    const categoryRows = Object.entries(categoryStats).map(([categoryId, count]) => ({
      categoryId,
      categoryName: this.getCategoryName(categoryId),
      count
    }));

    builder
      .addHeading('问题分类分布', 3)
      .addTable(
        [
          { key: 'categoryId', header: '分类ID' },
          { key: 'categoryName', header: '分类名称' },
          { key: 'count', header: '数量' }
        ],
        categoryRows
      )
      .addHorizontalRule();

    // 遍历每个文件的结果
    results.forEach((result, index) => {
      builder.addHeading(`${index + 1}. ${result.filePath}`, 3);

      // 显示规则违反详情
      if (result.ruleViolations && result.ruleViolations.length > 0) {
        builder.addHeading(`📋 规则检查 (${result.ruleViolations.length} 个问题)`, 4);

        // 按严重程度分组
        const groupedByCategory = this.groupViolationsByCategory(result.ruleViolations);

        for (const [categoryId, violations] of Object.entries(groupedByCategory)) {
          const categoryName = this.getCategoryName(categoryId);
          const severityIcon = this.getSeverityIcon(violations[0]?.severity || 'info');

          builder.addHeading(`${severityIcon} ${categoryName}`, 5);

          violations.forEach(violation => {
            builder
              .addRaw(`**[${violation.categoryId}-${violation.ruleId}] ${violation.title}**\n`)
              .addListItem('描述', violation.description);

            if (violation.line) {
              const fileDisplay = violation.filePath ? `文件: ${violation.filePath}, ` : '';
              const location = `${fileDisplay}第 ${violation.line} 行${violation.column ? `, 第 ${violation.column} 列` : ''}`;
              builder.addListItem('位置', location);
            }

            if (violation.codeSnippet) {
              const formatResult = CodeFormatter.format(violation.codeSnippet, violation.filePath);
              const formattedCode = CodeFormatter.toMarkdown(formatResult);

              if (formatResult.isInline) {
                builder.addRaw(`- **代码片段**: ${formattedCode}\n`);
              } else {
                builder.addRaw(`- **代码片段**:\n${formattedCode}\n`);
              }
            }

            if (violation.suggestion) {
              builder.addListItem('建议', violation.suggestion);
            }

            builder.addLineBreak();
          });
        }
      } else if (result.ruleResults.length === 0) {
        builder
          .addHeading('📋 规则检查', 4)
          .addParagraph('✅ 规则检查通过');
      } else {
        // 兼容旧格式
        builder.addHeading(`📋 规则检查 (${result.ruleResults.length} 个问题)`, 4);
        const issueList = result.ruleResults.map(issue => `❌ ${issue}`);
        builder.addList(issueList);
      }

      // AI 审查结果
      if (mode === 'ai' || mode === 'full') {
        // 记录原始AI返回内容用于调试
        if (process.env.AI_CR_DEBUG === 'true') {
          console.log(`🐛 原始AI内容 (${result.filePath}):`, result.aiResults);
        }

        builder
          .addHeading('🤖 AI 审查', 4)
          .addSection();

        // 检查AI结果是否为空或包含错误信息
        if (!result.aiResults || result.aiResults.trim() === '') {
          builder.addParagraph('⚠️ AI 审查结果为空');
        } else if (result.aiResults.includes('static 模式下跳过') ||
                   result.aiResults.includes('API Key 未配置')) {
          builder.addParagraph(result.aiResults);
        } else {
          // 进行格式化处理
          builder.addAIContent(result.aiResults, 5);

          // 如果启用调试模式，记录处理后的内容
          if (process.env.AI_CR_DEBUG === 'true') {
            // 优化内存使用，避免创建不必要的字符串副本
            const currentLength = builder.getLength();
            const debugContent = currentLength > 500 ?
              '...' + builder.build().substring(currentLength - 500) :
              builder.build();
            console.log(`🐛 处理后内容 (${result.filePath}):`, debugContent);
          }
        }
      }

      builder.addHorizontalRule();
    });

    return builder.build();
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