export async function runQueue<T>(items: T[], worker: (item: T) => Promise<void>): Promise<void> {
  console.log(`开始处理队列，共 ${items.length} 个任务`);
  
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
  
  console.log('队列处理完成');
}