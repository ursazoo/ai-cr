import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { FileWithSmartContext, RuleViolation } from '../types/index.js';

interface Rule {
  id: string;
  categoryId: string;
  title: string;
  description: string;
  checkBy: 'ai' | 'static' | 'both';
  severity: 'critical' | 'major' | 'minor' | 'info';
  enabled: boolean;
  examples?: {
    good?: string[];
    bad?: string[];
  };
}

/**
 * 规则与文件类型映射配置
 * 每个规则只在指定的文件类型中执行，避免误判
 */
const RULE_FILE_TYPE_MAP: Record<string, string[]> = {
  // 可读性规则 - 主要适用于编程语言文件
  'READ-001': ['.js', '.ts', '.jsx', '.tsx', '.vue'],
  'READ-002': ['.js', '.ts', '.jsx', '.tsx', '.vue'], // 变量命名规范
  'READ-003': ['.js', '.ts', '.jsx', '.tsx', '.vue'], // 魔法数字
  'READ-004': ['.js', '.ts', '.jsx', '.tsx', '.vue'],
  'READ-005': ['.js', '.ts', '.jsx', '.tsx', '.vue'],
  'READ-006': ['.js', '.ts', '.jsx', '.tsx', '.vue'],
  'READ-007': ['.js', '.ts', '.jsx', '.tsx', '.vue'],
  'READ-008': ['.vue', '.jsx', '.tsx'], // 组件相关
  
  // 架构规则 - 主要适用于编程语言文件
  'ARCH-001': ['.js', '.ts', '.jsx', '.tsx', '.vue'],
  'ARCH-002': ['.js', '.ts', '.jsx', '.tsx', '.vue'],
  'ARCH-003': ['.js', '.ts', '.jsx', '.tsx', '.vue'],
  'ARCH-004': ['.js', '.ts', '.jsx', '.tsx', '.vue'],
  'ARCH-005': ['.js', '.ts', '.jsx', '.tsx', '.vue'],
  'ARCH-006': ['.js', '.ts', '.jsx', '.tsx', '.vue'], // DOM操作
  'ARCH-007': ['.vue', '.jsx', '.tsx'], // 业务逻辑视图层
  
  // 安全规则 - 主要适用于编程语言文件
  'SEC-001': ['.js', '.ts', '.jsx', '.tsx', '.vue'], // 敏感信息硬编码
  'SEC-002': ['.js', '.ts', '.jsx', '.tsx', '.vue'], // 日志敏感信息
  'SEC-003': ['.js', '.ts', '.jsx', '.tsx', '.vue', '.html'], // XSS风险
  'SEC-004': ['.js', '.ts', '.jsx', '.tsx', '.vue'], // SQL注入
  'SEC-005': ['.js', '.ts', '.jsx', '.tsx', '.vue'], // 不安全正则
  'SEC-006': ['.js', '.ts', '.jsx', '.tsx', '.vue'], // 输入验证
  'SEC-007': ['.js', '.ts', '.jsx', '.tsx', '.vue'], // 文件操作
  
  // 性能规则 - 分别适用于不同框架
  'PERF-001': ['.vue'], // Vue v-for key
  'PERF-002': ['.vue'], // Vue v-if与v-for
  'PERF-003': ['.vue'], // Vue watch深度监听
  'PERF-004': ['.js', '.ts', '.jsx', '.tsx', '.vue'], // 依赖重复渲染
  'PERF-005': ['.js', '.ts', '.jsx', '.tsx', '.vue'], // DOM操作
  'PERF-006': ['.js', '.ts', '.jsx', '.tsx', '.vue', '.html'], // 图片资源
  'PERF-007': ['.js', '.ts', '.jsx', '.tsx', '.vue'], // 同步阻塞
  'PERF-008': ['.js', '.ts', '.jsx', '.tsx', '.vue'] // 内存泄漏
};

export class RulesEngine {
  private rules: Rule[] = [];
  
  constructor() {
    this.loadRules();
  }
  
