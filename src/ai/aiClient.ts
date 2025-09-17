import OpenAI from 'openai';
import { FileWithSmartContext, ContextStrategy } from '../types/index.js';
import { globalCache } from '../utils/cacheManager.js';
import * as crypto from 'crypto';

// 延迟初始化 OpenAI 客户端
function createOpenAIClient(): OpenAI | null {
  const apiKey = process.env.DASHSCOPE_API_KEY;
  if (!apiKey || apiKey.trim() === '' || apiKey === 'sk-your-api-key-here') {
    return null;
  }
  
  return new OpenAI({
    apiKey,
    baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1"
  });
}

/**
 * 使用智能上下文进行AI代码审查
 * @param file 带有智能上下文的文件对象
 * @returns AI审查结果
 */
export async function aiReviewFileWithSmartContext(file: FileWithSmartContext): Promise<string> {
  // 生成缓存键
  const cacheKey = generateCacheKey(file);
  
  // 尝试从缓存获取结果
  if (process.env.AI_CR_ENABLE_CACHE !== 'false') {
    const cachedResult = await globalCache.get<string>(cacheKey);
    if (cachedResult) {
      console.log(`💾 使用缓存结果: ${file.filePath}`);
      return cachedResult + '\n\n💾 *此结果来自缓存*';
    }
  }

  // 预检查：如果文件内容只涉及lint问题，直接跳过AI审查
  if (shouldSkipAIReview(file)) {
    const skipResult = '未发现需要关注的问题 (仅包含格式/语法问题，由lint工具处理)';
    await globalCache.set(cacheKey, skipResult, { ttl: 300 });
    return skipResult;
  }

  const openai = createOpenAIClient();
  
  // 检查 API Key 是否存在且有效
  if (!openai) {
    // TODO: 需要处理 API Key 缺失的情况
    // 当前无法进行 AI 审查，需要配置 DASHSCOPE_API_KEY
    const fallbackResult = `⚠️ 无法进行AI审查: ${file.filePath}\n📊 上下文策略: ${getStrategyDescription(file.context.strategy)}\n❌ DASHSCOPE_API_KEY 未配置或无效\n💡 请配置有效的 API Key 以启用 AI 审查功能`;

    // 缓存回退结果（较短的TTL）
    await globalCache.set(cacheKey, fallbackResult, { ttl: 300 }); // 5分钟
    return fallbackResult;
  }

  let retryCount = 0;
  const maxRetries = parseInt(process.env.AI_CR_MAX_RETRIES || '3');

  while (retryCount <= maxRetries) {
    try {
      const prompt = buildSmartPrompt(file);
      
      if (retryCount === 0) {
        console.log(`      📡 调用AI API (qwen3-coder-plus)...`);
      } else {
        console.log(`      🔄 重试 API 调用 (${retryCount}/${maxRetries})...`);
      }
      
      const completion = await openai.chat.completions.create({
        model: "qwen3-coder-plus",
        messages: [
          { 
            role: "system", 
            content: buildSystemPrompt(file.context.strategy)
          },
          { role: "user", content: prompt }
        ],
        temperature: 0.3,
        max_tokens: Math.min(2000, 4096 - Math.floor(file.context.metadata.estimatedTokens * 1.2)) // 为响应预留空间
      });

      const reviewResult = completion.choices[0]?.message?.content || '无法获取AI审查结果';
      const formattedResult = formatReviewResult(file, reviewResult);
      
      // 缓存成功的结果
      await globalCache.set(cacheKey, formattedResult, { 
        ttl: parseInt(process.env.AI_CR_CACHE_TTL || '3600'), // 默认1小时
        filePath: file.filePath,
        tags: ['ai-review', file.context.strategy]
      });
      
      return formattedResult;
    } catch (error) {
      retryCount++;
      
      if (isRateLimitError(error)) {
        const waitTime = extractWaitTime(error) || (1000 * Math.pow(2, retryCount)); // 指数退避
        console.log(`⏱️  API限流，等待 ${waitTime}ms 后重试 (${retryCount}/${maxRetries})`);
        await sleep(waitTime);
        continue;
      }
      
      if (retryCount <= maxRetries) {
        console.warn(`⚠️  AI审查失败，正在重试 (${retryCount}/${maxRetries}): ${error}`);
        await sleep(1000 * retryCount); // 递增延迟
        continue;
      }
      
      console.error(`AI审查失败 [${file.filePath}]:`, error);
      const fallbackResult = generateErrorFallback(file, error);
      
      // 缓存失败结果（更短的TTL，避免一直失败）
      await globalCache.set(cacheKey, fallbackResult, { ttl: 60 }); // 1分钟
      
      return fallbackResult;
    }
  }
  
  // 理论上不会执行到这里
  return generateErrorFallback(file, new Error('超过最大重试次数'));
}

