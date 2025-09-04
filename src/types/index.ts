/**
 * AI CR 系统通用类型定义
 */

/**
 * 上下文提取策略枚举
 */
export enum ContextStrategy {
  DIFF_ONLY = 'diff_only',           // 仅diff内容，适合微小变更
  CONTEXT_WINDOW = 'context_window',  // diff + 上下文窗口，适合小变更
  AFFECTED_BLOCKS = 'affected_blocks', // 受影响的函数/类块，适合中等变更
  SMART_SUMMARY = 'smart_summary',    // 智能摘要，适合大变更
  FULL_FILE = 'full_file'             // 完整文件，适合新文件/重构
}

/**
 * 文件类型枚举
 */
export enum FileType {
  CONFIG = 'config',        // 配置文件
  TEST = 'test',           // 测试文件
  CORE = 'core',           // 核心代码
  DOCUMENTATION = 'docs',   // 文档文件
  BUILD = 'build'          // 构建脚本
}

/**
 * 变更分析结果
 */
export interface ChangeAnalysis {
  filePath: string;
  fileSize: number;           // 文件总行数
  changeRatio: number;        // 变更比例 (0-1)
  chunkCount: number;         // 变更块数量
  maxChunkSize: number;       // 最大连续变更行数
  totalChangedLines: number;  // 总变更行数
  additions: number;          // 新增行数
  deletions: number;          // 删除行数
  isNewFile: boolean;         // 是否为新文件
  isDeleted: boolean;         // 是否被删除
  fileType: FileType;         // 文件类型
  hasApiChanges: boolean;     // 是否涉及API变更（基于简单规则判断）
  strategy: ContextStrategy;  // 选定的策略
  estimatedTokens: number;    // 预估token消耗
}

/**
 * 智能上下文结果
 */
export interface SmartContext {
  strategy: ContextStrategy;
  content: string;
  metadata: {
    originalSize: number;      // 原文件大小（行数）
    compressedSize: number;    // 压缩后大小（行数）
    compressionRatio: number;  // 压缩比例
    estimatedTokens: number;   // 预估token数量
  };
}

/**
 * 带智能上下文的文件对象
 */
export interface FileWithSmartContext {
  filePath: string;
  context: SmartContext;
  analysis: ChangeAnalysis;
}

export interface CRResult {
  filePath: string;
  success: boolean;
  ruleViolations: RuleViolation[];
  aiAnalysis: string;
  metadata: {
    strategy: string;
    tokenCount: number;
    processingTime: number;
    cached: boolean;
  };
  error?: string;
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

export interface JsonReportData {
  metadata: {
    generatedAt: string;
    reviewMode: string;
    totalFiles: number;
    totalIssues: number;
    filesWithIssues: number;
    aiProcessed: number;
    cacheHits: number;
  };
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