import * as fs from 'fs';
import * as path from 'path';
import { EnhancedContextConfig } from './enhancedContextExpander.js';
import { DependencyAnalyzerConfig } from './dependencyAnalyzer.js';

/**
 * 全局配置接口
 */
export interface GlobalAICRConfig {
  // 项目基础信息
  project: {
    name: string;
    rootDir: string;
    outputDir: string;
    tempDir: string;
    logLevel: 'debug' | 'info' | 'warn' | 'error';
  };

  // Git配置
  git: {
    baseBranch: string;
    includeUntracked: boolean;
    maxDiffSize: number; // 最大diff文件大小(bytes)
    excludePatterns: string[];
  };

  // AI服务配置
  ai: {
    provider: 'openai' | 'anthropic' | 'azure' | 'local';
    apiKey?: string;
    baseURL?: string;
    model: string;
    temperature: number;
    maxTokens: number;
    timeout: number;
    retryCount: number;
    rateLimitDelay: number; // 速率限制延迟(ms)
  };

  // 分析规则配置
  rules: {
    enabled: string[]; // 启用的规则类别
    severity: {
      error: string[];
      warning: string[];
      info: string[];
    };
    custom: {
      [key: string]: any;
    };
    ignore: {
      files: string[];
      patterns: string[];
      rules: string[];
    };
  };

  // 组件特定配置
  components: {
    queue: Partial<{
      maxConcurrency: number;
      timeoutMs: number;
      retryAttempts: number;
    }>;
    context: Partial<EnhancedContextConfig>;
    dependency: Partial<DependencyAnalyzerConfig>;
    report: Partial<{
      outputDir: string;
      format: 'markdown' | 'json' | 'html';
      includeStats: boolean;
    }>;
  };

  // 集成配置
  integrations: {
    database?: {
      type: 'mongodb' | 'postgresql' | 'mysql' | 'sqlite';
      connectionString: string;
      collection?: string;
      table?: string;
    };
    webhook?: {
      url: string;
      secret?: string;
      events: string[];
    };
    slack?: {
      token: string;
      channel: string;
      mentionUsers: string[];
    };
    github?: {
      token: string;
      owner: string;
      repo: string;
      commentOnPR: boolean;
    };
  };

  // 性能优化配置
  performance: {
    enableCache: boolean;
    cacheDir: string;
    cacheTTL: number; // 缓存生存时间(秒)
    maxCacheSize: number; // 最大缓存大小(MB)
    parallelProcessing: boolean;
    maxWorkers: number;
    chunkSize: number;
  };

  // 实验性功能
  experimental: {
    enableLearning: boolean; // 启用机器学习优化
    enableMetrics: boolean;  // 启用详细指标收集
    enableTrends: boolean;   // 启用趋势分析
    enableAutoFix: boolean;  // 启用自动修复建议
  };
}

/**
 * 配置文件格式
 */
export type ConfigFormat = 'json' | 'yaml' | 'js' | 'env';

/**
 * 配置源
 */
export interface ConfigSource {
  type: 'file' | 'env' | 'cli' | 'default';
  source: string;
  priority: number; // 优先级，数字越大优先级越高
}

/**
 * 配置验证结果
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  suggestions: string[];
}

/**
 * 默认配置
 */
const DEFAULT_CONFIG: GlobalAICRConfig = {
  project: {
    name: 'AI Code Review',
    rootDir: process.cwd(),
    outputDir: './ai-cr-reports',
    tempDir: './.ai-cr-temp',
    logLevel: 'info'
  },
  
  git: {
    baseBranch: 'main',
    includeUntracked: false,
    maxDiffSize: 1024 * 1024, // 1MB
    excludePatterns: [
      'node_modules/**',
      'dist/**',
      '*.min.js',
      '*.map',
      'coverage/**',
      '.git/**'
    ]
  },

  ai: {
    provider: 'openai',
    model: 'gpt-4-turbo-preview',
    temperature: 0.3,
    maxTokens: 4000,
    timeout: 30000,
    retryCount: 3,
    rateLimitDelay: 1000
  },

  rules: {
    enabled: ['security', 'performance', 'codeQuality', 'architecture'],
    severity: {
      error: ['security', 'critical-bugs'],
      warning: ['performance', 'maintainability'],
      info: ['style', 'suggestions']
    },
    custom: {},
    ignore: {
      files: [],
      patterns: ['*.test.{js,ts}', '*.spec.{js,ts}'],
      rules: []
    }
  },

  components: {
    queue: {},
    context: {},
    dependency: {},
    report: {}
  },

  integrations: {},

  performance: {
    enableCache: true,
    cacheDir: './.ai-cr-cache',
    cacheTTL: 86400, // 24小时
    maxCacheSize: 100, // 100MB
    parallelProcessing: true,
    maxWorkers: 4,
    chunkSize: 10
  },

  experimental: {
    enableLearning: false,
    enableMetrics: true,
    enableTrends: false,
    enableAutoFix: false
  }
};

