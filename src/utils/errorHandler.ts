import { ContextStrategy } from '../types/index.js';

/**
 * 错误类型枚举
 */
export enum ErrorType {
  // 系统级错误
  SYSTEM_ERROR = 'SYSTEM_ERROR',
  CONFIGURATION_ERROR = 'CONFIGURATION_ERROR',
  PERMISSION_ERROR = 'PERMISSION_ERROR',
  
  // Git操作错误
  GIT_ERROR = 'GIT_ERROR',
  FILE_NOT_FOUND = 'FILE_NOT_FOUND',
  FILE_ACCESS_ERROR = 'FILE_ACCESS_ERROR',
  
  // AI服务错误
  AI_SERVICE_ERROR = 'AI_SERVICE_ERROR',
  API_RATE_LIMIT = 'API_RATE_LIMIT',
  API_TIMEOUT = 'API_TIMEOUT',
  API_AUTHENTICATION = 'API_AUTHENTICATION',
  API_QUOTA_EXCEEDED = 'API_QUOTA_EXCEEDED',
  
  // 处理错误
  PARSING_ERROR = 'PARSING_ERROR',
  ANALYSIS_ERROR = 'ANALYSIS_ERROR',
  CONTEXT_EXTRACTION_ERROR = 'CONTEXT_EXTRACTION_ERROR',
  
  // 网络错误
  NETWORK_ERROR = 'NETWORK_ERROR',
  CONNECTION_TIMEOUT = 'CONNECTION_TIMEOUT',
  
  // 资源错误
  MEMORY_ERROR = 'MEMORY_ERROR',
  DISK_SPACE_ERROR = 'DISK_SPACE_ERROR',
  
  // 业务逻辑错误
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  DEPENDENCY_ERROR = 'DEPENDENCY_ERROR'
}

/**
 * 错误严重级别
 */
export enum ErrorSeverity {
  CRITICAL = 'CRITICAL',   // 系统无法继续运行
  HIGH = 'HIGH',           // 影响主要功能
  MEDIUM = 'MEDIUM',       // 影响部分功能
  LOW = 'LOW',             // 轻微影响
  INFO = 'INFO'            // 信息性错误
}

/**
 * 降级策略
 */
export enum FallbackStrategy {
  RETRY = 'RETRY',                    // 重试
  SKIP = 'SKIP',                      // 跳过
  SIMPLIFY = 'SIMPLIFY',              // 简化处理
  CACHE_FALLBACK = 'CACHE_FALLBACK',  // 使用缓存
  DEFAULT_VALUE = 'DEFAULT_VALUE',    // 使用默认值
  MANUAL_INTERVENTION = 'MANUAL_INTERVENTION' // 需要人工干预
}

/**
 * AI CR 专用错误类
 */
export class AICRError extends Error {
  public readonly type: ErrorType;
  public readonly severity: ErrorSeverity;
  public readonly code: string;
  public readonly context: Record<string, any>;
  public readonly recoverable: boolean;
  public readonly timestamp: Date;
  public readonly stackId: string;

  constructor(
    type: ErrorType,
    message: string,
    options: {
      severity?: ErrorSeverity;
      code?: string;
      context?: Record<string, any>;
      recoverable?: boolean;
      cause?: Error;
    } = {}
  ) {
    super(message);
    this.name = 'AICRError';
    this.type = type;
    this.severity = options.severity || ErrorSeverity.MEDIUM;
    this.code = options.code || type;
    this.context = options.context || {};
    this.recoverable = options.recoverable !== false; // 默认可恢复
    this.timestamp = new Date();
    this.stackId = this.generateStackId();

    if (options.cause) {
      this.stack += `\nCaused by: ${options.cause.stack}`;
    }
  }

  private generateStackId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  public toJSON() {
    return {
      name: this.name,
      type: this.type,
      message: this.message,
      severity: this.severity,
      code: this.code,
      context: this.context,
      recoverable: this.recoverable,
      timestamp: this.timestamp,
      stackId: this.stackId
    };
  }
}

