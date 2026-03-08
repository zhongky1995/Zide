// API 服务层 - 封装与主进程的IPC通信
import type {
  Project,
  CreateProjectParams,
  Chapter,
  ChapterSummary,
  Outline,
  AIOperation,
  Snapshot,
  ProjectMetrics,
  CandidateDraft,
  ContinuityReport,
  StoryBible,
  ChapterGoal,
  PlotBoardSnapshot,
  MemoryCard,
  RetconDecision,
  ManuscriptReadiness,
  NovelTaskEnvelope,
  NovelTaskExecutionResult,
} from '../types/api';

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
      runTask: (task: NovelTaskEnvelope) => Promise<any>;
      listCandidateDrafts: (projectId: string, chapterId: string) => Promise<any>;
      adoptCandidateDraft: (projectId: string, chapterId: string, draftId: string, force?: boolean) => Promise<any>;
      rejectCandidateDraft: (projectId: string, chapterId: string, draftId: string) => Promise<any>;
      listContinuityReports: (projectId: string, chapterId: string) => Promise<any>;
      getContinuityReport: (projectId: string, chapterId: string, draftId: string) => Promise<any>;
      regenerateContinuityReport: (projectId: string, chapterId: string, draftId: string) => Promise<any>;
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
      aiUpdateConfig: (config: any) => Promise<any>;
      aiGetStrategy: () => Promise<any>;
      aiListStrategies: () => Promise<any>;
      aiSetStrategy: (strategyId: string) => Promise<any>;
      aiGetIntentConfig: (intent: string) => Promise<any>;
      aiChat: (projectId: string, message: string, chapterId?: string) => Promise<any>;

      // 小说 Story Bible / Plot Board
      getStoryBible: (projectId: string) => Promise<any>;
      generateStoryBible: (projectId: string, seed?: string) => Promise<any>;
      updateStoryBible: (projectId: string, params: any) => Promise<any>;
      confirmStoryBible: (projectId: string) => Promise<any>;
      getPlotBoard: (projectId: string) => Promise<any>;
      updatePlotBoardChapterGoal: (projectId: string, chapterId: string, params: any) => Promise<any>;
      getLoreMemory: (projectId: string) => Promise<any>;
      syncLoreMemory: (projectId: string) => Promise<any>;
      getManuscriptReadiness: (projectId: string) => Promise<any>;
      listRetcons: (projectId: string) => Promise<any>;
      proposeRetcon: (projectId: string, params: any) => Promise<any>;
      approveRetcon: (projectId: string, retconId: string) => Promise<any>;
      rollbackRetcon: (projectId: string, retconId: string) => Promise<any>;

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
      openExportDir: (projectId?: string) => Promise<any>;

      // 统计操作
      getProjectMetrics: (projectId: string) => Promise<any>;
      getGlobalMetrics: () => Promise<any>;
      logOperation: (params: any) => Promise<any>;
    };
  }
}

const api = window.zide;

export const API_ERROR_EVENT = 'zide:api-error';

export type ApiErrorCategory = 'config' | 'data' | 'system';

export interface ApiErrorDetail {
  message: string;
  code?: string;
  category: ApiErrorCategory;
  details?: Record<string, unknown>;
}

function classifyApiError(code?: string, message?: string): ApiErrorCategory {
  if (!code) {
    if (typeof message === 'string' && /api key|配置|provider|model/i.test(message)) {
      return 'config';
    }
    return 'system';
  }

  const configCodes = new Set([
    'INVALID_PARAMS',
    'AI_CONFIG_FAILED',
    'AI_CONFIG_INVALID',
    'AI_PROVIDER_ERROR',
  ]);

  const dataCodes = new Set([
    'NOT_FOUND',
    'PROJECT_NOT_FOUND',
    'PROJECT_ALREADY_EXISTS',
    'OUTLINE_NOT_FOUND',
    'CHAPTER_NOT_FOUND',
    'SNAPSHOT_NOT_FOUND',
  ]);

  if (configCodes.has(code)) return 'config';
  if (dataCodes.has(code)) return 'data';
  return 'system';
}

function emitApiError(response: any, fallbackMessage: string): void {
  const message = typeof response?.error === 'string' && response.error.trim()
    ? response.error
    : fallbackMessage;
  const code = typeof response?.code === 'string' ? response.code : undefined;
  const details = response?.details && typeof response.details === 'object' && !Array.isArray(response.details)
    ? response.details as Record<string, unknown>
    : undefined;

  const detail: ApiErrorDetail = {
    message,
    code,
    category: classifyApiError(code, message),
    details,
  };

  console.error('[API Error]', detail);
  window.dispatchEvent(new CustomEvent<ApiErrorDetail>(API_ERROR_EVENT, { detail }));
}

// 辅助函数：从响应中提取数据
function extractData<T>(response: any, fallbackMessage = '请求失败'): T | null {
  if (response?.success) {
    return response.data;
  }
  emitApiError(response, fallbackMessage);
  return null;
}

