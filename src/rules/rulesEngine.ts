import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { FileWithSmartContext } from '../types/index.js';

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

interface RuleViolation {
  ruleId: string;
  categoryId: string;
  title: string;
  description: string;
  severity: 'critical' | 'major' | 'minor' | 'info';
  line?: number;
  column?: number;
  context?: string;
  codeSnippet?: string;
}

export class RulesEngine {
  private rules: Rule[] = [];
  
  constructor() {
    this.loadRules();
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
    
    // 只执行静态检查规则
    const staticRules = this.rules.filter(rule => 
      rule.enabled && (rule.checkBy === 'static' || rule.checkBy === 'both')
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
        violations.push(...this.checkNamingConventions(rule, content, lines));
        break;
        
      case 'READ-003': // 魔法数字/字符串
        violations.push(...this.checkMagicNumbers(rule, content, lines));
        break;
        
      case 'SEC-001': // 敏感信息硬编码
        violations.push(...this.checkHardcodedSecrets(rule, content, lines));
        break;
        
      case 'SEC-002': // 日志包含敏感信息
        violations.push(...this.checkSensitiveLogging(rule, content, lines));
        break;
        
      case 'SEC-003': // XSS注入风险
        violations.push(...this.checkXSSRisk(rule, content, lines));
        break;
        
      case 'PERF-001': // 大列表缺少key
        violations.push(...this.checkVueListKeys(rule, content, lines));
        break;
        
      case 'PERF-002': // v-if与v-for同层使用
        violations.push(...this.checkVueDirectiveConflict(rule, content, lines));
        break;
        
      case 'ARCH-006': // 直接操作DOM
        violations.push(...this.checkDirectDOMManipulation(rule, content, lines));
        break;
        
      default:
        // 对于其他规则，进行基本的关键词检查
        violations.push(...this.basicKeywordCheck(rule, content, lines));
    }
    
    return violations;
  }
  
  private checkNamingConventions(rule: Rule, content: string, lines: string[]): RuleViolation[] {
    const violations: RuleViolation[] = [];
    
    lines.forEach((line, index) => {
      // 检查无意义变量名
      if (/\b(?:data|temp|tmp|test|foo|bar)\s*[=:]/gi.test(line)) {
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
      
      // 检查函数名大写开头 (如 InitConfigList)
      if (/\b[A-Z][a-zA-Z]*\s*\(/g.test(line) && !line.includes('new ') && !line.includes('import')) {
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
    
    return violations;
  }
  
  private checkMagicNumbers(rule: Rule, content: string, lines: string[]): RuleViolation[] {
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
          line: index + 1,
          codeSnippet: line.trim()
        });
      }
    });
    
    return violations;
  }
  
  private checkHardcodedSecrets(rule: Rule, content: string, lines: string[]): RuleViolation[] {
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
  
  private checkSensitiveLogging(rule: Rule, content: string, lines: string[]): RuleViolation[] {
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
  
  private checkXSSRisk(rule: Rule, content: string, lines: string[]): RuleViolation[] {
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
  
  private checkVueListKeys(rule: Rule, content: string, lines: string[]): RuleViolation[] {
    const violations: RuleViolation[] = [];
    
    lines.forEach((line, index) => {
      if (line.includes('v-for') && !line.includes(':key')) {
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
    
    return violations;
  }
  
  private checkVueDirectiveConflict(rule: Rule, content: string, lines: string[]): RuleViolation[] {
    const violations: RuleViolation[] = [];
    
    lines.forEach((line, index) => {
      if (line.includes('v-for') && line.includes('v-if')) {
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
    
    return violations;
  }
  
  private checkDirectDOMManipulation(rule: Rule, content: string, lines: string[]): RuleViolation[] {
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
  
  private basicKeywordCheck(rule: Rule, content: string, lines: string[]): RuleViolation[] {
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