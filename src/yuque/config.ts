// src/yuque/config.ts
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

export type ProjectConfig = {
  project?: {
    name?: string;
    groupName?: string;       // 人类可读
    groupId?: string;         // 团队/空间 ID（可选）
    repoId?: string;          // 知识库 ID（推荐保存这个）
  };
  upload?: {
    enabled?: boolean;        // 默认 true
    monthDocPrefix?: string;  // 默认 "CR记录"
    appendMode?: "section" | "plain"; // 现在只实现这两种
  };
};

export type GlobalConfig = {
  yuque?: {
    token?: string;                     // 建议只放在这里或环境变量
    baseURL?: string;                   // 默认 https://www.yuque.com
  };
  defaults?: {
    spaceId?: string;                   // 预留：若要限定空间，可加上
  };
};

const PROJECT_CONFIG = "ai-cr.config.json";
const GLOBAL_DIR = path.join(os.homedir(), ".ai-cr");
const GLOBAL_CONFIG = path.join(GLOBAL_DIR, "config.json");

export function loadProjectConfig(cwd = process.cwd()): ProjectConfig {
  const p = path.join(cwd, PROJECT_CONFIG);
  if (!fs.existsSync(p)) return {};
  
  try {
    const content = fs.readFileSync(p, "utf8").trim();
    if (!content) return {};
    return JSON.parse(content);
  } catch (error) {
    console.warn(`警告：项目配置文件 ${p} 格式错误，将使用默认配置`);
    return {};
  }
}

export function saveProjectConfig(partial: ProjectConfig, cwd = process.cwd()) {
  const p = path.join(cwd, PROJECT_CONFIG);
  const prev = loadProjectConfig(cwd);
  const next: ProjectConfig = {
    ...prev,
    ...partial,
    project: { ...(prev.project || {}), ...(partial.project || {}) },
    upload:  { ...(prev.upload  || {}), ...(partial.upload  || {}) },
  };
  fs.writeFileSync(p, JSON.stringify(next, null, 2) + "\n", "utf8");
}

export function loadGlobalConfig(): GlobalConfig {
  if (!fs.existsSync(GLOBAL_CONFIG)) return {};
  
  try {
    const content = fs.readFileSync(GLOBAL_CONFIG, "utf8").trim();
    if (!content) return {};
    return JSON.parse(content);
  } catch (error) {
    console.warn(`警告：全局配置文件 ${GLOBAL_CONFIG} 格式错误，将使用默认配置`);
    return {};
  }
}

export function saveGlobalConfig(partial: GlobalConfig) {
  if (!fs.existsSync(GLOBAL_DIR)) fs.mkdirSync(GLOBAL_DIR, { recursive: true });
  const prev = loadGlobalConfig();
  const next: GlobalConfig = {
    ...prev,
    ...partial,
    yuque:   { ...(prev.yuque || {}), ...(partial.yuque || {}) },
    defaults:{ ...(prev.defaults || {}), ...(partial.defaults || {}) },
  };
  fs.writeFileSync(GLOBAL_CONFIG, JSON.stringify(next, null, 2) + "\n", "utf8");
}

export function getYuqueAuth() {
  const g = loadGlobalConfig();
  const token  = process.env.YUQUE_TOKEN ?? g.yuque?.token;
  const baseURL = (g.yuque?.baseURL || "https://www.yuque.com").replace(/\/+$/, "");
  if (!token) {
    throw new Error("缺少 Yuque Token：请设置环境变量 YUQUE_TOKEN 或 ~/.ai-cr/config.json 的 yuque.token");
  }
  return { token, baseURL };
}