  /**
   * 检查行是否为注释
   */
  private isCommentLine(line: string, fileType: string): boolean {
    const trimmed = line.trim();
    
    // JavaScript/TypeScript 注释
    if (['.js', '.ts', '.jsx', '.tsx', '.vue'].includes(fileType)) {
      return trimmed.startsWith('//') || 
             trimmed.startsWith('/*') || 
             trimmed.endsWith('*/') ||
             trimmed.startsWith('*');
    }
    
    // HTML/Vue 模板注释
    if (['.html', '.vue'].includes(fileType)) {
      return trimmed.startsWith('<!--') || trimmed.endsWith('-->');
    }
    
    // CSS 注释
    if (['.css', '.scss', '.less'].includes(fileType)) {
      return trimmed.startsWith('/*') || trimmed.endsWith('*/');
    }
    
    // JSON 没有注释
    if (['.json'].includes(fileType)) {
      return false;
    }
    
    return false;
  }
  
  /**
   * 检查规则是否适用于当前文件类型
   */
  private isRuleApplicable(ruleId: string, filePath: string): boolean {
    const fileType = path.extname(filePath).toLowerCase();
    const applicableTypes = RULE_FILE_TYPE_MAP[ruleId];
    
    // 如果规则没有在映射表中定义，默认不适用
    if (!applicableTypes) {
      return false;
    }
    
    return applicableTypes.includes(fileType);
  }
  
  private loadRules() {
    try {
      const __dirname = path.dirname(fileURLToPath(import.meta.url));
      const rulesPath = path.join(__dirname, 'rules.json');
      const rulesData = fs.readFileSync(rulesPath, 'utf-8');
      this.rules = JSON.parse(rulesData);
    } catch (error) {
      console.warn('加载规则失败:', error);
      this.rules = [];
    }
  }
  
  public runStaticRules(file: FileWithSmartContext): RuleViolation[] {
    const violations: RuleViolation[] = [];
    const content = file.context.content;
    const lines = content.split('\n');
    
    // 只执行静态检查规则，并过滤不适用的规则
    const staticRules = this.rules.filter(rule => 
      rule.enabled && 
      (rule.checkBy === 'static' || rule.checkBy === 'both') &&
      this.isRuleApplicable(rule.id, file.filePath)
    );
    
    for (const rule of staticRules) {
      const ruleViolations = this.checkRule(rule, content, lines, file.filePath);
      violations.push(...ruleViolations);
    }
    
    return violations;
  }
  
  private checkRule(rule: Rule, content: string, lines: string[], filePath: string): RuleViolation[] {
    const violations: RuleViolation[] = [];
    
    switch (rule.id) {
      case 'READ-002': // 命名不规范
        violations.push(...this.checkNamingConventions(rule, content, lines, filePath));
        break;
        
      case 'READ-003': // 魔法数字/字符串
        violations.push(...this.checkMagicNumbers(rule, content, lines, filePath));
        break;
        
      case 'SEC-001': // 敏感信息硬编码
        violations.push(...this.checkHardcodedSecrets(rule, content, lines, filePath));
        break;
        
      case 'SEC-002': // 日志包含敏感信息
        violations.push(...this.checkSensitiveLogging(rule, content, lines, filePath));
        break;
        
      case 'SEC-003': // XSS注入风险
        violations.push(...this.checkXSSRisk(rule, content, lines, filePath));
        break;
        
      case 'PERF-001': // 大列表缺少key
        violations.push(...this.checkVueListKeys(rule, content, lines, filePath));
        break;
        
      case 'PERF-002': // v-if与v-for同层使用
        violations.push(...this.checkVueDirectiveConflict(rule, content, lines, filePath));
        break;
        
      case 'ARCH-006': // 直接操作DOM
        violations.push(...this.checkDirectDOMManipulation(rule, content, lines, filePath));
        break;
        
      default:
        // 对于其他规则，进行基本的关键词检查
        violations.push(...this.basicKeywordCheck(rule, content, lines, filePath));
    }
    
    return violations;
  }
  
