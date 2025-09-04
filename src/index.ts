import { SmartContextExpander } from './utils/enhancedContextExpander.js';
import { runRulesOnFile } from './rules/rulesEngine.js';
import { aiReviewFileWithSmartContext } from './ai/aiClient.js';
import { runQueue } from './queue/queueRunner.js';
import { ReportGenerator, type ReviewResult } from './reports/reportGenerator.js';
import { filterFiles, getFileTypeDescription } from './filters/fileFilter.js';
import { getApiManager } from './api/index.js';
import { logger } from './utils/logger.js';

export type ReviewMode = 'static' | 'ai' | 'full';

/**
 * 上传报告到后端API
 */
async function uploadReport(jsonData: any, markdownContent?: string): Promise<void> {
  try {
    const apiManager = getApiManager();
    const projectGroupId = process.env.AI_CR_PROJECT_GROUP_ID;
    const userId = process.env.AI_CR_USER_ID;
    const userName = process.env.AI_CR_USER_NAME; // 获取用户名
    
    logger.info('📤 正在上传审查报告...');
    
    const uploadResponse = await apiManager.report.uploadReport(
      jsonData, 
      markdownContent,
      projectGroupId,
      userId,
      userName
    );
    
    if (uploadResponse.reportId) {
      console.log(`✅ 报告上传成功！报告ID: ${uploadResponse.reportId}`);
      
      if (uploadResponse.message) {
        console.log(`📝 ${uploadResponse.message}`);
      }
    } else {
      console.log('✅ 报告上传完成');
    }
    
  } catch (error) {
    logger.warn('⚠️  报告上传失败，但不影响本地审查结果:', (error as Error).message);
    logger.debug('上传错误详情:', error);
    console.warn(`⚠️  上传失败: ${(error as Error).message}`);
  }
}

export async function run(mode: ReviewMode = 'full'): Promise<void> {
  // console.log(`🚀 启动 AI 代码审查工具 (智能模式: ${mode})...\n`);
  
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
    console.log(`    🔍 策略: ${file.context.strategy} | 📊 内容: ${file.context.content.length} 字符`);
    
    // 执行静态规则检查
    const ruleViolations = (mode === 'static' || mode === 'full') ? runRulesOnFile(file) : [];
    const ruleStatus = ruleViolations.length > 0 ? `❌(${ruleViolations.length})` : '✅';
    let aiResults = '';
    let aiStatus = '';
    
    // AI 审查（仅在 ai 或 full 模式下执行）
    if (mode === 'ai' || mode === 'full') {
      console.log(`    🤖 开始AI审查...`);
      const startTime = Date.now();
      
      aiResults = await aiReviewFileWithSmartContext(file);
      
      const duration = Date.now() - startTime;
      const durationStr = duration > 1000 ? `${(duration/1000).toFixed(1)}s` : `${duration}ms`;
      
      if (aiResults.includes('💾 *此结果来自缓存*')) {
        aiStatus = '💾';
        console.log(`    💾 使用缓存结果 (${durationStr})`);
      } else if (aiResults.includes('模拟AI审查')) {
        aiStatus = '🤖';
        console.log(`    🤖 模拟审查完成 (${durationStr})`);
      } else if (aiResults.includes('AI审查失败')) {
        aiStatus = '⚠️';
        console.log(`    ⚠️ AI审查失败 (${durationStr})`);
      } else {
        aiStatus = '✅';
        console.log(`    ✅ AI审查完成 (${durationStr})`);
      }
    } else {
      aiResults = 'static 模式下跳过 AI 审查';
      aiStatus = '⏭️';
    }
    
    // 显示简洁的结果摘要
    console.log(`    📋 规则检查: ${ruleStatus} | 🤖 AI审查: ${aiStatus}`);
    
    // 收集结果用于报告生成
    results.push({
      filePath: file.filePath,
      ruleResults: ruleViolations.map(v => v.title),
      ruleViolations,
      aiResults
    });
  });
  
  // 生成并保存报告
  const reportData = reportGenerator.saveReport(results, mode);
  
  // 上传报告到后端
  await uploadReport(reportData.jsonData, reportData.markdownContent);
  
  console.log(`\n✨ 代码审查完成！`);
  console.log(`📁 报告目录: .ai-cr-reports/`);
  
  // 显示统计摘要
  const ruleIssuesCount = results.reduce((sum, r) => sum + r.ruleResults.length, 0);
  console.log(`📊 统计: ${results.length} 个文件，${ruleIssuesCount} 个规则问题`);
  
  // 确保进程正常退出
  process.exit(0);
}

// 直接运行时的默认行为
if (import.meta.url === `file://${process.argv[1]}`) {
  run().catch(err => {
    console.error('❌ 审查过程出错:', err);
    process.exit(1);
  });
}