/**
 * 环境变量映射
 */
const ENV_MAPPING: Record<string, string> = {
  'AI_CR_PROJECT_NAME': 'project.name',
  'AI_CR_ROOT_DIR': 'project.rootDir',
  'AI_CR_OUTPUT_DIR': 'project.outputDir',
  'AI_CR_LOG_LEVEL': 'project.logLevel',
  
  'AI_CR_GIT_BASE_BRANCH': 'git.baseBranch',
  'AI_CR_GIT_INCLUDE_UNTRACKED': 'git.includeUntracked',
  
  'AI_CR_AI_PROVIDER': 'ai.provider',
  'AI_CR_AI_API_KEY': 'ai.apiKey',
  'AI_CR_AI_BASE_URL': 'ai.baseURL',
  'AI_CR_AI_MODEL': 'ai.model',
  'AI_CR_AI_TEMPERATURE': 'ai.temperature',
  'AI_CR_AI_MAX_TOKENS': 'ai.maxTokens',
  'AI_CR_AI_TIMEOUT': 'ai.timeout',
  
  'AI_CR_ENABLE_CACHE': 'performance.enableCache',
  'AI_CR_CACHE_DIR': 'performance.cacheDir',
  'AI_CR_CACHE_TTL': 'performance.cacheTTL',
  'AI_CR_MAX_WORKERS': 'performance.maxWorkers',
  
  'AI_CR_ENABLE_LEARNING': 'experimental.enableLearning',
  'AI_CR_ENABLE_METRICS': 'experimental.enableMetrics'
};

/**
 * 配置管理器
 * 
 * 负责加载、验证、合并和管理AI CR系统的所有配置
 */
export class ConfigManager {
  private config: GlobalAICRConfig;
  private configSources: ConfigSource[] = [];
  private configPath: string | null = null;
  private watchMode = false;

  constructor() {
    this.config = this.deepClone(DEFAULT_CONFIG);
  }

  /**
   * 加载配置
   */
  public async loadConfig(options: {
    configPath?: string;
    format?: ConfigFormat;
    watch?: boolean;
  } = {}): Promise<GlobalAICRConfig> {
    
    this.watchMode = options.watch || false;
    
    // 1. 加载默认配置
    this.addConfigSource({
      type: 'default',
      source: 'built-in',
      priority: 0
    });

    // 2. 自动查找配置文件
    if (!options.configPath) {
      const foundPath = this.findConfigFile();
      if (foundPath) {
        options.configPath = foundPath;
      }
    }

    // 3. 加载文件配置
    if (options.configPath && fs.existsSync(options.configPath)) {
      await this.loadFileConfig(options.configPath, options.format);
      this.configPath = options.configPath;
    }

    // 4. 加载环境变量配置
    this.loadEnvConfig();

    // 5. 合并配置
    await this.mergeConfigurations();

    // 6. 验证配置
    const validation = this.validateConfig();
    if (!validation.valid) {
      throw new Error(`配置验证失败:\n${validation.errors.join('\n')}`);
    }

    // 7. 设置监听（如果启用）
    if (this.watchMode && this.configPath) {
      this.watchConfigFile();
    }

    console.log(`✅ 配置加载完成，来源: ${this.configSources.map(s => s.source).join(', ')}`);
    return this.config;
  }

  /**
   * 获取配置
   */
  public getConfig(): GlobalAICRConfig {
    return this.config;
  }

  /**
   * 获取特定组件配置
   */
  public getComponentConfig<T>(component: keyof GlobalAICRConfig['components']): T {
    return this.config.components[component] as T;
  }

  /**
   * 更新配置
   */
  public updateConfig(updates: Partial<GlobalAICRConfig>): void {
    this.config = this.deepMerge(this.config, updates);
    
    // 触发配置更新事件（如果有监听器）
    this.notifyConfigChange();
  }

  /**
   * 保存配置到文件
   */
  public async saveConfig(outputPath?: string): Promise<void> {
    const savePath = outputPath || this.configPath || './ai-cr.config.json';
    
    // 移除敏感信息
    const safeConfig = this.sanitizeConfig(this.config);
    
    const content = JSON.stringify(safeConfig, null, 2);
    fs.writeFileSync(savePath, content, 'utf-8');
    
    console.log(`💾 配置已保存至: ${savePath}`);
  }

