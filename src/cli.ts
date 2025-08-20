#!/usr/bin/env node

import { program } from 'commander';
import { run, type ReviewMode } from './index.js';
import { config } from 'dotenv';

// 加载环境变量
config();

program
  .name('cr')
  .description('AI 代码审查工具')
  .version('1.0.0')
  .option('-m, --mode <mode>', '审查模式: static (仅规则检查) | ai (仅AI审查) | full (完整审查)', 'full')
  .option('--no-color', '禁用颜色输出')
  .option('--verbose', '显示详细日志')
  .action(async (options) => {
    const { mode, color, verbose } = options;

    console.log(options);

    // 验证模式参数
    if (!['static', 'ai', 'full'].includes(mode)) {
      console.error(`❌ 无效的模式: ${mode}`);
      console.error('可用模式: static, ai, full');
      process.exit(1);
    }

    // 设置环境变量
    if (!color) process.env.NO_COLOR = '1';
    if (verbose) process.env.VERBOSE = '1';

    try {
      await run(mode as ReviewMode);
    } catch (error) {
      console.error('❌ 审查过程出错:', error);
      process.exit(1);
    }
  });

program.parse();