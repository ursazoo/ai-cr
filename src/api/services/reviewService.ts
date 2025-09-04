/**
 * 审查相关API服务
 */

import { ApiClient } from '../apiClient.js';
import { API_ENDPOINTS } from '../endpoints.js';
import type { 
  ReviewSubmission,
  ReviewSubmissionResponse,
  ReviewStatus,
  ReviewStatusResponse,
  ReviewHistoryResponse,
  PaginationParams
} from '../../types/api.js';

export class ReviewService {
  constructor(private apiClient: ApiClient) {}

  /**
   * 提交审查任务
   */
  async submitReview(submission: ReviewSubmission): Promise<ReviewSubmissionResponse> {
    const response = await this.apiClient.post<ReviewSubmissionResponse>(
      API_ENDPOINTS.REVIEW.SUBMIT,
      submission
    );

    if (!response.data) {
      throw new Error('提交审查任务失败：服务器未返回有效响应');
    }

    return response.data;
  }

  /**
   * 获取审查状态
   */
  async getReviewStatus(reviewId: string): Promise<ReviewStatus | null> {
    const response = await this.apiClient.get<ReviewStatusResponse>(
      `${API_ENDPOINTS.REVIEW.STATUS}/${reviewId}`
    );

    return response.data?.review || null;
  }

  /**
   * 获取审查历史
   */
  async getReviewHistory(params?: PaginationParams): Promise<ReviewHistoryResponse> {
    const queryParams = new URLSearchParams();
    
    if (params?.page) queryParams.set('page', params.page.toString());
    if (params?.pageSize) queryParams.set('pageSize', params.pageSize.toString());

    const url = `${API_ENDPOINTS.REVIEW.HISTORY}?${queryParams.toString()}`;
    const response = await this.apiClient.get<ReviewHistoryResponse>(url);

    return response.data || { list: [], total: 0, page: 1, pageSize: 10 };
  }

  /**
   * 轮询审查状态直到完成
   */
  async pollReviewStatus(
    reviewId: string, 
    onProgress?: (status: ReviewStatus) => void,
    maxWaitTime = 300000 // 5分钟
  ): Promise<ReviewStatus> {
    const startTime = Date.now();
    const pollInterval = 2000; // 2秒轮询一次

    while (Date.now() - startTime < maxWaitTime) {
      const status = await this.getReviewStatus(reviewId);
      
      if (!status) {
        throw new Error('无法获取审查状态');
      }

      if (onProgress) {
        onProgress(status);
      }

      if (status.status === 'completed' || status.status === 'failed') {
        return status;
      }

      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }

    throw new Error('审查超时：等待时间过长');
  }
}