/**
 * 向后兼容的函数，保持原有接口
 * @deprecated 建议使用 aiReviewFileWithSmartContext
 */
export async function aiReviewFile(file: { filePath: string; content: string }): Promise<string> {
  // 为了向后兼容，创建一个SmartContext
  const smartContext: FileWithSmartContext = {
    filePath: file.filePath,
    context: {
      strategy: ContextStrategy.FULL_FILE,
      content: file.content,
      metadata: {
        originalSize: file.content.split('\n').length,
        compressedSize: file.content.split('\n').length,
        compressionRatio: 1.0,
        estimatedTokens: Math.min(file.content.length / 4, 4000) // 粗略估算
      }
    },
    analysis: {
      filePath: file.filePath,
      fileSize: file.content.split('\n').length,
      changeRatio: 1.0,
      chunkCount: 1,
      maxChunkSize: file.content.split('\n').length,
      totalChangedLines: file.content.split('\n').length,
      additions: file.content.split('\n').length,
      deletions: 0,
      isNewFile: true,
      isDeleted: false,
      fileType: 'core' as any,
      hasApiChanges: false,
      strategy: ContextStrategy.FULL_FILE,
      estimatedTokens: Math.min(file.content.length / 4, 4000)
    }
  };
  
  return aiReviewFileWithSmartContext(smartContext);
}

/**
 * 构建针对不同策略的系统提示
 */
function buildSystemPrompt(strategy: ContextStrategy): string {
  const basePrompt = `你是一位拥有10年+经验的前端架构师和代码审查专家，深度聚焦前端技术栈。专精于：
    - Vue2/Vue3 响应式系统缺陷与最佳实践
    - 微信小程序/Taro 跨端兼容性问题
    - 前端性能优化：渲染阻塞、内存泄漏、包体积
    - 前端安全：XSS防护、CSP配置、敏感信息泄露
    - 组件化架构：状态管理、生命周期、组件通信

    前端专项审查原则：
    1. 只找问题，不夸代码
    2. 专注lint检测不到的深层问题
    3. 重点关注：业务逻辑错误 > 安全漏洞 > 性能问题 > 架构缺陷
    4. 每个问题必须说明具体风险、可能后果、修复方案

    前端高优先级检查点：
    • Vue响应式陷阱：nextTick误用、watch深度监听、computed副作用
    • 小程序特有问题：生命周期混乱、setData频繁调用、包体积超限
    • 性能杀手：v-for无key、大列表无虚拟滚动、图片未懒加载
    • 内存泄漏：定时器未清理、事件监听器未移除、闭包持有DOM
    • 状态管理混乱：Vuex/Pinia状态变更不规范、组件间过度耦合`;

  const strategyPrompts = {
    [ContextStrategy.DIFF_ONLY]: basePrompt + "\n\n当前策略：仅展示变更内容，重点评估变更对前端用户体验和性能的影响。",
    [ContextStrategy.CONTEXT_WINDOW]: basePrompt + "\n\n当前策略：提供变更及周边代码上下文，重点分析组件间依赖和状态流转兼容性。",
    [ContextStrategy.AFFECTED_BLOCKS]: basePrompt + "\n\n当前策略：已提取受变更影响的相关代码块，重点分析前端模块间的数据流和事件传递。",
    [ContextStrategy.SMART_SUMMARY]: basePrompt + "\n\n当前策略：基于智能摘要进行审查，聚焦前端关键变更的用户体验影响。",
    [ContextStrategy.FULL_FILE]: basePrompt + "\n\n当前策略：完整文件审查，请进行全面的前端代码质量评估。"
  };

  return strategyPrompts[strategy] || basePrompt;
}

