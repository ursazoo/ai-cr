import { SmartContextExpander } from './smartContextExpander.js';
import { ContextStrategy, ChangeAnalysis, FileType, SmartContext, FileWithSmartContext } from '../types/index.js';
import { DependencyAnalyzer, FileDependency } from './dependencyAnalyzer.js';

// 重新导出原始的SmartContextExpander供其他模块使用
export { SmartContextExpander };
import * as fs from 'fs';
import * as path from 'path';

/**
 * 增强的上下文分析结果
 */
export interface EnhancedChangeAnalysis extends ChangeAnalysis {
  dependencyWeight: number;      // 依赖权重 (0-100)
  semanticComplexity: number;    // 语义复杂度 (0-100)  
  businessCriticality: number;   // 业务关键性 (0-100)
  testCoverage: number;         // 测试覆盖度 (0-100)
  architecturalRisk: number;    // 架构风险 (0-100)
  relatedFiles: string[];       // 相关文件列表
  contextRecommendation: ContextRecommendation; // 上下文建议
}

/**
 * 上下文推荐
 */
export interface ContextRecommendation {
  primaryStrategy: ContextStrategy;
  fallbackStrategies: ContextStrategy[];
  includeRelatedFiles: boolean;
  relatedFilesCount: number;
  reasoningSteps: string[];
  riskFactors: string[];
  optimizations: string[];
}

/**
 * 增强的上下文配置
 */
export interface EnhancedContextConfig {
  // 依赖分析配置
  dependency: {
    enabled: boolean;
    maxDepth: number;              // 最大依赖深度
    includeTransitive: boolean;    // 是否包含传递依赖
    weightImportance: boolean;     // 是否基于重要性加权
  };
  
  // 语义分析配置
  semantic: {
    enabled: boolean;
    analyzeComplexity: boolean;    // 分析代码复杂度
    detectPatterns: boolean;       // 检测设计模式
    analyzeNaming: boolean;        // 分析命名规范
  };

  // 业务上下文配置
  business: {
    enabled: boolean;
    criticalPaths: string[];       // 关键业务路径
    domainMapping: Record<string, number>; // 领域重要性映射
  };

  // 智能优化配置
  optimization: {
    dynamicStrategy: boolean;      // 动态策略选择
    adaptiveThreshold: boolean;    // 自适应阈值
    learningEnabled: boolean;      // 启用学习能力
    cacheStrategy: boolean;        // 缓存策略结果
  };
}

/**
 * 策略选择权重
 */
interface StrategyWeights {
  fileSize: number;
  changeRatio: number; 
  chunkDistribution: number;
  dependencyImportance: number;
  semanticComplexity: number;
  businessCriticality: number;
  historicalPerformance: number;
}

/**
 * 默认增强配置
 */
const DEFAULT_ENHANCED_CONFIG: EnhancedContextConfig = {
  dependency: {
    enabled: true,
    maxDepth: 3,
    includeTransitive: true,
    weightImportance: true
  },
  semantic: {
    enabled: true,
    analyzeComplexity: true,
    detectPatterns: true,
    analyzeNaming: true
  },
  business: {
    enabled: true,
    criticalPaths: ['/api/', '/auth/', '/payment/', '/security/'],
    domainMapping: {
      'auth': 100,
      'payment': 95,
      'security': 90,
      'api': 80,
      'core': 70,
      'utils': 50,
      'ui': 40,
      'test': 20
    }
  },
  optimization: {
    dynamicStrategy: true,
    adaptiveThreshold: true,
    learningEnabled: true,
    cacheStrategy: true
  }
};

/**
 * 增强的上下文扩展器
 * 
 * 在原有SmartContextExpander基础上，增加依赖分析、语义分析和业务上下文感知能力
 */
export class EnhancedContextExpander extends SmartContextExpander {
  private enhancedConfig: EnhancedContextConfig;
  private dependencyAnalyzer: DependencyAnalyzer;
  // private strategyPerformanceHistory: Map<string, number[]> = new Map(); // TODO: 实现性能历史跟踪
  private semanticCache: Map<string, any> = new Map();