  private checkNamingConventions(rule: Rule, _content: string, lines: string[], filePath: string): RuleViolation[] {
    const violations: RuleViolation[] = [];
    const fileType = path.extname(filePath).toLowerCase();
    
    lines.forEach((line, index) => {
      // 跳过注释行
      if (this.isCommentLine(line, fileType)) {
        return;
      }
      
      // 检查无意义变量名 - 改进正则表达式，只匹配实际的变量声明
      if (/(?:const|let|var)\s+(?:data|temp|tmp|test|foo|bar)\s*[=:]/gi.test(line)) {
        violations.push({
          ruleId: rule.id,
          categoryId: rule.categoryId,
          title: rule.title,
          description: rule.description,
          severity: rule.severity,
          filePath: filePath,
          line: index + 1,
          codeSnippet: line.trim()
        });
      }
      
      // 检查函数名大写开头 (如 InitConfigList)
      if (/\b[A-Z][a-zA-Z]*\s*\(/g.test(line) && !line.includes('new ') && !line.includes('import')) {
        violations.push({
          ruleId: rule.id,
          categoryId: rule.categoryId,
          title: rule.title,
          description: rule.description,
          severity: rule.severity,
          filePath: filePath,
          line: index + 1,
          codeSnippet: line.trim()
        });
      }
    });
    
    return violations;
  }
  
  private checkMagicNumbers(rule: Rule, _content: string, lines: string[], _filePath: string): RuleViolation[] {
    const violations: RuleViolation[] = [];
    
    lines.forEach((line, index) => {
      // 检查比较操作中的魔法数字，排除常见的0, 1, -1
      if (/(?:===|!==|==|!=)\s*(?:[2-9]|[1-9]\d+)/g.test(line) && !line.includes('//')) {
        violations.push({
          ruleId: rule.id,
          categoryId: rule.categoryId,
          title: rule.title,
          description: rule.description,
          severity: rule.severity,
          filePath: _filePath,
          line: index + 1,
          codeSnippet: line.trim()
        });
      }
    });
    
    return violations;
  }
  
  private checkHardcodedSecrets(rule: Rule, _content: string, lines: string[], _filePath: string): RuleViolation[] {
    const violations: RuleViolation[] = [];
    const secretPatterns = [
      /['"](?:password|pwd|secret|key|token|api_key)['"]\s*[:=]\s*['"][^'"]+['"]/gi,
      /(?:password|pwd|secret|key|token)\s*[:=]\s*['"][^'"]{8,}['"]/gi,
    ];
    
    lines.forEach((line, index) => {
      secretPatterns.forEach(pattern => {
        if (pattern.test(line)) {
          violations.push({
            ruleId: rule.id,
            categoryId: rule.categoryId,
            title: rule.title,
            description: rule.description,
            severity: rule.severity,
            line: index + 1,
            codeSnippet: line.trim()
          });
        }
      });
    });
    
    return violations;
  }
  
  private checkSensitiveLogging(rule: Rule, _content: string, lines: string[], _filePath: string): RuleViolation[] {
    const violations: RuleViolation[] = [];
    const sensitivePatterns = [
      /console\.log.*(?:phone|mobile|idcard|password|token|secret)/gi,
      /console\.log.*\d{11}/g, // 11位数字可能是手机号
      /console\.log.*\d{15,18}/g, // 15-18位数字可能是身份证
    ];
    
    lines.forEach((line, index) => {
      sensitivePatterns.forEach(pattern => {
        if (pattern.test(line)) {
          violations.push({
            ruleId: rule.id,
            categoryId: rule.categoryId,
            title: rule.title,
            description: rule.description,
            severity: rule.severity,
            line: index + 1,
            codeSnippet: line.trim()
          });
        }
      });
    });
    
    return violations;
  }
  
  private checkXSSRisk(rule: Rule, _content: string, lines: string[], _filePath: string): RuleViolation[] {
    const violations: RuleViolation[] = [];
    const xssPatterns = [
      /v-html\s*=\s*[^"']*(?:user|input|data|param)/gi,
      /innerHTML\s*=\s*[^;]*(?:user|input|data|param)/gi,
      /\$\{[^}]*(?:user|input|data|param)[^}]*\}/gi,
    ];
    
    lines.forEach((line, index) => {
      xssPatterns.forEach(pattern => {
        if (pattern.test(line)) {
          violations.push({
            ruleId: rule.id,
            categoryId: rule.categoryId,
            title: rule.title,
            description: rule.description,
            severity: rule.severity,
            line: index + 1,
            codeSnippet: line.trim()
          });
        }
      });
    });
    
    return violations;
  }
  
  private checkVueListKeys(rule: Rule, _content: string, lines: string[], filePath: string): RuleViolation[] {
    const violations: RuleViolation[] = [];
    const fileType = path.extname(filePath).toLowerCase();
    
    lines.forEach((line, index) => {
      // 跳过注释行
      if (this.isCommentLine(line, fileType)) {
        return;
      }
      
      if (line.includes('v-for') && !line.includes(':key')) {
        violations.push({
          ruleId: rule.id,
          categoryId: rule.categoryId,
          title: rule.title,
          description: rule.description,
          severity: rule.severity,
          filePath: filePath,
          line: index + 1,
          codeSnippet: line.trim()
        });
      }
    });
    
    return violations;
  }
  
  private checkVueDirectiveConflict(rule: Rule, _content: string, lines: string[], filePath: string): RuleViolation[] {
    const violations: RuleViolation[] = [];
    const fileType = path.extname(filePath).toLowerCase();
    
    lines.forEach((line, index) => {
      // 跳过注释行
      if (this.isCommentLine(line, fileType)) {
        return;
      }
      
      if (line.includes('v-for') && line.includes('v-if')) {
        violations.push({
          ruleId: rule.id,
          categoryId: rule.categoryId,
          title: rule.title,
          description: rule.description,
          severity: rule.severity,
          filePath: filePath,
          line: index + 1,
          codeSnippet: line.trim()
        });
      }
    });
    
    return violations;
  }
  
  private checkDirectDOMManipulation(rule: Rule, _content: string, lines: string[], _filePath: string): RuleViolation[] {
    const violations: RuleViolation[] = [];
    const domPatterns = [
      /document\.(?:getElementById|querySelector|querySelectorAll)/gi,
      /\.innerHTML\s*=/gi,
      /\.appendChild\(/gi,
      /\.removeChild\(/gi,
    ];
    
    lines.forEach((line, index) => {
      domPatterns.forEach(pattern => {
        if (pattern.test(line)) {
          violations.push({
            ruleId: rule.id,
            categoryId: rule.categoryId,
            title: rule.title,
            description: rule.description,
            severity: rule.severity,
            line: index + 1,
            codeSnippet: line.trim()
          });
        }
      });
    });
    
    return violations;
  }
  
  private basicKeywordCheck(rule: Rule, _content: string, lines: string[], _filePath: string): RuleViolation[] {
    const violations: RuleViolation[] = [];
    
    // 通用console.log检测 (如果没有专门的SEC-002规则)
    if (rule.description.includes('console.log') || rule.description.includes('日志')) {
      lines.forEach((line, index) => {
        if (line.includes('console.log') || line.includes('console.warn') || line.includes('console.error')) {
          violations.push({
            ruleId: rule.id,
            categoryId: rule.categoryId,
            title: rule.title,
            description: rule.description,
            severity: rule.severity,
            line: index + 1,
            codeSnippet: line.trim()
          });
        }
      });
    }
    
    return violations;
  }
}

// 导出兼容函数供现有代码使用
export function runRulesOnFile(file: FileWithSmartContext): RuleViolation[] {
  const engine = new RulesEngine();
  return engine.runStaticRules(file);
}