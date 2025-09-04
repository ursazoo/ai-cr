import { Worker, isMainThread, parentPort, workerData } from 'worker_threads';
import * as os from 'os';
import * as path from 'path';
import { FileWithSmartContext } from '../types/index.js';
import { CRResult } from '../types/index.js';
import { AICRError, ErrorType } from './errorHandler.js';

/**
 * 工作任务类型
 */
export enum TaskType {
  FILE_ANALYSIS = 'file_analysis',
  CONTEXT_EXTRACTION = 'context_extraction',
  DEPENDENCY_ANALYSIS = 'dependency_analysis',
  AI_PROCESSING = 'ai_processing',
  REPORT_GENERATION = 'report_generation'
}

/**
 * 工作任务
 */
export interface WorkerTask {
  id: string;
  type: TaskType;
  data: any;
  options: {
    timeout?: number;
    priority?: number;
    retries?: number;
  };
}

/**
 * 任务结果
 */
export interface TaskResult<T = any> {
  taskId: string;
  success: boolean;
  result?: T;
  error?: string;
  processingTime: number;
  workerId: string;
}

/**
 * Worker配置
 */
export interface WorkerConfig {
  maxWorkers: number;
  taskTimeout: number;
  idleTimeout: number;
  enableCPUAffinity: boolean;
  memoryLimit: number; // MB
  restartOnMemoryLimit: boolean;
  enableProfiling: boolean;
}

/**
 * Worker统计信息
 */
export interface WorkerStats {
  workerId: string;
  tasksCompleted: number;
  tasksFailure: number;
  averageTaskTime: number;
  memoryUsage: number;
  cpuUsage: number;
  uptime: number;
  status: 'idle' | 'busy' | 'error' | 'terminated';
}

/**
 * 并行处理器配置
 */
export interface ParallelProcessorConfig extends WorkerConfig {
  queueSize: number;
  batchSize: number;
  loadBalancing: 'round-robin' | 'least-loaded' | 'priority';
  enableMonitoring: boolean;
  autoScale: boolean;
  minWorkers: number;
  scaleUpThreshold: number;
  scaleDownThreshold: number;
}

/**
 * 默认配置
 */
const DEFAULT_CONFIG: ParallelProcessorConfig = {
  maxWorkers: Math.max(2, os.cpus().length - 1),
  minWorkers: 2,
  taskTimeout: 60000, // 60秒
  idleTimeout: 300000, // 5分钟
  memoryLimit: 500, // 500MB
  queueSize: 1000,
  batchSize: 10,
  loadBalancing: 'least-loaded',
  enableCPUAffinity: false,
  restartOnMemoryLimit: true,
  enableProfiling: false,
  enableMonitoring: true,
  autoScale: true,
  scaleUpThreshold: 0.8, // 80%负载时扩容
  scaleDownThreshold: 0.3  // 30%负载时缩容
};

/**
 * Worker包装器
 */
class WorkerWrapper {
  public readonly id: string;
  public readonly worker: Worker;
  private currentTask: WorkerTask | null = null;
  private stats: WorkerStats;
  private startTime = Date.now();
  private taskTimes: number[] = [];
  private taskTimeout: NodeJS.Timeout | null = null;

  constructor(
    scriptPath: string,
    config: WorkerConfig,
    id: string
  ) {
    this.id = id;
    this.worker = new Worker(scriptPath, {
      workerData: { config, workerId: id }
    });

    this.stats = {
      workerId: id,
      tasksCompleted: 0,
      tasksFailure: 0,
      averageTaskTime: 0,
      memoryUsage: 0,
      cpuUsage: 0,
      uptime: 0,
      status: 'idle'
    };

    this.setupEventHandlers();
  }