function extractSuccess(response: any, fallbackMessage = '请求失败'): boolean {
  if (response?.success) {
    return true;
  }
  emitApiError(response, fallbackMessage);
  return false;
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
    return extractSuccess(result, '删除项目失败');
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
  async runTask(task: NovelTaskEnvelope): Promise<NovelTaskExecutionResult | null> {
    const result = await api.runTask(task);
    return extractData<NovelTaskExecutionResult>(result, '统一任务执行失败');
  },

  async listCandidateDrafts(projectId: string, chapterId: string): Promise<CandidateDraft[]> {
    const result = await api.listCandidateDrafts(projectId, chapterId);
    return extractData<CandidateDraft[]>(result, '获取候选稿列表失败') || [];
  },

  async adoptCandidateDraft(
    projectId: string,
    chapterId: string,
    draftId: string,
    force = false
  ): Promise<{ chapter: Chapter; candidateDraft: CandidateDraft; continuityReport: ContinuityReport; forced: boolean; snapshotId?: string } | null> {
    const result = await api.adoptCandidateDraft(projectId, chapterId, draftId, force);
    return extractData<{ chapter: Chapter; candidateDraft: CandidateDraft; continuityReport: ContinuityReport; forced: boolean; snapshotId?: string }>(result, '采纳候选稿失败');
  },

  async rejectCandidateDraft(projectId: string, chapterId: string, draftId: string): Promise<CandidateDraft | null> {
    const result = await api.rejectCandidateDraft(projectId, chapterId, draftId);
    return extractData<CandidateDraft>(result, '放弃候选稿失败');
  },

  async listContinuityReports(projectId: string, chapterId: string): Promise<ContinuityReport[]> {
    const result = await api.listContinuityReports(projectId, chapterId);
    return extractData<ContinuityReport[]>(result, '获取连续性报告列表失败') || [];
  },

  async getContinuityReport(projectId: string, chapterId: string, draftId: string): Promise<ContinuityReport | null> {
    const result = await api.getContinuityReport(projectId, chapterId, draftId);
    return extractData<ContinuityReport>(result, '获取连续性报告失败');
  },

  async regenerateContinuityReport(projectId: string, chapterId: string, draftId: string): Promise<ContinuityReport | null> {
    const result = await api.regenerateContinuityReport(projectId, chapterId, draftId);
    return extractData<ContinuityReport>(result, '重新生成连续性报告失败');
  },

  async generate(projectId: string, chapterId: string, intent: string, customPrompt?: string) {
    const result = await api.aiGenerate(projectId, chapterId, intent, customPrompt);
    return extractData(result, 'AI 生成失败');
  },

  async getOperationHistory(projectId: string, chapterId: string): Promise<AIOperation[]> {
    const result = await api.getOperationHistory(projectId, chapterId);
    return extractData<AIOperation[]>(result) || [];
  },

  async adoptOperation(projectId: string, chapterId: string, operationId: string): Promise<boolean> {
    const result = await api.adoptOperation(projectId, chapterId, operationId);
    return extractSuccess(result, '采纳操作失败');
  },

  async getStrategy(): Promise<any> {
    const result = await api.aiGetStrategy();
    return extractData(result, '获取策略失败');
  },

  async listStrategies(): Promise<any[]> {
    const result = await api.aiListStrategies();
    return extractData<any[]>(result, '获取策略列表失败') || [];
  },

  async setStrategy(strategyId: string): Promise<boolean> {
    const result = await api.aiSetStrategy(strategyId);
    return extractSuccess(result, '切换策略失败');
  },

  async getIntentConfig(intent: string): Promise<any> {
    const result = await api.aiGetIntentConfig(intent);
    return extractData(result, '获取意图配置失败');
  },

  async chat(projectId: string, message: string, chapterId?: string): Promise<{ message: string; model: string } | null> {
    const result = await api.aiChat(projectId, message, chapterId);
    return extractData<{ message: string; model: string }>(result, 'AI 对话失败');
  },
};

export const storyBibleApi = {
  async get(projectId: string): Promise<StoryBible | null> {
    const result = await api.getStoryBible(projectId);
    return extractData<StoryBible>(result, '获取 Story Bible 失败');
  },

  async generate(projectId: string, seed?: string): Promise<StoryBible | null> {
    const result = await api.generateStoryBible(projectId, seed);
    return extractData<StoryBible>(result, '生成 Story Bible 失败');
  },

  async update(projectId: string, params: Partial<StoryBible>): Promise<StoryBible | null> {
    const result = await api.updateStoryBible(projectId, params);
    return extractData<StoryBible>(result, '更新 Story Bible 失败');
  },

  async confirm(projectId: string): Promise<StoryBible | null> {
    const result = await api.confirmStoryBible(projectId);
    return extractData<StoryBible>(result, '确认 Story Bible 失败');
  },
};