  constructor(
    config: Partial<EnhancedContextConfig> = {},
    dependencyAnalyzer?: DependencyAnalyzer
  ) {
    super();
    this.enhancedConfig = this.mergeEnhancedConfig(DEFAULT_ENHANCED_CONFIG, config);
    this.dependencyAnalyzer = dependencyAnalyzer || new DependencyAnalyzer();
  }

  /**
   * 获取增强的智能上下文
   */
  public async getEnhancedFilesWithContext(filePaths: string[]): Promise<FileWithSmartContext[]> {
    const results: FileWithSmartContext[] = [];
    
    // 1. 批量分析依赖关系
    const dependencyResult = this.enhancedConfig.dependency.enabled 
      ? await this.dependencyAnalyzer.analyzeFiles(filePaths)
      : null;

    // 2. 为每个文件进行增强分析
    for (const filePath of filePaths) {
      try {
        const enhancedAnalysis = await this.performEnhancedAnalysis(filePath, dependencyResult?.files);
        const smartContext = await this.generateEnhancedContext(filePath, enhancedAnalysis);
        
        results.push({
          filePath,
          context: smartContext,
          analysis: enhancedAnalysis
        });
      } catch (error) {
        console.warn(`增强分析失败 ${filePath}:`, error);
        
        // 降级到基础分析
        const basicAnalysis = await this.analyzeFileChanges(filePath);
        const basicContext = await this.extractSmartContext(filePath, basicAnalysis);
        
        results.push({
          filePath,
          context: basicContext,
          analysis: basicAnalysis
        });
      }
    }

    // 3. 后处理：优化相关文件的上下文
    if (this.enhancedConfig.dependency.enabled && dependencyResult) {
      await this.optimizeRelatedContexts(results, dependencyResult.files);
    }

    return results;
  }

  /**
   * 执行增强分析
   */
  private async performEnhancedAnalysis(
    filePath: string, 
    dependencies?: Map<string, FileDependency>
  ): Promise<EnhancedChangeAnalysis> {
    
    // 获取基础分析
    const baseAnalysis = await this.analyzeFileChanges(filePath);
    
    // 增强分析
    const dependencyWeight = this.calculateDependencyWeight(filePath, dependencies);
    const semanticComplexity = await this.analyzeSemanticComplexity(filePath);
    const businessCriticality = this.assessBusinessCriticality(filePath);
    const testCoverage = await this.estimateTestCoverage(filePath, dependencies);
    const architecturalRisk = this.assessArchitecturalRisk(baseAnalysis, dependencies?.get(filePath));
    const relatedFiles = this.identifyRelatedFiles(filePath, dependencies);
    
    // 生成上下文推荐
    const contextRecommendation = await this.generateContextRecommendation(
      baseAnalysis,
      {
        dependencyWeight,
        semanticComplexity,
        businessCriticality,
        testCoverage,
        architecturalRisk,
        relatedFiles
      }
    );

    // 根据推荐更新策略
    const enhancedStrategy = this.enhancedConfig.optimization.dynamicStrategy 
      ? contextRecommendation.primaryStrategy
      : baseAnalysis.strategy;

    return {
      ...baseAnalysis,
      strategy: enhancedStrategy,
      dependencyWeight,
      semanticComplexity,
      businessCriticality,
      testCoverage,
      architecturalRisk,
      relatedFiles,
      contextRecommendation
    };
  }

  /**
   * 计算依赖权重
   */
  private calculateDependencyWeight(
    filePath: string, 
    dependencies?: Map<string, FileDependency>
  ): number {
    if (!dependencies || !this.enhancedConfig.dependency.enabled) {
      return 0;
    }

    const fileDep = dependencies.get(filePath);
    if (!fileDep) {
      return 0;
    }

    let weight = 0;
    
    // 被依赖数量权重 (50%)
    const dependentCount = fileDep.dependents.length;
    weight += Math.min(dependentCount * 10, 50);
    
    // 依赖深度权重 (30%)
    const maxDependencyDepth = this.calculateMaxDependencyDepth(filePath, dependencies);
    weight += Math.min(maxDependencyDepth * 5, 30);
    
    // 循环依赖惩罚 (20%)
    const hasCircularDep = this.hasCircularDependencies(filePath, dependencies);
    if (hasCircularDep) {
      weight += 20;
    }

    return Math.min(weight, 100);
  }

