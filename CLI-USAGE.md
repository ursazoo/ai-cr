# AI 代码审查工具 - CLI 版本

## ✨ 功能完成

已成功按照文档实现了 CLI 工具，支持：

### 📦 打包产物

- ✅ 可执行命令：`cr`
- ✅ 三种模式：`static` / `ai` / `full`
- ✅ 构建产物：`ai-cr-1.0.0.tgz` (6.2 kB)

### 🚀 使用方式

#### 方案 A：本地测试（推荐开发时）

```bash
# 1. 在其他项目中安装本地包
npm i -D /绝对路径/ai-cr/ai-cr-1.0.0.tgz

# 2. 添加脚本到 package.json
{
  "scripts": {
    "cr": "cr",
    "cr:static": "cr --mode=static", 
    "cr:ai": "cr --mode=ai"
  }
}

# 3. 运行
npm run cr
```

#### 方案 B：发布到 npm

```bash
# 1. 发布（需要修改 package 名称）
npm publish

# 2. 在业务项目安装
npm i -D @your-scope/ai-cr

# 3. 直接使用
npx cr --help
npx cr --mode=static
```

### 🛠️ CLI 选项

```
Usage: cr [options]

AI 代码审查工具

Options:
  -V, --version      显示版本号
  -m, --mode <mode>  审查模式: static (仅规则检查) | ai (仅AI审查) | full (完整审查) (default: "full")
  --no-color         禁用颜色输出
  --verbose          显示详细日志
  -h, --help         显示帮助信息
```

### 🔧 集成到工作流

#### Pre-commit Hook

```bash
npx husky add .husky/pre-commit "npm run cr:static"
```

#### GitHub Actions

```yaml
- name: Run Code Review
  run: npx cr --mode=static
```

### 📋 支持的审查模式

- **`static`**: 仅运行静态规则检查（console.log、debugger、长行等）
- **`ai`**: 仅运行 AI 审查（需要 DASHSCOPE_API_KEY）
- **`full`**: 完整审查（静态规则 + AI 审查）

### ⚙️ 环境配置

```bash
# 复制环境变量模板
cp .env.example .env

# 配置通义千问 API Key
DASHSCOPE_API_KEY=sk-your-key-here
```

## 🎯 工程实践亮点

1. **简洁实用**: 避免过度设计，专注核心功能
2. **模式分离**: 支持纯静态检查，降低 API 成本
3. **优雅降级**: 无 API Key 时自动切换到模拟模式
4. **标准 CLI**: 遵循 Unix 工具设计原则
5. **易于集成**: 支持多种安装和使用方式

现在可以在任何项目中轻松集成这个代码审查工具了！
