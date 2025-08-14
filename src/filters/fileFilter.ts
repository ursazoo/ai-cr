import * as path from 'path';

/**
 * 文件过滤器配置
 */
export interface FilterConfig {
  // 排除的文件扩展名
  excludeExtensions: string[];
  // 排除的文件名模式（支持通配符）
  excludePatterns: string[];
  // 排除的目录
  excludeDirectories: string[];
  // 最大文件大小（字节）
  maxFileSize: number;
}

/**
 * 默认过滤配置
 */
export const DEFAULT_FILTER_CONFIG: FilterConfig = {
  excludeExtensions: [
    // 文档和说明文件
    '.md', '.txt', '.rst', '.adoc', '.rtf',
    
    // 图片文件
    '.jpg', '.jpeg', '.png', '.gif', '.svg', '.ico', '.webp', '.bmp', '.tiff', '.avif',
    
    // 视频文件
    '.mp4', '.avi', '.mov', '.wmv', '.flv', '.webm', '.mkv', '.m4v',
    
    // 音频文件
    '.mp3', '.wav', '.flac', '.aac', '.ogg', '.m4a', '.wma',
    
    // 压缩文件
    '.zip', '.rar', '.7z', '.tar', '.gz', '.bz2', '.xz', '.lzma',
    
    // 字体文件
    '.ttf', '.otf', '.woff', '.woff2', '.eot',
    
    // 二进制文件
    '.exe', '.dll', '.so', '.dylib', '.bin', '.deb', '.rpm', '.msi',
    
    // 数据文件
    '.db', '.sqlite', '.sqlite3', '.mdb', '.accdb',
    
    // 证书和密钥文件
    '.pem', '.crt', '.key', '.p12', '.pfx', '.jks', '.keystore',
    
    // Office 文件
    '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.pdf', '.odt', '.ods', '.odp',
    
    // 设计文件
    '.psd', '.ai', '.sketch', '.fig', '.xd', '.eps',
    
    // 3D 和游戏文件
    '.obj', '.fbx', '.blend', '.max', '.maya', '.unity', '.unitypackage',
    
    // 移动端文件
    '.apk', '.ipa', '.aab', '.dSYM',
    
    // 锁文件和包管理器
    '.lock', '.lockb', 
    
    // 日志和临时文件
    '.log', '.tmp', '.temp', '.swp', '.swo', '.pid', '.prof', '.trace',
    
    // 操作系统文件
    '.DS_Store', 'Thumbs.db', 'desktop.ini',
    
    // 电子书
    '.epub', '.mobi', '.azw', '.azw3',
    
    // TypeScript 类型定义文件（通常自动生成）
    '.d.ts',
    
    // 配置文件（大多数情况下不需要代码审查）
    '.env', '.gitignore', '.gitattributes', '.gitkeep',
    '.editorconfig', '.prettierrc', '.eslintrc',
    '.toml', '.ini', '.cfg', '.conf'
  ],
  
  excludePatterns: [
    // 版本控制
    '.git/**',
    '.svn/**',
    '.hg/**',
    
    // IDE 和编辑器配置  
    '.vscode/**',
    '.idea/**',
    '.vs/**',
    '.eclipse/**',
    '.sublime-workspace',
    
    // 依赖目录
    'node_modules/**',
    'vendor/**',
    'bower_components/**',
    '.pnpm/**',
    
    // 构建产物和缓存
    'dist/**',
    'build/**',
    'out/**',
    'target/**',
    '.next/**',
    '.nuxt/**',
    '.svelte-kit/**',
    '.angular/**',
    'coverage/**',
    '.nyc_output/**',
    '.cache/**',
    'tmp/**',
    'temp/**',
    
    // 日志目录
    'logs/**',
    '*.log',
    
    // 测试快照和覆盖率
    '__snapshots__/**',
    '*.snap',
    'lcov.info',
    'clover.xml',
    'junit.xml',
    
    // 包管理器文件
    'yarn.lock',
    'pnpm-lock.yaml',
    'composer.lock',
    'Gemfile.lock',
    'poetry.lock',
    'Pipfile.lock',
    'package-lock.json',
    'shrinkwrap.yaml',
    
    // 环境和配置文件（敏感）
    '.env.local',
    '.env.production',
    '.env.staging', 
    '.env.development',
    '.env.test',
    '*.env.backup',
    
    // CI/CD 和部署
    '.github/workflows/*.yml',
    '.github/workflows/*.yaml',
    '.gitlab-ci.yml',
    '.travis.yml',
    'circle.yml',
    'appveyor.yml',
    'azure-pipelines.yml',
    
    // Docker 和容器
    '.docker/**',
    'docker-compose.override.yml',
    'docker-compose.prod.yml',
    'docker-compose.dev.yml',
    
    // 云平台配置
    'vercel.json',
    'netlify.toml',
    '.platform.app.yaml',
    '.platform/**',
    '.aws/**',
    '.gcp/**',
    '.azure/**',
    
    // 监控和分析
    'bundle-analyzer/**',
    'lighthouse/**',
    '.webpack-bundle-analyzer/**',
    
    // 移动端构建
    'ios/build/**',
    'android/app/build/**',
    'android/.gradle/**',
    'ios/Pods/**',
    'ios/*.xcworkspace/**',
    
    // 语言特定的构建产物
    '*.min.js',
    '*.min.css',
    '*.min.html',
    '*.bundle.js',
    '*.chunk.js',
    '*.map',
    
    // 备份和临时文件
    '*.bak',
    '*.backup',
    '*.orig',
    '*.rej',
    '*~',
    '#*#',
    '.#*',
    
    // 系统和隐藏文件
    '**/.DS_Store',
    '**/Thumbs.db', 
    '**/desktop.ini',
    
    // 大型数据文件
    '*.dump',
    '*.sql.gz',
    'seed/**',
    'fixtures/**',
    
    // 文档构建产物
    '_book/**',
    '_site/**',
    '.docusaurus/**',
    '.vitepress/**',
    'storybook-static/**'
  ],
  
  excludeDirectories: [
    // 基础依赖
    'node_modules',
    'vendor',
    'bower_components',
    
    // 版本控制
    '.git',
    '.svn',
    '.hg',
    
    // 构建产物
    'dist',
    'build',
    'out',
    'target',
    'bin',
    'obj',
    
    // 框架特定缓存
    '.next',
    '.nuxt',
    '.svelte-kit',
    '.angular',
    '.vitepress',
    '.docusaurus',
    
    // 测试和覆盖率
    'coverage',
    '.nyc_output',
    '__pycache__',
    '.pytest_cache',
    
    // 临时和缓存
    'tmp',
    'temp',
    '.cache',
    '.parcel-cache',
    '.eslintcache',
    
    // 日志
    'logs',
    
    // IDE
    '.vscode',
    '.idea',
    '.vs',
    
    // 移动端
    'ios/Pods',
    'android/.gradle',
    
    // 语言特定
    '.tox',        // Python
    '.cargo',      // Rust
    '.stack-work', // Haskell
    'elm-stuff',   // Elm
    
    // 数据库
    'data',
    'database',
    'db_backups',
    
    // 上传和用户内容
    'uploads',
    'storage/app',
    'storage/logs',
    'public/uploads'
  ],
  
  // 5MB 限制，防止审查超大文件
  maxFileSize: 5 * 1024 * 1024
};