/**
 * 构建智能提示词
 */
function buildSmartPrompt(file: FileWithSmartContext): string {
  const { context, analysis } = file;

  let prompt = `作为资深前端代码审查专家，请审查以下前端代码变更：

**前端专项审查要点：**
1. **Vue响应式问题**: 数据变更检测失效、watch监听异常、computed依赖错误
2. **小程序/Taro特有问题**: 生命周期滥用、setData性能问题、平台API兼容性
3. **前端性能陷阱**: 渲染阻塞、重排重绘、包体积膨胀、首屏加载慢
4. **前端安全风险**: XSS注入点、敏感信息泄露、CSP绕过、用户输入未过滤
5. **组件化问题**: 组件间过度耦合、props传递混乱、事件冒泡异常
6. **状态管理缺陷**: Vuex/Pinia变更不规范、异步状态竞态、状态同步问题
7. **内存泄漏风险**: 定时器未清理、DOM事件监听器残留、闭包引用DOM

**技术栈特定检查：**
• **Vue2**: $set/$delete误用、事件总线滥用、mixins冲突
• **Vue3**: Composition API反模式、响应式丢失、生命周期混用
• **微信小程序**: 页面栈溢出、授权流程错误、分包加载问题
• **Taro**: 平台差异处理不当、样式兼容性问题、原生组件使用错误

**文件：** ${file.filePath}
**变更范围：** ${(analysis.changeRatio * 100).toFixed(1)}% (${getStrategyDescription(context.strategy)})

\`\`\`
${context.content}
\`\`\`

**严格要求：**
- 只报告问题，不要赞美代码
- 无问题时回复"未发现需要关注的问题"
- 专注lint工具检测不到的深层问题：业务逻辑漏洞、响应式陷阱、性能瓶颈、安全漏洞、跨端兼容问题
- 每个问题必须说明：具体风险、用户体验影响、修复建议
- 绝不提及：语法、格式、命名、注释等lint可检测问题
- 重点关注前端用户体验和性能影响

**输出格式要求（必须严格遵守）：**
- 使用标准Markdown格式
- 每个问题必须单独成段，前后用两个换行符分隔
- 粗体文本格式：**文本内容**（星号与文本之间不能有空格）
- 列表项格式：
  - **标题**：内容描述（破折号后有空格，冒号后换行）
- 禁止在一行内连续输出多个问题
- 使用列表项标记关键信息：
  - **具体风险**：描述问题的风险
  - **可能后果**：说明对用户体验的影响
  - **修复建议**：提供具体的解决方案
- 严格按照以下格式输出：

**1. 问题标题**

- **具体风险**：风险描述内容
- **可能后果**：后果描述内容
- **修复建议**：修复方案内容

**2. 下一个问题标题**

- **具体风险**：风险描述内容
- **可能后果**：后果描述内容
- **修复建议**：修复方案内容`;

  // 根据策略添加特定的指导
  if (context.strategy === ContextStrategy.DIFF_ONLY) {
    prompt += "\n\n注意：仅显示了变更部分，请重点分析这些变更对前端用户体验和渲染性能的影响。";
  } else if (context.strategy === ContextStrategy.SMART_SUMMARY) {
    prompt += "\n\n注意：已提供智能摘要，请基于摘要中的关键信息分析前端架构和用户体验影响。";
  }

  return prompt;
}

