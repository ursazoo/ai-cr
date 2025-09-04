import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { CRResult } from '../types/index.js';
import { ChangeAnalysis } from '../types/index.js';
// import { ErrorType } from './errorHandler.js'; // 暂未使用

/**
 * 缓存条目
 */
export interface CacheEntry<T = any> {
  key: string;
  value: T;
  hash: string;          // 内容哈希
  timestamp: number;     // 创建时间戳
  lastAccessed: number;  // 最后访问时间
  accessCount: number;   // 访问次数
  ttl: number;          // 生存时间(秒)
  size: number;         // 数据大小(bytes)
  metadata: {
    fileSize: number;
    filePath: string;
    version: string;
    tags: string[];
  };
}

/**
 * 缓存配置
 */
export interface CacheConfig {
  enabled: boolean;
  rootDir: string;
  maxSize: number;        // 最大缓存大小(MB)
  maxEntries: number;     // 最大条目数
  defaultTTL: number;     // 默认TTL(秒)
  cleanupInterval: number; // 清理间隔(秒)
  compressionEnabled: boolean; // 启用压缩
  strategy: 'lru' | 'lfu' | 'ttl'; // 淘汰策略
  warmupOnStart: boolean; // 启动时预热
  persistToDisk: boolean; // 持久化到磁盘
  backupInterval: number; // 备份间隔(秒)
}

/**
 * 缓存统计
 */
export interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number;
  totalSize: number;      // 总大小(bytes)
  entryCount: number;
  oldestEntry: number;    // 最老条目时间戳
  newestEntry: number;    // 最新条目时间戳
  topKeys: string[];      // 访问最多的键
  memoryUsage: number;    // 内存使用量
}

/**
 * 缓存事件
 */
export enum CacheEvent {
  HIT = 'hit',
  MISS = 'miss',
  SET = 'set',
  DELETE = 'delete',
  EXPIRE = 'expire',
  EVICT = 'evict',
  CLEANUP = 'cleanup'
}

/**
 * 缓存键类型
 */
export enum CacheKeyType {
  FILE_ANALYSIS = 'file_analysis',
  CONTEXT_EXTRACTION = 'context_extraction',
  AI_RESPONSE = 'ai_response',
  DEPENDENCY_ANALYSIS = 'dependency_analysis',
  GIT_DIFF = 'git_diff',
  FILE_CONTENT = 'file_content'
}

/**
 * 默认缓存配置
 */
const DEFAULT_CACHE_CONFIG: CacheConfig = {
  enabled: true,
  rootDir: './.ai-cr-cache',
  maxSize: 100, // 100MB
  maxEntries: 1000,
  defaultTTL: 86400, // 24小时
  cleanupInterval: 3600, // 1小时
  compressionEnabled: true,
  strategy: 'lru',
  warmupOnStart: false,
  persistToDisk: true,
  backupInterval: 21600 // 6小时
};

/**
 * 智能缓存管理器
 * 
 * 提供基于内容哈希的增量缓存，支持多种淘汰策略和持久化
 */
