#!/usr/bin/env node

import { program } from 'commander';
import { run, type ReviewMode } from './index.js';
import { config } from 'dotenv';
import { initManager } from './utils/initManager.js';
import { configIntegrator } from './utils/configIntegrator.js';
import { initApiManager } from './api/index.js';
import { logger } from './utils/logger.js';

// 加载环境变量
config();

program
  .name('cr')
  .description('AI 代码审查工具')
  .version('1.0.0');

// 初始化命令
program
  .option('--init', '初始化AI-CR配置')
  .option('--init-global', '仅初始化全局配置')
  .option('--init-project', '仅初始化项目配置');

// 主命令
program
  .option('-m, --mode <mode>', '审查模式: static (仅规则检查) | ai (仅AI审查) | full (完整审查)', 'full')
  .option('--no-color', '禁用颜色输出')
  .option('--verbose', '显示详细日志')
  .option('--parallel <num>', '并行处理数量 (默认: 1)', '1')
  .option('--cache', '启用缓存 (默认: 启用)')
  .option('--no-cache', '禁用缓存')
  .option('--stats', '显示性能统计')
  .option('--config <path>', '指定配置文件路径')
  .option('--api-url <url>', '指定API基础URL')
  .action(async (options) => {
    const { 
      mode, color, verbose, parallel, cache, noCache, stats, config: configPath,
      init, initGlobal, initProject, apiUrl
    } = options;

    // 处理初始化命令
    if (init || initGlobal || initProject) {
      try {
        if (initGlobal) {
          await initManager.globalInit();
        } else if (initProject) {
          await initManager.projectInit();
        } else {
          // 完整初始化
          await initManager.globalInit();
          console.log('');
          await initManager.projectInit();
        }
        
        console.log('\n🎉 初始化完成！现在可以运行 npx cr 开始代码审查');
        process.exit(0);
      } catch (error) {
        console.error('❌ 初始化失败:', error);
        process.exit(1);
      }
    }

    // 在执行主要功能前检查初始化状态
    const initReady = await initManager.autoInitCheck();
    if (!initReady) {
      process.exit(1);
    }

    // 加载配置并应用到环境变量
    try {
      await configIntegrator.loadAndApplyConfigs();
      
      if (verbose) {
        const configSummary = configIntegrator.getConfigSummary();
        console.log('📋 当前配置:');
        console.log(`- 用户: ${configSummary.user}`);
        console.log(`- 项目: ${configSummary.project} (${configSummary.group})`);
        console.log(`- 模型: ${configSummary.model}`);
        console.log(`- 主分支: ${configSummary.mainBranch}`);
        console.log(`- 启用规则: ${configSummary.enabledRules.join(', ')}\n`);
      }
    } catch (error) {
      console.error('❌ 配置加载失败:', error);
      process.exit(1);
    }

    if (verbose) {
      console.log('🔧 启动参数:', options);
    }

    // 验证模式参数
    if (!['static', 'ai', 'full'].includes(mode)) {
      console.error(`❌ 无效的模式: ${mode}`);
      console.error('可用模式: static, ai, full');
      process.exit(1);
    }

    // 设置环境变量
    if (!color) process.env.NO_COLOR = '1';
    if (verbose) process.env.VERBOSE = '1';
    
    // 设置并行处理
    const parallelCount = parseInt(parallel);
    if (parallelCount > 1) {
      process.env.AI_CR_ENABLE_PARALLEL = 'true';
      process.env.AI_CR_MAX_WORKERS = parallel;
      console.log(`🚀 启用并行处理: ${parallelCount} 个Worker`);
    }
    
    // 设置缓存
    if (noCache) {
      process.env.AI_CR_ENABLE_CACHE = 'false';
      console.log('💾 缓存已禁用');
    } else if (cache !== false) {
      process.env.AI_CR_ENABLE_CACHE = 'true';
      if (verbose) console.log('💾 缓存已启用');
    }
    
    // 设置配置文件
    if (configPath) {
      process.env.AI_CR_CONFIG_PATH = configPath;
      console.log(`⚙️  使用配置文件: ${configPath}`);
    }

    // 设置API URL
    if (apiUrl) {
      process.env.AI_CR_API_BASE_URL = apiUrl;
      console.log(`🌐 使用API地址: ${apiUrl}`);
    }

    // 确保必要信息已配置（项目组ID和用户ID）
    try {
      const requiredInfo = await initManager.ensureRequiredInfo();
      if (verbose) {
        console.log(`✅ 项目组ID: ${requiredInfo.projectGroupId}`);
        console.log(`✅ 用户ID: ${requiredInfo.userId}`);
      }
      
      // 将必要信息存储到环境变量，供后续使用
      process.env.AI_CR_PROJECT_GROUP_ID = requiredInfo.projectGroupId;
      process.env.AI_CR_USER_ID = requiredInfo.userId;
    } catch (error) {
      logger.error('❌ 必要信息配置失败:', (error as Error).message);
      console.error('\n💡 请检查网络连接和API配置，或运行 --init 重新初始化');
      process.exit(1);
    }

    const startTime = Date.now();

    try {
      await run(mode as ReviewMode);
      
      // 显示性能统计
      if (stats || verbose) {
        const duration = Date.now() - startTime;
        console.log('\n📊 性能统计:');
        console.log(`- 总耗时: ${Math.round(duration / 1000)}秒`);
        console.log(`- 并行度: ${parallelCount > 1 ? parallelCount + ' Workers' : '顺序处理'}`);
        console.log(`- 缓存: ${noCache ? '禁用' : '启用'}`);
        
        // 如果启用了缓存，显示缓存统计
        if (!noCache) {
          try {
            const { globalCache } = await import('./utils/cacheManager.js');
            const cacheStats = globalCache.getStats();
            console.log(`- 缓存命中率: ${cacheStats.hitRate.toFixed(1)}%`);
            console.log(`- 缓存条目: ${cacheStats.entryCount} 个`);
          } catch (error) {
            // 忽略缓存统计错误
          }
        }
      }
      
    } catch (error) {
      console.error('❌ 审查过程出错:', error);
      process.exit(1);
    }
  });

program.parse();