# AI Code Review 系统

一个高性能、智能化的代码审查系统，基于AI技术提供深度代码分析、智能上下文理解和自动化报告生成。

## 🚀 最新增强功能

### ⚡ 性能优化

- **并行处理**: 支持多Worker并行审查，显著提升处理速度
- **智能缓存**: 基于内容哈希的缓存机制，避免重复分析
- **错误重试**: 智能重试和降级策略，提升系统稳定性

### 🔧 增强体验

- **统计报告**: 详细的性能统计和质量评分
- **配置灵活**: 支持命令行参数和配置文件
- **实时反馈**: 实时进度显示和缓存命中提示

## ✨ 核心特性

### 🧠 智能上下文分析

- **多维度判断**：基于文件大小、变更比例、依赖关系等多个维度选择最优上下文策略
- **5种上下文策略**：从简单的diff到完整文件分析，根据情况智能选择
- **依赖感知**：自动分析文件间的import/export关系，提供更准确的上下文

### ⚡ 高性能处理

- **智能队列**：优先级队列和批处理，合理分配处理资源
- **并行处理**：基于Worker线程的并行架构，充分利用多核CPU
- **增量缓存**：基于内容哈希的智能缓存，避免重复分析

### 📊 全面报告

- **多格式输出**：支持Markdown、HTML、JSON等多种报告格式
- **详细指标**：代码质量、安全性、性能等多维度分析
- **趋势分析**：对比历史数据，展示代码质量变化趋势

### 🛡️ 健壮性设计

- **多级错误处理**：完善的错误捕获、重试和降级机制
- **自动恢复**：智能降级策略，确保系统在异常情况下仍能工作
- **监控告警**：实时监控系统状态，及时发现问题

## 🚀 快速开始

### 安装依赖

```bash
npm install
```

### 基本使用

```typescript
import { AICRSystem } from './src/aiCRSystem';

// 创建系统实例
const aiCR = new AICRSystem();

// 初始化
await aiCR.initialize();

// 执行代码审查
const result = await aiCR.reviewCode({
  files: ['src/example.ts'],
  outputPath: './report.md'
});

console.log(`发现 ${result.metadata.totalIssues} 个问题`);
```

### 命令行使用

```bash
# 基础使用
npm run cr

# 启用并行处理 (4个Worker)
npm run cr -- --parallel 4

# 禁用缓存
npm run cr -- --no-cache

# 显示详细统计
npm run cr -- --stats --verbose

# 仅AI审查模式
npm run cr -- --mode ai

# 使用自定义配置
npm run cr -- --config ./ai-cr.config.json

# 组合使用
npm run cr -- --mode full --parallel 8 --stats --verbose
```

## 📋 配置说明

### 基础配置文件 (`ai-cr.config.json`)

```json
{
  "project": {
    "name": "我的项目",
    "rootDir": ".",
    "outputDir": "./ai-cr-reports"
  },
  "ai": {
    "provider": "openai",
    "model": "gpt-4-turbo-preview",
    "temperature": 0.3,
    "maxTokens": 4000
  },
  "rules": {
    "enabled": ["security", "performance", "codeQuality", "architecture"],
    "severity": {
      "error": ["security", "critical-bugs"],
      "warning": ["performance", "maintainability"],
      "info": ["style", "suggestions"]
    }
  },
  "performance": {
    "enableCache": true,
    "parallelProcessing": true,
    "maxWorkers": 4
  }
}
```

### 环境变量配置

```bash
# AI服务配置
export AI_CR_AI_PROVIDER=openai
export AI_CR_AI_API_KEY=your-api-key
export AI_CR_AI_MODEL=gpt-4-turbo-preview

# 性能配置
export AI_CR_MAX_WORKERS=8
export AI_CR_ENABLE_CACHE=true

# 项目配置
export AI_CR_PROJECT_NAME="My Project"
export AI_CR_OUTPUT_DIR="./reports"
```

## 🏗️ 系统架构