export class SmartCacheManager {
  private config: CacheConfig;
  private memoryCache = new Map<string, CacheEntry>();
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    hitRate: 0,
    totalSize: 0,
    entryCount: 0,
    oldestEntry: 0,
    newestEntry: 0,
    topKeys: [],
    memoryUsage: 0
  };
  
  private cleanupTimer: NodeJS.Timeout | null = null;
  private backupTimer: NodeJS.Timeout | null = null;
  private eventCallbacks = new Map<CacheEvent, Function[]>();

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = { ...DEFAULT_CACHE_CONFIG, ...config };
    this.initialize();
  }

  /**
   * 初始化缓存管理器
   */
  private async initialize(): Promise<void> {
    if (!this.config.enabled) {
      return;
    }

    try {
      // 确保缓存目录存在
      if (!fs.existsSync(this.config.rootDir)) {
        fs.mkdirSync(this.config.rootDir, { recursive: true });
      }

      // 加载持久化缓存
      if (this.config.persistToDisk) {
        await this.loadFromDisk();
      }

      // 启动定时清理
      if (this.config.cleanupInterval > 0) {
        this.startCleanupScheduler();
      }

      // 启动备份定时器
      if (this.config.backupInterval > 0 && this.config.persistToDisk) {
        this.startBackupScheduler();
      }

      // 预热缓存
      if (this.config.warmupOnStart) {
        await this.warmupCache();
      }

      console.log(`🚀 缓存管理器初始化完成，目录: ${this.config.rootDir}`);
    } catch (error) {
      console.warn('⚠️ 缓存管理器初始化失败:', error);
    }
  }

  /**
   * 获取缓存值
   */
  public async get<T>(key: string): Promise<T | null> {
    if (!this.config.enabled) {
      return null;
    }

    try {
      const entry = this.memoryCache.get(key);
      
      if (!entry) {
        this.recordMiss(key);
        return null;
      }

      // 检查TTL
      if (this.isExpired(entry)) {
        this.delete(key);
        this.recordMiss(key);
        return null;
      }

      // 更新访问信息
      entry.lastAccessed = Date.now();
      entry.accessCount++;
      
      this.recordHit(key);
      this.emitEvent(CacheEvent.HIT, { key, entry });
      
      return entry.value as T;
    } catch (error) {
      console.warn(`缓存获取失败 ${key}:`, error);
      return null;
    }
  }

  /**
   * 设置缓存值
   */
  public async set<T>(
    key: string,
    value: T,
    options: {
      ttl?: number;
      filePath?: string;
      tags?: string[];
      forceUpdate?: boolean;
    } = {}
  ): Promise<boolean> {
    if (!this.config.enabled) {
      return false;
    }

    try {
      const hash = this.generateHash(value);
      const existingEntry = this.memoryCache.get(key);
      
      // 如果内容没有变化且不强制更新，跳过
      if (existingEntry && existingEntry.hash === hash && !options.forceUpdate) {
        existingEntry.lastAccessed = Date.now();
        return true;
      }

      const size = this.calculateSize(value);
      const now = Date.now();
      
      // 检查空间限制
      if (!this.hasSpace(size)) {
        await this.makeSpace(size);
      }

      const entry: CacheEntry<T> = {
        key,
        value,
        hash,
        timestamp: now,
        lastAccessed: now,
        accessCount: 1,
        ttl: options.ttl || this.config.defaultTTL,
        size,
        metadata: {
          fileSize: size,
          filePath: options.filePath || '',
          version: '1.0.0',
          tags: options.tags || []
        }
      };

      this.memoryCache.set(key, entry);
      this.updateStats();
      this.emitEvent(CacheEvent.SET, { key, entry });
      
      return true;
    } catch (error) {
      console.warn(`缓存设置失败 ${key}:`, error);
      return false;
    }
  }

  /**
   * 删除缓存条目
   */
  public delete(key: string): boolean {
    const deleted = this.memoryCache.delete(key);
    if (deleted) {
      this.updateStats();
      this.emitEvent(CacheEvent.DELETE, { key });
    }
    return deleted;
  }

  /**
   * 清空缓存
   */
  public clear(): void {
    const count = this.memoryCache.size;
    this.memoryCache.clear();
    this.updateStats();
    console.log(`🧹 已清空 ${count} 个缓存条目`);
  }

  /**
   * 基于文件内容的缓存键生成
   */
  public generateFileKey(
    type: CacheKeyType,
    filePath: string,
    additionalData?: any
  ): string {
    try {
      const fileStats = fs.statSync(filePath);
      const baseKey = `${type}:${filePath}:${fileStats.mtime.getTime()}:${fileStats.size}`;
      
      if (additionalData) {
        const dataHash = this.generateHash(additionalData);
        return `${baseKey}:${dataHash}`;
      }
      
      return baseKey;
    } catch (error) {
      // 文件不存在或无法访问，使用路径和时间戳
      return `${type}:${filePath}:${Date.now()}`;
    }
  }

  /**
   * 智能缓存：分析结果
   */
  public async cacheAnalysisResult(
    filePath: string,
    analysis: ChangeAnalysis,
    ttl?: number
  ): Promise<void> {
    const key = this.generateFileKey(CacheKeyType.FILE_ANALYSIS, filePath, {
      strategy: analysis.strategy,
      changeRatio: analysis.changeRatio
    });
    
    await this.set(key, analysis, {
      ttl: ttl || this.config.defaultTTL,
      filePath,
      tags: ['analysis', analysis.fileType]
    });
  }

  /**
   * 获取缓存的分析结果
   */
  public async getCachedAnalysis(filePath: string, context?: any): Promise<ChangeAnalysis | null> {
    const key = this.generateFileKey(CacheKeyType.FILE_ANALYSIS, filePath, context);
    return this.get<ChangeAnalysis>(key);
  }

  /**
   * 智能缓存：AI响应结果
   */
  public async cacheAIResponse(
    contextHash: string,
    response: CRResult,
    ttl?: number
  ): Promise<void> {
    const key = `${CacheKeyType.AI_RESPONSE}:${contextHash}`;
    
    await this.set(key, response, {
      ttl: ttl || 3600, // AI响应缓存1小时
      tags: ['ai-response', 'cr-result']
    });
  }

  /**
   * 获取缓存的AI响应
   */
  public async getCachedAIResponse(contextHash: string): Promise<CRResult | null> {
    const key = `${CacheKeyType.AI_RESPONSE}:${contextHash}`;
    return this.get<CRResult>(key);
  }

  /**
   * 批量预热缓存
   */
  public async warmupFiles(filePaths: string[]): Promise<void> {
    console.log(`🔥 预热 ${filePaths.length} 个文件的缓存`);
    
    const warmupPromises = filePaths.slice(0, 50).map(async (filePath) => {
      try {
        // 预加载文件内容哈希
        if (fs.existsSync(filePath)) {
          const content = fs.readFileSync(filePath, 'utf-8');
          const hash = this.generateHash(content);
          const key = `${CacheKeyType.FILE_CONTENT}:${filePath}`;
          await this.set(key, { content, hash }, { 
            ttl: 1800, // 30分钟
            filePath,
            tags: ['warmup', 'content']
          });
        }
      } catch (error) {
        // 忽略预热失败的文件
      }
    });

    await Promise.allSettled(warmupPromises);
    console.log('✅ 缓存预热完成');
  }

  /**
   * 获取缓存统计
   */
  public getStats(): CacheStats {
    this.updateStats();
    return { ...this.stats };
  }

  /**
   * 清理过期缓存
   */
  public cleanup(): number {
    let cleanedCount = 0;
    
    for (const [key, entry] of this.memoryCache) {
      if (this.isExpired(entry)) {
        this.memoryCache.delete(key);
        cleanedCount++;
        this.emitEvent(CacheEvent.EXPIRE, { key, entry });
      }
    }
    
    if (cleanedCount > 0) {
      this.updateStats();
      console.log(`🧹 清理了 ${cleanedCount} 个过期缓存条目`);
      this.emitEvent(CacheEvent.CLEANUP, { count: cleanedCount });
    }
    
    return cleanedCount;
  }

  /**
   * 优化缓存（整理内存、压缩等）
   */
  public async optimize(): Promise<void> {
    console.log('🔧 开始缓存优化');
    
    // 清理过期条目
    this.cleanup();
    
    // 如果缓存过大，触发淘汰
    if (this.stats.totalSize > this.config.maxSize * 1024 * 1024) {
      await this.evictOldEntries(0.2); // 淘汰20%
    }
    
    // 持久化到磁盘
    if (this.config.persistToDisk) {
      await this.saveToDisk();
    }
    
    console.log('✅ 缓存优化完成');
  }

  /**
   * 注册事件监听器
   */
  public on(event: CacheEvent, callback: Function): void {
    if (!this.eventCallbacks.has(event)) {
      this.eventCallbacks.set(event, []);
    }
    this.eventCallbacks.get(event)!.push(callback);
  }

  /**
   * 销毁缓存管理器
   */
  public async destroy(): Promise<void> {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
    
    if (this.backupTimer) {
      clearInterval(this.backupTimer);
    }
    
    if (this.config.persistToDisk) {
      await this.saveToDisk();
    }
    
    this.clear();
    console.log('🔚 缓存管理器已销毁');
  }

  // 私有方法

  /**
   * 生成内容哈希
   */
  private generateHash(data: any): string {
    const content = typeof data === 'string' ? data : JSON.stringify(data);
    return crypto.createHash('md5').update(content).digest('hex');
  }

  /**
   * 计算数据大小
   */
  private calculateSize(data: any): number {
    const json = JSON.stringify(data);
    return Buffer.byteLength(json, 'utf8');
  }

  /**
   * 检查是否过期
   */
  private isExpired(entry: CacheEntry): boolean {
    return Date.now() > (entry.timestamp + entry.ttl * 1000);
  }

  /**
   * 检查是否有足够空间
   */
  private hasSpace(requiredSize: number): boolean {
    const maxSizeBytes = this.config.maxSize * 1024 * 1024;
    return (this.stats.totalSize + requiredSize) <= maxSizeBytes && 
           this.stats.entryCount < this.config.maxEntries;
  }

  /**
   * 腾出空间
   */
  private async makeSpace(_requiredSize: number): Promise<void> {
    const maxSizeBytes = this.config.maxSize * 1024 * 1024;
    const targetSize = maxSizeBytes * 0.8; // 清理到80%
    
    let freedSize = 0;
    let evictedCount = 0;
    
    // 根据策略排序条目
    const sortedEntries = Array.from(this.memoryCache.entries()).sort((a, b) => {
      return this.compareEntriesForEviction(a[1], b[1]);
    });
    
    for (const [key, entry] of sortedEntries) {
      if (this.stats.totalSize - freedSize <= targetSize) {
        break;
      }
      
      this.memoryCache.delete(key);
      freedSize += entry.size;
      evictedCount++;
      this.emitEvent(CacheEvent.EVICT, { key, entry });
    }
    
    this.updateStats();
    console.log(`🗑️ 淘汰了 ${evictedCount} 个缓存条目，释放 ${Math.round(freedSize / 1024)}KB 空间`);
  }

  /**
   * 淘汰指定比例的条目
   */
  private async evictOldEntries(ratio: number): Promise<number> {
    const targetCount = Math.floor(this.memoryCache.size * ratio);
    const entries = Array.from(this.memoryCache.entries()).sort((a, b) => {
      return this.compareEntriesForEviction(a[1], b[1]);
    });
    
    let evictedCount = 0;
    for (let i = 0; i < Math.min(targetCount, entries.length); i++) {
      const entry = entries[i];
      if (entry) {
        const [key] = entry;
        this.memoryCache.delete(key);
        evictedCount++;
      }
    }
    
    return evictedCount;
  }

  /**
   * 比较条目进行淘汰排序
   */
  private compareEntriesForEviction(a: CacheEntry, b: CacheEntry): number {
    switch (this.config.strategy) {
      case 'lru': // 最近最少使用
        return a.lastAccessed - b.lastAccessed;
      case 'lfu': // 最少使用频率
        return a.accessCount - b.accessCount;
      case 'ttl': // 按TTL排序
        return (a.timestamp + a.ttl) - (b.timestamp + b.ttl);
      default:
        return a.lastAccessed - b.lastAccessed;
    }
  }

  /**
   * 更新统计信息
   */
  private updateStats(): void {
    this.stats.entryCount = this.memoryCache.size;
    this.stats.hitRate = this.stats.hits + this.stats.misses > 0 
      ? (this.stats.hits / (this.stats.hits + this.stats.misses)) * 100 
      : 0;
    
    let totalSize = 0;
    let oldest = Date.now();
    let newest = 0;
    
    for (const entry of this.memoryCache.values()) {
      totalSize += entry.size;
      if (entry.timestamp < oldest) oldest = entry.timestamp;
      if (entry.timestamp > newest) newest = entry.timestamp;
    }
    
    this.stats.totalSize = totalSize;
    this.stats.oldestEntry = oldest;
    this.stats.newestEntry = newest;
    
    // 更新热门键
    this.updateTopKeys();
  }

  /**
   * 更新热门键统计
   */
  private updateTopKeys(): void {
    const entries = Array.from(this.memoryCache.entries())
      .sort((a, b) => b[1].accessCount - a[1].accessCount);
    
    this.stats.topKeys = entries.slice(0, 10).map(([key]) => key);
  }

  /**
   * 记录命中
   */
  private recordHit(_key: string): void {
    this.stats.hits++;
  }

  /**
   * 记录未命中
   */
  private recordMiss(_key: string): void {
    this.stats.misses++;
  }

  /**
   * 发送事件
   */
  private emitEvent(event: CacheEvent, data: any): void {
    const callbacks = this.eventCallbacks.get(event);
    if (callbacks) {
      callbacks.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.warn(`缓存事件回调失败 ${event}:`, error);
        }
      });
    }
  }

  /**
   * 启动清理定时器
   */
  private startCleanupScheduler(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.config.cleanupInterval * 1000);
  }

  /**
   * 启动备份定时器
   */
  private startBackupScheduler(): void {
    this.backupTimer = setInterval(async () => {
      await this.saveToDisk();
    }, this.config.backupInterval * 1000);
  }

  /**
   * 保存到磁盘
   */
  private async saveToDisk(): Promise<void> {
    try {
      const cacheFile = path.join(this.config.rootDir, 'cache.json');
      const data = {
        timestamp: Date.now(),
        stats: this.stats,
        entries: Array.from(this.memoryCache.entries())
      };
      
      fs.writeFileSync(cacheFile, JSON.stringify(data, null, 2));
      console.log(`💾 缓存已保存至磁盘: ${cacheFile}`);
    } catch (error) {
      console.warn('保存缓存到磁盘失败:', error);
    }
  }

  /**
   * 从磁盘加载
   */
  private async loadFromDisk(): Promise<void> {
    try {
      const cacheFile = path.join(this.config.rootDir, 'cache.json');
      
      if (!fs.existsSync(cacheFile)) {
        return;
      }
      
      const data = JSON.parse(fs.readFileSync(cacheFile, 'utf-8'));
      const entries = data.entries || [];
      
      let loadedCount = 0;
      for (const [key, entry] of entries) {
        if (!this.isExpired(entry)) {
          this.memoryCache.set(key, entry);
          loadedCount++;
        }
      }
      
      this.updateStats();
      console.log(`📂 从磁盘加载了 ${loadedCount} 个缓存条目`);
    } catch (error) {
      console.warn('从磁盘加载缓存失败:', error);
    }
  }

  /**
   * 预热缓存
   */
  private async warmupCache(): Promise<void> {
    console.log('🔥 开始预热缓存');
    // 这里可以根据历史使用情况预热常用文件
  }
}

/**
 * 全局缓存管理器实例
 */
export const globalCache = new SmartCacheManager();

/**
 * 装饰器：自动缓存方法结果
 */
export function cached(options: {
  keyGenerator?: (...args: any[]) => string;
  ttl?: number;
  condition?: (...args: any[]) => boolean;
} = {}) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    
    descriptor.value = async function (...args: any[]) {
      const { keyGenerator, ttl, condition } = options;
      
      // 检查缓存条件
      if (condition && !condition(...args)) {
        return originalMethod.apply(this, args);
      }
      
      // 生成缓存键
      const key = keyGenerator ? 
        keyGenerator(...args) : 
        `${target.constructor.name}.${propertyKey}:${JSON.stringify(args)}`;
      
      // 尝试从缓存获取
      const cachedResult = await globalCache.get(key);
      if (cachedResult !== null) {
        return cachedResult;
      }
      
      // 执行原方法并缓存结果
      const result = await originalMethod.apply(this, args);
      await globalCache.set(key, result, ttl ? { ttl } : {});
      
      return result;
    };
    
    return descriptor;
  };
}