  /**
   * 验证配置
   */
  public validateConfig(config?: GlobalAICRConfig): ValidationResult {
    const targetConfig = config || this.config;
    const errors: string[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];

    try {
      // 验证必需字段
      if (!targetConfig.project.name) {
        errors.push('project.name 不能为空');
      }

      if (!targetConfig.project.rootDir || !fs.existsSync(targetConfig.project.rootDir)) {
        errors.push('project.rootDir 必须是有效的目录路径');
      }

      // 验证AI配置
      if (!targetConfig.ai.model) {
        errors.push('ai.model 不能为空');
      }

      if (targetConfig.ai.provider === 'openai' && !targetConfig.ai.apiKey && !process.env.OPENAI_API_KEY) {
        warnings.push('使用OpenAI时建议设置API密钥');
      }

      // 验证数值范围
      if (targetConfig.ai.temperature < 0 || targetConfig.ai.temperature > 1) {
        errors.push('ai.temperature 必须在0-1之间');
      }

      if (targetConfig.ai.maxTokens < 100 || targetConfig.ai.maxTokens > 32000) {
        warnings.push('ai.maxTokens 建议在100-32000之间');
      }

      // 验证性能配置
      if (targetConfig.performance.maxWorkers > 16) {
        warnings.push('maxWorkers过大可能影响系统性能');
      }

      if (targetConfig.performance.maxCacheSize > 1000) {
        warnings.push('maxCacheSize过大可能占用过多磁盘空间');
      }

      // 提供优化建议
      if (!targetConfig.performance.enableCache) {
        suggestions.push('启用缓存可以显著提高性能');
      }

      if (targetConfig.rules.enabled.length === 0) {
        suggestions.push('建议启用至少一个规则分类');
      }

      if (!targetConfig.experimental.enableMetrics) {
        suggestions.push('启用指标收集有助于分析和改进');
      }

      return {
        valid: errors.length === 0,
        errors,
        warnings,
        suggestions
      };

    } catch (error) {
      return {
        valid: false,
        errors: [`配置验证异常: ${error}`],
        warnings: [],
        suggestions: []
      };
    }
  }

  /**
   * 生成配置模板
   */
  public generateTemplate(format: ConfigFormat = 'json'): string {
    const template = this.deepClone(DEFAULT_CONFIG);
    
    // 添加注释和示例
    const annotated = this.addConfigAnnotations(template);
    
    switch (format) {
      case 'json':
        return JSON.stringify(annotated, null, 2);
      case 'yaml':
        return this.convertToYaml(annotated);
      case 'js':
        return this.convertToJS(annotated);
      default:
        throw new Error(`不支持的格式: ${format}`);
    }
  }

  /**
   * 自动查找配置文件
   */
  private findConfigFile(): string | null {
    const possiblePaths = [
      './ai-cr.config.json',
      './ai-cr.config.js',
      './.ai-crrc',
      './package.json' // 从package.json中读取ai-cr字段
    ];

    for (const configPath of possiblePaths) {
      if (fs.existsSync(configPath)) {
        console.log(`🔍 找到配置文件: ${configPath}`);
        return configPath;
      }
    }

    console.log('📄 未找到配置文件，使用默认配置');
    return null;
  }

  /**
   * 加载文件配置
   */
  private async loadFileConfig(configPath: string, format?: ConfigFormat): Promise<void> {
    try {
      const ext = path.extname(configPath).toLowerCase();
      const detectedFormat = format || this.detectFormat(ext);
      
      let fileConfig: Partial<GlobalAICRConfig>;
      
      switch (detectedFormat) {
        case 'json':
          fileConfig = this.loadJsonConfig(configPath);
          break;
        case 'js':
          fileConfig = await this.loadJsConfig(configPath);
          break;
        case 'yaml':
          fileConfig = this.loadYamlConfig(configPath);
          break;
        default:
          throw new Error(`不支持的配置格式: ${detectedFormat}`);
      }

      // 特殊处理package.json
      if (path.basename(configPath) === 'package.json') {
        const packageJson = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        fileConfig = packageJson['ai-cr'] || {};
      }

      this.config = this.deepMerge(this.config, fileConfig);
      
      this.addConfigSource({
        type: 'file',
        source: configPath,
        priority: 2
      });

    } catch (error) {
      console.warn(`⚠️ 配置文件加载失败 ${configPath}:`, error);
    }
  }

  /**
   * 加载环境变量配置
   */
  private loadEnvConfig(): void {
    const envConfig: any = {};
    
    for (const [envVar, configPath] of Object.entries(ENV_MAPPING)) {
      const value = process.env[envVar];
      if (value !== undefined) {
        this.setNestedValue(envConfig, configPath, this.parseEnvValue(value));
      }
    }

    if (Object.keys(envConfig).length > 0) {
      this.config = this.deepMerge(this.config, envConfig);
      
      this.addConfigSource({
        type: 'env',
        source: 'environment variables',
        priority: 3
      });
    }
  }

  /**
   * 合并所有配置源
   */
  private async mergeConfigurations(): Promise<void> {
    // 配置源已经按优先级排序并合并
    // 这里可以添加额外的合并逻辑
    
    // 确保目录存在
    this.ensureDirectories();
    
    // 处理相对路径
    this.resolveRelativePaths();
  }

