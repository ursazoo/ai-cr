import { initManager } from './initManager.js';
import type { GlobalConfig, ProjectConfig } from './initManager.js';

/**
 * 集成配置管理器
 * 将初始化的配置转换为系统环境变量
 */
export class ConfigIntegrator {
  private globalConfig: GlobalConfig | null = null;
  private projectConfig: ProjectConfig | null = null;

  /**
   * 加载并应用配置
   */
  public async loadAndApplyConfigs(): Promise<void> {
    this.globalConfig = initManager.getGlobalConfig();
    this.projectConfig = initManager.getProjectConfig();

    if (!this.globalConfig) {
      throw new Error('未找到全局配置，请运行 npx cr --init 进行初始化');
    }

    // 项目配置现在是可选的，会在运行时自动创建
    // if (!this.projectConfig) {
    //   throw new Error('未找到项目配置，请运行 npx cr --init-project 进行初始化');
    // }

    // 应用全局配置到环境变量
    this.applyGlobalConfig();
    
    // 应用项目配置到环境变量（如果存在）
    if (this.projectConfig) {
      this.applyProjectConfig();
    }
  }

  /**
   * 获取配置信息用于显示
   */
  public getConfigSummary(): {
    user: string;
    model: string;
    project: string;
    group: string;
    mainBranch: string;
    enabledRules: string[];
  } {
    if (!this.globalConfig) {
      throw new Error('全局配置未加载');
    }

    return {
      user: this.globalConfig.userInfo.name,
      model: this.globalConfig.model,
      project: this.projectConfig?.project?.name || '未知项目',
      group: this.projectConfig?.project?.group || '未知项目组',
      mainBranch: this.projectConfig?.project?.mainBranch || 'main',
      enabledRules: this.projectConfig?.rules?.enabled || []
    };
  }

  /**
   * 应用全局配置到环境变量
   */
  private applyGlobalConfig(): void {
    if (!this.globalConfig) return;

    // 设置OpenAI配置
    process.env.OPENAI_API_KEY = this.globalConfig.apiKey;
    process.env.DASHSCOPE_API_KEY = this.globalConfig.apiKey; // AI客户端使用此环境变量
    
    if (this.globalConfig.baseURL) {
      process.env.OPENAI_BASE_URL = this.globalConfig.baseURL;
    }
    
    process.env.OPENAI_MODEL = this.globalConfig.model;
    process.env.AI_CR_USER_NAME = this.globalConfig.userInfo.name;
    
    if (this.globalConfig.userInfo.email) {
      process.env.AI_CR_USER_EMAIL = this.globalConfig.userInfo.email;
    }
  }

  /**
   * 应用项目配置到环境变量
   */
  private applyProjectConfig(): void {
    if (!this.projectConfig) return;

    // 设置项目信息
    process.env.AI_CR_PROJECT_NAME = this.projectConfig.project.name;
    process.env.AI_CR_PROJECT_GROUP = this.projectConfig.project.group;
    process.env.AI_CR_MAIN_BRANCH = this.projectConfig.project.mainBranch;
    
    if (this.projectConfig.project.description) {
      process.env.AI_CR_PROJECT_DESCRIPTION = this.projectConfig.project.description;
    }

    // 设置AI配置
    if (this.projectConfig.ai.temperature !== undefined) {
      process.env.OPENAI_TEMPERATURE = this.projectConfig.ai.temperature.toString();
    }
    
    if (this.projectConfig.ai.maxTokens !== undefined) {
      process.env.OPENAI_MAX_TOKENS = this.projectConfig.ai.maxTokens.toString();
    }

    // 设置规则配置
    process.env.AI_CR_ENABLED_RULES = this.projectConfig.rules.enabled.join(',');
    
    if (this.projectConfig.rules.customRules) {
      process.env.AI_CR_CUSTOM_RULES = this.projectConfig.rules.customRules.join(',');
    }
  }
}

/**
 * 全局配置集成器实例
 */
export const configIntegrator = new ConfigIntegrator();