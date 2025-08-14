// src/yuque/yuqueUpload.ts
import fs from "node:fs/promises";
import dayjs from "dayjs";
import { getYuqueAuth, loadProjectConfig } from "./config.js";
import { YuqueClient } from "./yuqueClient.js";

/** 将本次 Markdown 报告上传/追加到“YYYY-MM CR记录”的月度文档（幂等） */
export async function uploadReportToYuque(reportPath: string, opts?: { repoId?: string; monthTitle?: string }) {
  const { token, baseURL } = getYuqueAuth();
  const proj = loadProjectConfig();
  const repoId = opts?.repoId ?? proj.project?.repoId;
  if (!repoId) throw new Error("未配置 repoId：请先执行交互绑定，或设置 YUQUE_REPO_ID / ai-cr.config.json");

  const prefix = proj.upload?.monthDocPrefix || "CR记录";
  const monthTitle = opts?.monthTitle ?? `${dayjs().format("YYYY-MM")} ${prefix}`;

  const yuque = new YuqueClient({ token, baseURL });

  // 查找是否已有当月文档
  const existing = await yuque.findDocByTitle(repoId, monthTitle);
  const content = await fs.readFile(reportPath, "utf8");

  if (!existing) {
    // 不存在：直接创建
    await yuque.createDoc(repoId, { title: monthTitle, body: `# ${monthTitle}\n\n${content}\n` });
    return { created: true, title: monthTitle };
  }

  // 存在：追加一个分节（以当前时间 + 分支 + commit 短SHA 为小节标题）
  const now = dayjs().format("YYYY-MM-DD HH:mm");
  const branch = safeExec("git rev-parse --abbrev-ref HEAD");
  const shortSha = safeExec("git rev-parse --short HEAD");
  const sectionTitle = `## ${now} | ${branch} | ${shortSha}`;
  const appendBlock = `\n${sectionTitle}\n\n${content}\n`;

  const doc = await yuque.getDocRaw(repoId, existing.id);
  const mergedBody = mergeMarkdown(doc.body || "", appendBlock);

  await yuque.updateDoc(repoId, existing.id, { body: mergedBody });
  return { created: false, title: monthTitle };
}

function mergeMarkdown(original: string, appendBlock: string) {
  // 简单合并策略：直接拼到末尾。你也可以在此做“去重/分隔线”等增强。
  return `${(original || "").trim()}\n\n---\n${appendBlock}`.trim() + "\n";
}

function safeExec(cmd: string): string {
  try {
    const { execSync } = require("node:child_process");
    return execSync(cmd, { encoding: "utf8" }).trim();
  } catch {
    return "unknown";
  }
}