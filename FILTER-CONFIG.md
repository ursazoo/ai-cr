# AI 代码审查工具 - 智能文件过滤配置

## 🎯 过滤策略

从架构师角度设计的全面过滤规则，确保只审查真正重要的代码文件，提升效率并降低成本。

## 📊 默认排除的文件类型（150+ 种）

### 📄 文档和电子书

- **文档**: `.md`, `.txt`, `.rst`, `.adoc`, `.rtf`
- **电子书**: `.epub`, `.mobi`, `.azw`, `.azw3`

### 🖼️ 媒体文件  

- **图片**: `.jpg`, `.png`, `.gif`, `.svg`, `.webp`, `.tiff`, `.avif`
- **视频**: `.mp4`, `.avi`, `.mov`, `.mkv`, `.m4v`
- **音频**: `.mp3`, `.wav`, `.flac`, `.aac`, `.m4a`, `.wma`

### 📦 归档和安装文件

- **压缩**: `.zip`, `.rar`, `.7z`, `.tar`, `.gz`, `.xz`, `.lzma`
- **安装包**: `.exe`, `.msi`, `.deb`, `.rpm`, `.apk`, `.ipa`

### 🎨 设计和创意文件

- **设计**: `.psd`, `.ai`, `.sketch`, `.fig`, `.xd`, `.eps`
- **3D/游戏**: `.obj`, `.fbx`, `.blend`, `.unity`, `.unitypackage`
- **字体**: `.ttf`, `.otf`, `.woff`, `.woff2`, `.eot`

### 📊 Office 和数据文件

- **Office**: `.doc`, `.xls`, `.pdf`, `.odt`, `.ods`, `.odp`
- **数据库**: `.db`, `.sqlite`, `.mdb`, `.accdb`

### 🔐 安全和证书文件

- **证书**: `.pem`, `.crt`, `.key`, `.p12`, `.jks`, `.keystore`
- **环境配置**: `.env.local`, `.env.production`, `.env.staging`

## 🗂️ 排除的目录（50+ 个）

### 📦 依赖和包管理

```
node_modules/        # Node.js 依赖
vendor/             # PHP/Go 依赖  
bower_components/   # Bower 依赖
ios/Pods/          # iOS CocoaPods
```

### 🏗️ 构建产物

```
dist/, build/, out/ # 通用构建目录
.next/             # Next.js 构建
.nuxt/             # Nuxt.js 构建
.svelte-kit/       # SvelteKit 构建
.angular/          # Angular 构建
```

### 🧪 测试和覆盖率

```
coverage/          # 测试覆盖率报告
.nyc_output/       # NYC 覆盖率工具
__pycache__/       # Python 缓存
.pytest_cache/     # pytest 缓存
```

### ⚡ 缓存和临时

```
.cache/            # 通用缓存
.parcel-cache/     # Parcel 缓存
.eslintcache       # ESLint 缓存
tmp/, temp/        # 临时目录
logs/              # 日志目录
```

### 🛠️ IDE 和编辑器

```
.vscode/           # VS Code 配置
.idea/             # JetBrains IDE
.vs/               # Visual Studio
```

### 📱 移动端开发

```
android/.gradle/   # Android Gradle
ios/build/         # iOS 构建产物
```

### 🗃️ 版本控制

```
.git/, .svn/, .hg/ # 版本控制系统
```

## 🔍 排除的文件模式（100+ 种）

### 📦 包管理器锁文件

```
yarn.lock          # Yarn 锁文件
pnpm-lock.yaml     # PNPM 锁文件
composer.lock      # PHP Composer
Gemfile.lock       # Ruby Bundler
poetry.lock        # Python Poetry
```

### 🚀 CI/CD 配置

```
.github/workflows/*.yml  # GitHub Actions
.gitlab-ci.yml          # GitLab CI
.travis.yml             # Travis CI
azure-pipelines.yml     # Azure DevOps
```

### 🐳 容器和云平台

```
docker-compose.*.yml    # Docker Compose 环境文件
vercel.json            # Vercel 配置
netlify.toml           # Netlify 配置
.platform/**           # Platform.sh 配置
```

### 🗜️ 压缩和构建产物

```
*.min.js, *.min.css    # 压缩文件
*.bundle.js            # 打包文件
*.chunk.js             # 代码分割文件
*.map                  # Source Maps
```

### 📊 测试和监控

```
__snapshots__/**       # Jest 快照
*.snap                 # 测试快照
lcov.info             # 覆盖率报告
bundle-analyzer/**    # 打包分析
lighthouse/**         # 性能审计
```

### 🗂️ 系统和临时文件

```
**/.DS_Store          # macOS 系统文件
**/Thumbs.db          # Windows 缩略图
*.tmp, *.temp         # 临时文件
*.bak, *.backup       # 备份文件
*~, #*#               # 编辑器临时文件
```

## ⚙️ 自定义配置

在项目根目录创建 `.ai-cr-config.json`：

```json
{
  "filter": {
    "excludeExtensions": [".md", ".png", ".lock"],
    "excludePatterns": ["test/**", "*.spec.js", "docs/**"],
    "excludeDirectories": ["legacy", "deprecated"],
    "maxFileSize": 5242880
  }
}
```

## 📈 性能优化

- **文件大小限制**: 5MB（防止审查超大文件）
- **智能过滤**: 减少 80-90% 无关文件
- **成本控制**: 大幅降低 AI API 调用成本
- **速度提升**: 专注核心代码，审查更快

## 🎯 审查的重要文件

### 💻 源代码文件

```
.js, .ts, .jsx, .tsx    # JavaScript/TypeScript
.py, .java, .go, .rs    # 后端语言
.vue, .svelte          # 前端框架组件
.php, .rb, .cs         # 其他后端语言
```

### 🎨 样式和模板

```
.css, .scss, .less     # 样式文件
.html, .htm           # 模板文件
```

### ⚙️ 核心配置文件

```
package.json          # 项目配置
tsconfig.json        # TypeScript 配置
.env                 # 环境变量（结构审查）
webpack.config.js    # 构建配置
```

### 📜 脚本文件

```
.sh, .ps1            # Shell/PowerShell 脚本
.sql                 # 数据库脚本
```

这套过滤规则覆盖了现代软件开发的方方面面，既保证重要代码得到审查，又避免浪费资源在无关文件上。
