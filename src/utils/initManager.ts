import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import inquirer from 'inquirer';
import { OpenAI } from 'openai';
import { initApiManager } from '../api/index.js';
import { logger } from './logger.js';

/**
 * 全局配置接口
 */
export interface GlobalConfig {
  apiKey: string;
  baseURL?: string;
  model: string;
  userInfo: {
    id?: string;     // 新增：用户ID
    name: string;
    email?: string;
  };
  backendApi?: {
    baseUrl: string;
    token?: string;
  };
  created: string;
  updated: string;
}

/**
 * 项目配置接口
 */
export interface ProjectConfig {
  project: {
    projectGroupId?: string;  // 新增：项目组ID
    projectGroupName?: string; // 新增：项目组名称（显示用）
    projectName?: string;     // 新增：项目名称
    name: string;
    group: string;
    mainBranch: string;
    description?: string;
    developerName?: string;   // 新增：开发者姓名
    developerUserId?: string; // 新增：开发者ID
  };
  ai: {
    model?: string;
    temperature?: number;
    maxTokens?: number;
  };
  rules: {
    enabled: string[];
    customRules?: string[];
  };
  created: string;
  updated: string;
}

/**
 * 初始化管理器
 */
export class InitManager {
  private readonly globalConfigPath: string;
  private readonly projectConfigPath: string;

  constructor() {
    // 全局配置路径：用户主目录下的 .ai-cr/config.json
    this.globalConfigPath = path.join(os.homedir(), '.ai-cr', 'config.json');
    // 项目配置路径：项目根目录下的 .ai-cr.config.json
    this.projectConfigPath = path.join(process.cwd(), '.ai-cr.config.json');
  }