/**
 * 错误恢复配置
 */
export interface RecoveryConfig {
  maxRetries: number;
  retryDelay: number;
  backoffMultiplier: number;
  maxRetryDelay: number;
  enableFallback: boolean;
  fallbackTimeout: number;
  logErrors: boolean;
  notifyOnCritical: boolean;
}

/**
 * 降级处理器
 */
export interface FallbackHandler {
  strategy: FallbackStrategy;
  condition: (_error: AICRError) => boolean;
  handler: (_error: AICRError, _context: any) => Promise<any>;
  priority: number;
}

/**
 * 错误统计
 */
export interface ErrorStats {
  total: number;
  byType: Record<ErrorType, number>;
  bySeverity: Record<ErrorSeverity, number>;
  recoveryRate: number;
  averageRecoveryTime: number;
  criticalErrors: AICRError[];
  recentErrors: AICRError[];
}

/**
 * 默认恢复配置
 */
const DEFAULT_RECOVERY_CONFIG: RecoveryConfig = {
  maxRetries: 3,
  retryDelay: 1000,
  backoffMultiplier: 2,
  maxRetryDelay: 10000,
  enableFallback: true,
  fallbackTimeout: 30000,
  logErrors: true,
  notifyOnCritical: true
};

/**
 * 鲁棒错误处理器
 * 
 * 提供统一的错误处理、恢复和降级机制
 */
export class RobustErrorHandler {
  private config: RecoveryConfig;
  private fallbackHandlers: FallbackHandler[] = [];
  private errorLog: AICRError[] = [];
  private retryAttempts: Map<string, number> = new Map();
  private recoveryCounts: Map<string, number> = new Map();
  private _startTime = Date.now(); // 暂未使用，预留用于性能监控

  constructor(config: Partial<RecoveryConfig> = {}) {
    this.config = { ...DEFAULT_RECOVERY_CONFIG, ...config };
    this.setupDefaultFallbacks();
  }

  /**
   * 包装异步函数，提供错误处理和恢复
   */
  public async withErrorHandling<T>(
    operation: () => Promise<T>,
    context: {
      operationName: string;
      filePath?: string;
      additionalContext?: Record<string, any>;
    }
  ): Promise<T> {
    const operationId = `${context.operationName}-${Date.now()}`;
    let lastError: AICRError | null = null;

    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      try {
        this.retryAttempts.set(operationId, attempt);
        const result = await operation();
        
        // 成功后清理重试记录
        this.retryAttempts.delete(operationId);
        return result;

      } catch (error) {
        const acrError = this.normalizeError(error, context);
        lastError = acrError;
        
        this.logError(acrError);

        // 检查是否是致命错误（不可重试）
        if (!acrError.recoverable || acrError.severity === ErrorSeverity.CRITICAL) {
          break;
        }

        // 最后一次尝试，不再重试
        if (attempt >= this.config.maxRetries) {
          break;
        }

        // 计算重试延迟
        const delay = this.calculateRetryDelay(attempt);
        console.warn(`⚠️ ${context.operationName} 失败，${delay}ms后进行第${attempt + 1}次重试:`, acrError.message);
        
        await this.sleep(delay);
      }
    }

    // 所有重试都失败，尝试降级处理
    if (lastError && this.config.enableFallback) {
      const fallbackResult = await this.attemptFallback(lastError, context);
      if (fallbackResult !== undefined) {
        return fallbackResult;
      }
    }

