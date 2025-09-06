/**
 * API相关的TypeScript类型定义
 */

// 基础响应结构
export interface BaseApiResponse<T = any> {
  code: number;
  message?: string;
  data?: T;
  success?: boolean;
}

// 分页响应结构
export interface PaginatedResponse<T> {
  list: T[];
  total: number;
  page: number;
  pageSize: number;
}

// 项目组相关类型
export interface ProjectGroup {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectGroupListResponse {
  list: ProjectGroup[];
}

// 用户相关类型
export interface User {
  id: string;
  username: string;
  email?: string;
  name: string;
  role?: string;
  avatar?: string;
  createdAt: string;
  updatedAt: string;
}

export interface UserInfoResponse {
  user: User;
}

// 项目相关类型
export interface Project {
  id: string;
  name: string;
  description?: string;
  groupId: string;
  groupName: string;
  repositoryUrl?: string;
  mainBranch?: string;
  status: 'active' | 'inactive' | 'archived';
  createdAt: string;
  updatedAt: string;
}

export interface ProjectDetailResponse {
  project: Project;
}

export interface ProjectListResponse extends PaginatedResponse<Project> {}

// 报告相关类型
export interface ReviewReport {
  id: string;
  projectId: string;
  projectName: string;
  userId: string;
  userName: string;
  reviewMode: 'static' | 'ai' | 'full';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  metadata: {
    generatedAt: string;
    toolVersion: string;
    totalFiles: number;
    totalIssues: number;
    filesWithIssues: number;
    aiProcessed: number;
    cacheHits: number;
  };
  statistics: {
    severityDistribution: {
      critical: number;
      major: number;
      minor: number;
      info: number;
    };
    categoryDistribution: Record<string, number>;
  };
  reportData: any; // 完整的报告数据
  markdownContent?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ReportUploadRequest {
  projectId?: string;
  projectName: string;
  reviewMode: string;
  reportData: any;
  markdownContent?: string;
  metadata?: any;
}

export interface ReportUploadResponse {
  reportId: string;
  status: string;
  message?: string;
}

export interface UploadCodeReviewDetailsRequest {
  documentId: number;
  reviewData: any; // JsonReportData 结构
}

export interface UploadCodeReviewDetailsResponse {
  documentId: number;
  totalIssues: number;
  message: string;
}

export interface ReportListResponse extends PaginatedResponse<ReviewReport> {}

export interface ReportDetailResponse {
  report: ReviewReport;
}

// 审查相关类型
export interface ReviewSubmission {
  projectId: string;
  branchName: string;
  commitHash: string;
  changedFiles: string[];
  reviewMode: 'static' | 'ai' | 'full';
  metadata?: any;
}

export interface ReviewSubmissionResponse {
  reviewId: string;
  status: 'queued' | 'processing';
}

export interface ReviewStatus {
  id: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  progress: number;
  message?: string;
  completedAt?: string;
  reportId?: string;
}

export interface ReviewStatusResponse {
  review: ReviewStatus;
}

export interface ReviewHistoryResponse extends PaginatedResponse<ReviewReport> {}

// 请求参数类型
export interface PaginationParams {
  page?: number;
  pageSize?: number;
}

export interface ProjectListParams extends PaginationParams {
  groupId?: string;
  status?: string;
  keyword?: string;
}

export interface ReportListParams extends PaginationParams {
  projectId?: string;
  userId?: string;
  status?: string;
  reviewMode?: string;
  startDate?: string;
  endDate?: string;
}

// API错误类型
export interface ApiError {
  code: number;
  message: string;
  details?: any;
  timestamp: string;
}