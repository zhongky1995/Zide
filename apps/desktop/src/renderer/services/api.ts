// API 服务层 - 封装与主进程的IPC通信
import type { Project, CreateProjectParams, Chapter, ChapterSummary, Outline, AIOperation, Snapshot, ProjectMetrics } from '../types/api';

declare global {
  interface Window {
    zide: {
      // 项目操作
      createProject: (config: CreateProjectParams) => Promise<any>;
      getProjects: () => Promise<any>;
      getProject: (id: string) => Promise<any>;
      updateProject: (id: string, params: any) => Promise<any>;
      deleteProject: (id: string) => Promise<any>;

      // 大纲操作
      generateOutline: (params: any) => Promise<any>;
      getOutline: (projectId: string) => Promise<any>;
      updateOutline: (projectId: string, params: any) => Promise<any>;
      confirmOutline: (projectId: string) => Promise<any>;
      addChapter: (projectId: string, params: any) => Promise<any>;
      updateChapter: (projectId: string, chapterId: string, params: any) => Promise<any>;
      deleteChapter: (projectId: string, chapterId: string) => Promise<any>;
      reorderChapters: (projectId: string, chapterIds: string[]) => Promise<any>;

      // 章节操作
      getChapters: (projectId: string) => Promise<any>;
      getChapterSummaryList: (projectId: string) => Promise<any>;
      getChapter: (projectId: string, chapterId: string) => Promise<any>;
      saveChapter: (projectId: string, chapterId: string, content: string) => Promise<any>;
      updateChapterStatus: (projectId: string, chapterId: string, status: string) => Promise<any>;
      updateChapterMeta: (projectId: string, chapterId: string, params: any) => Promise<any>;
      updateChapterCompletion: (projectId: string, chapterId: string, completion: number) => Promise<any>;
      getNextChapterNumber: (projectId: string) => Promise<any>;

      // AI操作
      aiGenerate: (projectId: string, chapterId: string, intent: string, customPrompt?: string) => Promise<any>;
      aiContinue: (projectId: string, chapterId: string) => Promise<any>;
      aiExpand: (projectId: string, chapterId: string) => Promise<any>;
      aiRewrite: (projectId: string, chapterId: string) => Promise<any>;
      aiAddArgument: (projectId: string, chapterId: string) => Promise<any>;
      aiPolish: (projectId: string, chapterId: string) => Promise<any>;
      aiSimplify: (projectId: string, chapterId: string) => Promise<any>;
      getOperationHistory: (projectId: string, chapterId: string) => Promise<any>;
      adoptOperation: (projectId: string, chapterId: string, operationId: string) => Promise<any>;
      aiPing: () => Promise<any>;
      aiGetConfig: () => Promise<any>;

      // 上下文操作
      packContext: (projectId: string, chapterId: string) => Promise<any>;
      retrieveContext: (projectId: string, chapterId: string, query: string, limit?: number) => Promise<any>;
      indexChapter: (projectId: string, chapterId: string, content: string) => Promise<any>;
      rebuildIndex: (projectId: string) => Promise<any>;
      getIndexStats: (projectId: string) => Promise<any>;
      getProjectContext: (projectId: string) => Promise<any>;

      // 快照操作
      createChapterSnapshot: (projectId: string, chapterId: string, operationId?: string) => Promise<any>;
      createGlobalSnapshot: (projectId: string, description?: string) => Promise<any>;
      getSnapshots: (projectId: string) => Promise<any>;
      getSnapshot: (snapshotId: string) => Promise<any>;
      getLatestSnapshot: (projectId: string, type?: string) => Promise<any>;
      rollbackSnapshot: (snapshotId: string) => Promise<any>;
      rollbackChapter: (projectId: string, chapterId: string) => Promise<any>;
      deleteSnapshot: (snapshotId: string) => Promise<any>;
      cleanupSnapshots: (projectId: string, keepCount?: number) => Promise<any>;
      getSnapshotCount: (projectId: string) => Promise<any>;

      // 检查操作
      runCheck: (projectId: string) => Promise<any>;
      checkMissingChapters: (projectId: string) => Promise<any>;
      checkTermConsistency: (projectId: string) => Promise<any>;
      checkDuplicateContent: (projectId: string) => Promise<any>;
      checkCompletion: (projectId: string, threshold?: number) => Promise<any>;
      checkOutlineDrift: (projectId: string) => Promise<any>;
      resolveIssue: (projectId: string, issue: any) => Promise<any>;
      ignoreIssue: (projectId: string, issue: any) => Promise<any>;

      // 导出操作
      exportProject: (projectId: string, format: string) => Promise<any>;
      exportChapters: (projectId: string, chapterIds: string[], format: string) => Promise<any>;
      exportPreview: (projectId: string, format: string) => Promise<any>;
      getExportHistory: (projectId: string) => Promise<any>;
      deleteExport: (filePath: string) => Promise<any>;
      openExportDir: () => Promise<any>;

      // 统计操作
      getProjectMetrics: (projectId: string) => Promise<any>;
      getGlobalMetrics: () => Promise<any>;
      logOperation: (params: any) => Promise<any>;
    };
  }
}

