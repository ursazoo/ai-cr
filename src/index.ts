import { SmartContextExpander } from './utils/smartContextExpander.js';
import { runRulesOnFile } from './rules/rulesEngine.js';
import { aiReviewFileWithSmartContext } from './ai/aiClient.js';
import { runQueue } from './queue/queueRunner.js';
import { ReportGenerator, type ReviewResult } from './reports/reportGenerator.js';
import { filterFiles, getFileTypeDescription } from './filters/fileFilter.js';

export type ReviewMode = 'static' | 'ai' | 'full';

export async function run(mode: ReviewMode = 'full'): Promise<void> {
  console.log(`🚀 启动 AI 代码审查工具 (智能模式: ${mode})...\n`);
  
  // 初始化智能上下文扩展器（使用环境变量配置）
  const smartExpander = new SmartContextExpander();
  
  // 获取智能上下文文件
  const smartFiles = await smartExpander.getChangedFilesWithSmartContext();
  
  if (smartFiles.length === 0) {
    console.log('没有检测到已变更的文件，审查结束。');
    return;
  }
  
  // 过滤文件 - 转换为旧格式进行过滤
  const allFiles = smartFiles.map(f => ({ filePath: f.filePath, content: f.context.content }));
  const { filtered: filteredPaths, excluded } = filterFiles(allFiles);
  const filteredPathsSet = new Set(filteredPaths.map(f => f.filePath));
  const files = smartFiles.filter(f => filteredPathsSet.has(f.filePath));
  
  console.log(`检测到 ${smartFiles.length} 个变更文件，过滤后需审查 ${files.length} 个:`);
  
  // 显示Token优化统计
  let totalOriginalTokens = 0;
  let totalOptimizedTokens = 0;
  
  files.forEach(file => {
    const fileType = getFileTypeDescription(file.filePath);
    const strategy = file.context.strategy;
    const tokenSaving = file.context.metadata.compressionRatio < 1.0 
      ? ` (节省${Math.round((1 - file.context.metadata.compressionRatio) * 100)}%)`
      : '';
    
    console.log(`  - ${file.filePath} (${fileType}) [${strategy}]${tokenSaving}`);
    
    totalOriginalTokens += Math.round(file.analysis.fileSize * 8); // 粗略估算原始tokens
    totalOptimizedTokens += file.context.metadata.estimatedTokens;
  });
  
  if (excluded.length > 0) {
    console.log(`\n⏭️  已跳过 ${excluded.length} 个文件 (图片、文档、依赖等):`);
    excluded.slice(0, 5).forEach(filePath => console.log(`  - ${filePath}`));
    if (excluded.length > 5) {
      console.log(`  ... 还有 ${excluded.length - 5} 个文件`);
    }
  }
  
  // 显示Token优化总结
  if (files.length > 0) {
    const totalSavingRatio = totalOriginalTokens > 0 
      ? Math.round((1 - totalOptimizedTokens / totalOriginalTokens) * 100)
      : 0;
    console.log(`\n💾 Token优化: ${totalOptimizedTokens} / ${totalOriginalTokens} (节省${totalSavingRatio}%)`);
  }
  console.log();
  
  if (files.length === 0) {
    console.log('所有文件都已被过滤，无需审查。');
    return;
  }
  
  // 初始化报告生成器
  const reportGenerator = new ReportGenerator();
  const results: ReviewResult[] = [];
  
  await runQueue(files, async (file) => {
    console.log(`\n[${results.length + 1}/${files.length}] 正在审查: ${file.filePath}`);
    console.log(`    🔍 策略: ${file.context.strategy} | 📊 Token: ${file.context.metadata.estimatedTokens}`);
    
    // 静态规则检查（所有模式都执行）
    // 转换为旧格式以兼容现有规则引擎
    const legacyFile = { filePath: file.filePath, content: file.context.content };
    const ruleResults = runRulesOnFile(legacyFile);
    const ruleStatus = ruleResults.length === 0 ? '✅' : `❌(${ruleResults.length})`;
    
    let aiResults = '';
    let aiStatus = '';
    
    // AI 审查（仅在 ai 或 full 模式下执行）
    if (mode === 'ai' || mode === 'full') {
      aiResults = await aiReviewFileWithSmartContext(file);
      aiStatus = aiResults.includes('模拟AI审查') || aiResults.includes('AI审查失败') ? '⚠️ ' : '✅';
    } else {
      aiResults = 'static 模式下跳过 AI 审查';
      aiStatus = '⏭️ ';
    }
    
    // 显示简洁的结果摘要
    console.log(`    📋 规则检查: ${ruleStatus} | 🤖 AI审查: ${aiStatus}`);
    
    // 收集结果用于报告生成
    results.push({
      filePath: file.filePath,
      ruleResults,
      aiResults
    });
  });
  
  // 生成并保存报告
  const reportPath = reportGenerator.saveReport(results, mode);
  
  console.log(`\n✨ 代码审查完成！`);
  console.log(`📁 报告已保存到: ${reportPath}`);
  
  // 显示统计摘要
  const ruleIssuesCount = results.reduce((sum, r) => sum + r.ruleResults.length, 0);
  console.log(`📊 统计: ${results.length} 个文件，${ruleIssuesCount} 个规则问题`);
}

// 直接运行时的默认行为
if (import.meta.url === `file://${process.argv[1]}`) {
  run().catch(err => {
    console.error('❌ 审查过程出错:', err);
    process.exit(1);
  });
}