export const plotBoardApi = {
  async get(projectId: string): Promise<PlotBoardSnapshot | null> {
    const result = await api.getPlotBoard(projectId);
    return extractData<PlotBoardSnapshot>(result, '获取 Plot Board 失败');
  },

  async updateChapterGoal(projectId: string, chapterId: string, params: Partial<ChapterGoal>): Promise<PlotBoardSnapshot | null> {
    const result = await api.updatePlotBoardChapterGoal(projectId, chapterId, params);
    return extractData<PlotBoardSnapshot>(result, '更新 Plot Board 章节目标失败');
  },
};

export const loreMemoryApi = {
  async get(projectId: string): Promise<MemoryCard[]> {
    const result = await api.getLoreMemory(projectId);
    return extractData<MemoryCard[]>(result, '获取 Lore Memory 失败') || [];
  },

  async sync(projectId: string): Promise<MemoryCard[]> {
    const result = await api.syncLoreMemory(projectId);
    return extractData<MemoryCard[]>(result, '同步 Lore Memory 失败') || [];
  },
};

export const manuscriptApi = {
  async getReadiness(projectId: string): Promise<ManuscriptReadiness | null> {
    const result = await api.getManuscriptReadiness(projectId);
    return extractData<ManuscriptReadiness>(result, '获取 Manuscript Readiness 失败');
  },
};

export const retconApi = {
  async list(projectId: string): Promise<RetconDecision[]> {
    const result = await api.listRetcons(projectId);
    return extractData<RetconDecision[]>(result, '获取 Retcon 列表失败') || [];
  },

  async propose(
    projectId: string,
    params: {
      summary: string;
      reason?: string;
      affectedChapterIds?: string[];
      affectedCharacters?: string[];
    }
  ): Promise<RetconDecision | null> {
    const result = await api.proposeRetcon(projectId, params);
    return extractData<RetconDecision>(result, '创建 Retcon 提案失败');
  },

  async approve(
    projectId: string,
    retconId: string
  ): Promise<{ decision: RetconDecision; snapshotIds: string[] } | null> {
    const result = await api.approveRetcon(projectId, retconId);
    return extractData<{ decision: RetconDecision; snapshotIds: string[] }>(result, '批准 Retcon 失败');
  },

  async rollback(projectId: string, retconId: string): Promise<RetconDecision | null> {
    const result = await api.rollbackRetcon(projectId, retconId);
    return extractData<RetconDecision>(result, '回滚 Retcon 失败');
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
    return extractSuccess(result, '章节回滚失败');
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

// 检查API
export const checkApi = {
  async run(projectId: string): Promise<any> {
    const result = await api.runCheck(projectId);
    return extractData(result, '运行检查失败');
  },

  async getMissingChapters(projectId: string): Promise<any[]> {
    const result = await api.checkMissingChapters(projectId);
    return extractData<any[]>(result) || [];
  },

  async getTermConsistency(projectId: string): Promise<any[]> {
    const result = await api.checkTermConsistency(projectId);
    return extractData<any[]>(result) || [];
  },

  async getDuplicateContent(projectId: string): Promise<any[]> {
    const result = await api.checkDuplicateContent(projectId);
    return extractData<any[]>(result) || [];
  },

  async resolveIssue(projectId: string, issue: any): Promise<boolean> {
    const result = await api.resolveIssue(projectId, issue);
    return extractSuccess(result, '修复问题失败');
  },

  async ignoreIssue(projectId: string, issue: any): Promise<boolean> {
    const result = await api.ignoreIssue(projectId, issue);
    return extractSuccess(result, '忽略问题失败');
  },
};

// 导出API
export const exportApi = {
  async export(projectId: string, format: string): Promise<any> {
    const result = await api.exportProject(projectId, normalizeExportFormat(format));
    return extractData(result, '导出项目失败');
  },

  async exportChapters(projectId: string, chapterIds: string[], format: string): Promise<any> {
    const result = await api.exportChapters(projectId, chapterIds, normalizeExportFormat(format));
    return extractData(result, '导出章节失败');
  },

  async preview(projectId: string, format: string): Promise<string> {
    const result = await api.exportPreview(projectId, normalizeExportFormat(format));
    return extractData<string>(result) || '';
  },

  async history(projectId: string): Promise<any[]> {
    const result = await api.getExportHistory(projectId);
    const data = extractData<any>(result);
    if (Array.isArray(data)) return data;
    if (data?.recent && Array.isArray(data.recent)) return data.recent;
    return [];
  },

  async openDir(projectId?: string): Promise<boolean> {
    const result = await api.openExportDir(projectId);
    return extractSuccess(result, '打开导出目录失败');
  },
};

function normalizeExportFormat(format: string): string {
  if (format === 'markdown') {
    return 'md';
  }
  return format;
}
