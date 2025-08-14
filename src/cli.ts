#!/usr/bin/env node

import { program } from 'commander';
import { run, type ReviewMode } from './index.js';
import { config } from 'dotenv';

// 可选：仅在 init-only 时用到
// （也可以在 action 中按需 import，避免启动时加载）
import { ensureProjectGroup } from './yuque/initGroup.js';

// 加载环境变量
config();

program
  .name('cr')
  .description('AI 代码审查工具')
  .version('1.0.0')
  .option('-m, --mode <mode>', '审查模式: static (仅规则检查) | ai (仅AI审查) | full (完整审查)', 'full')
  .option('--no-color', '禁用颜色输出')
  .option('--verbose', '显示详细日志')
  .option('--init-only', '仅进行语雀绑定（首配），不执行审查', false)
  // 默认上传：使用 --no-upload 关闭
  .option('--no-upload', '不将报告上传至语雀（默认会上传）')
  .action(async (options) => {
    const { mode, color, verbose, initOnly } = options;

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
      // 只做绑定，不跑审查
      if (initOnly) {
        await ensureProjectGroup();
        console.log('✅ 语雀知识库绑定完成');
        return;
      }

      // Commander 对于 --no-upload，会把 options.upload 设为 false；
      // 默认不传时，options.upload 为 true
      const upload: boolean = options.upload !== false;

      await run(mode as ReviewMode, { upload });
    } catch (error) {
      console.error('❌ 审查过程出错:', error);
      process.exit(1);
    }
  });

program.parse();