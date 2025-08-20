import { execSync } from 'child_process';
import * as fs from 'fs';

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

/**
 * diff统计信息
 */
interface DiffStats {
  additions: number;
  deletions: number;
  chunks: DiffChunk[];
}

/**
 * diff变更块
 */
interface DiffChunk {
  startLine: number;
  endLine: number;
  size: number;
  type: 'addition' | 'deletion' | 'modification';
}

/**
 * 配置选项
 */
export interface SmartContextConfig {
  maxTokensPerFile: number;    // 单文件最大token数
  contextWindowSize: number;   // 上下文窗口大小
  enableCaching: boolean;      // 是否启用缓存
  aggressiveCompression: boolean; // 是否使用激进压缩
}

/**
 * 从环境变量加载配置
 */
function loadConfigFromEnv(): SmartContextConfig {
  return {
    maxTokensPerFile: parseInt(process.env.MAX_TOKENS_PER_FILE || '4000'),
    contextWindowSize: parseInt(process.env.CONTEXT_WINDOW_SIZE || '20'),
    enableCaching: process.env.ENABLE_SMART_CACHE !== 'false',
    aggressiveCompression: process.env.CONTEXT_STRATEGY === 'aggressive'
  };
}

/**
 * 默认配置
 */
export const DEFAULT_CONFIG: SmartContextConfig = loadConfigFromEnv();

/**
 * 智能上下文扩展器主类
 * 
 * 负责分析文件变更并选择最优的上下文提取策略
 */
export class SmartContextExpander {
  private config: SmartContextConfig;
  private cache: Map<string, ChangeAnalysis> = new Map();

