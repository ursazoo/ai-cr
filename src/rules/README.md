# 分类与规则关系说明

## 1. 分类（Category）

**定义**  
分类是规则的高层分组，用于组织和管理规则集，方便前端展示、筛选和分组统计。  
它决定了一个规则属于哪一类问题，但不关心规则的具体实现细节。

**特点**

- 只描述“领域”或“问题类型”
- 不包含具体的检测条件
- 用于 UI 展示和管理
- 一般包含：
  - `id`: 分类唯一标识（如 `readability`）
  - `name`: 分类名称（如 “可读性与可维护性”）
  - `description`: 分类说明
  - `order`: 展示顺序
  - `appliesTo`: 适用文件类型
  - `defaultCheckBy`: 默认检查方式（`ai` 或 `static`）
  - `tags`: 标签（用于搜索/筛选）
  - `enabled`: 是否启用
  - `aiFocus`: 给 AI 的检查提示方向（高层提示）

---

## 2. 规则（Rule）

**定义**  
规则是分类下的最小检测单元，明确规定了需要检测的具体问题和判断标准。  
每条规则都可以有唯一的 `ruleId`，并归属于一个分类。

**特点**

- 可由静态工具（eslint、stylelint）或 AI 检查实现
- 检测条件明确且可执行
- 包含：
  - `id`: 规则唯一标识（如 `R001`）
  - `categoryId`: 关联的分类 ID（如 `readability`）
  - `title`: 规则名称（如 “禁止使用魔法数字”）
  - `description`: 规则详细说明
  - `checkBy`: `ai` 或 `static`
  - `pattern`（可选）: 静态匹配规则（正则、AST 查询等）
  - `aiPrompt`（可选）: AI 检查提示（更具体的检测描述）

---

## 3. 分类与规则的关系

- **分类** 是规则的容器，描述问题的高层领域  
- **规则** 是分类下的具体检测项  
- 同一分类下可有多条规则，规则实现方式（AI/静态）可以不同  
- AI 检查时，`aiFocus` 给出整体方向，`aiPrompt` 在规则层给出具体任务

---

## 4. 示例

### 分类

```json
{
  "id": "readability",
  "name": "可读性与可维护性",
  "order": 10,
  "description": "函数拆分、意图表达、魔法值、注释质量等语义可读性问题。",
  "appliesTo": [".ts", ".tsx", ".js", ".jsx", ".vue"],
  "defaultCheckBy": "ai",
  "aiFocus": [
    "长函数/深嵌套应拆分",
    "命名应体现语义而非 a/b/data",
    "消除魔法数字，提取常量"
  ],
  "tags": ["可读性"],
  "enabled": true
}
```

### 规则

```json
{
  "id": "R001",
  "categoryId": "readability",
  "title": "禁止使用魔法数字",
  "description": "代码中出现的数字应使用具名常量代替，提升可读性和可维护性。",
  "checkBy": "static",
  "pattern": "\b(100|200|404)\b"
}
```

这样：
 • AI 收到分类 + aiFocus，可以理解上下文范围。
 • 细化规则决定 AI 逐条检查，并且可统计命中率、生成问题报告。