  /**
   * 监听配置文件变化
   */
  private watchConfigFile(): void {
    if (!this.configPath) return;

    fs.watchFile(this.configPath, { interval: 1000 }, async (curr, prev) => {
      if (curr.mtime > prev.mtime) {
        console.log(`🔄 配置文件已更新: ${this.configPath}`);
        try {
          await this.loadFileConfig(this.configPath!);
          console.log('✅ 配置已重新加载');
          this.notifyConfigChange();
        } catch (error) {
          console.error('❌ 配置重新加载失败:', error);
        }
      }
    });
  }

  /**
   * 通知配置变化
   */
  private notifyConfigChange(): void {
    // 这里可以实现事件发送机制
    // 例如：EventEmitter, 回调函数等
  }

  /**
   * 确保目录存在
   */
  private ensureDirectories(): void {
    const dirs = [
      this.config.project.outputDir,
      this.config.project.tempDir,
      this.config.performance.cacheDir
    ];

    for (const dir of dirs) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }
  }

  /**
   * 解析相对路径
   */
  private resolveRelativePaths(): void {
    const rootDir = this.config.project.rootDir;
    
    this.config.project.outputDir = path.resolve(rootDir, this.config.project.outputDir);
    this.config.project.tempDir = path.resolve(rootDir, this.config.project.tempDir);
    this.config.performance.cacheDir = path.resolve(rootDir, this.config.performance.cacheDir);
  }

  /**
   * 清理敏感配置信息
   */
  private sanitizeConfig(config: GlobalAICRConfig): any {
    const sanitized = this.deepClone(config);
    
    // 移除敏感信息
    if (sanitized.ai.apiKey) {
      sanitized.ai.apiKey = '***';
    }
    
    if (sanitized.integrations.database?.connectionString) {
      sanitized.integrations.database.connectionString = '***';
    }
    
    if (sanitized.integrations.webhook?.secret) {
      sanitized.integrations.webhook.secret = '***';
    }

    return sanitized;
  }

  // 工具方法
  private detectFormat(ext: string): ConfigFormat {
    switch (ext) {
      case '.json': return 'json';
      case '.js': case '.mjs': return 'js';
      case '.yml': case '.yaml': return 'yaml';
      default: return 'json';
    }
  }

  private loadJsonConfig(configPath: string): any {
    const content = fs.readFileSync(configPath, 'utf-8');
    return JSON.parse(content);
  }

  private async loadJsConfig(configPath: string): Promise<any> {
    const absolutePath = path.resolve(configPath);
    delete require.cache[absolutePath];
    const module = require(absolutePath);
    return module.default || module;
  }

  private loadYamlConfig(_configPath: string): any {
    // 简化实现，实际需要yaml解析库
    throw new Error('YAML格式支持需要额外依赖');
  }

  private addConfigSource(source: ConfigSource): void {
    this.configSources.push(source);
    this.configSources.sort((a, b) => a.priority - b.priority);
  }

  private parseEnvValue(value: string): any {
    // 尝试解析为数字
    if (/^\d+$/.test(value)) {
      return parseInt(value, 10);
    }
    
    // 尝试解析为浮点数
    if (/^\d*\.\d+$/.test(value)) {
      return parseFloat(value);
    }
    
    // 尝试解析为布尔值
    if (value.toLowerCase() === 'true') return true;
    if (value.toLowerCase() === 'false') return false;
    
    // 尝试解析为JSON
    if (value.startsWith('{') || value.startsWith('[')) {
      try {
        return JSON.parse(value);
      } catch {
        // 解析失败，返回原字符串
      }
    }
    
    return value;
  }

  private setNestedValue(obj: any, path: string, value: any): void {
    const keys = path.split('.');
    let current = obj;
    
    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (!key) continue;
      
      if (!(key in current)) {
        current[key] = {};
      }
      current = current[key];
    }
    
    const lastKey = keys[keys.length - 1];
    if (lastKey) {
      current[lastKey] = value;
    }
  }

  private deepClone<T>(obj: T): T {
    return JSON.parse(JSON.stringify(obj));
  }

  private deepMerge(target: any, source: any): any {
    const result = { ...target };
    
    for (const key in source) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        result[key] = this.deepMerge(target[key] || {}, source[key]);
      } else {
        result[key] = source[key];
      }
    }
    
    return result;
  }

  private addConfigAnnotations(_config: any): any {
    // 简化实现，实际可以添加详细的配置说明和注释
    return {};
  }

  private convertToYaml(_config: any): string {
    // 简化实现，需要yaml库
    return '# YAML format not implemented';
  }

  private convertToJS(config: any): string {
    return `module.exports = ${JSON.stringify(config, null, 2)};`;
  }
}