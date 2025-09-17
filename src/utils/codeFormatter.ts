import * as path from 'path';

/**
 * 代码格式化选项
 */
export interface CodeFormatOptions {
  maxInlineLength?: number; // 内联代码的最大长度，默认60
  maxLineLength?: number;   // 代码块中单行的最大长度，默认80
  language?: string;        // 代码语言标识
}

/**
 * 格式化结果
 */
export interface FormatResult {
  isInline: boolean;        // 是否使用内联格式
  content: string;          // 格式化后的内容
  language?: string;        // 语言标识（仅代码块格式使用）
}

/**
 * 智能代码格式化工具
 */
export class CodeFormatter {
  private static readonly DEFAULT_MAX_INLINE_LENGTH = 60;
  private static readonly DEFAULT_MAX_LINE_LENGTH = 80;
  
  /**
   * 格式化代码片段，智能选择内联或代码块格式
   */
  public static format(code: string, filePath?: string, options: CodeFormatOptions = {}): FormatResult {
    const maxInlineLength = options.maxInlineLength || this.DEFAULT_MAX_INLINE_LENGTH;
    const maxLineLength = options.maxLineLength || this.DEFAULT_MAX_LINE_LENGTH;
    const language = options.language || this.detectLanguage(filePath);
    
    // 清理代码
    const cleanedCode = code.trim();
    if (!cleanedCode) {
      return { isInline: true, content: '' };
    }
    
    // 判断是否使用内联格式
    const shouldUseInline = this.shouldUseInlineFormat(cleanedCode, maxInlineLength);
    
    if (shouldUseInline) {
      // 内联格式：单行且简短的代码
      return {
        isInline: true,
        content: this.formatInlineCode(cleanedCode)
      };
    } else {
      // 代码块格式：多行或较长的代码
      return {
        isInline: false,
        content: this.formatCodeBlock(cleanedCode, maxLineLength),
        language: language
      };
    }
  }
  
  /**
   * 判断是否应该使用内联格式
   */
  private static shouldUseInlineFormat(code: string, maxInlineLength: number): boolean {
    // 包含换行符则不使用内联格式
    if (code.includes('\n') || code.includes('\r')) {
      return false;
    }
    
    // 超过最大长度则不使用内联格式
    if (code.length > maxInlineLength) {
      return false;
    }
    
    // 包含复杂语法结构则不使用内联格式
    if (this.hasComplexSyntax(code)) {
      return false;
    }
    
    return true;
  }
  
  /**
   * 检查是否包含复杂语法结构
   */
  private static hasComplexSyntax(code: string): boolean {
    const complexPatterns = [
      /\{.*\}/,           // 包含大括号
      /\[.*\]/,           // 包含中括号
      /function\s*\(/,    // 函数定义
      /=>\s*\{/,          // 箭头函数
      /if\s*\(/,          // if语句
      /for\s*\(/,         // for循环
      /while\s*\(/,       // while循环
      /try\s*\{/,         // try语句
      /catch\s*\(/,       // catch语句
      /class\s+\w+/,      // 类定义
      /interface\s+\w+/,  // 接口定义
      /type\s+\w+/,       // 类型定义
    ];
    
    return complexPatterns.some(pattern => pattern.test(code));
  }
  
  /**
   * 格式化内联代码
   */
  private static formatInlineCode(code: string): string {
    // 去除多余的空格，但保留关键空格
    return code.replace(/\s+/g, ' ').trim();
  }
  
  /**
   * 格式化代码块
   */
  private static formatCodeBlock(code: string, maxLineLength: number): string {
    const lines = code.split('\n');
    const formattedLines = lines.map(line => this.formatLongLine(line.trim(), maxLineLength));
    return formattedLines.join('\n');
  }
  
  /**
   * 格式化过长的代码行
   */
  private static formatLongLine(line: string, maxLength: number): string {
    if (line.length <= maxLength) {
      return line;
    }
    
    // 尝试在合适的位置换行
    const breakPoints = this.findBreakPoints(line);
    if (breakPoints.length === 0) {
      return line; // 无法找到合适的断点，保持原样
    }
    
    const result: string[] = [];
    let currentLine = '';
    let lastBreakIndex = 0;
    
    for (const breakIndex of breakPoints) {
      const segment = line.substring(lastBreakIndex, breakIndex);
      
      if ((currentLine + segment).length <= maxLength) {
        currentLine += segment;
      } else {
        if (currentLine) {
          result.push(currentLine.trim());
        }
        currentLine = segment.trim();
      }
      
      lastBreakIndex = breakIndex;
    }
    
    // 添加剩余部分
    const remaining = line.substring(lastBreakIndex);
    if (remaining) {
      if ((currentLine + remaining).length <= maxLength) {
        currentLine += remaining;
      } else {
        if (currentLine) {
          result.push(currentLine.trim());
        }
        result.push(remaining.trim());
      }
    }
    
    if (currentLine.trim()) {
      result.push(currentLine.trim());
    }
    
    // 为续行添加适当的缩进
    return result.map((line, index) => {
      if (index === 0) return line;
      return '  ' + line; // 2个空格缩进
    }).join('\n');
  }
  
  /**
   * 找到代码行中适合换行的位置
   */
  private static findBreakPoints(line: string): number[] {
    const breakPoints: number[] = [];
    const patterns = [
      /[,;]/g,           // 逗号和分号后
      /\s+(&&|\|\|)\s+/g, // 逻辑运算符前后
      /\s*[+\-*/=<>!]+\s*/g, // 运算符前后
      /[({[]$/g,         // 开括号后
      /[)}\]]/g,         // 闭括号后
      /\./g,             // 点号后
      /:/g,              // 冒号后
    ];
    
    patterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(line)) !== null) {
        breakPoints.push(match.index + match[0].length);
      }
    });
    
    // 去重并排序
    return [...new Set(breakPoints)].sort((a, b) => a - b);
  }
  
  /**
   * 根据文件路径检测代码语言
   */
  private static detectLanguage(filePath?: string): string {
    if (!filePath) {
      return '';
    }
    
    const ext = path.extname(filePath).toLowerCase();
    const languageMap: Record<string, string> = {
      '.js': 'javascript',
      '.jsx': 'javascript',
      '.ts': 'typescript',
      '.tsx': 'typescript',
      '.vue': 'vue',
      '.html': 'html',
      '.htm': 'html',
      '.css': 'css',
      '.scss': 'scss',
      '.sass': 'sass',
      '.less': 'less',
      '.json': 'json',
      '.xml': 'xml',
      '.sql': 'sql',
      '.py': 'python',
      '.java': 'java',
      '.c': 'c',
      '.cpp': 'cpp',
      '.go': 'go',
      '.rs': 'rust',
      '.php': 'php',
      '.rb': 'ruby',
      '.sh': 'bash',
      '.yml': 'yaml',
      '.yaml': 'yaml',
      '.md': 'markdown'
    };
    
    return languageMap[ext] || '';
  }
  
  /**
   * 生成Markdown代码片段
   * 返回纯 Markdown 字符串，供 MarkdownBuilder 使用
   */
  public static toMarkdown(formatResult: FormatResult): string {
    if (formatResult.isInline) {
      // 内联代码格式
      return `\`${formatResult.content}\``;
    } else {
      // 代码块格式
      const language = formatResult.language || '';
      return `\`\`\`${language}\n${formatResult.content}\n\`\`\``;
    }
  }
}