  constructor(config: Partial<SmartContextConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * 获取所有变更文件的智能上下文
   */
  public async getChangedFilesWithSmartContext(): Promise<FileWithSmartContext[]> {
    try {
      const changedFiles = await this.getChangedFilesList();
      const results: FileWithSmartContext[] = [];

      for (const filePath of changedFiles) {
        try {
          const analysis = await this.analyzeFileChanges(filePath);
          const context = await this.extractSmartContext(filePath, analysis);
          
          results.push({
            filePath,
            context,
            analysis
          });
        } catch (error) {
          console.warn(`跳过文件 ${filePath}:`, error instanceof Error ? error.message : error);
          // 发生错误时不中断整个流程，跳过该文件继续处理其他文件
          continue;
        }
      }

      return results;
    } catch (error) {
      console.error('获取变更文件失败:', error);
      // 发生严重错误时返回空数组，避免整个流程崩溃
      return [];
    }
  }

  /**
   * 获取Git变更文件列表
   */
  private async getChangedFilesList(): Promise<string[]> {
    let gitCommand: string;
    
    try {
      // 检查是否为初始提交
      execSync('git rev-parse HEAD~1', { encoding: 'utf-8', stdio: 'pipe' });
      gitCommand = 'git diff --name-only HEAD~1';
    } catch {
      // 初始提交场景：获取当前提交的所有文件
      gitCommand = 'git ls-tree -r --name-only HEAD';
    }
    
    const output = execSync(gitCommand, { encoding: 'utf-8' });
    return output
      .split('\\n')
      .filter(Boolean)
      .filter(file => fs.existsSync(file));
  }

  /**
   * 分析单个文件的变更情况
   */
  private async analyzeFileChanges(filePath: string): Promise<ChangeAnalysis> {
    // 检查缓存
    const cacheKey = this.getCacheKey(filePath);
    if (this.config.enableCaching && this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    // 获取文件基本信息
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const fileSize = fileContent.split('\\n').length;
    const fileType = this.detectFileType(filePath);

    // 获取diff信息
    const diffStats = await this.getDiffStats(filePath);
    
    // 计算变更指标
    const totalChangedLines = diffStats.additions + diffStats.deletions;
    const changeRatio = fileSize > 0 ? totalChangedLines / fileSize : 0;
    const maxChunkSize = diffStats.chunks.length > 0 
      ? Math.max(...diffStats.chunks.map(chunk => chunk.size))
      : 0;

    // 检查是否涉及API变更
    const hasApiChanges = await this.detectApiChanges(filePath, fileContent);

    // 构建分析结果
    const analysis: ChangeAnalysis = {
      filePath,
      fileSize,
      changeRatio,
      chunkCount: diffStats.chunks.length,
      maxChunkSize,
      totalChangedLines,
      additions: diffStats.additions,
      deletions: diffStats.deletions,
      isNewFile: diffStats.deletions === 0 && diffStats.additions === fileSize,
      isDeleted: diffStats.additions === 0 && fileSize === 0,
      fileType,
      hasApiChanges,
      strategy: ContextStrategy.FULL_FILE, // 临时值，稍后确定
      estimatedTokens: 0 // 临时值，稍后计算
    };

    // 选择最优策略
    analysis.strategy = this.selectOptimalStrategy(analysis);
    analysis.estimatedTokens = this.estimateTokens(analysis);

    // 缓存结果
    if (this.config.enableCaching) {
      this.cache.set(cacheKey, analysis);
    }

    return analysis;
  }

  /**
   * 获取diff统计信息
   */
  private async getDiffStats(filePath: string): Promise<DiffStats> {
    try {
      // 使用git diff --numstat获取精确统计
      const numstatOutput = execSync(
        `git diff HEAD~1 --numstat -- "${filePath}"`,
        { encoding: 'utf-8', stdio: 'pipe' }
      ).toString().trim();

      let additions = 0;
      let deletions = 0;

      if (numstatOutput) {
        const parts = numstatOutput.split('\\t');
        if (parts.length >= 2) {
          additions = parseInt(parts[0] || '0') || 0;
          deletions = parseInt(parts[1] || '0') || 0;
        }
      }

      // 获取详细的diff信息用于分析变更块
      const chunks = await this.parseDiffChunks(filePath);

      return {
        additions,
        deletions,
        chunks
      };
    } catch (error) {
      // diff获取失败时返回默认值
      console.warn(`获取${filePath}的diff信息失败:`, error);
      return {
        additions: 0,
        deletions: 0,
        chunks: []
      };
    }
  }

  /**
   * 解析diff变更块
   */
  private async parseDiffChunks(filePath: string): Promise<DiffChunk[]> {
    try {
      const diffOutput = execSync(
        `git diff HEAD~1 -- "${filePath}"`,
        { encoding: 'utf-8', stdio: 'pipe' }
      ).toString();

      if (!diffOutput.trim()) {
        return [];
      }

      const chunks: DiffChunk[] = [];
      const lines = diffOutput.split('\n');
      
      let currentChunk: Partial<DiffChunk> | null = null;
      let currentLineNum = 0;

      for (const line of lines) {
        // 解析@@行信息，例如：@@ -10,7 +10,9 @@
        const chunkHeaderMatch = line.match(/^@@\s+-(\d+),?\d*\s+\+(\d+),?\d*\s+@@/);
        if (chunkHeaderMatch) {
          // 保存前一个chunk
          if (currentChunk && currentChunk.startLine !== undefined) {
            chunks.push({
              startLine: currentChunk.startLine,
              endLine: currentLineNum - 1,
              size: currentLineNum - currentChunk.startLine,
              type: currentChunk.type || 'modification'
            });
          }

          // 开始新的chunk
          currentLineNum = parseInt(chunkHeaderMatch[2] || '0'); // 新文件的起始行号
          currentChunk = {
            startLine: currentLineNum,
            type: 'modification'
          };
          continue;
        }

        // 跳过非内容行
        if (line.startsWith('diff ') || line.startsWith('index ') || 
            line.startsWith('---') || line.startsWith('+++')) {
          continue;
        }

        // 分析变更类型
        if (currentChunk) {
          if (line.startsWith('+') && !line.startsWith('+++')) {
            currentChunk.type = 'addition';
            currentLineNum++;
          } else if (line.startsWith('-') && !line.startsWith('---')) {
            currentChunk.type = currentChunk.type === 'addition' ? 'modification' : 'deletion';
            // 删除行不增加行号
          } else if (line.startsWith(' ') || line === '') {
            // 上下文行
            currentLineNum++;
          }
        }
      }

      // 保存最后一个chunk
      if (currentChunk && currentChunk.startLine !== undefined) {
        chunks.push({
          startLine: currentChunk.startLine,
          endLine: currentLineNum,
          size: currentLineNum - currentChunk.startLine + 1,
          type: currentChunk.type || 'modification'
        });
      }

      return chunks;
    } catch (error) {
      console.warn(`解析${filePath}的diff块失败:`, error);
      return [];
    }
  }

  /**
   * 检测文件类型
   */
  private detectFileType(filePath: string): FileType {
    const ext = filePath.toLowerCase();
    
    if (ext.includes('test') || ext.includes('spec') || ext.includes('__tests__')) {
      return FileType.TEST;
    }
    
    if (ext.endsWith('.md') || ext.endsWith('.txt') || ext.endsWith('.doc')) {
      return FileType.DOCUMENTATION;
    }
    
    if (ext.includes('config') || ext.endsWith('.json') || ext.endsWith('.yml') || 
        ext.endsWith('.yaml') || ext.endsWith('.env')) {
      return FileType.CONFIG;
    }
    
    if (ext.includes('build') || ext.includes('webpack') || ext.includes('rollup') ||
        ext.endsWith('.sh') || ext.endsWith('.bat')) {
      return FileType.BUILD;
    }
    
    return FileType.CORE;
  }

  /**
   * 检测是否涉及API变更（基于简单规则）
   */
  private async detectApiChanges(_filePath: string, content: string): Promise<boolean> {
    // 简单的API变更检测规则
    const apiPatterns = [
      /export\s+(function|class|interface|type|const)/,
      /public\s+(function|class)/,
      /interface\s+\w+/,
      /type\s+\w+\s*=/
    ];

    return apiPatterns.some(pattern => pattern.test(content));
  }

  /**
   * 选择最优的上下文策略
   */
  private selectOptimalStrategy(analysis: ChangeAnalysis): ContextStrategy {
    // 特殊情况优先处理
    if (analysis.isNewFile || analysis.fileSize < 50) {
      return ContextStrategy.FULL_FILE;
    }

    if (analysis.isDeleted) {
      return ContextStrategy.DIFF_ONLY;
    }

    // 配置文件通常需要完整上下文
    if (analysis.fileType === FileType.CONFIG && analysis.fileSize < 200) {
      return ContextStrategy.FULL_FILE;
    }

    // 基于变更比例和复杂度的策略选择
    if (analysis.changeRatio < 0.05 && analysis.chunkCount <= 2) {
      return ContextStrategy.DIFF_ONLY;
    }

    if (analysis.changeRatio < 0.15 && analysis.chunkCount <= 3) {
      return ContextStrategy.CONTEXT_WINDOW;
    }

    if (analysis.changeRatio < 0.4 && !analysis.hasApiChanges) {
      return ContextStrategy.AFFECTED_BLOCKS;
    }

    if (analysis.changeRatio > 0.6 || analysis.fileSize < 200) {
      return ContextStrategy.FULL_FILE;
    }

    // 默认使用智能摘要策略
    return ContextStrategy.SMART_SUMMARY;
  }

  /**
   * 估算token数量
   */
  private estimateTokens(analysis: ChangeAnalysis): number {
    const baseTokens = {
      [ContextStrategy.DIFF_ONLY]: 500,
      [ContextStrategy.CONTEXT_WINDOW]: 1000,
      [ContextStrategy.AFFECTED_BLOCKS]: 2000,
      [ContextStrategy.SMART_SUMMARY]: 3000,
      [ContextStrategy.FULL_FILE]: Math.min(analysis.fileSize * 8, this.config.maxTokensPerFile)
    };

    return baseTokens[analysis.strategy];
  }

  /**
   * 提取智能上下文
   */
  private async extractSmartContext(filePath: string, analysis: ChangeAnalysis): Promise<SmartContext> {
    const content = fs.readFileSync(filePath, 'utf-8');
    
    let extractedContent: string;
    let compressedSize: number;

    switch (analysis.strategy) {
      case ContextStrategy.DIFF_ONLY:
        extractedContent = await this.extractDiffOnly(filePath);
        break;
      case ContextStrategy.CONTEXT_WINDOW:
        extractedContent = await this.extractContextWindow(filePath, content);
        break;
      case ContextStrategy.AFFECTED_BLOCKS:
        extractedContent = await this.extractAffectedBlocks(filePath, content);
        break;
      case ContextStrategy.SMART_SUMMARY:
        extractedContent = await this.extractSmartSummary(filePath, content);
        break;
      case ContextStrategy.FULL_FILE:
      default:
        extractedContent = content;
        break;
    }

    compressedSize = extractedContent.split('\\n').length;
    const compressionRatio = analysis.fileSize > 0 ? compressedSize / analysis.fileSize : 1;

    return {
      strategy: analysis.strategy,
      content: extractedContent,
      metadata: {
        originalSize: analysis.fileSize,
        compressedSize,
        compressionRatio,
        estimatedTokens: analysis.estimatedTokens
      }
    };
  }

  /**
   * 策略1: 仅提取diff内容
   */
  private async extractDiffOnly(filePath: string): Promise<string> {
    try {
      const diffOutput = execSync(
        `git diff HEAD~1 -- "${filePath}"`,
        { encoding: 'utf-8', stdio: 'pipe' }
      ).toString();

      if (!diffOutput.trim()) {
        return `文件 ${filePath} 无变更内容`;
      }

      return `文件变更: ${filePath}\n\n${diffOutput}`;
    } catch (error) {
      console.warn(`提取${filePath}的diff失败:`, error);
      return `文件 ${filePath} diff提取失败`;
    }
  }

  /**
   * 策略2: diff + 上下文窗口
   */
  private async extractContextWindow(filePath: string, content: string): Promise<string> {
    try {
      const chunks = await this.parseDiffChunks(filePath);
      if (chunks.length === 0) {
        return content; // 无变更时返回全文
      }

      const lines = content.split('\n');
      const contextLines = new Set<number>();
      const windowSize = this.config.contextWindowSize;

      // 为每个变更块添加上下文窗口
      for (const chunk of chunks) {
        const start = Math.max(0, chunk.startLine - windowSize - 1);
        const end = Math.min(lines.length - 1, chunk.endLine + windowSize - 1);
        
        for (let i = start; i <= end; i++) {
          contextLines.add(i);
        }
      }

      // 构建带行号的上下文内容
      const contextContent: string[] = [`文件: ${filePath}`, ''];
      
      const sortedLines = Array.from(contextLines).sort((a, b) => a - b);
      let lastLine = -2;

      for (const lineNum of sortedLines) {
        // 如果行号不连续，添加省略标记
        if (lineNum > lastLine + 1) {
          contextContent.push('...');
        }
        
        contextContent.push(`${(lineNum + 1).toString().padStart(4, ' ')}: ${lines[lineNum] || ''}`);
        lastLine = lineNum;
      }

      return contextContent.join('\n');
    } catch (error) {
      console.warn(`提取${filePath}的上下文窗口失败:`, error);
      return content;
    }
  }

  /**
   * 策略3: 提取受影响的代码块（函数/类）
   */
  private async extractAffectedBlocks(filePath: string, content: string): Promise<string> {
    try {
      const chunks = await this.parseDiffChunks(filePath);
      if (chunks.length === 0) {
        return content;
      }

      const lines = content.split('\n');
      const affectedBlocks = new Set<string>();

      // 为每个变更块找到对应的函数/类边界
      for (const chunk of chunks) {
        const blockContent = this.findContainingBlock(lines, chunk.startLine, chunk.endLine);
        if (blockContent) {
          affectedBlocks.add(blockContent);
        }
      }

      if (affectedBlocks.size === 0) {
        // 如果没有找到代码块，回退到上下文窗口策略
        return this.extractContextWindow(filePath, content);
      }

      // 构建结果
      const result = [`文件: ${filePath}`, ''];
      
      // 添加文件头部（imports等）
      const headerContent = this.extractFileHeader(lines);
      if (headerContent) {
        result.push('// 文件头部', headerContent, '');
      }

      // 添加受影响的代码块
      result.push('// 受影响的代码块');
      Array.from(affectedBlocks).forEach(block => {
        result.push('', block);
      });

      return result.join('\n');
    } catch (error) {
      console.warn(`提取${filePath}的受影响代码块失败:`, error);
      return content;
    }
  }

  /**
   * 策略4: 智能摘要
   */
  private async extractSmartSummary(filePath: string, content: string): Promise<string> {
    try {
      const lines = content.split('\n');
      const chunks = await this.parseDiffChunks(filePath);
      
      const result = [`文件: ${filePath}`, ''];

      // 1. 文件头部（前30行或到第一个主要函数/类）
      const headerEnd = this.findHeaderEnd(lines);
      if (headerEnd > 0) {
        result.push('// === 文件头部 ===');
        for (let i = 0; i < headerEnd; i++) {
          result.push(`${(i + 1).toString().padStart(4, ' ')}: ${lines[i]}`);
        }
        result.push('');
      }

      // 2. 变更摘要
      if (chunks.length > 0) {
        result.push('// === 变更摘要 ===');
        result.push(`总共${chunks.length}个变更块:`);
        chunks.forEach((chunk, index) => {
          result.push(`${index + 1}. 第${chunk.startLine}-${chunk.endLine}行 (${chunk.type})`);
        });
        result.push('');
      }

      // 3. 关键变更内容（最重要的2-3个变更块）
      const importantChunks = this.selectImportantChunks(chunks, 3);
      if (importantChunks.length > 0) {
        result.push('// === 关键变更 ===');
        for (const chunk of importantChunks) {
          const contextStart = Math.max(0, chunk.startLine - 5);
          const contextEnd = Math.min(lines.length - 1, chunk.endLine + 5);
          
          result.push(`变更块 (${chunk.startLine}-${chunk.endLine}):`);
          for (let i = contextStart; i <= contextEnd; i++) {
            const marker = (i >= chunk.startLine - 1 && i <= chunk.endLine - 1) ? '→' : ' ';
            result.push(`${marker}${(i + 1).toString().padStart(4, ' ')}: ${lines[i]}`);
          }
          result.push('');
        }
      }

      return result.join('\n');
    } catch (error) {
      console.warn(`生成${filePath}的智能摘要失败:`, error);
      return content;
    }
  }

  /**
   * 查找包含变更的代码块
   */
  private findContainingBlock(lines: string[], startLine: number, endLine: number): string | null {
    // 向上查找函数/类的开始
    let blockStart = startLine - 1;
    const blockPatterns = [
      /^\s*(export\s+)?(async\s+)?function\s+/,
      /^\s*(export\s+)?class\s+/,
      /^\s*(export\s+)?interface\s+/,
      /^\s*(export\s+)?type\s+/,
      /^\s*(export\s+)?const\s+\w+\s*=\s*(async\s*)?\(/
    ];

    // 向上搜索到代码块开始
    while (blockStart >= 0) {
      const line = lines[blockStart];
      if (line && blockPatterns.some(pattern => pattern.test(line))) {
        break;
      }
      blockStart--;
    }

    if (blockStart < 0) {
      blockStart = Math.max(0, startLine - 10);
    }

    // 向下查找代码块结束
    let blockEnd = endLine - 1;
    let braceCount = 0;
    let foundOpenBrace = false;

    for (let i = blockStart; i < lines.length; i++) {
      const line = lines[i];
      if (!line) continue;
      
      // 计算大括号
      for (const char of line) {
        if (char === '{') {
          braceCount++;
          foundOpenBrace = true;
        } else if (char === '}') {
          braceCount--;
          if (foundOpenBrace && braceCount === 0) {
            blockEnd = i;
            break;
          }
        }
      }
      
      if (foundOpenBrace && braceCount === 0) {
        break;
      }
    }

    // 构建代码块内容
    const blockLines = lines.slice(blockStart, blockEnd + 1);
    return blockLines
      .map((line, index) => `${(blockStart + index + 1).toString().padStart(4, ' ')}: ${line}`)
      .join('\n');
  }

  /**
   * 提取文件头部（imports和类型定义）
   */
  private extractFileHeader(lines: string[]): string | null {
    const headerEnd = this.findHeaderEnd(lines);
    if (headerEnd <= 0) return null;

    return lines
      .slice(0, headerEnd)
      .map((line, index) => `${(index + 1).toString().padStart(4, ' ')}: ${line}`)
      .join('\n');
  }

  /**
   * 找到文件头部的结束位置
   */
  private findHeaderEnd(lines: string[]): number {
    const maxHeaderLines = 30; // 最多扫描前30行
    const importantPatterns = [
      /^import\s+/,
      /^export\s+.*from/,
      /^\/\*\*/, // JSDoc注释
      /^\/\//, // 单行注释
      /^export\s+type\s+/,
      /^export\s+interface\s+/,
      /^type\s+.*=/,
      /^interface\s+/
    ];

    let headerEnd = 0;
    
    for (let i = 0; i < Math.min(lines.length, maxHeaderLines); i++) {
      const line = lines[i]?.trim() || '';
      
      // 跳过空行和注释
      if (!line || line.startsWith('//') || line.startsWith('/*') || line.startsWith('*')) {
        headerEnd = i + 1;
        continue;
      }

      // 检查是否是头部内容
      const isHeaderContent = importantPatterns.some(pattern => pattern.test(line));
      if (isHeaderContent) {
        headerEnd = i + 1;
      } else if (line.includes('function') || line.includes('class') || line.includes('const')) {
        // 遇到主要的代码内容就停止
        break;
      }
    }

    return headerEnd;
  }

  /**
   * 选择最重要的变更块
   */
  private selectImportantChunks(chunks: DiffChunk[], maxCount: number): DiffChunk[] {
    if (chunks.length <= maxCount) {
      return chunks;
    }

    // 按大小排序，选择最大的几个变更块
    return chunks
      .sort((a, b) => b.size - a.size)
      .slice(0, maxCount);
  }

  /**
   * 生成缓存键
   */
  private getCacheKey(filePath: string): string {
    try {
      // 使用文件路径和最后修改时间生成缓存键
      const stats = fs.statSync(filePath);
      return `${filePath}:${stats.mtime.getTime()}`;
    } catch {
      return filePath;
    }
  }

  /**
   * 清除缓存
   */
  public clearCache(): void {
    this.cache.clear();
  }
}