/**
 * API服务统一导出
 */

import { ApiClient, type ApiClientConfig } from './apiClient.js';
import { ProjectService } from './services/projectService.js';
import { UserService } from './services/userService.js';
import { ReportService } from './services/reportService.js';
import { ReviewService } from './services/reviewService.js';

/**
 * API服务管理器
 */
export class ApiManager {
  private apiClient: ApiClient;
  
  public readonly project: ProjectService;
  public readonly user: UserService;
  public readonly report: ReportService;
  public readonly review: ReviewService;

  constructor(config: ApiClientConfig) {
    this.apiClient = new ApiClient(config);
    
    this.project = new ProjectService(this.apiClient);
    this.user = new UserService(this.apiClient);
    this.report = new ReportService(this.apiClient);
    this.review = new ReviewService(this.apiClient);
  }

  /**
   * 更新API配置
   */
  updateConfig(config: Partial<ApiClientConfig>): void {
    this.apiClient.updateConfig(config);
  }

  /**
   * 获取API配置
   */
  getConfig(): Readonly<Required<ApiClientConfig>> {
    return this.apiClient.getConfig();
  }

  /**
   * 测试API连接
   */
  async testConnection(): Promise<boolean> {
    try {
      // 尝试获取项目组列表来测试连接
      await this.project.getProjectGroupList();
      return true;
    } catch (error) {
      console.warn('API连接测试失败:', (error as Error).message);
      return false;
    }
  }
}

// 单例实例
let apiManager: ApiManager | null = null;

/**
 * 初始化API管理器
 */
export function initApiManager(config: ApiClientConfig): ApiManager {
  apiManager = new ApiManager(config);
  return apiManager;
}

/**
 * 获取API管理器实例
 */
export function getApiManager(): ApiManager {
  if (!apiManager) {
    throw new Error('API管理器未初始化，请先调用 initApiManager()');
  }
  return apiManager;
}

// 重新导出类型和服务
export { ApiClient, type ApiClientConfig } from './apiClient.js';
export { API_ENDPOINTS } from './endpoints.js';
export { ProjectService } from './services/projectService.js';
export { UserService } from './services/userService.js';
export { ReportService } from './services/reportService.js';
export { ReviewService } from './services/reviewService.js';