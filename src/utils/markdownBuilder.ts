/**
 * 简单高效的 Markdown 构建器
 * 使用字符串拼接，确保格式正确输出
 */

/**
 * AI 内容处理工具类
 */
export class AIContentProcessor {
  /**
   * 处理 AI 结果中的标题级别问题
   * 将 AI 生成的 markdown 内容中的标题级别调整到合适的层级
   */
  static adjustHeadingLevels(content: string, baseLevel: number = 4): string {
    if (!content || !content.trim()) {
      return '';
    }

    const lines = content.split('\n');
    const processedLines: string[] = [];

    for (const line of lines) {
      const trimmedLine = line.trim();

      if (!trimmedLine) {
        processedLines.push('');
        continue;
      }

      // 检测标题行
      const headingMatch = trimmedLine.match(/^(#{1,6})\s+(.+)$/);
      if (headingMatch) {
        const originalLevel = headingMatch[1]?.length || 1;
        const headingText = headingMatch[2] || '';
        // 将标题级别调整到基础级别之下
        const adjustedLevel = Math.min(6, baseLevel + originalLevel - 1);
        const adjustedHeading = '#'.repeat(adjustedLevel) + ' ' + headingText;
        processedLines.push(adjustedHeading);
      } else {
        // 非标题行，保持原样
        processedLines.push(line);
      }
    }

    return processedLines.join('\n');
  }

  /**
   * 清理内容格式（去除多余空行等）
   */
  static cleanContent(content: string): string {
    if (!content || !content.trim()) {
      return '';
    }

    return content
      .split('\n')
      .map(line => line.trimEnd()) // 去除行尾空格
      .join('\n')
      .replace(/\n{3,}/g, '\n\n') // 将多个连续空行替换为两个
      .trim();
  }

  /**
   * 专门处理AI返回的审查结果格式
   * 确保正确的换行、列表格式和段落分隔
   */
  static formatAIResponse(content: string): string {
    if (!content || !content.trim()) {
      return '';
    }

    let processed = content;

    // 1. 安全地处理缺失换行的问题描述 - 避免ReDoS风险
    processed = processed.replace(/([。！？])\s*/g, '$1\n\n');
    processed = processed.replace(/\n\n([具可能修])/g, '\n\n$1');

    // 2. 修复破损的粗体标记格式
    processed = processed.replace(/\*\*\s*-\s*\*\*/g, '\n\n- ');
    processed = processed.replace(/\*\*([^*]+)\*\*\s*[：:]/g, '\n\n**$1**：');

    // 3. 确保问题之间有正确分隔 - 简化正则表达式
    processed = processed.replace(/\*\*具体风险[：:]\*\*/g, '\n**具体风险**：');
    processed = processed.replace(/\*\*修复建议[：:]\*\*/g, '\n**修复建议**：');

    // 3. 修复列表格式问题
    processed = processed.replace(/^(\s*)([•·・-])\s*/gm, '$1- ');

    // 4. 修复粗体标记问题，确保正确的格式
    processed = processed.replace(/\*\*([^*\n]+?)\*\*/g, (_, text) => {
      // 确保粗体文本前后有适当空格
      return ` **${text.trim()}** `;
    });

    // 修复可能被破坏的粗体格式
    processed = processed.replace(/\*\s+\*/g, '**');
    processed = processed.replace(/\*{3,}/g, '**');

    // 5. 强制问题点换行分隔
    processed = processed.replace(/([^\n])(\d+\.\s+)/g, '$1\n\n$2');
    processed = processed.replace(/\*\*(\d+\..*?)\*\*/g, '\n\n**$1**\n');

    // 6. 处理长行，在句号后添加换行 - 限制查找范围
    processed = processed.replace(/([。！？])\s*(?=[^。！？\n]{30,80})/g, '$1\n');

    // 7. 清理多余空行
    processed = processed.replace(/\n{3,}/g, '\n\n');

    // 8. 确保段落间有适当间距
    processed = processed.replace(/([。！？])\n([A-Za-z\u4e00-\u9fa5])/g, '$1\n\n$2');

    return processed.trim();
  }

  /**
   * 检测并修复常见的AI格式问题
   */
  static detectAndFixCommonIssues(content: string): string {
    if (!content || !content.trim()) {
      return '';
    }

    let fixed = content;

    // 1. 修复缺失的列表标记
    fixed = fixed.replace(/^(\s*)(?![-*+•]|\d+\.)\s*([具可能修][^:\n]*[:：])/gm, '$1- $2');

    // 2. 修复粗体文本格式
    fixed = fixed.replace(/(\*{1,2})([^*]+)\1/g, (_, stars, text) => {
      return stars.length === 2 ? `**${text}**` : `*${text}*`;
    });

    // 3. 确保代码块有正确的语言标识
    fixed = fixed.replace(/```(?!\w)/g, '```javascript');

    // 4. 修复中文标点后的空格问题
    fixed = fixed.replace(/([，。！？；：])\s+/g, '$1');

    // 5. 确保英文单词间有空格
    fixed = fixed.replace(/([a-zA-Z])([。，！？])/g, '$1 $2');

    return fixed;
  }

  /**
   * 修复列表格式问题
   */
  static fixListFormatting(content: string): string {
    if (!content || !content.trim()) {
      return '';
    }

    let fixed = content;

    // 1. 识别并修复列表项格式
    fixed = fixed.replace(/\s*-\s*\*\*([^*]+)\*\*/g, '\n\n- **$1**');

    // 2. 修复列表项的子项
    fixed = fixed.replace(/\*\*\s*-\s*/g, '**\n\n- ');

    // 3. 确保列表项后的内容正确缩进
    fixed = fixed.replace(/^(\s*[-*+])\s*(.+)$/gm, (_, marker, content) => {
      return `${marker} ${content.trim()}`;
    });

    // 4. 修复列表项中的粗体冒号格式
    fixed = fixed.replace(/^(\s*[-*+])\s*\*\*([^*:：]+)\*\*\s*[：:]/gm, '$1 **$2**：');

    return fixed;
  }

  /**
   * 修复粗体格式问题
   */
  static fixBoldFormatting(content: string): string {
    if (!content || !content.trim()) {
      return '';
    }

    let fixed = content;

    // 1. 修复不成对的粗体标记
    const boldCount = (fixed.match(/\*\*/g) || []).length;
    if (boldCount % 2 !== 0) {
      // 尝试修复不成对的标记 - 在行末添加缺失的标记
      fixed = fixed.replace(/\*\*([^*\n]+)$/gm, '**$1**');
      // 如果还是不成对，在内容末尾添加
      const newBoldCount = (fixed.match(/\*\*/g) || []).length;
      if (newBoldCount % 2 !== 0) {
        fixed += '**';
      }
    }

    // 2. 确保粗体标记与内容间没有多余空格
    fixed = fixed.replace(/\*\*\s+([^*]+?)\s+\*\*/g, '**$1**');

    // 3. 修复连续的粗体标记
    fixed = fixed.replace(/\*\*\*\*/g, '** **');

    // 4. 确保列表项中的粗体标记正确
    fixed = fixed.replace(/^(\s*[-*+])\s*\*\*([^*:：]+)[：:]\*\*/gm, '$1 **$2**：');

    return fixed;
  }

  /**
   * 综合处理AI内容
   */
  static processAIContent(content: string, baseLevel: number = 4): string {
    if (!content || !content.trim()) {
      return '';
    }

    // 1. 先进行常见问题修复
    let processed = this.detectAndFixCommonIssues(content);

    // 2. 修复列表格式问题
    processed = this.fixListFormatting(processed);

    // 3. 修复粗体格式问题
    processed = this.fixBoldFormatting(processed);

    // 4. 格式化AI响应
    processed = this.formatAIResponse(processed);

    // 5. 调整标题级别
    processed = this.adjustHeadingLevels(processed, baseLevel);

    // 6. 最终清理
    processed = this.cleanContent(processed);

    return processed;
  }
}

/**
 * 表格行数据
 */
export interface TableRow {
  [key: string]: string | number;
}

/**
 * 表格列配置
 */
export interface TableColumn {
  key: string;
  header: string;
  align?: 'left' | 'center' | 'right';
}

/**
 * 基于字符串拼接的 Markdown 构建器
 */
export class MarkdownBuilder {
  private content: string[] = [];

  /**
   * 添加标题
   */
  addHeading(text: string, level: number = 1): MarkdownBuilder {
    const adjustedLevel = Math.max(1, Math.min(6, level));
    this.content.push('#'.repeat(adjustedLevel) + ' ' + text + '\n\n');
    return this;
  }

  /**
   * 添加段落
   */
  addParagraph(text: string): MarkdownBuilder {
    this.content.push(text + '\n\n');
    return this;
  }

  /**
   * 添加粗体文本
   */
  addBold(text: string): MarkdownBuilder {
    this.content.push('**' + text + '**\n\n');
    return this;
  }

  /**
   * 添加斜体文本
   */
  addItalic(text: string): MarkdownBuilder {
    this.content.push('*' + text + '*\n\n');
    return this;
  }

  /**
   * 添加内联代码
   */
  addInlineCode(codeText: string): MarkdownBuilder {
    this.content.push('`' + codeText + '`\n\n');
    return this;
  }

  /**
   * 添加代码块
   */
  addCodeBlock(codeText: string, language?: string): MarkdownBuilder {
    const lang = language || '';
    this.content.push('```' + lang + '\n' + codeText + '\n```\n\n');
    return this;
  }

  /**
   * 添加列表
   */
  addList(items: string[], ordered: boolean = false): MarkdownBuilder {
    items.forEach((item, index) => {
      const prefix = ordered ? `${index + 1}. ` : '- ';
      this.content.push(prefix + item + '\n');
    });
    this.content.push('\n');
    return this;
  }

  /**
   * 添加表格
   */
  addTable(columns: TableColumn[], rows: TableRow[]): MarkdownBuilder {
    if (columns.length === 0 || rows.length === 0) {
      return this;
    }

    // 表头行
    const headers = columns.map(col => col.header).join(' | ');
    this.content.push('| ' + headers + ' |\n');

    // 分隔符
    const separators = columns.map(col => {
      switch (col.align) {
        case 'center': return ':------:';
        case 'right': return '------:';
        default: return '------';
      }
    }).join(' | ');
    this.content.push('| ' + separators + ' |\n');

    // 数据行
    rows.forEach(row => {
      const cells = columns.map(col => String(row[col.key] || '')).join(' | ');
      this.content.push('| ' + cells + ' |\n');
    });

    this.content.push('\n');
    return this;
  }

  /**
   * 添加链接
   */
  addLink(linkText: string, url: string): MarkdownBuilder {
    this.content.push('[' + linkText + '](' + url + ')\n\n');
    return this;
  }

  /**
   * 添加图片
   */
  addImage(alt: string, url: string, title?: string): MarkdownBuilder {
    const titleAttr = title ? ' "' + title + '"' : '';
    this.content.push('![' + alt + '](' + url + titleAttr + ')\n\n');
    return this;
  }

  /**
   * 添加水平分隔线
   */
  addHorizontalRule(): MarkdownBuilder {
    this.content.push('---\n\n');
    return this;
  }

  /**
   * 添加引用块
   */
  addBlockquote(quoteText: string): MarkdownBuilder {
    const lines = quoteText.split('\n');
    lines.forEach(line => {
      this.content.push('> ' + line + '\n');
    });
    this.content.push('\n');
    return this;
  }

  /**
   * 添加换行
   */
  addLineBreak(): MarkdownBuilder {
    this.content.push('\n');
    return this;
  }

  /**
   * 添加原始文本（不进行任何处理）
   */
  addRaw(rawText: string): MarkdownBuilder {
    if (!rawText || !rawText.trim()) {
      return this;
    }
    this.content.push(rawText);
    if (!rawText.endsWith('\n')) {
      this.content.push('\n');
    }
    return this;
  }

  /**
   * 添加 AI 结果内容（预处理标题级别）
   */
  addAIContent(content: string, baseLevel: number = 4): MarkdownBuilder {
    if (!content || !content.trim()) {
      return this;
    }

    // 使用 AIContentProcessor 综合处理内容
    const processedContent = AIContentProcessor.processAIContent(content, baseLevel);

    // 直接添加处理后的内容
    this.addRaw(processedContent);
    return this;
  }

  /**
   * 添加键值对（格式化为 **key**: value）
   */
  addKeyValue(key: string, value: string | number): MarkdownBuilder {
    this.content.push('**' + key + '**: ' + String(value) + '\n\n');
    return this;
  }

  /**
   * 添加列表项（带描述）
   */
  addListItem(label: string, description?: string): MarkdownBuilder {
    if (description) {
      this.content.push('- **' + label + '**: ' + description + '\n');
    } else {
      this.content.push('- ' + label + '\n');
    }
    return this;
  }

  /**
   * 开始一个新的部分（添加额外的换行）
   */
  addSection(): MarkdownBuilder {
    this.content.push('\n');
    return this;
  }

  /**
   * 清空内容
   */
  clear(): MarkdownBuilder {
    this.content = [];
    return this;
  }

  /**
   * 生成最终的 Markdown 字符串
   */
  build(): string {
    return this.content.join('');
  }

  /**
   * 获取当前内容长度
   */
  getLength(): number {
    return this.content.join('').length;
  }

  /**
   * 创建一个新的 MarkdownBuilder 实例
   */
  static create(): MarkdownBuilder {
    return new MarkdownBuilder();
  }
}