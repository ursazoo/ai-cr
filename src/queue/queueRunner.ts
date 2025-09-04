export async function runQueue<T>(items: T[], worker: (item: T) => Promise<void>): Promise<void> {
  console.log(`开始处理队列，共 ${items.length} 个任务`);
  
  // 获取并发配置
  const maxConcurrency = parseInt(process.env.AI_CR_MAX_WORKERS || '1');
  const enableParallel = process.env.AI_CR_ENABLE_PARALLEL === 'true' || maxConcurrency > 1;
  
  if (enableParallel && items.length > 1) {
    await runParallelQueue(items, worker, maxConcurrency);
  } else {
    await runSequentialQueue(items, worker);
  }
  
  console.log('队列处理完成');
}

/**
 * 并行队列处理
 */
async function runParallelQueue<T>(items: T[], worker: (item: T) => Promise<void>, maxConcurrency: number): Promise<void> {
  console.log(`🚀 启用并行处理，最大并发数: ${maxConcurrency}`);
  
  const results = new Array(items.length);
  let completed = 0;
  
  // 分批处理
  for (let i = 0; i < items.length; i += maxConcurrency) {
    const batch = items.slice(i, i + maxConcurrency);
    const batchPromises = batch.map(async (item, batchIndex) => {
      const globalIndex = i + batchIndex;
      
      try {
        console.log(`[${globalIndex + 1}/${items.length}] 正在处理...`);
        await worker(item);
        results[globalIndex] = { success: true };
        completed++;
        
        // 显示进度
        const progress = Math.round((completed / items.length) * 100);
        console.log(`⚡ 进度: ${completed}/${items.length} (${progress}%)`);
        
      } catch (error) {
        console.error(`任务 ${globalIndex + 1} 处理失败:`, error);
        results[globalIndex] = { success: false, error };
      }
    });
    
    await Promise.all(batchPromises);
  }
  
  // 统计结果
  const successCount = results.filter(r => r?.success).length;
  const failureCount = results.length - successCount;
  
  if (failureCount > 0) {
    console.log(`⚠️  完成统计: ${successCount} 成功, ${failureCount} 失败`);
  } else {
    console.log(`✅ 全部 ${successCount} 个任务处理成功`);
  }
}

/**
 * 顺序队列处理（原有逻辑）
 */
async function runSequentialQueue<T>(items: T[], worker: (item: T) => Promise<void>): Promise<void> {
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (!item) continue;
    
    console.log(`[${i + 1}/${items.length}] 正在处理...`);
    
    try {
      await worker(item);
    } catch (error) {
      console.error(`任务 ${i + 1} 处理失败:`, error);
    }
  }
}