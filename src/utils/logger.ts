/**
 * 日志工具
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LoggerConfig {
  level: LogLevel;
  enableColors: boolean;
  enableTimestamp: boolean;
  prefix?: string;
}

export class Logger {
  private config: LoggerConfig;

  constructor(config: Partial<LoggerConfig> = {}) {
    this.config = {
      level: 'info',
      enableColors: !process.env.NO_COLOR,
      enableTimestamp: true,
      ...config
    };
  }

  private getLogLevelPriority(level: LogLevel): number {
    const priorities = { debug: 0, info: 1, warn: 2, error: 3 };
    return priorities[level];
  }

  private shouldLog(level: LogLevel): boolean {
    return this.getLogLevelPriority(level) >= this.getLogLevelPriority(this.config.level);
  }

  private formatMessage(level: LogLevel, message: string, ...args: any[]): string {
    let formatted = '';

    // 添加时间戳
    if (this.config.enableTimestamp) {
      const timestamp = new Date().toISOString();
      formatted += `[${timestamp}] `;
    }

    // 添加日志级别
    const levelStr = level.toUpperCase().padEnd(5);
    if (this.config.enableColors) {
      const colors = {
        debug: '\x1b[36m', // cyan
        info: '\x1b[32m',  // green  
        warn: '\x1b[33m',  // yellow
        error: '\x1b[31m'  // red
      };
      formatted += `${colors[level]}${levelStr}\x1b[0m `;
    } else {
      formatted += `${levelStr} `;
    }

    // 添加前缀
    if (this.config.prefix) {
      formatted += `[${this.config.prefix}] `;
    }

    // 添加消息
    formatted += message;

    // 添加额外参数
    if (args.length > 0) {
      formatted += ' ' + args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
      ).join(' ');
    }

    return formatted;
  }

  debug(message: string, ...args: any[]): void {
    if (this.shouldLog('debug')) {
      console.debug(this.formatMessage('debug', message, ...args));
    }
  }

  info(message: string, ...args: any[]): void {
    if (this.shouldLog('info')) {
      console.info(this.formatMessage('info', message, ...args));
    }
  }

  warn(message: string, ...args: any[]): void {
    if (this.shouldLog('warn')) {
      console.warn(this.formatMessage('warn', message, ...args));
    }
  }

  error(message: string, ...args: any[]): void {
    if (this.shouldLog('error')) {
      console.error(this.formatMessage('error', message, ...args));
    }
  }

  /**
   * API相关日志
   */
  apiRequest(method: string, url: string, body?: any): void {
    this.debug(`API ${method} ${url}`, body ? { body } : '');
  }

  apiResponse(method: string, url: string, status: number, data?: any): void {
    const level = status >= 400 ? 'error' : 'debug';
    this[level](`API ${method} ${url} -> ${status}`, data ? { data } : '');
  }

  apiError(method: string, url: string, error: Error): void {
    this.error(`API ${method} ${url} failed:`, error.message);
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<LoggerConfig>): void {
    this.config = { ...this.config, ...config };
  }
}

// 默认logger实例
export const logger = new Logger({
  prefix: 'ai-cr',
  level: process.env.VERBOSE ? 'debug' : 'info'
});