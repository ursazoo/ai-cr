/**
 * 用户相关API服务
 */

import { ApiClient } from '../apiClient.js';
import { API_ENDPOINTS } from '../endpoints.js';
import type { 
  User, 
  UserInfoResponse
} from '../../types/api.js';

export class UserService {
  constructor(private apiClient: ApiClient) {}

  /**
   * 获取当前用户信息
   */
  async getCurrentUser(): Promise<User | null> {
    try {
      const response = await this.apiClient.get<UserInfoResponse>(
        API_ENDPOINTS.COMMON.USER_INFO
      );

      return response.data?.user || null;
    } catch (error) {
      console.warn('获取用户信息失败:', (error as Error).message);
      return null;
    }
  }

  /**
   * 获取用户配置
   */
  async getUserProfile(): Promise<User | null> {
    try {
      const response = await this.apiClient.get<{ user: User }>(
        API_ENDPOINTS.USER.PROFILE
      );

      return response.data?.user || null;
    } catch (error) {
      console.warn('获取用户配置失败:', (error as Error).message);
      return null;
    }
  }

  /**
   * 根据真实姓名查询用户列表
   */
  async getUserList(realName: string): Promise<User[]> {
    try {
      const response = await this.apiClient.post<{ list: any[] }>(
        API_ENDPOINTS.COMMON.USER_LIST,
        { realName }
      );

      // 映射后端返回的数据格式到前端期望的格式
      const users = response.data?.list?.map(backendUser => ({
        id: backendUser.id.toString(),
        username: backendUser.realName || '',
        name: backendUser.realName || '', // 将realName映射到name字段
        email: backendUser.email || '',
        role: 'user',
        avatar: backendUser.avatar || '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      })) || [];

      return users;
    } catch (error) {
      console.warn('查询用户列表失败:', (error as Error).message);
      return [];
    }
  }

  /**
   * 更新用户设置
   */
  async updateUserSettings(settings: Record<string, any>): Promise<boolean> {
    try {
      const response = await this.apiClient.put(
        API_ENDPOINTS.USER.SETTINGS,
        settings
      );

      return response.code === 200;
    } catch (error) {
      console.warn('更新用户设置失败:', (error as Error).message);
      return false;
    }
  }
}