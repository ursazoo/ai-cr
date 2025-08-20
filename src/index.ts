import { getChangedFilesWithContext } from './utils/contextExpander.js';
import { runRulesOnFile } from './rules/rulesEngine.js';
import { aiReviewFile } from './ai/aiClient.js';
import { runQueue } from './queue/queueRunner.js';
import { ReportGenerator, type ReviewResult } from './reports/reportGenerator.js';
import { filterFiles, getFileTypeDescription } from './filters/fileFilter.js';

export type ReviewMode = 'static' | 'ai' | 'full';

export async function run(mode: ReviewMode = 'full'): Promise<void> {
  console.log(`🚀 启动 AI 代码审查工具 (模式: ${mode})...\n`);
  
  const allFiles = await getChangedFilesWithContext();
  
  if (allFiles.length === 0) {
    console.log('没有检测到已变更的文件，审查结束。');
    return;
  }
  
  // 过滤文件
  const { filtered: files, excluded } = filterFiles(allFiles);
  
  console.log(`检测到 ${allFiles.length} 个变更文件，过滤后需审查 ${files.length} 个:`);
  files.forEach(file => {
    const fileType = getFileTypeDescription(file.filePath);
    console.log(`  - ${file.filePath} (${fileType})`);
  });
  
  if (excluded.length > 0) {
    console.log(`\n⏭️  已跳过 ${excluded.length} 个文件 (图片、文档、依赖等):`);
    excluded.slice(0, 5).forEach(filePath => console.log(`  - ${filePath}`));
    if (excluded.length > 5) {
      console.log(`  ... 还有 ${excluded.length - 5} 个文件`);
    }
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
    
    // 静态规则检查（所有模式都执行）
    const ruleResults = runRulesOnFile(file);
    const ruleStatus = ruleResults.length === 0 ? '✅' : `❌(${ruleResults.length})`;
    
    let aiResults = '';
    let aiStatus = '';
    
    // AI 审查（仅在 ai 或 full 模式下执行）
    if (mode === 'ai' || mode === 'full') {
      aiResults = await aiReviewFile(file);
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