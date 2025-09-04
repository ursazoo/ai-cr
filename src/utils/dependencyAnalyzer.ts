import * as fs from 'fs';
import * as path from 'path';

/**
 * 文件依赖关系
 */
export interface FileDependency {
  filePath: string;
  imports: ImportInfo[];
  exports: ExportInfo[];
  dependents: string[];     // 谁依赖了这个文件
  dependencies: string[];   // 这个文件依赖谁
  externalDependencies: string[]; // 外部依赖（node_modules等）
}

/**
 * Import信息
 */
export interface ImportInfo {
  source: string;          // 来源模块
  importItems: string[];   // 导入的具体项目
  isDefault: boolean;      // 是否是默认导入
  isDynamic: boolean;      // 是否是动态导入
  isTypeOnly: boolean;     // 是否仅类型导入
  line: number;           // 所在行号
}

/**
 * Export信息
 */
export interface ExportInfo {
  name: string;           // 导出名称
  type: 'function' | 'class' | 'interface' | 'type' | 'const' | 'default' | 'namespace';
  isDefault: boolean;     // 是否是默认导出
  line: number;          // 所在行号
  reExportFrom?: string; // 重新导出的来源（如果有）
}

/**
 * 依赖分析结果
 */
export interface DependencyAnalysisResult {
  files: Map<string, FileDependency>;
  dependencyGraph: DependencyGraph;
  circularDependencies: string[][];
  orphanFiles: string[];
  entryPoints: string[];
}

/**
 * 依赖图
 */
export interface DependencyGraph {
  nodes: string[];
  edges: { from: string; to: string; type: 'import' | 'dynamic' }[];
}

/**
 * 依赖分析器配置
 */
export interface DependencyAnalyzerConfig {
  rootDir: string;
  includePatterns: string[];
  excludePatterns: string[];
  followDynamicImports: boolean;
  analyzeTypeImports: boolean;
  resolveNodeModules: boolean;
}

/**
 * 默认配置
 */
const DEFAULT_CONFIG: DependencyAnalyzerConfig = {
  rootDir: process.cwd(),
  includePatterns: ['**/*.{ts,tsx,js,jsx}'],
  excludePatterns: ['node_modules/**', 'dist/**', '**/*.test.{ts,tsx,js,jsx}', '**/*.spec.{ts,tsx,js,jsx}'],
  followDynamicImports: true,
  analyzeTypeImports: true,
  resolveNodeModules: false
};

/**
 * 依赖分析器
 * 
 * 分析项目中文件的依赖关系，为AI CR提供更好的上下文信息
 */
export class DependencyAnalyzer {
  private config: DependencyAnalyzerConfig;
  private cache: Map<string, FileDependency> = new Map();

