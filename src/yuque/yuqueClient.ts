// src/yuque/yuqueClient.ts
// 一个很薄的 Yuque API 封装（用到再渐进扩展）
type FetchLike = typeof fetch;

export interface YuqueClientOptions {
  token: string;
  baseURL?: string; // 默认 https://www.yuque.com
  fetchImpl?: FetchLike;
}

export interface YuqueRepo {
  id: number | string;
  name: string;
  slug?: string;
  namespace?: string;
  group?: { id?: number | string; name?: string };
}

export interface YuqueDoc {
  id: number | string;
  title: string;
  slug?: string;
}

export class YuqueClient {
  private token: string;
  private baseURL: string;
  private fetchImpl: FetchLike;

  constructor(opts: YuqueClientOptions) {
    this.token = opts.token;
    this.baseURL = (opts.baseURL || "https://www.yuque.com").replace(/\/+$/, "");
    this.fetchImpl = opts.fetchImpl || fetch;
  }

  private async request<T>(method: string, url: string, body?: any): Promise<T> {
    const headers: Record<string, string> = {
      "X-Auth-Token": this.token,
      "Content-Type": "application/json",
    };
    
    const requestInit: RequestInit = {
      method,
      headers,
    };
    
    if (body) {
      requestInit.body = JSON.stringify(body);
    }
    
    const res = await this.fetchImpl(url, requestInit);
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Yuque API ${method} ${url} failed: ${res.status} ${text}`);
    }
    const data = (await res.json().catch(() => ({}))) as any;
    // 语雀常见响应为 { data: ... }
    return (data?.data ?? data) as T;
  }

  /** 拉取我能看到的 Repo 列表 —— 不同环境可能需要按组织查询，这里先给一个兜底实现 */
  async listRepos(): Promise<YuqueRepo[]> {
    // 尝试 1：/api/v2/user/repos
    const url1 = `${this.baseURL}/api/v2/user/repos`;
    try {
      const list = await this.request<any[]>( "GET", url1 );
      return (list || []).map(r => ({
        id: r.id, name: r.name, slug: r.slug, namespace: r.namespace, group: r.group
      }));
    } catch {
      // 兜底：返回空数组，交互时提示用户手动输入 Repo ID
      return [];
    }
  }

  async listDocs(repoId: string | number): Promise<YuqueDoc[]> {
    const url = `${this.baseURL}/api/v2/repos/${repoId}/docs`;
    const list = await this.request<any[]>("GET", url);
    return (list || []).map(d => ({ id: d.id, title: d.title, slug: d.slug }));
  }

  async getDocRaw(repoId: string | number, docIdOrSlug: string | number): Promise<{ title: string; body: string }> {
    const url = `${this.baseURL}/api/v2/repos/${repoId}/docs/${docIdOrSlug}?raw=1`;
    // raw=1 时 data 为纯文本；有些环境仍返回 { data: { body: '...' } }，这里做两手准备
    const res = await this.request<any>("GET", url);
    if (typeof res === "string") return { title: String(docIdOrSlug), body: res };
    return { title: res.title ?? String(docIdOrSlug), body: res.body ?? "" };
  }

  async createDoc(repoId: string | number, payload: { title: string; body: string }): Promise<YuqueDoc> {
    const url = `${this.baseURL}/api/v2/repos/${repoId}/docs`;
    const res = await this.request<any>("POST", url, { title: payload.title, format: "markdown", body: payload.body });
    return { id: res.id, title: res.title, slug: res.slug };
  }

  async updateDoc(repoId: string | number, docId: string | number, payload: { title?: string; body: string }): Promise<YuqueDoc> {
    const url = `${this.baseURL}/api/v2/repos/${repoId}/docs/${docId}`;
    const res = await this.request<any>("PUT", url, { title: payload.title, format: "markdown", body: payload.body });
    return { id: res.id, title: res.title, slug: res.slug };
  }

  async findDocByTitle(repoId: string | number, title: string): Promise<YuqueDoc | null> {
    const docs = await this.listDocs(repoId);
    return docs.find(d => d.title === title) ?? null;
  }
}