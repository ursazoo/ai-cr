/**
 * 通用API客户端
 * 提供统一的HTTP请求封装，支持重试、错误处理、认证等功能
 */
import { config } from 'dotenv';

// 确保环境变量已加载
config();

export interface ApiClientConfig {
  baseUrl: string;
  timeout?: number;
  retryCount?: number;
  retryDelay?: number;
  token?: string;
}

export interface ApiResponse<T = any> {
  code: number;
  message?: string;
  data?: T;
  success?: boolean;
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers?: Record<string, string>;
  timeout?: number;
  retryCount?: number;
  body?: any;
}

export class ApiClient {
  private config: Required<ApiClientConfig>;
  
  constructor(config: ApiClientConfig) {
    this.config = {
      baseUrl: config.baseUrl.replace(/\/$/, ''), // 移除末尾斜杠
      timeout: config.timeout ?? 30000,
      retryCount: config.retryCount ?? 3,
      retryDelay: config.retryDelay ?? 1000,
      token: config.token ?? ''
    };
  }

  /**
   * 发送HTTP请求
   */
  async request<T = any>(endpoint: string, options: RequestOptions = {}): Promise<ApiResponse<T>> {
    const {
      method = 'GET',
      headers = {},
      timeout = this.config.timeout,
      retryCount = this.config.retryCount,
      body
    } = options;

    //  || this.config.baseUrl
    // 'http://localhost:36788'
    const baseUrl = 'http://localhost:36788';
    const prodUrl = 'http://gw.fshows.com/api';
    const url = `${baseUrl && prodUrl}${endpoint}`;
    
    // 默认请求头
    const defaultHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'ai-cr/1.0.0'
    };

    // 添加认证头
    if (this.config.token) {
      defaultHeaders['Authorization'] = `Bearer ${this.config.token}`;
    }

    // 添加API Key认证（用于长城后端API）
    // 从环境变量获取API Key，优先使用生产环境
    // TODO: 从环境变量获取API Key
    const apiKey = 'Ht5bK8mN3jL7vR4qP9wE2xI6sA1zB4cD9eF6';
    if (apiKey) {
      defaultHeaders['x-api-key'] = apiKey;
    }

    const finalHeaders = { ...defaultHeaders, ...headers };
    
    // 准备请求选项
    const fetchOptions: RequestInit = {
      method,
      headers: finalHeaders,
      signal: AbortSignal.timeout(timeout)
    };

    if (body && method !== 'GET') {
      const bodyContent = typeof body === 'string' ? body : JSON.stringify(body);
      fetchOptions.body = bodyContent;
      
      // 添加请求体日志
      console.log('请求体内容:', bodyContent);
    }

    // 执行请求（带重试机制）
    return this.executeWithRetry(url, fetchOptions, retryCount);
  }

  /**
   * 带重试机制的请求执行
   */
  private async executeWithRetry<T>(
    url: string, 
    options: RequestInit, 
    retriesLeft: number
  ): Promise<ApiResponse<T>> {
    try {
      console.log(`发送请求到: ${url}`);
      console.log(`请求头:`, options.headers);
      
      const response = await fetch(url, options);
      
      console.log(`响应状态: ${response.status} ${response.statusText}`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json() as ApiResponse<T>;
      console.log(`响应数据:`, data);
      
      // 检查业务状态码
      if (data.code && data.code !== 200) {
        throw new Error(data.message || `API错误: ${data.code}`);
      }

      return data;
    } catch (error) {
      console.log(`请求错误:`, error);
      // 如果是网络错误且还有重试次数，则重试
      if (retriesLeft > 0 && this.shouldRetry(error as Error)) {
        console.warn(`请求失败，${this.config.retryDelay}ms后重试... (剩余${retriesLeft}次)`);
        await this.delay(this.config.retryDelay);
        return this.executeWithRetry(url, options, retriesLeft - 1);
      }
      
      throw error;
    }
  }

  /**
   * 判断是否应该重试
   */
  private shouldRetry(error: Error): boolean {
    // 网络错误、超时错误等应该重试
    return error.name === 'AbortError' || 
           error.message.includes('fetch') ||
           error.message.includes('network') ||
           error.message.includes('timeout');
  }

  /**
   * 延迟执行
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * GET请求
   */
  async get<T = any>(endpoint: string, options?: Omit<RequestOptions, 'method' | 'body'>): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { ...options, method: 'GET' });
  }

  /**
   * POST请求
   */
  async post<T = any>(endpoint: string, body?: any, options?: Omit<RequestOptions, 'method'>): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { ...options, method: 'POST', body });
  }

  /**
   * PUT请求
   */
  async put<T = any>(endpoint: string, body?: any, options?: Omit<RequestOptions, 'method'>): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { ...options, method: 'PUT', body });
  }

  /**
   * DELETE请求
   */
  async delete<T = any>(endpoint: string, options?: Omit<RequestOptions, 'method' | 'body'>): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { ...options, method: 'DELETE' });
  }

  /**
   * 更新配置
   */
  updateConfig(newConfig: Partial<ApiClientConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * 获取当前配置
   */
  getConfig(): Readonly<Required<ApiClientConfig>> {
    return { ...this.config };
  }
}