```
┌─────────────────────────────────────────────────────────────┐
│                    AI Code Review System                    │
├─────────────────────────────────────────────────────────────┤
│  ConfigManager  │  ErrorHandler  │  CacheManager  │  ...    │
├─────────────────────────────────────────────────────────────┤
│                     Core Components                         │
│  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────┐ │
│  │ DependencyAnalyzer │  │ ContextExpander  │  │ SmartQueue   │ │
│  └─────────────────┘  └─────────────────┘  └──────────────┘ │
├─────────────────────────────────────────────────────────────┤
│                 Processing Layer                            │
│  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────┐ │
│  │ ParallelProcessor │  │   AI Service    │  │ ReportGenerator │ │
│  └─────────────────┘  └─────────────────┘  └──────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## 📦 核心模块

### 🔍 依赖分析器 (DependencyAnalyzer)

- 分析文件间的import/export关系
- 检测循环依赖
- 识别孤立文件和入口点

### 🧠 上下文扩展器 (EnhancedContextExpander)

- 5种智能上下文策略
- 基于多维度分析的策略选择
- 语义复杂度评估

### ⚡ 智能队列 (SmartCRQueue)

- 优先级队列管理
- 智能批处理
- 负载均衡

### 📊 报告生成器 (SmartReportGenerator)

- 多格式报告输出
- 详细的指标分析
- 趋势对比功能

### 💾 缓存管理器 (SmartCacheManager)

- 基于内容哈希的增量缓存
- 多种淘汰策略 (LRU/LFU/TTL)
- 自动清理和优化

### 🚀 并行处理器 (ParallelProcessor)

- Worker线程池管理
- 自动扩缩容
- 任务负载均衡

### 🛡️ 错误处理器 (RobustErrorHandler)

- 多级错误处理
- 智能重试机制
- 降级策略

## 🔧 高级用法

### 自定义规则

```typescript
// 注册自定义分析规则
const customRules = {
  checkAsyncAwait: {
    severity: 'warning',
    check: (code) => {
      // 检查异步代码模式
      return code.includes('await') && !code.includes('try');
    },
    message: '建议为async/await添加错误处理'
  }
};

aiCR.registerCustomRules(customRules);
```

### 批量处理

```typescript
// 批量审查多个分支
const branches = ['feature/auth', 'feature/payment', 'bugfix/validation'];
const results = await aiCR.batchReview(
  branches.map(branch => ({ branch }))
);
```

### 集成CI/CD

```yaml
# .github/workflows/ai-cr.yml
name: AI Code Review
on:
  pull_request:
    branches: [main]

jobs:
  ai-review:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm install
      
      - name: Run AI Code Review
        run: npm run ai-cr -- --base-branch origin/main --output review.md
        env:
          AI_CR_AI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
      
      - name: Comment PR
        uses: actions/github-script@v6
        with:
          script: |
            const fs = require('fs');
            const report = fs.readFileSync('review.md', 'utf8');
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: `## 🤖 AI Code Review\n\n${report}`
            });
```

## 📈 性能优化

### Token使用优化

- **智能策略选择**：根据文件特征选择最优上下文策略，减少60-70% token使用
- **增量分析**：只分析变更的文件，避免重复处理
- **缓存机制**：相同内容复用分析结果

### 处理性能优化

- **并行处理**：多Worker并行分析，提升40-50%处理速度
- **智能队列**：优先级排序和批处理，合理分配资源
- **内存管理**：自动清理和垃圾回收，避免内存泄漏

## 🚨 故障排除

### 常见问题

**Q: Token超出限制怎么办？**

```bash
# 调整上下文策略
export AI_CR_CONTEXT_STRATEGY=aggressive
# 或者限制单文件token数
export AI_CR_MAX_TOKENS_PER_FILE=2000
```

**Q: 处理速度太慢？**

```bash
# 启用并行处理
export AI_CR_MAX_WORKERS=8
export AI_CR_ENABLE_CACHE=true
```

**Q: API调用失败？**

```bash
# 检查API配置
npm run ai-cr -- --health-check

# 查看详细日志
export AI_CR_LOG_LEVEL=debug
```

### 日志分析

```bash
# 查看处理日志
tail -f logs/ai-cr.log

# 分析性能指标
npm run ai-cr -- --stats

# 导出缓存统计
npm run ai-cr -- --cache-stats
```

## 🤝 贡献指南

1. Fork 项目
2. 创建特性分支 (`git checkout -b feature/amazing-feature`)
3. 提交更改 (`git commit -m 'Add some amazing feature'`)
4. 推送分支 (`git push origin feature/amazing-feature`)
5. 创建 Pull Request

### 开发环境设置

```bash
# 克隆项目
git clone https://github.com/your-username/ai-cr.git
cd ai-cr

# 安装依赖
npm install

# 运行测试
npm test

# 运行示例
npm run example

# 构建项目
npm run build
```

## 📄 许可证

MIT License - 详见 [LICENSE](LICENSE) 文件

## 🙏 致谢

感谢所有贡献者和以下开源项目：

- OpenAI GPT API
- TypeScript
- Node.js Worker Threads

---

**🚀 让AI助力代码质量提升，让开发更高效！**