  constructor(config: Partial<DependencyAnalyzerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * 分析指定文件的依赖关系
   */
  public async analyzeFile(filePath: string): Promise<FileDependency | null> {
    try {
      const absolutePath = path.resolve(filePath);
      
      // 检查缓存
      if (this.cache.has(absolutePath)) {
        return this.cache.get(absolutePath)!;
      }

      // 检查文件是否存在
      if (!fs.existsSync(absolutePath)) {
        return null;
      }

      const content = fs.readFileSync(absolutePath, 'utf-8');
      const dependency = await this.parseFileDependency(absolutePath, content);
      
      // 缓存结果
      this.cache.set(absolutePath, dependency);
      return dependency;

    } catch (error) {
      console.warn(`分析文件依赖失败 ${filePath}:`, error);
      return null;
    }
  }

  /**
   * 分析多个文件的依赖关系
   */
  public async analyzeFiles(filePaths: string[]): Promise<DependencyAnalysisResult> {
    const files = new Map<string, FileDependency>();
    
    // 第一轮：解析所有文件的imports和exports
    for (const filePath of filePaths) {
      const dependency = await this.analyzeFile(filePath);
      if (dependency) {
        files.set(dependency.filePath, dependency);
      }
    }

    // 第二轮：构建依赖关系
    this.buildDependencyRelationships(files);

    // 构建依赖图
    const dependencyGraph = this.buildDependencyGraph(files);

    // 检测循环依赖
    const circularDependencies = this.detectCircularDependencies(dependencyGraph);

    // 找出孤立文件（没有被任何文件导入的文件）
    const orphanFiles = this.findOrphanFiles(files);

    // 找出入口点（不导入其他文件，但被其他文件导入）
    const entryPoints = this.findEntryPoints(files);

    return {
      files,
      dependencyGraph,
      circularDependencies,
      orphanFiles,
      entryPoints
    };
  }

  /**
   * 获取文件的直接依赖
   */
  public getDirectDependencies(filePath: string): string[] {
    const dependency = this.cache.get(path.resolve(filePath));
    return dependency ? dependency.dependencies : [];
  }

  /**
   * 获取依赖此文件的其他文件
   */
  public getDependents(filePath: string): string[] {
    const dependency = this.cache.get(path.resolve(filePath));
    return dependency ? dependency.dependents : [];
  }

  /**
   * 获取文件的传递依赖（递归获取所有相关文件）
   */
  public getTransitiveDependencies(filePath: string, maxDepth: number = 3): string[] {
    const visited = new Set<string>();
    const result: string[] = [];
    
    const traverse = (currentPath: string, depth: number) => {
      if (depth > maxDepth || visited.has(currentPath)) {
        return;
      }
      
      visited.add(currentPath);
      const dependencies = this.getDirectDependencies(currentPath);
      
      for (const dep of dependencies) {
        if (!visited.has(dep)) {
          result.push(dep);
          traverse(dep, depth + 1);
        }
      }
    };

    traverse(path.resolve(filePath), 0);
    return result;
  }

  /**
   * 解析单个文件的依赖信息
   */
  private async parseFileDependency(filePath: string, content: string): Promise<FileDependency> {
    const imports = this.parseImports(content);
    const exports = this.parseExports(content);
    
    // 解析依赖路径
    const dependencies = await this.resolveDependencyPaths(filePath, imports);
    const externalDependencies = this.extractExternalDependencies(imports);

    return {
      filePath,
      imports,
      exports,
      dependents: [], // 稍后填充
      dependencies: dependencies.filter(dep => !dep.startsWith('node_modules')),
      externalDependencies
    };
  }

  /**
   * 解析import语句
   */
  private parseImports(content: string): ImportInfo[] {
    const imports: ImportInfo[] = [];
    const lines = content.split('\n');

    // 匹配各种import语句的正则
    const importPatterns = [
      // import defaultExport from "module-name";
      /^import\s+(\w+)\s+from\s+['"](.*?)['"];?\s*$/,
      // import * as name from "module-name";
      /^import\s+\*\s+as\s+(\w+)\s+from\s+['"](.*?)['"];?\s*$/,
      // import { export1, export2 } from "module-name";
      /^import\s+\{\s*(.*?)\s*\}\s+from\s+['"](.*?)['"];?\s*$/,
      // import defaultExport, { export1, export2 } from "module-name";
      /^import\s+(\w+)\s*,\s*\{\s*(.*?)\s*\}\s+from\s+['"](.*?)['"];?\s*$/,
      // import "module-name";
      /^import\s+['"](.*?)['"];?\s*$/,
    ];

    // Type-only imports
    const typeImportPatterns = [
      /^import\s+type\s+\{\s*(.*?)\s*\}\s+from\s+['"](.*?)['"];?\s*$/,
      /^import\s+type\s+(\w+)\s+from\s+['"](.*?)['"];?\s*$/,
    ];

    lines.forEach((line, lineIndex) => {
      const trimmedLine = line.trim();
      
      // 跳过注释行
      if (trimmedLine.startsWith('//') || trimmedLine.startsWith('/*') || trimmedLine.startsWith('*')) {
        return;
      }

      // 检查type-only imports
      for (const pattern of typeImportPatterns) {
        const match = trimmedLine.match(pattern);
        if (match) {
          imports.push({
            source: match[2] || match[1] || '', // type import可能只有一个捕获组
            importItems: match[1] ? this.parseImportItems(match[1]) : [],
            isDefault: !match[1]?.includes('{'),
            isDynamic: false,
            isTypeOnly: true,
            line: lineIndex + 1
          });
          return;
        }
      }

      // 检查普通imports
      for (const pattern of importPatterns) {
        const match = trimmedLine.match(pattern);
        if (match) {
          let source: string;
          let importItems: string[] = [];
          let isDefault = false;

          if (match.length === 2) {
            // import "module-name";
            source = match[1] || '';
          } else if (match.length === 3) {
            // import defaultExport from "module-name" 或 import * as name from "module-name"
            source = match[2] || '';
            if (trimmedLine.includes('* as')) {
              importItems = [`* as ${match[1] || ''}`];
            } else {
              importItems = [match[1] || ''];
              isDefault = true;
            }
          } else if (match.length === 4) {
            if (match[1] && match[2]) {
              // import defaultExport, { export1, export2 } from "module-name";
              source = match[3] || '';
              importItems = [match[1], ...this.parseImportItems(match[2])];
              isDefault = true;
            } else {
              // import { export1, export2 } from "module-name";
              source = match[2] || '';
              importItems = this.parseImportItems(match[1] || '');
            }
          } else {
            continue;
          }

          imports.push({
            source,
            importItems,
            isDefault,
            isDynamic: false,
            isTypeOnly: false,
            line: lineIndex + 1
          });
          return;
        }
      }

      // 检查动态import
      const dynamicImportMatch = trimmedLine.match(/import\s*\(\s*['"](.*?)['\"]\s*\)/);
      if (dynamicImportMatch) {
        imports.push({
          source: dynamicImportMatch[1] || '',
          importItems: [],
          isDefault: false,
          isDynamic: true,
          isTypeOnly: false,
          line: lineIndex + 1
        });
      }
    });

    return imports;
  }

  /**
   * 解析import项目列表
   */
  private parseImportItems(itemsStr: string): string[] {
    return itemsStr
      .split(',')
      .map(item => item.trim())
      .filter(item => item.length > 0)
      .map(item => {
        // 处理 as 重命名
        const asMatch = item.match(/^(.*?)\s+as\s+(.*)$/);
        return asMatch ? (asMatch[2] || item) : item;
      });
  }

  /**
   * 解析export语句
   */
  private parseExports(content: string): ExportInfo[] {
    const exports: ExportInfo[] = [];
    const lines = content.split('\n');

    lines.forEach((line, lineIndex) => {
      const trimmedLine = line.trim();
      
      // 跳过注释
      if (trimmedLine.startsWith('//') || trimmedLine.startsWith('/*') || trimmedLine.startsWith('*')) {
        return;
      }

      // export default
      if (trimmedLine.startsWith('export default ')) {
        exports.push({
          name: 'default',
          type: 'default',
          isDefault: true,
          line: lineIndex + 1
        });
        return;
      }

      // export function/class/interface/type
      const declarationMatch = trimmedLine.match(/^export\s+(function|class|interface|type|const|let|var)\s+(\w+)/);
      if (declarationMatch) {
        exports.push({
          name: declarationMatch[2] || '',
          type: declarationMatch[1] as any,
          isDefault: false,
          line: lineIndex + 1
        });
        return;
      }

      // export { ... }
      const namedExportMatch = trimmedLine.match(/^export\s+\{\s*(.*?)\s*\}(?:\s+from\s+['"](.*?)['"])?/);
      if (namedExportMatch) {
        const exportItems = this.parseExportItems(namedExportMatch[1] || '');
        const reExportFrom = namedExportMatch[2];
        
        exportItems.forEach(item => {
          const exportInfo: ExportInfo = {
            name: item,
            type: 'const', // 默认类型，实际可能是其他
            isDefault: false,
            line: lineIndex + 1
          };
          if (reExportFrom) {
            exportInfo.reExportFrom = reExportFrom;
          }
          exports.push(exportInfo);
        });
        return;
      }

      // export * from "module"
      const reExportMatch = trimmedLine.match(/^export\s+\*\s+from\s+['"](.*?)['"];?\s*$/);
      if (reExportMatch) {
        const exportInfo: ExportInfo = {
          name: '*',
          type: 'namespace',
          isDefault: false,
          line: lineIndex + 1
        };
        if (reExportMatch[1]) {
          exportInfo.reExportFrom = reExportMatch[1];
        }
        exports.push(exportInfo);
      }
    });

    return exports;
  }

  /**
   * 解析export项目列表
   */
  private parseExportItems(itemsStr: string): string[] {
    return itemsStr
      .split(',')
      .map(item => item.trim())
      .filter(item => item.length > 0)
      .map(item => {
        // 处理 as 重命名，取重命名后的名字
        const asMatch = item.match(/^(.*?)\s+as\s+(.*)$/);
        return asMatch ? (asMatch[2] || item) : item;
      });
  }

  /**
   * 解析依赖路径
   */
  private async resolveDependencyPaths(filePath: string, imports: ImportInfo[]): Promise<string[]> {
    const dependencies: string[] = [];
    const baseDir = path.dirname(filePath);

    for (const importInfo of imports) {
      if (!this.config.followDynamicImports && importInfo.isDynamic) {
        continue;
      }

      if (!this.config.analyzeTypeImports && importInfo.isTypeOnly) {
        continue;
      }

      const resolved = await this.resolveModulePath(baseDir, importInfo.source);
      if (resolved) {
        dependencies.push(resolved);
      }
    }

    return dependencies;
  }

  /**
   * 解析模块路径
   */
  private async resolveModulePath(baseDir: string, modulePath: string): Promise<string | null> {
    // 外部依赖（不解析）
    if (!modulePath.startsWith('.')) {
      return this.config.resolveNodeModules ? `node_modules/${modulePath}` : null;
    }

    // 相对路径
    let resolvedPath = path.resolve(baseDir, modulePath);

    // 尝试添加常见的文件扩展名
    const extensions = ['.ts', '.tsx', '.js', '.jsx', '.json'];
    
    for (const ext of extensions) {
      const pathWithExt = resolvedPath + ext;
      if (fs.existsSync(pathWithExt)) {
        return pathWithExt;
      }
    }

    // 尝试index文件
    for (const ext of extensions) {
      const indexPath = path.join(resolvedPath, `index${ext}`);
      if (fs.existsSync(indexPath)) {
        return indexPath;
      }
    }

    // 检查目录是否存在且有package.json
    if (fs.existsSync(resolvedPath) && fs.statSync(resolvedPath).isDirectory()) {
      const packageJsonPath = path.join(resolvedPath, 'package.json');
      if (fs.existsSync(packageJsonPath)) {
        try {
          const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
          const main = packageJson.main || 'index.js';
          const mainPath = path.join(resolvedPath, main);
          if (fs.existsSync(mainPath)) {
            return mainPath;
          }
        } catch {
          // 忽略package.json解析错误
        }
      }
    }

    return null;
  }

  /**
   * 提取外部依赖
   */
  private extractExternalDependencies(imports: ImportInfo[]): string[] {
    return imports
      .filter(imp => !imp.source.startsWith('.'))
      .map(imp => imp.source)
      .filter((dep, index, arr) => arr.indexOf(dep) === index); // 去重
  }

  /**
   * 构建文件间的依赖关系
   */
  private buildDependencyRelationships(files: Map<string, FileDependency>): void {
    // 清空现有的dependents
    for (const dependency of files.values()) {
      dependency.dependents = [];
    }

    // 构建dependents关系
    for (const [filePath, dependency] of files) {
      for (const depPath of dependency.dependencies) {
        const depFile = files.get(depPath);
        if (depFile) {
          depFile.dependents.push(filePath);
        }
      }
    }
  }

  /**
   * 构建依赖图
   */
  private buildDependencyGraph(files: Map<string, FileDependency>): DependencyGraph {
    const nodes = Array.from(files.keys());
    const edges: { from: string; to: string; type: 'import' | 'dynamic' }[] = [];

    for (const [filePath, dependency] of files) {
      for (const depPath of dependency.dependencies) {
        if (files.has(depPath)) {
          // 检查是否有动态导入
          const hasDynamicImport = dependency.imports.some(
            imp => imp.source.includes(path.relative(path.dirname(filePath), depPath)) && imp.isDynamic
          );
          
          edges.push({
            from: filePath,
            to: depPath,
            type: hasDynamicImport ? 'dynamic' : 'import'
          });
        }
      }
    }

    return { nodes, edges };
  }

  /**
   * 检测循环依赖
   */
  private detectCircularDependencies(graph: DependencyGraph): string[][] {
    const cycles: string[][] = [];
    const visited = new Set<string>();
    const recStack = new Set<string>();
    const path: string[] = [];

    const dfs = (node: string): void => {
      if (recStack.has(node)) {
        // 找到循环
        const cycleStart = path.indexOf(node);
        if (cycleStart !== -1) {
          cycles.push(path.slice(cycleStart).concat(node));
        }
        return;
      }

      if (visited.has(node)) {
        return;
      }

      visited.add(node);
      recStack.add(node);
      path.push(node);

      // 遍历邻接节点
      const neighbors = graph.edges
        .filter(edge => edge.from === node)
        .map(edge => edge.to);

      for (const neighbor of neighbors) {
        dfs(neighbor);
      }

      recStack.delete(node);
      path.pop();
    };

    for (const node of graph.nodes) {
      if (!visited.has(node)) {
        dfs(node);
      }
    }

    return cycles;
  }

  /**
   * 找出孤立文件
   */
  private findOrphanFiles(files: Map<string, FileDependency>): string[] {
    return Array.from(files.values())
      .filter(file => file.dependents.length === 0 && file.dependencies.length > 0)
      .map(file => file.filePath);
  }

  /**
   * 找出入口点
   */
  private findEntryPoints(files: Map<string, FileDependency>): string[] {
    return Array.from(files.values())
      .filter(file => file.dependencies.length === 0 && file.dependents.length > 0)
      .map(file => file.filePath);
  }

  /**
   * 清除缓存
   */
  public clearCache(): void {
    this.cache.clear();
  }

  /**
   * 获取文件的相关文件（依赖和被依赖的文件）
   * 这个方法对AI CR特别有用，可以提供更好的上下文
   */
  public getRelatedFiles(filePath: string, maxDepth: number = 2): {
    dependencies: string[];
    dependents: string[];
    related: string[];
  } {
    const absolutePath = path.resolve(filePath);
    const dependencies = this.getTransitiveDependencies(absolutePath, maxDepth);
    const dependents = this.getTransitiveDependents(absolutePath, maxDepth);
    
    // 合并去重
    const related = [...new Set([...dependencies, ...dependents])];

    return {
      dependencies,
      dependents, 
      related
    };
  }

  /**
   * 获取传递性的被依赖文件
   */
  private getTransitiveDependents(filePath: string, maxDepth: number = 3): string[] {
    const visited = new Set<string>();
    const result: string[] = [];
    
    const traverse = (currentPath: string, depth: number) => {
      if (depth > maxDepth || visited.has(currentPath)) {
        return;
      }
      
      visited.add(currentPath);
      const dependents = this.getDependents(currentPath);
      
      for (const dep of dependents) {
        if (!visited.has(dep)) {
          result.push(dep);
          traverse(dep, depth + 1);
        }
      }
    };

    traverse(filePath, 0);
    return result;
  }
}