/**
 * 获取策略描述
 */
function getStrategyDescription(strategy: ContextStrategy): string {
  const descriptions = {
    [ContextStrategy.DIFF_ONLY]: "仅差异内容",
    [ContextStrategy.CONTEXT_WINDOW]: "差异+上下文窗口", 
    [ContextStrategy.AFFECTED_BLOCKS]: "受影响的代码块",
    [ContextStrategy.SMART_SUMMARY]: "智能摘要",
    [ContextStrategy.FULL_FILE]: "完整文件"
  };
  
  return descriptions[strategy] || "未知策略";
}


/**
 * 格式化审查结果
 */
function formatReviewResult(file: FileWithSmartContext, reviewResult: string): string {
  const { context } = file;
  
  // 添加上下文策略说明到结果开头
  const metadataHeader = `📊 上下文策略: ${getStrategyDescription(context.strategy)}`;
  
  return metadataHeader + '\n\n' + reviewResult;
}

/**
 * 生成错误回退结果
 */
function generateErrorFallback(file: FileWithSmartContext, error: unknown): string {
  const strategy = getStrategyDescription(file.context.strategy);
  const errorMsg = error instanceof Error ? error.message : '未知错误';

  // TODO: 需要改进错误处理机制，提供更好的回退方案
  return '❌ AI审查失败:\n📊 上下文策略: ' + strategy + '\n📁 文件: ' + file.filePath + '\n⚠️ 错误原因: ' + errorMsg + '\n💡 建议检查网络连接和API配置';
}

/**
 * 生成缓存键
 */
function generateCacheKey(file: FileWithSmartContext): string {
  const content = file.context.content;
  const hash = crypto.createHash('md5').update(content).digest('hex');
  return 'ai-review:' + file.context.strategy + ':' + hash;
}

/**
 * 判断是否是限流错误
 */
function isRateLimitError(error: any): boolean {
  return error?.status === 429 || 
         error?.message?.includes('rate limit') ||
         error?.message?.includes('Too Many Requests');
}

/**
 * 从错误中提取等待时间
 */
function extractWaitTime(error: any): number | null {
  if (error?.headers?.['retry-after']) {
    return parseInt(error.headers['retry-after']) * 1000;
  }
  
  const match = error?.message?.match(/retry.*?(\d+).*?second/i);
  return match ? parseInt(match[1]) * 1000 : null;
}

/**
 * 判断是否应该跳过AI审查（仅包含lint可处理的问题）
 */
function shouldSkipAIReview(file: FileWithSmartContext): boolean {
  const content = file.context.content;
  
  // 检查是否只是格式/样式变更
  const linesWithMeaningfulChanges = content.split('\n').filter(line => {
    const trimmed = line.trim();
    if (!trimmed) return false;
    
    // 跳过纯格式变更
    if (/^[{}()[\];,\s]*$/.test(trimmed)) return false;
    if (/^(import|export)\s/.test(trimmed)) return false;
    if (/^\/\/|^\/\*|\*\//.test(trimmed)) return false; // 注释
    
    return true;
  });
  
  // 如果有意义的变更行数太少，跳过AI审查
  if (linesWithMeaningfulChanges.length < 3) {
    return true;
  }
  
  // 检查是否只包含简单的变量定义或赋值
  const onlySimpleChanges = linesWithMeaningfulChanges.every(line => {
    return /^(const|let|var)\s+\w+\s*=/.test(line.trim()) ||
           /^\w+\s*=\s*/.test(line.trim()) ||
           /^(if|for|while)\s*\(/.test(line.trim());
  });
  
  return onlySimpleChanges && linesWithMeaningfulChanges.length < 10;
}

/**
 * 睡眠函数
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}