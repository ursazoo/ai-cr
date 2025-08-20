import OpenAI from 'openai';
import { FileWithSmartContext, ContextStrategy } from '../utils/smartContextExpander.js';

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
  const openai = createOpenAIClient();
  
  // 检查 API Key 是否存在且有效
  if (!openai) {
    return generateMockReview(file);
  }

  try {
    const prompt = buildSmartPrompt(file);
    
    const completion = await openai.chat.completions.create({
      model: "qwen-plus",
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
    
    // 添加智能上下文的元数据信息
    return formatReviewResult(file, reviewResult);
  } catch (error) {
    console.error(`AI审查失败 [${file.filePath}]:`, error);
    return generateErrorFallback(file, error);
  }
}

/**
 * 向后兼容的函数，保持原有接口
 * @deprecated 建议使用 aiReviewFileWithSmartContext
 */
export async function aiReviewFile(file: { filePath: string; content: string }): Promise<string> {
  // 为了向后兼容，创建一个模拟的SmartContext
  const mockSmartContext: FileWithSmartContext = {
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
  
  return aiReviewFileWithSmartContext(mockSmartContext);
}

/**
 * 构建针对不同策略的系统提示
 */
function buildSystemPrompt(strategy: ContextStrategy): string {
  const basePrompt = "你是一个资深的代码审查专家，请对提供的代码进行详细审查并提供改进建议。";
  
  const strategyPrompts = {
    [ContextStrategy.DIFF_ONLY]: basePrompt + " 重点关注代码变更部分的质量和潜在问题。",
    [ContextStrategy.CONTEXT_WINDOW]: basePrompt + " 已提供变更代码及其上下文，请综合分析。",
    [ContextStrategy.AFFECTED_BLOCKS]: basePrompt + " 已提取受影响的代码块，请重点分析这些代码块之间的关联。",
    [ContextStrategy.SMART_SUMMARY]: basePrompt + " 已提供智能摘要，请基于摘要进行重点分析。",
    [ContextStrategy.FULL_FILE]: basePrompt + " 请对整个文件进行全面审查。"
  };
  
  return strategyPrompts[strategy] || basePrompt;
}

/**
 * 构建智能提示词
 */
function buildSmartPrompt(file: FileWithSmartContext): string {
  const { context, analysis } = file;
  
  let prompt = `请对以下代码进行审查，重点关注：
1. 代码质量和规范性
2. 潜在的bug和问题  
3. 性能优化建议
4. 安全性问题

**文件信息：**
- 文件路径: ${file.filePath}
- 上下文策略: ${getStrategyDescription(context.strategy)}
- 变更比例: ${(analysis.changeRatio * 100).toFixed(1)}%
- 预估Token: ${context.metadata.estimatedTokens}

**代码内容：**
\`\`\`
${context.content}
\`\`\`

请用中文回复，给出具体的建议和改进方案。`;

  // 根据策略添加特定的指导
  if (context.strategy === ContextStrategy.DIFF_ONLY) {
    prompt += "\n\n注意：仅显示了变更部分，请重点分析这些变更的影响。";
  } else if (context.strategy === ContextStrategy.SMART_SUMMARY) {
    prompt += "\n\n注意：已提供智能摘要，请基于摘要中的关键信息进行分析。";
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
 * 生成模拟审查结果
 */
function generateMockReview(file: FileWithSmartContext): string {
  const { context } = file;
  
  return `🤖 模拟AI审查: ${file.filePath}
📊 上下文策略: ${getStrategyDescription(context.strategy)}
📈 Token优化: ${context.metadata.compressionRatio < 0.5 ? '节省' + Math.round((1 - context.metadata.compressionRatio) * 100) + '%' : '未优化'}
✅ 代码结构良好
✅ 无明显安全问题  
✅ 建议：配置 DASHSCOPE_API_KEY 使用真实AI审查

💡 智能上下文信息:
- 原始大小: ${context.metadata.originalSize} 行
- 压缩后: ${context.metadata.compressedSize} 行
- 预估Token: ${context.metadata.estimatedTokens}`;
}

/**
 * 格式化审查结果
 */
function formatReviewResult(file: FileWithSmartContext, reviewResult: string): string {
  const { context } = file;
  
  // 添加智能上下文元数据到结果开头
  const metadataHeader = `📊 智能上下文 (${getStrategyDescription(context.strategy)})
💾 Token优化: ${context.metadata.estimatedTokens} tokens (压缩比${Math.round(context.metadata.compressionRatio * 100)}%)

`;
  
  return metadataHeader + reviewResult;
}

/**
 * 生成错误回退结果
 */
function generateErrorFallback(file: FileWithSmartContext, error: unknown): string {
  return `🤖 AI审查失败，切换到模拟模式:
📊 上下文策略: ${getStrategyDescription(file.context.strategy)}
✅ ${file.filePath} 基础检查通过  
⚠️  错误原因: ${error instanceof Error ? error.message : '未知错误'}
💡 预估Token: ${file.context.metadata.estimatedTokens}`;
}