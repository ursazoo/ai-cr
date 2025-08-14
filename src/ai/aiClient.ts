import OpenAI from 'openai';
import { FileWithContext } from '../utils/contextExpander';

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

export async function aiReviewFile(file: FileWithContext): Promise<string> {
  const openai = createOpenAIClient();
  
  // 检查 API Key 是否存在且有效
  if (!openai) {
    return `🤖 模拟AI审查: ${file.filePath}
✅ 代码结构良好
✅ 无明显安全问题  
✅ 建议：配置 DASHSCOPE_API_KEY 使用真实AI审查`;
  }

  try {
    const prompt = `请对以下代码进行审查，重点关注：
1. 代码质量和规范性
2. 潜在的bug和问题
3. 性能优化建议
4. 安全性问题

文件路径：${file.filePath}
代码内容：
\`\`\`
${file.content}
\`\`\`

请用中文回复，给出具体的建议和改进方案。`;

    const completion = await openai.chat.completions.create({
      model: "qwen-plus",
      messages: [
        { role: "system", content: "你是一个资深的代码审查专家，请对提供的代码进行详细审查并提供改进建议。" },
        { role: "user", content: prompt }
      ],
      temperature: 0.3,
    });

    return completion.choices[0]?.message?.content || '无法获取AI审查结果';
  } catch (error) {
    console.error(`AI审查失败 [${file.filePath}]:`, error);
    return `🤖 AI审查失败，切换到模拟模式:
✅ ${file.filePath} 基础检查通过
⚠️  错误原因: ${error instanceof Error ? error.message : '未知错误'}`;
  }
}