  /**
   * 全局初始化
   */
  public async globalInit(): Promise<void> {
    console.log('🚀 AI-CR 全局初始化\n');

    // 检查是否已存在全局配置
    const hasGlobalConfig = this.hasGlobalConfig();
    if (hasGlobalConfig) {
      const { reinit } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'reinit',
          message: '检测到已有全局配置，是否重新初始化？',
          default: false
        }
      ]);

      if (!reinit) {
        console.log('✅ 使用现有全局配置');
        await this.showGlobalConfig();
        return;
      }
    }

    await this.createGlobalConfig();
  }

  /**
   * 项目初始化
   */
  public async projectInit(): Promise<void> {
    console.log('🏗️  AI-CR 项目初始化\n');

    // 确保全局配置存在
    if (!this.hasGlobalConfig()) {
      console.log('⚠️  检测到没有全局配置，先进行全局初始化...\n');
      await this.globalInit();
      console.log('\n继续项目初始化...\n');
    }

    // 检查是否已存在项目配置
    const hasProjectConfig = this.hasProjectConfig();
    if (hasProjectConfig) {
      const { reinit } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'reinit',
          message: '检测到已有项目配置，是否重新初始化？',
          default: false
        }
      ]);

      if (!reinit) {
        console.log('✅ 使用现有项目配置');
        await this.showProjectConfig();
        return;
      }
    }

    await this.createProjectConfig();
  }

  /**
   * 检查初始化状态
   */
  public async checkInitStatus(): Promise<{
    globalConfigExists: boolean;
    projectConfigExists: boolean;
    needsInit: boolean;
  }> {
    const globalConfigExists = this.hasGlobalConfig();
    const projectConfigExists = this.hasProjectConfig();
    const needsInit = !globalConfigExists || !projectConfigExists;

    return {
      globalConfigExists,
      projectConfigExists,
      needsInit
    };
  }

  /**
   * 自动初始化检查
   */
  public async autoInitCheck(): Promise<boolean> {
    const status = await this.checkInitStatus();
    
    if (!status.globalConfigExists) {
      console.log('⚠️  检测到没有全局配置，请运行 npx cr --init 进行初始化');
      return false;
    }

    if (!status.projectConfigExists) {
      console.log('⚠️  检测到没有项目配置，正在自动初始化项目...\n');
      await this.projectInit();
      return true;
    }

    return true;
  }

  /**
   * 创建全局配置
   */
  private async createGlobalConfig(): Promise<void> {
    console.log('📋 配置 API 信息:');

    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'apiKey',
        message: '请输入 API Key (阿里云DashScope):',
        validate: (input: string) => {
          if (!input || input.trim().length === 0) {
            return '请输入有效的API Key';
          }
          return true;
        }
      },
      {
        type: 'input',
        name: 'baseURL',
        message: '请输入API Base URL:',
        default: 'https://dashscope.aliyuncs.com/compatible-mode/v1'
      },
      {
        type: 'input',
        name: 'model',
        message: '请输入模型名称:',
        default: 'qwen3-coder-plus'
      },
    ]);

    // 测试API Key
    console.log('\n🧪 正在测试API连接...');
    const isValid = await this.testApiKey(answers.apiKey, answers.baseURL, answers.model);
    
    if (!isValid) {
      console.log('❌ API Key测试失败，请检查配置后重试');
      return;
    }

    console.log('✅ API Key验证成功！');

    // 配置用户信息 - 通过查询后端用户列表
    console.log('\n👤 配置用户信息...');
    
    // 临时创建API管理器来查询用户
    const tempApiManager = initApiManager({
      baseUrl: 'http://localhost:3000', // 或使用配置的后端地址
      timeout: 30000
    });

    let selectedUser: any = null;
    while (true) {
      const { realName } = await inquirer.prompt([
        {
          type: 'input',
          name: 'realName',
          message: '请输入您的真实姓名进行查询:',
          validate: (input: string) => input.trim().length > 0 || '请输入真实姓名'
        }
      ]);

      try {
        const users = await tempApiManager.user.getUserList(realName.trim());
        
        if (users.length === 0) {
          console.log(`❌ 未找到姓名为 "${realName}" 的用户，请重新输入正确的真实姓名`);
          continue;
        }

        if (users.length === 1) {
          selectedUser = users[0];
          console.log(`✅ 找到用户: ${selectedUser.name} (${selectedUser.id})`);
          break;
        } else {
          const { selectedUserId } = await inquirer.prompt([
            {
              type: 'list',
              name: 'selectedUserId',
              message: '找到多个用户，请选择:',
              choices: users.map(user => ({
                name: `${user.name} (${user.email || user.id})`,
                value: user.id
              }))
            }
          ]);
          selectedUser = users.find(u => u.id === selectedUserId)!;
          break;
        }
      } catch (error) {
        console.log(`❌ 查询用户信息时出错: ${(error as Error).message}`);
        console.log('请重新输入真实姓名');
        continue;
      }
    }

    // 保存全局配置
    const globalConfig: GlobalConfig = {
      apiKey: answers.apiKey,
      baseURL: answers.baseURL || undefined,
      model: answers.model,
      userInfo: {
        id: selectedUser.id,
        name: selectedUser.name,
        email: selectedUser.email
      },
      backendApi: {
        baseUrl: 'http://localhost:3000'
      },
      created: new Date().toISOString(),
      updated: new Date().toISOString()
    };

    this.saveGlobalConfig(globalConfig);
    console.log(`✅ 全局配置已保存到: ${this.globalConfigPath}`);
  }

  /**
   * 创建项目配置
   */
  private async createProjectConfig(): Promise<void> {
    console.log('📋 配置项目信息:');

    // 尝试从Git获取项目信息
    const gitInfo = await this.getGitInfo();

    console.log('⚠️  项目初始化已整合到主流程中');
    console.log('请直接运行 npx cr 进行代码审查，系统会自动引导配置必要信息');
  }

  /**
   * 测试API Key
   */
  private async testApiKey(apiKey: string, baseURL?: string, model?: string): Promise<boolean> {
    try {
      const openai = new OpenAI({
        apiKey,
        baseURL: baseURL || undefined
      });

      // 发送一个简单的测试请求，使用用户配置的模型
      await openai.chat.completions.create({
        model: model || 'qwen3-coder-plus',
        messages: [{ role: 'user', content: 'Hello' }],
        max_tokens: 5
      });

      return true;
    } catch (error: any) {
      console.log(`❌ API测试失败: ${error.message}`);
      return false;
    }
  }

  /**
   * 确保必要的信息已配置（项目组ID和用户ID）
   */
  public async ensureRequiredInfo(): Promise<{
    projectGroupId: string;
    userId: string;
  }> {
    logger.info('🔍 检查必要信息...');

    // 初始化API管理器
    const globalConfig = this.getGlobalConfig();
    const apiBaseUrl = process.env.AI_CR_API_BASE_URL || globalConfig?.backendApi?.baseUrl || 'http://localhost:36788';
    
    const apiManager = initApiManager({
      baseUrl: apiBaseUrl,
      timeout: 15000,
      retryCount: 2
    });

    // 1. 检查并获取项目组ID
    const projectGroupId = await this.ensureProjectGroupId(apiManager);
    
    // 2. 检查并获取用户ID  
    const userId = await this.ensureUserId(apiManager);

    logger.info('✅ 必要信息已完备');
    return { projectGroupId, userId };
  }

  /**
   * 确保项目组ID已配置
   */
  private async ensureProjectGroupId(apiManager: any): Promise<string> {
    const projectConfig = this.getProjectConfig();
    
    // 检查是否已有项目组ID
    if (projectConfig?.project?.projectGroupId) {
      logger.debug(`使用已配置的项目组ID: ${projectConfig.project.projectGroupId}`);
      return projectConfig.project.projectGroupId;
    }

    logger.info('📋 需要配置项目组信息...');
    
    try {
      // 获取项目组选择列表
      const projectGroups = await apiManager.project.getProjectGroupChoices();
      
      if (projectGroups.length === 0) {
        throw new Error('未找到任何项目组，请确认API接口返回正确数据');
      }

      const { selectedGroupId } = await inquirer.prompt([
        {
          type: 'list',
          name: 'selectedGroupId',
          message: '请选择项目组:',
          choices: projectGroups
        }
      ]);

      // 保存项目组ID到项目配置
      await this.saveProjectGroupId(selectedGroupId, projectGroups);
      
      logger.info(`✅ 项目组配置完成: ${selectedGroupId}`);
      return selectedGroupId;
    } catch (error) {
      logger.error('获取项目组信息失败:', (error as Error).message);
      throw new Error(`无法配置项目组信息: ${(error as Error).message}`);
    }
  }

  /**
   * 确保用户ID已配置
   */
  private async ensureUserId(apiManager: any): Promise<string> {
    const globalConfig = this.getGlobalConfig();
    
    // 全局配置中应该已经有用户ID了，如果没有说明全局配置有问题
    if (!globalConfig?.userInfo?.id) {
      throw new Error('全局配置中缺少用户信息，请重新运行 npx cr --init 进行初始化');
    }

    logger.debug(`使用已配置的用户ID: ${globalConfig.userInfo.id}`);
    return globalConfig.userInfo.id;
  }

  /**
   * 保存项目组ID到配置
   */
  private async saveProjectGroupId(groupId: string, projectGroups: Array<{name: string, value: string}>): Promise<void> {
    const group = projectGroups.find(g => g.value === groupId);
    const groupName = group?.name || groupId;

    if (this.hasProjectConfig()) {
      // 更新现有配置
      const config = this.getProjectConfig()!;
      config.project.projectGroupId = groupId;
      config.project.projectGroupName = groupName;
      config.updated = new Date().toISOString();
      
      fs.writeFileSync(this.projectConfigPath, JSON.stringify(config, null, 2), 'utf-8');
    } else {
      // 创建新的项目配置
      const gitInfo = await this.getGitInfo();
      const globalConfig = this.getGlobalConfig();
      
      // 获取项目名称，如果无法自动获取则要求用户输入
      let projectName = gitInfo.projectName;
      if (!projectName) {
        const dirName = path.basename(process.cwd());
        const answer = await inquirer.prompt([{
          type: 'input',
          name: 'projectName',
          message: '请输入项目名称:',
          default: dirName,
          validate: (input: string) => {
            if (!input || input.trim() === '') {
              return '项目名称不能为空';
            }
            return true;
          }
        }]);
        projectName = answer.projectName.trim();
      }
      
      const projectConfig: ProjectConfig = {
        project: {
          projectGroupId: groupId,
          projectGroupName: groupName,
          projectName: projectName!,
          name: projectName!,
          group: groupName,
          mainBranch: gitInfo.mainBranch || 'main',
          // 从全局配置获取开发者信息
          developerName: globalConfig?.userInfo.name || 'unknown',
          developerUserId: globalConfig?.userInfo.id || 'unknown'
        },
        ai: {
          temperature: 0.1,
          maxTokens: 4000
        },
        rules: {
          enabled: ['quality', 'security', 'performance', 'maintainability', 'bestPractices']
        },
        created: new Date().toISOString(),
        updated: new Date().toISOString()
      };
      
      // 确保目录存在
      const configDir = path.dirname(this.projectConfigPath);
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
      }
      
      fs.writeFileSync(this.projectConfigPath, JSON.stringify(projectConfig, null, 2), 'utf-8');
    }
  }

  /**
   * 保存用户ID到全局配置
   */
  private async saveUserId(user: { id: string; name: string; email?: string }): Promise<void> {
    const config = this.getGlobalConfig()!;
    config.userInfo.id = user.id;
    config.userInfo.name = user.name;
    if (user.email) {
      config.userInfo.email = user.email;
    }
    config.updated = new Date().toISOString();
    
    fs.writeFileSync(this.globalConfigPath, JSON.stringify(config, null, 2), 'utf-8');
  }

  /**
   * 获取项目组列表（仅用于兼容旧代码）
   */
  private async fetchProjectGroups(): Promise<Array<{name: string, value: string}>> {
    // 这个方法已弃用，直接抛出错误强制使用新的ensureRequiredInfo流程
    throw new Error('请使用 ensureRequiredInfo() 方法获取项目组信息');
  }

  /**
   * 获取Git信息
   */
  private async getGitInfo(): Promise<{
    projectName?: string;
    organization?: string;
    mainBranch?: string;
  }> {
    try {
      const { execSync } = require('child_process');
      
      // 获取远程仓库URL
      const remoteUrl = execSync('git remote get-url origin', { encoding: 'utf8' }).trim();
      
      // 解析项目名和组织名
      let projectName: string | undefined;
      let organization: string | undefined;
      
      const match = remoteUrl.match(/[:/]([^/]+)\/([^/]+?)(?:\.git)?$/);
      if (match) {
        organization = match[1];
        projectName = match[2];
      }

      // 获取默认分支
      let mainBranch: string | undefined;
      try {
        mainBranch = execSync('git symbolic-ref refs/remotes/origin/HEAD', { encoding: 'utf8' })
          .trim()
          .replace('refs/remotes/origin/', '');
      } catch {
        // 如果无法获取，尝试常见分支名
        try {
          execSync('git rev-parse --verify main', { stdio: 'ignore' });
          mainBranch = 'main';
        } catch {
          try {
            execSync('git rev-parse --verify master', { stdio: 'ignore' });
            mainBranch = 'master';
          } catch {
            // 无法确定主分支
          }
        }
      }

      return { projectName, organization, mainBranch };
    } catch {
      return {};
    }
  }

  /**
   * 检查全局配置是否存在
   */
  private hasGlobalConfig(): boolean {
    return fs.existsSync(this.globalConfigPath);
  }

  /**
   * 检查项目配置是否存在
   */
  private hasProjectConfig(): boolean {
    return fs.existsSync(this.projectConfigPath);
  }

  /**
   * 保存全局配置
   */
  private saveGlobalConfig(config: GlobalConfig): void {
    const configDir = path.dirname(this.globalConfigPath);
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }
    fs.writeFileSync(this.globalConfigPath, JSON.stringify(config, null, 2));
  }

  /**
   * 保存项目配置
   */
  private saveProjectConfig(config: ProjectConfig): void {
    fs.writeFileSync(this.projectConfigPath, JSON.stringify(config, null, 2));
    
    // 添加到.gitignore
    this.addToGitignore('.ai-cr.config.json');
  }

  /**
   * 获取全局配置
   */
  public getGlobalConfig(): GlobalConfig | null {
    if (!this.hasGlobalConfig()) {
      return null;
    }
    
    try {
      const content = fs.readFileSync(this.globalConfigPath, 'utf8');
      return JSON.parse(content);
    } catch {
      return null;
    }
  }

  /**
   * 获取项目配置
   */
  public getProjectConfig(): ProjectConfig | null {
    if (!this.hasProjectConfig()) {
      return null;
    }
    
    try {
      const content = fs.readFileSync(this.projectConfigPath, 'utf8');
      return JSON.parse(content);
    } catch {
      return null;
    }
  }

  /**
   * 显示全局配置
   */
  private async showGlobalConfig(): Promise<void> {
    const config = this.getGlobalConfig();
    if (!config) {
      console.log('❌ 无法读取全局配置');
      return;
    }

    console.log('\n📋 当前全局配置:');
    console.log(`- 用户: ${config.userInfo.name} ${config.userInfo.email ? `<${config.userInfo.email}>` : ''}`);
    console.log(`- 模型: ${config.model}`);
    console.log(`- API Key: ${config.apiKey.substring(0, 10)}...`);
    if (config.baseURL) {
      console.log(`- Base URL: ${config.baseURL}`);
    }
    if (config.backendApi?.baseUrl) {
      console.log(`- 后端API: ${config.backendApi.baseUrl}`);
    }
    console.log(`- 创建时间: ${new Date(config.created).toLocaleString()}`);
    console.log(`- 更新时间: ${new Date(config.updated).toLocaleString()}`);
  }

  /**
   * 显示项目配置
   */
  private async showProjectConfig(): Promise<void> {
    const config = this.getProjectConfig();
    if (!config) {
      console.log('❌ 无法读取项目配置');
      return;
    }

    console.log('\n📋 当前项目配置:');
    console.log(`- 项目: ${config.project.name}`);
    console.log(`- 团队: ${config.project.group}`);
    console.log(`- 主分支: ${config.project.mainBranch}`);
    if (config.project.description) {
      console.log(`- 描述: ${config.project.description}`);
    }
    console.log(`- 启用规则: ${config.rules.enabled.join(', ')}`);
    console.log(`- 创建时间: ${new Date(config.created).toLocaleString()}`);
    console.log(`- 更新时间: ${new Date(config.updated).toLocaleString()}`);
  }

  /**
   * 添加到.gitignore
   */
  private addToGitignore(pattern: string): void {
    const gitignorePath = path.join(process.cwd(), '.gitignore');
    
    let gitignoreContent = '';
    if (fs.existsSync(gitignorePath)) {
      gitignoreContent = fs.readFileSync(gitignorePath, 'utf8');
    }

    // 检查是否已经存在
    if (gitignoreContent.includes(pattern)) {
      return;
    }

    // 添加到.gitignore
    const newContent = gitignoreContent.trim() + (gitignoreContent.trim() ? '\n' : '') + `\n# AI-CR configuration\n${pattern}\n`;
    fs.writeFileSync(gitignorePath, newContent);
  }
}

/**
 * 全局初始化管理器实例
 */
export const initManager = new InitManager();