  /**
   * 执行任务
   */
  public async executeTask(task: WorkerTask): Promise<TaskResult> {
    if (this.currentTask) {
      throw new Error(`Worker ${this.id} 正在执行任务`);
    }

    this.currentTask = task;
    this.stats.status = 'busy';
    
    const startTime = Date.now();
    
    return new Promise((resolve, reject) => {
      const timeoutMs = task.options.timeout || 60000;
      
      // 设置任务超时
      this.taskTimeout = setTimeout(() => {
        this.handleTaskTimeout(task);
        reject(new AICRError(
          ErrorType.API_TIMEOUT,
          `任务超时: ${task.id}`,
          { context: { taskType: task.type, workerId: this.id } }
        ));
      }, timeoutMs);

      // 监听结果
      const resultHandler = (result: TaskResult) => {
        if (result.taskId === task.id) {
          this.clearTaskTimeout();
          this.completeTask(Date.now() - startTime, result.success);
          this.worker.off('message', resultHandler);
          resolve(result);
        }
      };

      // 监听错误
      const errorHandler = (error: Error) => {
        this.clearTaskTimeout();
        this.completeTask(Date.now() - startTime, false);
        this.worker.off('error', errorHandler);
        reject(error);
      };

      this.worker.on('message', resultHandler);
      this.worker.on('error', errorHandler);

      // 发送任务给Worker
      this.worker.postMessage(task);
    });
  }

  /**
   * 检查Worker是否空闲
   */
  public isIdle(): boolean {
    return this.stats.status === 'idle';
  }

  /**
   * 获取负载度（0-1）
   */
  public getLoad(): number {
    return this.currentTask ? 1 : 0;
  }

  /**
   * 获取统计信息
   */
  public getStats(): WorkerStats {
    this.stats.uptime = Date.now() - this.startTime;
    return { ...this.stats };
  }

  /**
   * 终止Worker
   */
  public async terminate(): Promise<void> {
    this.clearTaskTimeout();
    await this.worker.terminate();
    this.stats.status = 'terminated';
  }

  /**
   * 设置事件处理器
   */
  private setupEventHandlers(): void {
    this.worker.on('error', (error) => {
      console.error(`Worker ${this.id} 错误:`, error);
      this.stats.status = 'error';
    });

    this.worker.on('exit', (code) => {
      console.log(`Worker ${this.id} 退出，代码: ${code}`);
      this.stats.status = 'terminated';
    });
  }

  /**
   * 处理任务超时
   */
  private handleTaskTimeout(task: WorkerTask): void {
    console.warn(`⏱️ 任务超时: ${task.id} (Worker: ${this.id})`);
    this.stats.status = 'error';
    this.currentTask = null;
  }

  /**
   * 完成任务
   */
  private completeTask(duration: number, success: boolean): void {
    this.currentTask = null;
    this.stats.status = 'idle';
    
    if (success) {
      this.stats.tasksCompleted++;
      this.taskTimes.push(duration);
      
      // 计算平均时间（只保留最近100个任务）
      if (this.taskTimes.length > 100) {
        this.taskTimes = this.taskTimes.slice(-50);
      }
      
      this.stats.averageTaskTime = this.taskTimes.reduce((a, b) => a + b, 0) / this.taskTimes.length;
    } else {
      this.stats.tasksFailure++;
    }
  }

  /**
   * 清除任务超时
   */
  private clearTaskTimeout(): void {
    if (this.taskTimeout) {
      clearTimeout(this.taskTimeout);
      this.taskTimeout = null;
    }
  }
}

/**
 * 并行处理器
 * 
 * 管理Worker线程池，提供高性能的并行处理能力
 */
export class ParallelProcessor {
  private config: ParallelProcessorConfig;
  private workers: WorkerWrapper[] = [];
  private taskQueue: WorkerTask[] = [];
  private completedTasks = 0;
  private failedTasks = 0;
  private monitoring = false;
  private monitoringInterval: NodeJS.Timeout | null = null;