const api = window.zide;

// 辅助函数：从响应中提取数据
function extractData<T>(response: any): T | null {
  if (response?.success) {
    return response.data;
  }
  console.error('API Error:', response?.error);
  // 显示错误给用户
  alert('API Error: ' + (response?.error || 'Unknown error'));
  return null;
}

// 项目API
export const projectApi = {
  async create(params: CreateProjectParams): Promise<Project | null> {
    const result = await api.createProject(params);
    return extractData<Project>(result);
  },

  async list(): Promise<Project[]> {
    const result = await api.getProjects();
    return extractData<Project[]>(result) || [];
  },

  async get(id: string): Promise<Project | null> {
    const result = await api.getProject(id);
    return extractData<Project>(result);
  },

  async update(id: string, params: Partial<Project>): Promise<Project | null> {
    const result = await api.updateProject(id, params);
    return extractData<Project>(result);
  },

  async delete(id: string): Promise<boolean> {
    const result = await api.deleteProject(id);
    return result?.success || false;
  },
};

// 大纲API
export const outlineApi = {
  async generate(projectId: string, template?: string, chapterCount?: number): Promise<Outline | null> {
    const result = await api.generateOutline({ projectId, template, chapterCount });
    return extractData<Outline>(result);
  },

  async get(projectId: string): Promise<Outline | null> {
    const result = await api.getOutline(projectId);
    return extractData<Outline>(result);
  },

  async confirm(projectId: string): Promise<Outline | null> {
    const result = await api.confirmOutline(projectId);
    return extractData<Outline>(result);
  },

  async addChapter(projectId: string, title: string, target?: string): Promise<Outline | null> {
    const result = await api.addChapter(projectId, { title, target });
    return extractData<Outline>(result);
  },
};

// 章节API
export const chapterApi = {
  async list(projectId: string): Promise<Chapter[]> {
    const result = await api.getChapters(projectId);
    return extractData<Chapter[]>(result) || [];
  },

  async summaryList(projectId: string): Promise<ChapterSummary[]> {
    const result = await api.getChapterSummaryList(projectId);
    return extractData<ChapterSummary[]>(result) || [];
  },

  async get(projectId: string, chapterId: string): Promise<Chapter | null> {
    const result = await api.getChapter(projectId, chapterId);
    return extractData<Chapter>(result);
  },

  async save(projectId: string, chapterId: string, content: string): Promise<Chapter | null> {
    const result = await api.saveChapter(projectId, chapterId, content);
    return extractData<Chapter>(result);
  },

  async updateStatus(projectId: string, chapterId: string, status: string): Promise<Chapter | null> {
    const result = await api.updateChapterStatus(projectId, chapterId, status);
    return extractData<Chapter>(result);
  },

  async getNextNumber(projectId: string): Promise<string> {
    const result = await api.getNextChapterNumber(projectId);
    return extractData<string>(result) || '01';
  },
};

// AI API
export const aiApi = {
  async generate(projectId: string, chapterId: string, intent: string, customPrompt?: string) {
    const result = await api.aiGenerate(projectId, chapterId, intent, customPrompt);
    return result?.success ? result.data : null;
  },

  async getOperationHistory(projectId: string, chapterId: string): Promise<AIOperation[]> {
    const result = await api.getOperationHistory(projectId, chapterId);
    return extractData<AIOperation[]>(result) || [];
  },

  async adoptOperation(projectId: string, chapterId: string, operationId: string): Promise<boolean> {
    const result = await api.adoptOperation(projectId, chapterId, operationId);
    return result?.success || false;
  },
};

// 快照API
export const snapshotApi = {
  async createChapter(projectId: string, chapterId: string, operationId?: string): Promise<Snapshot | null> {
    const result = await api.createChapterSnapshot(projectId, chapterId, operationId);
    return extractData<Snapshot>(result);
  },

  async createGlobal(projectId: string, description?: string): Promise<Snapshot | null> {
    const result = await api.createGlobalSnapshot(projectId, description);
    return extractData<Snapshot>(result);
  },

  async list(projectId: string): Promise<Snapshot[]> {
    const result = await api.getSnapshots(projectId);
    return extractData<Snapshot[]>(result) || [];
  },

  async rollbackChapter(projectId: string, chapterId: string): Promise<boolean> {
    const result = await api.rollbackChapter(projectId, chapterId);
    return result?.success || false;
  },
};

// 统计API
export const metricsApi = {
  async getProject(projectId: string): Promise<ProjectMetrics | null> {
    const result = await api.getProjectMetrics(projectId);
    return extractData<ProjectMetrics>(result);
  },

  async getGlobal(): Promise<ProjectMetrics[]> {
    const result = await api.getGlobalMetrics();
    return extractData<ProjectMetrics[]>(result) || [];
  },
};
