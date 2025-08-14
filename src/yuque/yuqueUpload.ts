// src/yuque/yuqueUpload.ts
import fs from "node:fs/promises";
import dayjs from "dayjs";
import { getYuqueAuth, loadProjectConfig } from "./config.js";
import { YuqueClient } from "./yuqueClient.js";

/** 将本次 Markdown 报告上传到语雀知识库的对应目录结构 */
export async function uploadReportToYuque(reportPath: string, opts?: { repoId?: string; monthTitle?: string }) {
  const { token, baseURL } = getYuqueAuth();
  const proj = loadProjectConfig();
  const repoId = opts?.repoId ?? proj.project?.repoId;
  if (!repoId) throw new Error("未配置 repoId：请先执行交互绑定，或设置 YUQUE_REPO_ID / ai-cr.config.json");

  const yuque = new YuqueClient({ token, baseURL });
  const content = await fs.readFile(reportPath, "utf8");

  // 1. 确保项目组分组存在
  const projectName = proj.project?.name || "AI-CR项目";
  const projectGroupUUID = await ensureProjectGroup(yuque, repoId, projectName);
  
  // 2. 确保月度分组存在
  const monthTitle = opts?.monthTitle ?? dayjs().format("YYYY-MM");
  const monthGroupUUID = await ensureMonthGroup(yuque, repoId, monthTitle, projectGroupUUID);
  
  // 3. 生成文档标题和文件名
  const now = dayjs();
  const userName = safeExec("git config user.name") || "unknown";
  const projectNameSlug = proj.project?.name?.replace(/[^a-zA-Z0-9]/g, '_') || "ai_cr";
  const dateStr = now.format("YYYYMMDD");
  
  const docTitle = `${userName}_${projectNameSlug}_${dateStr}`;
  
  // 4. 创建文档
  const docResponse = await yuque.createDoc(repoId, { 
    title: docTitle,
    body: content,
    format: "markdown"
  });
  
  // 5. 将文档添加到月度分组下
  await yuque.updateToc(repoId, {
    action: "appendNode",
    action_mode: "child",
    target_uuid: monthGroupUUID,
    type: "DOC",
    doc_ids: [Number(docResponse.id)]
  });
  
  return { 
    created: true, 
    title: docTitle, 
    docId: docResponse.id,
    path: `${projectName}/${monthTitle}/${docTitle}`
  };
}

// 确保项目组分组存在
async function ensureProjectGroup(yuque: YuqueClient, repoId: string | number, projectName: string): Promise<string> {
  const toc = await yuque.getToc(repoId);
  
  // 查找是否已存在项目组分组
  const existingGroup = toc.find(item => 
    item.type === 'TITLE' && item.title === projectName
  );
  
  if (existingGroup) {
    return existingGroup.uuid;
  }
  
  // 创建新的项目组分组
  const newGroupResponse = await yuque.updateToc(repoId, {
    action: "prependNode",
    action_mode: "child",
    type: "TITLE",
    title: projectName
  });
  
  const newGroup = newGroupResponse.find(item => 
    item.type === 'TITLE' && item.title === projectName
  );
  
  if (!newGroup) {
    throw new Error(`创建项目组分组失败: ${projectName}`);
  }
  
  return newGroup.uuid;
}

// 确保月度分组存在
async function ensureMonthGroup(yuque: YuqueClient, repoId: string | number, monthTitle: string, parentGroupUUID: string): Promise<string> {
  const toc = await yuque.getToc(repoId);
  
  // 查找是否已存在月度分组（在项目组下）
  const existingGroup = toc.find(item => 
    item.type === 'TITLE' && 
    item.title === monthTitle && 
    item.parent_uuid === parentGroupUUID
  );
  
  if (existingGroup) {
    return existingGroup.uuid;
  }
  
  // 创建新的月度分组
  const newGroupResponse = await yuque.updateToc(repoId, {
    action: "prependNode",
    action_mode: "child",
    target_uuid: parentGroupUUID,
    type: "TITLE",
    title: monthTitle
  });
  
  const newGroup = newGroupResponse.find(item => 
    item.type === 'TITLE' && 
    item.title === monthTitle && 
    item.parent_uuid === parentGroupUUID
  );
  
  if (!newGroup) {
    throw new Error(`创建月度分组失败: ${monthTitle}`);
  }
  
  return newGroup.uuid;
}

function safeExec(cmd: string): string {
  try {
    const { execSync } = require("node:child_process");
    return execSync(cmd, { encoding: "utf8" }).trim();
  } catch {
    return "unknown";
  }
}