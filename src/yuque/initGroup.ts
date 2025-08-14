// src/yuque/initGroup.ts
import inquirer from "inquirer";
import { loadProjectConfig, saveProjectConfig, getYuqueAuth } from "./config.js";
import { YuqueClient } from "./yuqueClient.js";

/**
 * 确保项目配置中存在 repoId（项目组知识库）。
 * 逻辑：
 * 1) 先看 CLI/环境变量（YUQUE_REPO_ID / YUQUE_GROUP_ID）；
 * 2) 再看项目内配置；
 * 3) 否则调用 Yuque 列表，交互式选择一个 Repo，写回配置；
 * 4) 如果列表为空，提示用户手动输入 Repo ID（兜底）。
 */
export async function ensureProjectGroup(cwd = process.cwd()): Promise<{ repoId: string; groupId?: string }> {
  const envRepoId = process.env.YUQUE_REPO_ID;
  const envGroupId = process.env.YUQUE_GROUP_ID;
  console.log('====ensureProjectGroup====', envRepoId, envGroupId);

  if (envRepoId) {
    // 非交互/CI 场景
    const result: { repoId: string; groupId?: string } = { repoId: String(envRepoId) };
    if (envGroupId) {
      result.groupId = String(envGroupId);
    }
    return result;
  }

  const proj = loadProjectConfig(cwd);
  if (proj.project?.repoId) {
    const result: { repoId: string; groupId?: string } = { repoId: String(proj.project.repoId) };
    if (proj.project.groupId) {
      result.groupId = String(proj.project.groupId);
    }
    return result;
  }

  const { token, baseURL } = getYuqueAuth(); // 可能抛错，交由上层处理
  const yuque = new YuqueClient({ token, baseURL });

  let repos = await yuque.listRepos();
  if (!repos.length) {
    // 兜底：让用户手填 Repo ID
    const { repoId } = await inquirer.prompt([
      {
        type: "input",
        name: "repoId",
        message: "未能获取知识库列表，请手动输入该项目所属【知识库ID】（Yuque Repo ID）：",
        validate: (v) => v && String(v).trim() ? true : "Repo ID 不能为空"
      }
    ]);
    saveProjectConfig({ project: { repoId: String(repoId) } }, cwd);
    return { repoId: String(repoId) };
  }

  const { repoId } = await inquirer.prompt([
    {
      type: "list",
      name: "repoId",
      pageSize: 12,
      message: "请选择该项目所属的【项目组知识库】",
      choices: repos.map(r => ({
        name: `${r.group?.name ?? "未知团队"} / ${r.name}  (#${r.id})`,
        value: String(r.id),
      }))
    }
  ]);

  const repo = repos.find(r => String(r.id) === String(repoId));
  const projectConfig: { repoId?: string; groupId?: string; groupName?: string } = {
    repoId: String(repoId)
  };
  
  if (repo?.group?.id) {
    projectConfig.groupId = String(repo.group.id);
  }
  if (repo?.group?.name) {
    projectConfig.groupName = repo.group.name;
  }
  
  saveProjectConfig({ project: projectConfig }, cwd);

  const result: { repoId: string; groupId?: string } = { repoId: String(repoId) };
  if (repo?.group?.id) {
    result.groupId = String(repo.group.id);
  }
  return result;
}