/**
 * 检查文件是否应该被排除
 */
export function shouldExcludeFile(filePath: string, content?: string, config: FilterConfig = DEFAULT_FILTER_CONFIG): boolean {
  const ext = path.extname(filePath).toLowerCase();
  
  // 检查文件扩展名
  if (config.excludeExtensions.includes(ext)) {
    return true;
  }
  
  // 检查文件大小
  if (content && Buffer.byteLength(content, 'utf8') > config.maxFileSize) {
    return true;
  }
  
  // 检查目录
  const pathParts = filePath.split('/');
  for (const excludeDir of config.excludeDirectories) {
    if (pathParts.includes(excludeDir)) {
      return true;
    }
  }
  
  // 检查文件名模式
  for (const pattern of config.excludePatterns) {
    if (matchPattern(filePath, pattern)) {
      return true;
    }
  }
  
  return false;
}

/**
 * 简单的通配符匹配
 */
function matchPattern(filePath: string, pattern: string): boolean {
  // 将通配符模式转换为正则表达式
  const regexPattern = pattern
    .replace(/\./g, '\\.')
    .replace(/\*\*/g, '.*')
    .replace(/\*/g, '[^/]*');
  
  const regex = new RegExp(`^${regexPattern}$`);
  return regex.test(filePath);
}

/**
 * 过滤文件列表
 */
export function filterFiles<T extends { filePath: string; content?: string }>(
  files: T[], 
  config: FilterConfig = DEFAULT_FILTER_CONFIG
): { filtered: T[], excluded: string[] } {
  const filtered: T[] = [];
  const excluded: string[] = [];
  
  for (const file of files) {
    if (shouldExcludeFile(file.filePath, file.content, config)) {
      excluded.push(file.filePath);
    } else {
      filtered.push(file);
    }
  }
  
  return { filtered, excluded };
}

/**
 * 获取文件类型的友好描述
 */
export function getFileTypeDescription(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const filename = path.basename(filePath).toLowerCase();
  
  // 特殊文件名处理
  if (filename === '.env' || filename.startsWith('.env.')) {
    return '环境配置';
  }
  if (filename === '.gitignore' || filename === '.gitattributes') {
    return 'Git配置';
  }
  if (filename === 'dockerfile' || filename.startsWith('docker-compose')) {
    return 'Docker配置';
  }
  
  const typeMap: Record<string, string> = {
    // 编程语言
    '.js': 'JavaScript',
    '.ts': 'TypeScript', 
    '.jsx': 'React JSX',
    '.tsx': 'React TSX',
    '.vue': 'Vue组件',
    '.py': 'Python',
    '.java': 'Java',
    '.cpp': 'C++',
    '.c': 'C语言',
    '.go': 'Go',
    '.rs': 'Rust',
    '.php': 'PHP',
    '.rb': 'Ruby',
    '.cs': 'C#',
    '.swift': 'Swift',
    '.kt': 'Kotlin',
    '.dart': 'Dart',
    
    // 样式和标记
    '.css': '样式文件',
    '.scss': 'Sass样式',
    '.less': 'Less样式',
    '.html': 'HTML',
    '.xml': 'XML',
    
    // 配置文件
    '.json': 'JSON配置',
    '.yml': 'YAML配置',
    '.yaml': 'YAML配置',
    '.toml': 'TOML配置',
    '.ini': 'INI配置',
    '.conf': '配置文件',
    '.cfg': '配置文件',
    
    // 脚本文件
    '.sh': 'Shell脚本',
    '.ps1': 'PowerShell',
    '.sql': 'SQL脚本',
    
    // 类型定义
    '.d.ts': 'TypeScript声明',
    
    // 其他常见文件
    '.md': 'Markdown文档',
    '.txt': '文本文件',
    '.env': '环境配置',
    '.lock': '锁文件',
    '.lockb': '锁文件'
  };
  
  return typeMap[ext] || '其他文件';
}