    // 降级也失败，抛出最后的错误
    throw lastError || new AICRError(
      ErrorType.SYSTEM_ERROR,
      `${context.operationName} 执行失败且无法恢复`
    );
  }

  /**
   * 注册降级处理器
   */
  public registerFallback(handler: FallbackHandler): void {
    this.fallbackHandlers.push(handler);
    this.fallbackHandlers.sort((a, b) => b.priority - a.priority);
  }

  /**
   * 创建错误
   */
  public createError(
    type: ErrorType,
    message: string,
    options: {
      severity?: ErrorSeverity;
      context?: Record<string, any>;
      recoverable?: boolean;
      cause?: Error;
    } = {}
  ): AICRError {
    return new AICRError(type, message, options);
  }

  /**
   * 获取错误统计
   */
  public getErrorStats(): ErrorStats {
    const total = this.errorLog.length;
    const byType: Record<ErrorType, number> = {} as any;
    const bySeverity: Record<ErrorSeverity, number> = {} as any;
    
    // 初始化计数器
    Object.values(ErrorType).forEach(type => byType[type] = 0);
    Object.values(ErrorSeverity).forEach(severity => bySeverity[severity] = 0);
    
    // 统计
    for (const error of this.errorLog) {
      byType[error.type]++;
      bySeverity[error.severity]++;
    }
    
    const recoveredCount = Array.from(this.recoveryCounts.values()).reduce((a, b) => a + b, 0);
    const recoveryRate = total > 0 ? (recoveredCount / total) * 100 : 0;
    
    const criticalErrors = this.errorLog.filter(e => e.severity === ErrorSeverity.CRITICAL);
    const recentErrors = this.errorLog.slice(-10);
    
    return {
      total,
      byType,
      bySeverity,
      recoveryRate,
      averageRecoveryTime: 0, // 需要更复杂的计算
      criticalErrors,
      recentErrors
    };
  }

  /**
   * 清理错误日志
   */
  public clearErrorLog(): void {
    this.errorLog = [];
    this.retryAttempts.clear();
    this.recoveryCounts.clear();
  }

  /**
   * 规范化错误
   */
  private normalizeError(error: any, context: any): AICRError {
    if (error instanceof AICRError) {
      return error;
    }

    // 识别常见错误类型
    let errorType = ErrorType.SYSTEM_ERROR;
    let severity = ErrorSeverity.MEDIUM;
    let recoverable = true;

    if (error.code === 'ENOENT') {
      errorType = ErrorType.FILE_NOT_FOUND;
      severity = ErrorSeverity.HIGH;
      recoverable = false;
    } else if (error.code === 'EACCES') {
      errorType = ErrorType.PERMISSION_ERROR;
      severity = ErrorSeverity.HIGH;
      recoverable = false;
    } else if (error.code === 'ENOTDIR' || error.code === 'EISDIR') {
      errorType = ErrorType.FILE_ACCESS_ERROR;
      severity = ErrorSeverity.HIGH;
    } else if (error.message?.includes('timeout')) {
      errorType = ErrorType.API_TIMEOUT;
      severity = ErrorSeverity.MEDIUM;
    } else if (error.message?.includes('rate limit')) {
      errorType = ErrorType.API_RATE_LIMIT;
      severity = ErrorSeverity.LOW;
    } else if (error.message?.includes('authentication')) {
      errorType = ErrorType.API_AUTHENTICATION;
      severity = ErrorSeverity.CRITICAL;
      recoverable = false;
    } else if (error.message?.includes('network')) {
      errorType = ErrorType.NETWORK_ERROR;
      severity = ErrorSeverity.MEDIUM;
    } else if (error.message?.includes('git')) {
      errorType = ErrorType.GIT_ERROR;
      severity = ErrorSeverity.HIGH;
    }

    return new AICRError(errorType, error.message || '未知错误', {
      severity,
      recoverable,
      context: { ...context, originalError: error.toString() },
      cause: error
    });
  }

  /**
   * 记录错误
   */
  private logError(error: AICRError): void {
    this.errorLog.push(error);
    
    // 限制日志大小
    if (this.errorLog.length > 1000) {
      this.errorLog = this.errorLog.slice(-800);
    }

    if (this.config.logErrors) {
      const logLevel = this.getLogLevel(error.severity);
      console[logLevel](`[${error.type}] ${error.message}`, {
        stackId: error.stackId,
        context: error.context
      });
    }

    // 对于严重错误，可以发送通知
    if (error.severity === ErrorSeverity.CRITICAL && this.config.notifyOnCritical) {
      this.notifyCriticalError(error);
    }
  }

  /**
   * 计算重试延迟
   */
  private calculateRetryDelay(attempt: number): number {
    const baseDelay = this.config.retryDelay;
    const delay = baseDelay * Math.pow(this.config.backoffMultiplier, attempt - 1);
    return Math.min(delay, this.config.maxRetryDelay);
  }

  /**
   * 尝试降级处理
   */
  private async attemptFallback(error: AICRError, context: any): Promise<any> {
    for (const handler of this.fallbackHandlers) {
      if (handler.condition(error)) {
        try {
          console.log(`🔄 尝试降级策略: ${handler.strategy}`);
          const result = await Promise.race([
            handler.handler(error, context),
            this.timeoutPromise(this.config.fallbackTimeout)
          ]);
          
          // 记录成功的降级
          const recoveryKey = `${error.type}-${handler.strategy}`;
          this.recoveryCounts.set(recoveryKey, (this.recoveryCounts.get(recoveryKey) || 0) + 1);
          
          console.log(`✅ 降级策略成功: ${handler.strategy}`);
          return result;
          
        } catch (fallbackError) {
          console.warn(`❌ 降级策略失败 ${handler.strategy}:`, fallbackError);
          continue;
        }
      }
    }
    
    return undefined;
  }

  /**
   * 设置默认降级处理器
   */
  private setupDefaultFallbacks(): void {
    // 上下文提取降级策略
    this.registerFallback({
      strategy: FallbackStrategy.SIMPLIFY,
      priority: 80,
      condition: (error) => error.type === ErrorType.CONTEXT_EXTRACTION_ERROR,
      handler: async (error, context) => {
        // 降级到更简单的上下文策略
        if (context.currentStrategy !== ContextStrategy.DIFF_ONLY) {
          console.log('📉 降级到DIFF_ONLY策略');
          return this.fallbackToSimpleStrategy(context);
        }
        throw error;
      }
    });

    // API限流降级策略
    this.registerFallback({
      strategy: FallbackStrategy.CACHE_FALLBACK,
      priority: 90,
      condition: (error) => error.type === ErrorType.API_RATE_LIMIT,
      handler: async (error, context) => {
        // 等待并使用缓存
        const waitTime = this.extractWaitTimeFromError(error);
        if (waitTime > 0 && waitTime < 60000) { // 最多等待1分钟
          await this.sleep(waitTime);
          throw error; // 让重试机制处理
        }
        return this.getCachedResult(context);
      }
    });

    // 网络错误降级策略
    this.registerFallback({
      strategy: FallbackStrategy.RETRY,
      priority: 70,
      condition: (error) => error.type === ErrorType.NETWORK_ERROR,
      handler: async (error, _context) => {
        // 等待网络恢复
        await this.sleep(5000);
        throw error; // 触发重试
      }
    });

    // 文件访问错误降级策略
    this.registerFallback({
      strategy: FallbackStrategy.SKIP,
      priority: 60,
      condition: (error) => error.type === ErrorType.FILE_ACCESS_ERROR,
      handler: async (_error, context) => {
        console.log(`⏭️ 跳过无法访问的文件: ${context.filePath}`);
        return null; // 跳过该文件
      }
    });

    // Git错误降级策略
    this.registerFallback({
      strategy: FallbackStrategy.SIMPLIFY,
      priority: 75,
      condition: (error) => error.type === ErrorType.GIT_ERROR,
      handler: async (_error, context) => {
        // 回退到本地文件读取模式
        console.log('🔄 Git操作失败，回退到本地文件模式');
        return this.fallbackToLocalFileMode(context);
      }
    });

    // 解析错误降级策略
    this.registerFallback({
      strategy: FallbackStrategy.DEFAULT_VALUE,
      priority: 50,
      condition: (error) => error.type === ErrorType.PARSING_ERROR,
      handler: async (error, context) => {
        console.log('🎯 解析失败，使用默认值');
        return this.getDefaultParsingResult(context);
      }
    });
  }

  // 降级处理方法
  private async fallbackToSimpleStrategy(_context: any): Promise<any> {
    // 简化实现：降级到最简单的策略
    return { strategy: ContextStrategy.DIFF_ONLY, content: 'Fallback content' };
  }

  private async getCachedResult(_context: any): Promise<any> {
    // 简化实现：从缓存获取结果
    return { cached: true, result: 'Cached result' };
  }

  private async fallbackToLocalFileMode(_context: any): Promise<any> {
    // 简化实现：本地文件读取模式
    return { mode: 'local', files: [] };
  }

  private getDefaultParsingResult(_context: any): any {
    // 简化实现：默认解析结果
    return { parsed: false, data: null };
  }

  // 工具方法
  private extractWaitTimeFromError(error: AICRError): number {
    // 从错误消息中提取等待时间
    const match = error.message.match(/retry.*?(\d+).*?second/i) || [];
    return match[1] ? parseInt(match[1]) * 1000 : 0;
  }

  private getLogLevel(severity: ErrorSeverity): 'error' | 'warn' | 'info' | 'log' {
    switch (severity) {
      case ErrorSeverity.CRITICAL:
      case ErrorSeverity.HIGH:
        return 'error';
      case ErrorSeverity.MEDIUM:
        return 'warn';
      case ErrorSeverity.LOW:
        return 'info';
      default:
        return 'log';
    }
  }

  private notifyCriticalError(error: AICRError): void {
    // 可以实现通知机制：邮件、Slack、webhook等
    console.error(`🚨 严重错误通知:`, error.toJSON());
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private timeoutPromise<T>(timeout: number): Promise<T> {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error('操作超时')), timeout);
    });
  }
}

