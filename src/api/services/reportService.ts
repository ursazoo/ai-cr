/**
 * 报告相关API服务
 */

import { ApiClient } from '../apiClient.js';
import { API_ENDPOINTS } from '../endpoints.js';
import type { 
  ReviewReport,
  ReportUploadRequest,
  ReportUploadResponse,
  ReportListResponse,
  ReportDetailResponse,
  ReportListParams
} from '../../types/api.js';
import type { JsonReportData } from '../../reports/reportGenerator.js';

export class ReportService {
  constructor(private apiClient: ApiClient) {}

  /**
   * 上传审查报告
   */
  async uploadReport(
    reportData: JsonReportData, 
    markdownContent?: string,
    projectGroupId?: string,
    userId?: string,
    userName?: string
  ): Promise<ReportUploadResponse> {
    // 获取当前分支名
    let branchName = 'main';
    try {
      const { execSync } = require('child_process');
      branchName = execSync('git branch --show-current', { encoding: 'utf8' }).trim();
    } catch (error) {
      // 如果获取分支名失败，使用默认值
    }

    // 从reportData中获取真实的用户名
    const realUserName = reportData.projectInfo.developerName || userName || 'AI-CR用户';
    
    // 构造符合后端API期望的数据格式
    const uploadRequest = {
      projectId: parseInt(projectGroupId || reportData.projectInfo.projectGroupId || '1'), // 转为数字
      userName: realUserName, // 使用真实用户名
      branchName: branchName, // 分支名
      reviewContent: markdownContent || '代码审查报告' // 完整的Markdown内容
    };

    // 添加详细的请求参数日志
    console.log('============ 请求参数详情 ============');
    console.log('projectGroupId 参数:', projectGroupId);
    console.log('reportData.projectInfo.projectGroupId:', reportData.projectInfo.projectGroupId);
    console.log('userName 参数:', userName);
    console.log('reportData.projectInfo.developerName:', reportData.projectInfo.developerName);
    console.log('markdownContent 长度:', markdownContent?.length || 0);
    console.log('分支名:', branchName);
    console.log('最终请求对象:', JSON.stringify(uploadRequest, null, 2));
    console.log('=================================');

    const response = await this.apiClient.post<ReportUploadResponse>(
      API_ENDPOINTS.DOCUMENT.CREATE_CODE_REVIEW,
      uploadRequest
    );

    if (!response.data) {
      throw new Error('上传报告失败：服务器未返回有效响应');
    }

    return response.data;
  }

  /**
   * 获取报告列表
   */
  async getReportList(params?: ReportListParams): Promise<ReportListResponse> {
    const queryParams = new URLSearchParams();
    
    if (params?.page) queryParams.set('page', params.page.toString());
    if (params?.pageSize) queryParams.set('pageSize', params.pageSize.toString());
    if (params?.projectId) queryParams.set('projectId', params.projectId);
    if (params?.userId) queryParams.set('userId', params.userId);
    if (params?.status) queryParams.set('status', params.status);
    if (params?.reviewMode) queryParams.set('reviewMode', params.reviewMode);
    if (params?.startDate) queryParams.set('startDate', params.startDate);
    if (params?.endDate) queryParams.set('endDate', params.endDate);

    const url = `${API_ENDPOINTS.REPORT.LIST}?${queryParams.toString()}`;
    const response = await this.apiClient.get<ReportListResponse>(url);

    return response.data || { list: [], total: 0, page: 1, pageSize: 10 };
  }

  /**
   * 获取报告详情
   */
  async getReportDetail(reportId: string): Promise<ReviewReport | null> {
    const response = await this.apiClient.get<ReportDetailResponse>(
      `${API_ENDPOINTS.REPORT.DETAIL}/${reportId}`
    );

    return response.data?.report || null;
  }

  /**
   * 更新报告状态
   */
  async updateReportStatus(reportId: string, status: string): Promise<boolean> {
    try {
      const response = await this.apiClient.put(
        `${API_ENDPOINTS.REPORT.UPDATE_STATUS}/${reportId}`,
        { status }
      );

      return response.code === 200;
    } catch (error) {
      console.warn('更新报告状态失败:', (error as Error).message);
      return false;
    }
  }

  /**
   * 删除报告
   */
  async deleteReport(reportId: string): Promise<boolean> {
    try {
      const response = await this.apiClient.delete(
        `${API_ENDPOINTS.REPORT.DELETE}/${reportId}`
      );

      return response.code === 200;
    } catch (error) {
      console.warn('删除报告失败:', (error as Error).message);
      return false;
    }
  }
}