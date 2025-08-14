import { FileWithContext } from '../utils/contextExpander';

export function runRulesOnFile(file: FileWithContext): string[] {
  const results: string[] = [];
  
  if (file.content.includes('console.log')) {
    results.push('禁止使用 console.log');
  }
  
  if (file.content.includes('debugger')) {
    results.push('禁止提交 debugger 语句');
  }
  
  if (file.content.includes('// TODO') || file.content.includes('// FIXME')) {
    results.push('存在待办事项，建议处理后提交');
  }
  
  const lines = file.content.split('\n');
  if (lines.some(line => line.length > 120)) {
    results.push('存在过长的代码行（>120字符）');
  }
  
  return results;
}