  constructor(config: Partial<ParallelProcessorConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * 初始化处理器
   */
  public async initialize(): Promise<void> {
    console.log(`🚀 初始化并行处理器，最大Worker数: ${this.config.maxWorkers}`);
    
    // 创建初始Worker
    const initialWorkerCount = Math.min(this.config.minWorkers, this.config.maxWorkers);
    await this.scaleWorkers(initialWorkerCount);

    // 启动监控
    if (this.config.enableMonitoring) {
      this.startMonitoring();
    }

    console.log(`✅ 并行处理器初始化完成，活跃Worker: ${this.workers.length}`);
  }

  /**
   * 提交任务
   */
  public async submitTask(task: WorkerTask): Promise<TaskResult> {
    return new Promise((resolve, reject) => {
      // 检查队列是否已满
      if (this.taskQueue.length >= this.config.queueSize) {
        reject(new AICRError(
          ErrorType.SYSTEM_ERROR,
          '任务队列已满',
          { context: { queueSize: this.taskQueue.length, taskId: task.id } }
        ));
        return;
      }

      // 添加完成回调
      const originalTask = task;
      const wrappedTask = {
        ...originalTask,
        __resolve: resolve,
        __reject: reject
      } as any;

      this.taskQueue.push(wrappedTask);
      
      // 尝试立即处理
      this.processQueue();

      // 检查是否需要扩容
      if (this.config.autoScale) {
        this.checkScaling();
      }
    });
  }

  /**
   * 批量提交任务
   */
  public async submitBatch(tasks: WorkerTask[]): Promise<TaskResult[]> {
    console.log(`📦 批量提交 ${tasks.length} 个任务`);
    
    const promises = tasks.map(task => this.submitTask(task));
    
    try {
      const results = await Promise.allSettled(promises);
      
      const successResults = results
        .filter(r => r.status === 'fulfilled')
        .map(r => (r as any).value);
      
      const failures = results.filter(r => r.status === 'rejected').length;
      
      if (failures > 0) {
        console.warn(`⚠️ 批量处理中有 ${failures} 个任务失败`);
      }
      
      return successResults;
    } catch (error) {
      throw new AICRError(
        ErrorType.SYSTEM_ERROR,
        '批量任务处理失败',
        { cause: error as Error, context: { taskCount: tasks.length } }
      );
    }
  }

  /**
   * 处理文件分析任务
   */
  public async processFileAnalysis(
    files: FileWithSmartContext[]
  ): Promise<CRResult[]> {
    
    const tasks: WorkerTask[] = files.map((file, index) => ({
      id: `analysis_${index}_${Date.now()}`,
      type: TaskType.FILE_ANALYSIS,
      data: file,
      options: {
        timeout: 30000,
        priority: 1
      }
    }));

    const results = await this.submitBatch(tasks);
    
    return results
      .filter(r => r.success && r.result)
      .map(r => r.result);
  }

  /**
   * 获取处理器状态
   */
  public getStatus() {
    return {
      workers: this.workers.length,
      activeWorkers: this.workers.filter(w => !w.isIdle()).length,
      queueSize: this.taskQueue.length,
      completedTasks: this.completedTasks,
      failedTasks: this.failedTasks,
      successRate: this.completedTasks + this.failedTasks > 0 
        ? (this.completedTasks / (this.completedTasks + this.failedTasks)) * 100 
        : 0
    };
  }

  /**
   * 获取Worker统计
   */
  public getWorkerStats(): WorkerStats[] {
    return this.workers.map(w => w.getStats());
  }

  /**
   * 关闭处理器
   */
  public async shutdown(): Promise<void> {
    console.log('🔚 关闭并行处理器');
    
    this.stopMonitoring();
    
    // 等待队列中的任务完成或超时
    const shutdownTimeout = 10000; // 10秒
    const startTime = Date.now();
    
    while (this.taskQueue.length > 0 && Date.now() - startTime < shutdownTimeout) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // 终止所有Worker
    await Promise.all(this.workers.map(w => w.terminate()));
    this.workers = [];
    
    console.log('✅ 并行处理器已关闭');
  }

  // 私有方法

  /**
   * 处理任务队列
   */
  private async processQueue(): Promise<void> {
    while (this.taskQueue.length > 0) {
      const availableWorker = this.findAvailableWorker();
      
      if (!availableWorker) {
        break; // 没有可用Worker
      }

      const task = this.getNextTask();
      if (!task) {
        break; // 没有待处理任务
      }

      try {
        const result = await availableWorker.executeTask(task);
        this.completedTasks++;
        (task as any).__resolve(result);
      } catch (error) {
        this.failedTasks++;
        (task as any).__reject(error);
      }
    }
  }

  /**
   * 查找可用Worker
   */
  private findAvailableWorker(): WorkerWrapper | null {
    switch (this.config.loadBalancing) {
      case 'round-robin':
        return this.workers.find(w => w.isIdle()) || null;
      
      case 'least-loaded':
        const sortedWorkers = this.workers
          .filter(w => w.isIdle())
          .sort((a, b) => a.getLoad() - b.getLoad());
        return sortedWorkers[0] || null;
      
      case 'priority':
        // 基于Worker性能选择
        const performanceWorkers = this.workers
          .filter(w => w.isIdle())
          .sort((a, b) => {
            const statsA = a.getStats();
            const statsB = b.getStats();
            return statsA.averageTaskTime - statsB.averageTaskTime;
          });
        return performanceWorkers[0] || null;
      
      default:
        return this.workers.find(w => w.isIdle()) || null;
    }
  }

  /**
   * 获取下一个任务
   */
  private getNextTask(): WorkerTask | null {
    if (this.taskQueue.length === 0) {
      return null;
    }

    // 按优先级排序
    this.taskQueue.sort((a, b) => (b.options.priority || 0) - (a.options.priority || 0));
    
    return this.taskQueue.shift() || null;
  }

  /**
   * 检查是否需要扩容/缩容
   */
  private async checkScaling(): Promise<void> {
    const activeWorkers = this.workers.filter(w => !w.isIdle()).length;
    const totalWorkers = this.workers.length;
    const loadRatio = totalWorkers > 0 ? activeWorkers / totalWorkers : 0;

    // 扩容检查
    if (loadRatio > this.config.scaleUpThreshold && 
        totalWorkers < this.config.maxWorkers &&
        this.taskQueue.length > 0) {
      
      const newWorkerCount = Math.min(
        totalWorkers + Math.ceil(totalWorkers * 0.5), // 增加50%
        this.config.maxWorkers
      );
      
      await this.scaleWorkers(newWorkerCount);
      console.log(`📈 扩容到 ${this.workers.length} 个Worker`);
    }

    // 缩容检查
    if (loadRatio < this.config.scaleDownThreshold && 
        totalWorkers > this.config.minWorkers &&
        this.taskQueue.length === 0) {
      
      const targetWorkerCount = Math.max(
        Math.ceil(totalWorkers * 0.7), // 减少30%
        this.config.minWorkers
      );
      
      await this.scaleWorkers(targetWorkerCount);
      console.log(`📉 缩容到 ${this.workers.length} 个Worker`);
    }
  }

  /**
   * 调整Worker数量
   */
  private async scaleWorkers(targetCount: number): Promise<void> {
    const currentCount = this.workers.length;
    
    if (targetCount > currentCount) {
      // 增加Worker
      const toAdd = targetCount - currentCount;
      const workerScript = path.join(__dirname, 'worker.js');
      
      for (let i = 0; i < toAdd; i++) {
        const workerId = `worker_${Date.now()}_${i}`;
        const worker = new WorkerWrapper(workerScript, this.config, workerId);
        this.workers.push(worker);
      }
    } else if (targetCount < currentCount) {
      // 减少Worker
      const toRemove = currentCount - targetCount;
      const idleWorkers = this.workers.filter(w => w.isIdle());
      
      const workersToTerminate = idleWorkers.slice(0, Math.min(toRemove, idleWorkers.length));
      
      await Promise.all(workersToTerminate.map(w => w.terminate()));
      
      this.workers = this.workers.filter(w => !workersToTerminate.includes(w));
    }
  }

  /**
   * 启动监控
   */
  private startMonitoring(): void {
    if (this.monitoring) return;
    
    this.monitoring = true;
    this.monitoringInterval = setInterval(() => {
      this.logStatus();
      this.checkWorkerHealth();
    }, 10000); // 每10秒监控一次
  }

  /**
   * 停止监控
   */
  private stopMonitoring(): void {
    this.monitoring = false;
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
  }

  /**
   * 记录状态
   */
  private logStatus(): void {
    const status = this.getStatus();
    console.log(`📊 处理器状态: Workers=${status.workers}/${status.activeWorkers}, 队列=${status.queueSize}, 完成=${status.completedTasks}, 失败=${status.failedTasks}, 成功率=${status.successRate.toFixed(1)}%`);
  }

  /**
   * 检查Worker健康状态
   */
  private checkWorkerHealth(): void {
    const unhealthyWorkers = this.workers.filter(w => {
      const stats = w.getStats();
      return stats.status === 'error' || 
             (stats.memoryUsage > this.config.memoryLimit && this.config.restartOnMemoryLimit);
    });

    if (unhealthyWorkers.length > 0) {
      console.warn(`⚠️ 发现 ${unhealthyWorkers.length} 个不健康的Worker，正在重启`);
      this.restartUnhealthyWorkers(unhealthyWorkers);
    }
  }

  /**
   * 重启不健康的Worker
   */
  private async restartUnhealthyWorkers(workers: WorkerWrapper[]): Promise<void> {
    for (const worker of workers) {
      const index = this.workers.indexOf(worker);
      if (index !== -1) {
        await worker.terminate();
        
        const workerScript = path.join(__dirname, 'worker.js');
        const newWorker = new WorkerWrapper(
          workerScript, 
          this.config, 
          `worker_${Date.now()}_restart`
        );
        
        this.workers[index] = newWorker;
      }
    }
  }

  /**
   * 生成任务ID
   */
  public generateTaskId(type: TaskType): string {
    return `${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Worker线程代码（如果在Worker环境中执行）
if (!isMainThread && parentPort) {
  const { workerId } = workerData;
  
  console.log(`🔧 Worker ${workerId} 启动`);

  parentPort.on('message', async (task: WorkerTask) => {
    const startTime = Date.now();
    
    try {
      // 处理不同类型的任务
      let result: any;
      
      switch (task.type) {
        case TaskType.FILE_ANALYSIS:
          result = await handleFileAnalysis(task.data);
          break;
        case TaskType.CONTEXT_EXTRACTION:
          result = await handleContextExtraction(task.data);
          break;
        case TaskType.DEPENDENCY_ANALYSIS:
          result = await handleDependencyAnalysis(task.data);
          break;
        case TaskType.AI_PROCESSING:
          result = await handleAIProcessing(task.data);
          break;
        case TaskType.REPORT_GENERATION:
          result = await handleReportGeneration(task.data);
          break;
        default:
          throw new Error(`未支持的任务类型: ${task.type}`);
      }

      const taskResult: TaskResult = {
        taskId: task.id,
        success: true,
        result,
        processingTime: Date.now() - startTime,
        workerId
      };

      parentPort!.postMessage(taskResult);
    } catch (error) {
      const taskResult: TaskResult = {
        taskId: task.id,
        success: false,
        error: error instanceof Error ? error.message : String(error),
        processingTime: Date.now() - startTime,
        workerId
      };

      parentPort!.postMessage(taskResult);
    }
  });

  // Worker任务处理函数（简化实现）
  async function handleFileAnalysis(data: any): Promise<any> {
    // 实际的文件分析逻辑
    return { analyzed: true, file: data.filePath };
  }

  async function handleContextExtraction(_data: any): Promise<any> {
    // 实际的上下文提取逻辑
    return { extracted: true, context: 'extracted context' };
  }

  async function handleDependencyAnalysis(_data: any): Promise<any> {
    // 实际的依赖分析逻辑
    return { dependencies: [], analyzed: true };
  }

  async function handleAIProcessing(_data: any): Promise<any> {
    // 实际的AI处理逻辑
    return { processed: true, result: 'AI result' };
  }

  async function handleReportGeneration(_data: any): Promise<any> {
    // 实际的报告生成逻辑
    return { report: 'Generated report', generated: true };
  }
}

/**
 * 全局并行处理器实例
 */
export const globalParallelProcessor = new ParallelProcessor();

/**
 * 工具函数：并行执行函数列表
 */
export async function parallelExecute<T>(
  functions: Array<() => Promise<T>>,
  options: {
    maxConcurrency?: number;
    failFast?: boolean;
  } = {}
): Promise<T[]> {
  const { maxConcurrency = 5, failFast = false } = options;
  const results: T[] = [];
  const errors: Error[] = [];

  for (let i = 0; i < functions.length; i += maxConcurrency) {
    const batch = functions.slice(i, i + maxConcurrency);
    const promises = batch.map(async (fn, _index) => {
      try {
        return await fn();
      } catch (error) {
        if (failFast) {
          throw error;
        }
        errors.push(error as Error);
        return null;
      }
    });

    const batchResults = await Promise.all(promises);
    results.push(...batchResults.filter(r => r !== null) as T[]);
  }

  if (errors.length > 0 && failFast) {
    throw errors[0];
  }

  return results;
}