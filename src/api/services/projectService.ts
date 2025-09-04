/**
 * 项目相关API服务
 */

import { ApiClient } from '../apiClient.js';
import { API_ENDPOINTS } from '../endpoints.js';
import type { 
  ProjectGroup, 
  ProjectGroupListResponse,
  Project,
  ProjectDetailResponse,
  ProjectListResponse,
  ProjectListParams
} from '../../types/api.js';

export class ProjectService {
  constructor(private apiClient: ApiClient) {}

  /**
   * 获取项目组列表
   */
  async getProjectGroupList(): Promise<ProjectGroup[]> {
    const response = await this.apiClient.post<ProjectGroupListResponse>(
      API_ENDPOINTS.COMMON.PROJECT_LIST,
      {}
    );

    return response.data?.list || [];
  }

  /**
   * 获取项目组选择列表（用于inquirer）
   */
  async getProjectGroupChoices(): Promise<Array<{name: string, value: string}>> {
    const projectGroups = await this.getProjectGroupList();
    
    return projectGroups.map(group => ({
      name: group.name,
      value: group.id // 使用ID作为值
    }));
  }

  /**
   * 获取项目详情
   */
  async getProjectDetail(projectId: string): Promise<Project | null> {
    const response = await this.apiClient.get<ProjectDetailResponse>(
      `${API_ENDPOINTS.PROJECT.DETAIL}/${projectId}`
    );

    return response.data?.project || null;
  }

  /**
   * 获取项目列表
   */
  async getProjectList(params?: ProjectListParams): Promise<ProjectListResponse> {
    const queryParams = new URLSearchParams();
    
    if (params?.page) queryParams.set('page', params.page.toString());
    if (params?.pageSize) queryParams.set('pageSize', params.pageSize.toString());
    if (params?.groupId) queryParams.set('groupId', params.groupId);
    if (params?.status) queryParams.set('status', params.status);
    if (params?.keyword) queryParams.set('keyword', params.keyword);

    const url = `${API_ENDPOINTS.PROJECT.LIST}?${queryParams.toString()}`;
    const response = await this.apiClient.get<ProjectListResponse>(url);

    return response.data || { list: [], total: 0, page: 1, pageSize: 10 };
  }

  /**
   * 创建项目
   */
  async createProject(project: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>): Promise<Project> {
    const response = await this.apiClient.post<{ project: Project }>(
      API_ENDPOINTS.PROJECT.CREATE,
      project
    );

    if (!response.data?.project) {
      throw new Error('创建项目失败：返回数据格式错误');
    }

    return response.data.project;
  }

  /**
   * 更新项目
   */
  async updateProject(projectId: string, updates: Partial<Project>): Promise<Project> {
    const response = await this.apiClient.put<{ project: Project }>(
      `${API_ENDPOINTS.PROJECT.UPDATE}/${projectId}`,
      updates
    );

    if (!response.data?.project) {
      throw new Error('更新项目失败：返回数据格式错误');
    }

    return response.data.project;
  }
}