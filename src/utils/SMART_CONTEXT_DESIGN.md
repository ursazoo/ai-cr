# 智能上下文扩展器 - 技术设计文档

## 📋 设计目标

将现有的简单全文读取改造为智能的多维度判断系统，根据不同情况选择最优的上下文策略，大幅降低token消耗。

## 🏗️ 架构设计

### 核心数据结构

```typescript
interface ChangeAnalysis {
  filePath: string;
  fileSize: number;           // 文件总行数
  changeRatio: number;        // 变更比例 (0-1)
  chunkCount: number;         // 变更块数量
  maxChunkSize: number;       // 最大连续变更行数
  isNewFile: boolean;         // 是否为新文件
  isDeleted: boolean;         // 是否被删除
  fileType: FileType;         // 文件类型
  hasApiChanges: boolean;     // 是否涉及API变更
  strategy: ContextStrategy;  // 选定的策略
  estimatedTokens: number;    // 预估token消耗
}

enum ContextStrategy {
  DIFF_ONLY = 'diff_only',           // <500 tokens
  CONTEXT_WINDOW = 'context_window',  // ~1000 tokens  
  AFFECTED_BLOCKS = 'affected_blocks', // ~2000 tokens
  SMART_SUMMARY = 'smart_summary',    // ~3000 tokens
  FULL_FILE = 'full_file'             // 4000+ tokens
}

enum FileType {
  CONFIG = 'config',        // 配置文件
  TEST = 'test',           // 测试文件
  CORE = 'core',           // 核心代码
  DOCUMENTATION = 'docs',   // 文档
  BUILD = 'build'          // 构建脚本
}

interface SmartContext {
  strategy: ContextStrategy;
  content: string;
  metadata: {
    originalSize: number;
    compressedSize: number;
    compressionRatio: number;
    estimatedTokens: number;
  };
}
```

## 🎯 多维度判断逻辑

### 判断维度

1. **文件大小维度**
   - 小文件 (<100行): 倾向于FULL_FILE
   - 中文件 (100-500行): 根据变更比例决定
   - 大文件 (>500行): 倾向于智能压缩

2. **变更比例维度**
   - 微小变更 (<5%): DIFF_ONLY或CONTEXT_WINDOW
   - 小变更 (5-20%): CONTEXT_WINDOW或AFFECTED_BLOCKS
   - 中等变更 (20-50%): AFFECTED_BLOCKS或SMART_SUMMARY
   - 大变更 (>50%): SMART_SUMMARY或FULL_FILE

3. **变更分散度维度**
   - 集中变更 (1-2个chunk): 优先局部策略
   - 分散变更 (3-5个chunk): 中等策略
   - 高度分散 (>5个chunk): 全局策略

4. **文件类型维度**
   - 配置文件: 通常使用FULL_FILE（文件小且重要）
   - 测试文件: 可以使用CONTEXT_WINDOW（上下文需求低）
   - 核心代码: 需要更多上下文，使用AFFECTED_BLOCKS

5. **语义重要性维度**
   - API变更: 需要完整上下文
   - 类型定义变更: 需要相关类型信息
   - 内部实现变更: 可以使用局部上下文

### 决策矩阵

```typescript
function selectStrategy(analysis: ChangeAnalysis): ContextStrategy {
  // 特殊情况优先处理
  if (analysis.isNewFile) return ContextStrategy.FULL_FILE;
  if (analysis.fileSize < 50) return ContextStrategy.FULL_FILE;
  
  // 基于变更比例的基础策略
  if (analysis.changeRatio < 0.05 && analysis.chunkCount <= 2) {
    return ContextStrategy.DIFF_ONLY;
  }
  
  if (analysis.changeRatio < 0.15 && analysis.chunkCount <= 3) {
    return ContextStrategy.CONTEXT_WINDOW;
  }
  
  if (analysis.changeRatio < 0.4 && !analysis.hasApiChanges) {
    return ContextStrategy.AFFECTED_BLOCKS;
  }
  
  if (analysis.changeRatio > 0.6 || analysis.fileSize < 200) {
    return ContextStrategy.FULL_FILE;
  }
  
  // 默认智能摘要策略
  return ContextStrategy.SMART_SUMMARY;
}
```

## 🔧 上下文提取策略

### 1. DIFF_ONLY Strategy

- 适用: 微小变更 (<10行，<5%变更比例)
- 内容: 仅包含git diff输出
- Token估算: ~500

### 2. CONTEXT_WINDOW Strategy  

- 适用: 小变更 (10-50行，<15%变更比例)
- 内容: diff内容 + 前后20行上下文
- Token估算: ~1000

### 3. AFFECTED_BLOCKS Strategy

- 适用: 中等变更 (涉及多个函数/类)
- 内容: 受影响的完整函数/类定义
- Token估算: ~2000

### 4. SMART_SUMMARY Strategy

- 适用: 大变更但不适合全文
- 内容: 文件头部(imports+类型) + 关键变更块
- Token估算: ~3000

### 5. FULL_FILE Strategy

- 适用: 新文件、小文件、重构
- 内容: 完整文件内容
- Token估算: 4000+

## 📊 性能优化

### Token消耗控制

- 最大单文件token限制: 4000
- 超出限制时自动降级策略
- 提供token预估功能

### 缓存机制

- 文件内容hash缓存
- diff解析结果缓存
- 策略选择结果缓存

### 错误处理

- Git命令失败时降级到全文模式
- 文件读取失败时跳过该文件
- 策略执行失败时回退到简单策略

## 🚀 实现计划

### Phase 1: 基础框架

1. 创建核心数据结构
2. 实现diff解析功能
3. 实现基础的多维度分析

### Phase 2: 策略实现

1. 实现5种上下文提取策略
2. 实现策略选择逻辑
3. 添加性能监控

### Phase 3: 集成优化

1. 集成到现有AI客户端
2. 添加配置选项
3. 完善错误处理和日志

## 📈 预期效果

- **Token节省**: 60-70%
- **成本降低**: ~65%
- **性能提升**: 30-40%
- **质量保证**: 通过智能判断保持审查质量

## 🔍 测试策略

### 单元测试

- diff解析准确性测试
- 策略选择逻辑测试
- 各种边界条件测试

### 集成测试

- 不同类型文件的处理测试
- token消耗统计验证
- 审查质量对比测试

### 性能测试

- 大仓库处理性能测试
- 内存使用优化验证
- 并发处理能力测试
