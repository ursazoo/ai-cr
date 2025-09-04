# API集成功能说明

## 概述

ai-cr工具现在完全集成了后端API，实现以下功能：
- **自动上传**审查报告到后端服务（默认启用）
- **智能获取**项目组列表和用户信息
- **自动配置**必要的项目组ID和用户ID
- **统一管理**所有API调用

## 工作流程

每次运行 `npx cr` 时，工具会：

1. **检查项目组ID**：如果项目配置中没有 `projectGroupId`，会自动获取项目组列表供用户选择
2. **检查用户ID**：如果全局配置中没有用户ID，会提示输入真实姓名并查询用户信息
3. **执行代码审查**：正常进行静态规则检查和AI审查
4. **自动上传报告**：将审查结果上传到后端系统

## 配置方式

### 环境变量配置

在 `.env` 文件中配置API地址：

```bash
# 后端API基础地址
AI_CR_API_BASE_URL=http://localhost:36788
```

## 命令行使用

### 基本用法

```bash
# 基本使用（自动上传报告）
npx cr

# 指定审查模式
npx cr --mode full

# 指定API地址
npx cr --api-url http://localhost:36788

# 显示详细日志
npx cr --verbose
```

### 完整示例

```bash
# 完整审查并自动上传报告，显示详细日志
npx cr --mode full --verbose --api-url http://localhost:36788
```

## API接口

### 1. 获取项目组列表

**接口**: `POST /api/common/getProjectList`

**请求体**:
```json
{}
```

**响应**:
```json
{
  "code": 200,
  "data": {
    "list": [
      {
        "id": "group1",
        "name": "前端开发组"
      }
    ]
  }
}
```

### 2. 查询用户列表

**接口**: `POST /common/getUserList`

**请求体**:
```json
{
  "realName": "张三"
}
```

**响应**:
```json
{
  "code": 200,
  "data": {
    "list": [
      {
        "id": "user_123",
        "name": "张三",
        "email": "zhangsan@example.com"
      }
    ]
  }
}
```

### 3. 上传审查报告

**接口**: `POST /document/createCodeReviewDocument`

**请求体**:
```json
{
  "projectGroupId": "group_001",
  "projectName": "项目名称",
  "userId": "user_123",
  "reviewMode": "full",
  "reportData": {
    "metadata": {...},
    "projectInfo": {...},
    "statistics": {...},
    "files": [...],
    "summary": {...}
  },
  "markdownContent": "# 报告内容...",
  "metadata": {...},
  "statistics": {...},
  "summary": {...}
}
```

**响应**:
```json
{
  "code": 200,
  "data": {
    "reportId": "report_12345",
    "status": "success",
    "message": "报告上传成功"
  }
}
```

## 架构说明

### 文件结构

```
src/
├── api/
│   ├── apiClient.ts       # 通用HTTP客户端
│   ├── endpoints.ts       # API端点定义
│   ├── index.ts          # API管理器
│   └── services/
│       ├── projectService.ts  # 项目相关API
│       ├── userService.ts     # 用户相关API
│       ├── reportService.ts   # 报告相关API
│       └── reviewService.ts   # 审查相关API
├── types/
│   └── api.ts            # API类型定义
└── utils/
    └── logger.ts         # 日志工具
```

### 特性

1. **自动化流程**: 首次使用时自动配置，后续无需手动干预
2. **智能检查**: 自动检查必要信息，缺失时提示配置
3. **统一错误处理**: 所有API调用都有统一的错误处理机制
4. **自动重试**: 网络错误时自动重试
5. **类型安全**: 完整的TypeScript类型定义
6. **优雅降级**: API调用失败时提供清晰的错误信息

## 错误处理

- **网络错误**: 自动重试，失败后提供清晰错误信息
- **项目组获取失败**: 中断执行，提示检查网络和API配置
- **用户信息获取失败**: 提示检查姓名或联系管理员
- **报告上传失败**: 显示警告但不影响本地报告生成

## 日志

使用 `--verbose` 参数可以看到详细的API调用日志：

```bash
npx cr --verbose
```

日志包含：
- 必要信息检查过程
- API请求/响应详情
- 错误信息和解决建议
- 报告上传状态

## 开发调试

在开发环境中，设置环境变量来调用本地后端服务：

```bash
export AI_CR_API_BASE_URL=http://localhost:36788
npx cr
```

或直接使用命令行参数：

```bash
npx cr --api-url http://localhost:36788
```

## 配置文件结构

### 全局配置 (`~/.ai-cr/config.json`)
```json
{
  "apiKey": "your-dashscope-api-key",
  "model": "qwen-plus", 
  "userInfo": {
    "id": "user_123",
    "name": "张三",
    "email": "zhangsan@example.com"
  },
  "backendApi": {
    "baseUrl": "http://localhost:36788"
  },
  "created": "2024-01-01T00:00:00.000Z",
  "updated": "2024-01-01T00:00:00.000Z"
}
```

### 项目配置 (`.ai-cr.config.json`)
```json
{
  "project": {
    "projectGroupId": "group_001",
    "projectGroupName": "前端开发组",
    "name": "AI代码审查工具",
    "group": "前端开发组",
    "mainBranch": "main"
  },
  "ai": {
    "temperature": 0.1,
    "maxTokens": 4000
  },
  "rules": {
    "enabled": ["quality", "security", "performance"]
  },
  "created": "2024-01-01T00:00:00.000Z",
  "updated": "2024-01-01T00:00:00.000Z"
}
```