/**
 * 全局错误处理器实例
 */
export const globalErrorHandler = new RobustErrorHandler();

/**
 * 装饰器：自动错误处理
 */
export function withErrorHandling(_operationName: string) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    
    descriptor.value = async function (...args: any[]) {
      return globalErrorHandler.withErrorHandling(
        () => originalMethod.apply(this, args),
        {
          operationName: `${target.constructor.name}.${propertyKey}`,
          additionalContext: { args: args.slice(0, 2) } // 只记录前两个参数避免日志过长
        }
      );
    };
    
    return descriptor;
  };
}

/**
 * 工具函数：安全执行
 */
export async function safeExecute<T>(
  operation: () => Promise<T>,
  fallback: T | (() => T),
  context?: string
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    console.warn(`安全执行失败 ${context || ''}:`, error);
    return typeof fallback === 'function' ? (fallback as any)() : fallback;
  }
}

/**
 * 工具函数：批量安全执行
 */
export async function safeExecuteBatch<T>(
  operations: (() => Promise<T>)[],
  options: {
    failFast?: boolean;
    maxConcurrency?: number;
    context?: string;
  } = {}
): Promise<Array<T | Error>> {
  const results: Array<T | Error> = [];
  const { failFast = false, maxConcurrency = 5, context = 'batch' } = options;

  // 分批处理
  for (let i = 0; i < operations.length; i += maxConcurrency) {
    const batch = operations.slice(i, i + maxConcurrency);
    const batchPromises = batch.map(async (operation, index) => {
      try {
        return await operation();
      } catch (error) {
        if (failFast) {
          throw error;
        }
        console.warn(`批量执行失败 ${context}[${i + index}]:`, error);
        return error as Error;
      }
    });

    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);

    // 检查是否有致命错误
    if (failFast && batchResults.some(r => r instanceof Error)) {
      break;
    }
  }

  return results;
}