  /**
   * 分析语义复杂度
   */
  private async analyzeSemanticComplexity(filePath: string): Promise<number> {
    if (!this.enhancedConfig.semantic.enabled) {
      return 0;
    }

    // 检查缓存
    if (this.semanticCache.has(filePath)) {
      return this.semanticCache.get(filePath).complexity;
    }

    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      let complexity = 0;

      // 代码复杂度分析 (40%)
      if (this.enhancedConfig.semantic.analyzeComplexity) {
        complexity += this.calculateCyclomaticComplexity(content) * 0.4;
      }

      // 模式检测 (30%)
      if (this.enhancedConfig.semantic.detectPatterns) {
        complexity += this.detectDesignPatterns(content) * 0.3;
      }

      // 命名分析 (30%)
      if (this.enhancedConfig.semantic.analyzeNaming) {
        complexity += this.analyzeNamingComplexity(content) * 0.3;
      }

      // 缓存结果
      this.semanticCache.set(filePath, { complexity, timestamp: Date.now() });
      
      return Math.min(complexity, 100);
    } catch (error) {
      console.warn(`语义分析失败 ${filePath}:`, error);
      return 50; // 默认中等复杂度
    }
  }

  /**
   * 评估业务关键性
   */
  private assessBusinessCriticality(filePath: string): number {
    if (!this.enhancedConfig.business.enabled) {
      return 50; // 默认中等重要性
    }

    let criticality = 0;

    // 检查关键路径
    for (const criticalPath of this.enhancedConfig.business.criticalPaths) {
      if (filePath.includes(criticalPath)) {
        criticality = Math.max(criticality, 80);
      }
    }

    // 检查领域映射
    for (const [domain, weight] of Object.entries(this.enhancedConfig.business.domainMapping)) {
      if (filePath.toLowerCase().includes(domain.toLowerCase())) {
        criticality = Math.max(criticality, weight);
      }
    }

    // 基于文件名的启发式判断
    const lowercasePath = filePath.toLowerCase();
    if (lowercasePath.includes('index') || lowercasePath.includes('main')) {
      criticality = Math.max(criticality, 70);
    }
    if (lowercasePath.includes('config') || lowercasePath.includes('constant')) {
      criticality = Math.max(criticality, 60);
    }
    if (lowercasePath.includes('util') || lowercasePath.includes('helper')) {
      criticality = Math.max(criticality, 30);
    }

    return criticality || 40; // 默认40分
  }

  /**
   * 估算测试覆盖度
   */
  private async estimateTestCoverage(
    filePath: string, 
    _dependencies?: Map<string, FileDependency>
  ): Promise<number> {
    try {
      // 寻找对应的测试文件
      const testFiles = this.findTestFiles(filePath);
      if (testFiles.length === 0) {
        return 0;
      }

      let totalCoverage = 0;
      for (const testFile of testFiles) {
        if (fs.existsSync(testFile)) {
          const testContent = fs.readFileSync(testFile, 'utf-8');
          const coverage = this.analyzeTestCoverage(filePath, testContent);
          totalCoverage += coverage;
        }
      }

      return Math.min(totalCoverage / testFiles.length, 100);
    } catch (error) {
      return 0;
    }
  }

  /**
   * 评估架构风险
   */
  private assessArchitecturalRisk(
    analysis: ChangeAnalysis, 
    dependency?: FileDependency
  ): number {
    let risk = 0;

    // 大规模变更风险 (30%)
    if (analysis.changeRatio > 0.7) {
      risk += 30;
    } else if (analysis.changeRatio > 0.4) {
      risk += 15;
    }

    // API变更风险 (25%)
    if (analysis.hasApiChanges) {
      risk += 25;
    }

    // 依赖复杂性风险 (25%)
    if (dependency) {
      const depRisk = Math.min(dependency.dependents.length * 2, 25);
      risk += depRisk;
    }

    // 文件类型风险 (20%)
    if (analysis.fileType === FileType.CORE) {
      risk += 20;
    } else if (analysis.fileType === FileType.CONFIG) {
      risk += 15;
    }

    return Math.min(risk, 100);
  }

  /**
   * 识别相关文件
   */
  private identifyRelatedFiles(
    filePath: string, 
    dependencies?: Map<string, FileDependency>
  ): string[] {
    if (!dependencies) {
      return [];
    }

    const related = this.dependencyAnalyzer.getRelatedFiles(filePath, 2);
    return related.related.slice(0, 5); // 限制数量
  }

  /**
   * 生成上下文推荐
   */
  private async generateContextRecommendation(
    baseAnalysis: ChangeAnalysis,
    enhancements: {
      dependencyWeight: number;
      semanticComplexity: number;
      businessCriticality: number;
      testCoverage: number;
      architecturalRisk: number;
      relatedFiles: string[];
    }
  ): Promise<ContextRecommendation> {
    
    const reasoningSteps: string[] = [];
    const riskFactors: string[] = [];
    const optimizations: string[] = [];

    // 计算各因素的权重分数
    const scores = this.calculateStrategyScores(baseAnalysis, enhancements);
    
    // 选择最佳策略
    const sortedStrategies = Object.entries(scores)
      .sort(([,a], [,b]) => b - a)
      .map(([strategy]) => strategy as ContextStrategy);

    const primaryStrategy = sortedStrategies[0] || ContextStrategy.FULL_FILE;
    const fallbackStrategies = sortedStrategies.slice(1, 3);

    // 生成推理步骤
    reasoningSteps.push(`文件大小: ${baseAnalysis.fileSize}行`);
    reasoningSteps.push(`变更比例: ${Math.round(baseAnalysis.changeRatio * 100)}%`);
    reasoningSteps.push(`依赖权重: ${enhancements.dependencyWeight}分`);
    reasoningSteps.push(`业务关键性: ${enhancements.businessCriticality}分`);
    reasoningSteps.push(`选择策略: ${primaryStrategy} (评分: ${scores[primaryStrategy]?.toFixed(1) || 'N/A'})`);

    // 识别风险因素
    if (enhancements.architecturalRisk > 70) {
      riskFactors.push('高架构风险，需要额外上下文');
    }
    if (enhancements.testCoverage < 50) {
      riskFactors.push('测试覆盖度低，建议包含相关测试文件');
    }
    if (enhancements.dependencyWeight > 60) {
      riskFactors.push('强依赖关系，建议包含依赖文件');
    }

    // 生成优化建议
    if (enhancements.relatedFiles.length > 0) {
      optimizations.push('包含相关文件以提供更好的上下文');
    }
    if (baseAnalysis.estimatedTokens > 3000) {
      optimizations.push('考虑使用智能摘要以减少token使用');
    }

    return {
      primaryStrategy,
      fallbackStrategies,
      includeRelatedFiles: enhancements.relatedFiles.length > 0 && enhancements.dependencyWeight > 40,
      relatedFilesCount: Math.min(enhancements.relatedFiles.length, 3),
      reasoningSteps,
      riskFactors,
      optimizations
    };
  }

  /**
   * 计算策略评分
   */
  private calculateStrategyScores(
    baseAnalysis: ChangeAnalysis,
    enhancements: any
  ): Record<ContextStrategy, number> {
    
    const weights: StrategyWeights = {
      fileSize: 0.2,
      changeRatio: 0.25,
      chunkDistribution: 0.15,
      dependencyImportance: 0.15,
      semanticComplexity: 0.1,
      businessCriticality: 0.1,
      historicalPerformance: 0.05
    };

    const scores: Record<ContextStrategy, number> = {
      [ContextStrategy.DIFF_ONLY]: 0,
      [ContextStrategy.CONTEXT_WINDOW]: 0,
      [ContextStrategy.AFFECTED_BLOCKS]: 0,
      [ContextStrategy.SMART_SUMMARY]: 0,
      [ContextStrategy.FULL_FILE]: 0
    };

    // 文件大小因素
    if (baseAnalysis.fileSize < 50) {
      scores[ContextStrategy.FULL_FILE] += 80 * weights.fileSize;
    } else if (baseAnalysis.fileSize < 200) {
      scores[ContextStrategy.AFFECTED_BLOCKS] += 70 * weights.fileSize;
      scores[ContextStrategy.CONTEXT_WINDOW] += 60 * weights.fileSize;
    } else if (baseAnalysis.fileSize < 500) {
      scores[ContextStrategy.SMART_SUMMARY] += 80 * weights.fileSize;
      scores[ContextStrategy.AFFECTED_BLOCKS] += 60 * weights.fileSize;
    } else {
      scores[ContextStrategy.SMART_SUMMARY] += 90 * weights.fileSize;
    }

    // 变更比例因素
    if (baseAnalysis.changeRatio < 0.1) {
      scores[ContextStrategy.DIFF_ONLY] += 90 * weights.changeRatio;
      scores[ContextStrategy.CONTEXT_WINDOW] += 70 * weights.changeRatio;
    } else if (baseAnalysis.changeRatio < 0.3) {
      scores[ContextStrategy.CONTEXT_WINDOW] += 80 * weights.changeRatio;
      scores[ContextStrategy.AFFECTED_BLOCKS] += 70 * weights.changeRatio;
    } else if (baseAnalysis.changeRatio < 0.7) {
      scores[ContextStrategy.AFFECTED_BLOCKS] += 80 * weights.changeRatio;
      scores[ContextStrategy.SMART_SUMMARY] += 70 * weights.changeRatio;
    } else {
      scores[ContextStrategy.SMART_SUMMARY] += 60 * weights.changeRatio;
      scores[ContextStrategy.FULL_FILE] += 80 * weights.changeRatio;
    }

    // 依赖重要性因素
    if (enhancements.dependencyWeight > 60) {
      scores[ContextStrategy.AFFECTED_BLOCKS] += 70 * weights.dependencyImportance;
      scores[ContextStrategy.SMART_SUMMARY] += 60 * weights.dependencyImportance;
    }

    // 业务关键性因素
    if (enhancements.businessCriticality > 70) {
      scores[ContextStrategy.AFFECTED_BLOCKS] += 80 * weights.businessCriticality;
      scores[ContextStrategy.SMART_SUMMARY] += 70 * weights.businessCriticality;
    }

    // 语义复杂度因素
    if (enhancements.semanticComplexity > 60) {
      scores[ContextStrategy.FULL_FILE] += 60 * weights.semanticComplexity;
      scores[ContextStrategy.SMART_SUMMARY] += 80 * weights.semanticComplexity;
    }

    return scores;
  }

  /**
   * 生成增强上下文
   */
  private async generateEnhancedContext(
    filePath: string, 
    analysis: EnhancedChangeAnalysis
  ): Promise<SmartContext> {
    
    // 使用基础的上下文提取
    const baseContext = await this.extractSmartContext(filePath, analysis);
    
    // 如果需要包含相关文件，增强上下文内容
    if (analysis.contextRecommendation.includeRelatedFiles && analysis.relatedFiles.length > 0) {
      const enhancedContent = await this.includeRelatedFilesContext(
        baseContext.content,
        analysis.relatedFiles.slice(0, analysis.contextRecommendation.relatedFilesCount)
      );
      
      return {
        ...baseContext,
        content: enhancedContent,
        metadata: {
          ...baseContext.metadata,
          estimatedTokens: Math.floor(baseContext.metadata.estimatedTokens * 1.2) // 增加token估算
        }
      };
    }

    return baseContext;
  }

  /**
   * 包含相关文件上下文
   */
  private async includeRelatedFilesContext(baseContent: string, relatedFiles: string[]): Promise<string> {
    const parts = [baseContent, '', '// === 相关文件上下文 ==='];
    
    for (const relatedFile of relatedFiles) {
      try {
        if (fs.existsSync(relatedFile)) {
          const content = fs.readFileSync(relatedFile, 'utf-8');
          const summary = this.generateFileSummary(relatedFile, content);
          parts.push(``, `// ${relatedFile}`, summary);
        }
      } catch (error) {
        parts.push(`// ${relatedFile} - 读取失败`);
      }
    }
    
    return parts.join('\n');
  }

  /**
   * 生成文件摘要
   */
  private generateFileSummary(_filePath: string, content: string): string {
    const lines = content.split('\n');
    const summary: string[] = [];
    
    // 文件头部（imports等）
    const headerLines = lines.slice(0, 20).filter(line => 
      line.trim().startsWith('import') || 
      line.trim().startsWith('export') ||
      line.trim().startsWith('interface') ||
      line.trim().startsWith('type')
    );
    
    if (headerLines.length > 0) {
      summary.push('// 重要声明:');
      summary.push(...headerLines.slice(0, 10));
    }
    
    return summary.join('\n');
  }

  // 辅助方法实现
  private calculateMaxDependencyDepth(_filePath: string, _dependencies: Map<string, FileDependency>): number {
    // 简化实现
    return 2;
  }

  private hasCircularDependencies(_filePath: string, _dependencies: Map<string, FileDependency>): boolean {
    // 简化实现
    return false;
  }

  private calculateCyclomaticComplexity(content: string): number {
    // 简化的圈复杂度计算
    const complexityKeywords = ['if', 'for', 'while', 'switch', 'catch', 'case', '&&', '||'];
    let complexity = 1; // 基础复杂度
    
    for (const keyword of complexityKeywords) {
      const matches = content.match(new RegExp(`\\b${keyword}\\b`, 'g'));
      complexity += matches ? matches.length : 0;
    }
    
    return Math.min(complexity / 2, 100); // 标准化到0-100
  }

  private detectDesignPatterns(content: string): number {
    // 简化的设计模式检测
    const patterns = [
      /class.*Factory/,
      /class.*Builder/,
      /class.*Observer/,
      /class.*Strategy/,
      /class.*Adapter/
    ];
    
    let score = 0;
    for (const pattern of patterns) {
      if (pattern.test(content)) {
        score += 20;
      }
    }
    
    return Math.min(score, 100);
  }

  private analyzeNamingComplexity(content: string): number {
    // 简化的命名复杂度分析
    const lines = content.split('\n');
    let complexity = 0;
    
    for (const line of lines) {
      // 检查过长的变量名（可能过于复杂）
      const longNames = line.match(/\b\w{20,}\b/g);
      if (longNames) {
        complexity += longNames.length * 10;
      }
      
      // 检查缩写过多的变量名
      const abbreviations = line.match(/\b[a-z]{1,3}\b/g);
      if (abbreviations && abbreviations.length > 3) {
        complexity += 5;
      }
    }
    
    return Math.min(complexity / 10, 100);
  }

  private findTestFiles(filePath: string): string[] {
    const testFiles: string[] = [];
    const baseName = path.basename(filePath, path.extname(filePath));
    const dir = path.dirname(filePath);
    
    // 常见的测试文件模式
    const testPatterns = [
      `${baseName}.test.ts`,
      `${baseName}.test.js`,
      `${baseName}.spec.ts`, 
      `${baseName}.spec.js`,
      `__tests__/${baseName}.test.ts`,
      `__tests__/${baseName}.test.js`
    ];
    
    for (const pattern of testPatterns) {
      const testPath = path.join(dir, pattern);
      if (fs.existsSync(testPath)) {
        testFiles.push(testPath);
      }
    }
    
    return testFiles;
  }

  private analyzeTestCoverage(filePath: string, testContent: string): number {
    // 简化的测试覆盖度分析
    const sourceContent = fs.readFileSync(filePath, 'utf-8');
    const functions = sourceContent.match(/function\s+\w+|const\s+\w+\s*=/g);
    const testCases = testContent.match(/it\(|test\(/g);
    
    if (!functions || functions.length === 0) {
      return 0;
    }
    
    const testCount = testCases ? testCases.length : 0;
    return Math.min((testCount / functions.length) * 100, 100);
  }

  private async optimizeRelatedContexts(
    _results: FileWithSmartContext[],
    _dependencies: Map<string, FileDependency>
  ): Promise<void> {
    // 后续优化：可以基于依赖关系进一步优化上下文
    // 这里暂时保持简单实现
  }

  private mergeEnhancedConfig(
    defaultConfig: EnhancedContextConfig,
    userConfig: Partial<EnhancedContextConfig>
  ): EnhancedContextConfig {
    return {
      dependency: { ...defaultConfig.dependency, ...userConfig.dependency },
      semantic: { ...defaultConfig.semantic, ...userConfig.semantic },
      business: { ...defaultConfig.business, ...userConfig.business },
      optimization: { ...defaultConfig.optimization, ...userConfig.optimization }
    };
  }
}