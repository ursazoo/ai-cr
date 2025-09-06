/**
 * API端点定义
 * 统一管理所有API接口路径
 */

export const API_ENDPOINTS = {
  // 公共接口
  COMMON: {
    PROJECT_LIST: '/common/getProjectList',
    USER_INFO: '/user/getInfo',
    USER_LIST: '/common/getUserList'
  },
  
  // 项目相关
  PROJECT: {
    DETAIL: '/project/detail',
    LIST: '/project/list',
    CREATE: '/project/create',
    UPDATE: '/project/update'
  },

  // 用户相关
  USER: {
    PROFILE: '/user/profile',
    SETTINGS: '/user/settings'
  },

  // 文档相关
  DOCUMENT: {
    CREATE_CODE_REVIEW: '/document/createCodeReviewDocument',
    UPLOAD_CODE_REVIEW_DETAILS: '/document/uploadCodeReviewDetails'
  },

  // 报告相关
  REPORT: {
    UPLOAD: '/report/upload',
    LIST: '/report/list', 
    DETAIL: '/report/detail',
    UPDATE_STATUS: '/report/updateStatus',
    DELETE: '/report/delete'
  },

  // 审查相关
  REVIEW: {
    SUBMIT: '/review/submit',
    STATUS: '/review/status',
    HISTORY: '/review/history'
  }
} as const;

// 导出类型，便于类型检查
export type ApiEndpoints = typeof API_ENDPOINTS;