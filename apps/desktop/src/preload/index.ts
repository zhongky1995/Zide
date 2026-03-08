import { contextBridge, ipcRenderer } from 'electron';

// 预加载脚本 - 安全桥接层
// 暴露给渲染进程的 API 白名单

const api = {
  // ========== 项目操作 ==========
  createProject: (config: { name: string; type: string; readers?: string; scale?: string; description?: string; idea?: string }) =>
    ipcRenderer.invoke('project:create', config),
  getProjects: () => ipcRenderer.invoke('project:list'),
  getProject: (id: string) => ipcRenderer.invoke('project:get', id),
  updateProject: (id: string, params: any) => ipcRenderer.invoke('project:update', id, params),
  deleteProject: (id: string) => ipcRenderer.invoke('project:delete', id),

  // ========== 大纲操作 ==========
  generateOutline: (params: { projectId: string; template?: string; chapterCount?: number; customChapters?: string[] }) =>
    ipcRenderer.invoke('outline:generate', params),
  getOutline: (projectId: string) => ipcRenderer.invoke('outline:get', projectId),
  updateOutline: (projectId: string, params: { status?: 'draft' | 'confirmed' }) =>
    ipcRenderer.invoke('outline:update', projectId, params),
  confirmOutline: (projectId: string) => ipcRenderer.invoke('outline:confirm', projectId),
  addChapter: (projectId: string, params: { title: string; target?: string }) =>
    ipcRenderer.invoke('outline:addChapter', projectId, params),
  updateChapter: (projectId: string, chapterId: string, params: any) =>
    ipcRenderer.invoke('outline:updateChapter', projectId, chapterId, params),
  deleteChapter: (projectId: string, chapterId: string) =>
    ipcRenderer.invoke('outline:deleteChapter', projectId, chapterId),
  reorderChapters: (projectId: string, chapterIds: string[]) =>
    ipcRenderer.invoke('outline:reorderChapters', projectId, chapterIds),

  // ========== 章节操作 ==========
  getChapters: (projectId: string) => ipcRenderer.invoke('chapter:list', projectId),
  getChapterSummaryList: (projectId: string) => ipcRenderer.invoke('chapter:summaryList', projectId),
  getChapter: (projectId: string, chapterId: string) => ipcRenderer.invoke('chapter:get', projectId, chapterId),
  saveChapter: (projectId: string, chapterId: string, content: string) =>
    ipcRenderer.invoke('chapter:save', projectId, chapterId, content),
  updateChapterStatus: (projectId: string, chapterId: string, status: string) =>
    ipcRenderer.invoke('chapter:updateStatus', projectId, chapterId, status),
  updateChapterMeta: (projectId: string, chapterId: string, params: { title?: string; target?: string }) =>
    ipcRenderer.invoke('chapter:updateMeta', projectId, chapterId, params),
  updateChapterCompletion: (projectId: string, chapterId: string, completion: number) =>
    ipcRenderer.invoke('chapter:updateCompletion', projectId, chapterId, completion),
  getNextChapterNumber: (projectId: string) => ipcRenderer.invoke('chapter:getNextNumber', projectId),

  // ========== AI 操作 ==========
  aiGenerate: (projectId: string, chapterId: string, intent: string, customPrompt?: string) =>
    ipcRenderer.invoke('ai:generate', projectId, chapterId, intent, customPrompt),
  runTask: (task: any) => ipcRenderer.invoke('ai:task', task),
  listCandidateDrafts: (projectId: string, chapterId: string) =>
    ipcRenderer.invoke('ai:listCandidateDrafts', projectId, chapterId),
  adoptCandidateDraft: (projectId: string, chapterId: string, draftId: string, force?: boolean) =>
    ipcRenderer.invoke('ai:adoptCandidateDraft', projectId, chapterId, draftId, force),
  rejectCandidateDraft: (projectId: string, chapterId: string, draftId: string) =>
    ipcRenderer.invoke('ai:rejectCandidateDraft', projectId, chapterId, draftId),
  listContinuityReports: (projectId: string, chapterId: string) =>
    ipcRenderer.invoke('continuity:listByChapter', projectId, chapterId),
  getContinuityReport: (projectId: string, chapterId: string, draftId: string) =>
    ipcRenderer.invoke('continuity:getByDraft', projectId, chapterId, draftId),
  regenerateContinuityReport: (projectId: string, chapterId: string, draftId: string) =>
    ipcRenderer.invoke('continuity:regenerate', projectId, chapterId, draftId),
  aiContinue: (projectId: string, chapterId: string) =>
    ipcRenderer.invoke('ai:continue', projectId, chapterId),
  aiExpand: (projectId: string, chapterId: string) =>
    ipcRenderer.invoke('ai:expand', projectId, chapterId),
  aiRewrite: (projectId: string, chapterId: string) =>
    ipcRenderer.invoke('ai:rewrite', projectId, chapterId),
  aiAddArgument: (projectId: string, chapterId: string) =>
    ipcRenderer.invoke('ai:addArgument', projectId, chapterId),
  aiPolish: (projectId: string, chapterId: string) =>
    ipcRenderer.invoke('ai:polish', projectId, chapterId),
  aiSimplify: (projectId: string, chapterId: string) =>
    ipcRenderer.invoke('ai:simplify', projectId, chapterId),
  getOperationHistory: (projectId: string, chapterId: string) =>
    ipcRenderer.invoke('ai:getOperationHistory', projectId, chapterId),
  adoptOperation: (projectId: string, chapterId: string, operationId: string) =>
    ipcRenderer.invoke('ai:adoptOperation', projectId, chapterId, operationId),
  aiPing: () => ipcRenderer.invoke('ai:ping'),
  aiGetConfig: () => ipcRenderer.invoke('ai:getConfig'),
  aiUpdateConfig: (config: any) => ipcRenderer.invoke('ai:updateConfig', config),
  aiSwitchAdapter: (useReal: boolean) => ipcRenderer.invoke('ai:switchAdapter', useReal),
  aiGetStrategy: () => ipcRenderer.invoke('ai:getStrategy'),
  aiListStrategies: () => ipcRenderer.invoke('ai:listStrategies'),
  aiSetStrategy: (strategyId: string) => ipcRenderer.invoke('ai:setStrategy', strategyId),
  aiGetIntentConfig: (intent: string) => ipcRenderer.invoke('ai:getIntentConfig', intent),
  aiChat: (projectId: string, message: string, chapterId?: string) =>
    ipcRenderer.invoke('ai:chat', projectId, message, chapterId),

  // ========== 小说 Story Bible / Plot Board ==========
  getStoryBible: (projectId: string) => ipcRenderer.invoke('storyBible:get', projectId),
  generateStoryBible: (projectId: string, seed?: string) => ipcRenderer.invoke('storyBible:generate', projectId, seed),
  updateStoryBible: (projectId: string, params: any) => ipcRenderer.invoke('storyBible:update', projectId, params),
  confirmStoryBible: (projectId: string) => ipcRenderer.invoke('storyBible:confirm', projectId),
  getPlotBoard: (projectId: string) => ipcRenderer.invoke('plotBoard:get', projectId),
  updatePlotBoardChapterGoal: (projectId: string, chapterId: string, params: any) =>
    ipcRenderer.invoke('plotBoard:updateChapterGoal', projectId, chapterId, params),
  getLoreMemory: (projectId: string) => ipcRenderer.invoke('loreMemory:get', projectId),
  syncLoreMemory: (projectId: string) => ipcRenderer.invoke('loreMemory:sync', projectId),
  getManuscriptReadiness: (projectId: string) => ipcRenderer.invoke('manuscript:getReadiness', projectId),
  listRetcons: (projectId: string) => ipcRenderer.invoke('retcon:list', projectId),
  proposeRetcon: (projectId: string, params: any) => ipcRenderer.invoke('retcon:propose', projectId, params),
  approveRetcon: (projectId: string, retconId: string) => ipcRenderer.invoke('retcon:approve', projectId, retconId),
  rollbackRetcon: (projectId: string, retconId: string) => ipcRenderer.invoke('retcon:rollback', projectId, retconId),

  // ========== 上下文操作 ==========
  packContext: (projectId: string, chapterId: string) =>
    ipcRenderer.invoke('context:pack', projectId, chapterId),
  retrieveContext: (projectId: string, chapterId: string, query: string, limit?: number) =>
    ipcRenderer.invoke('context:retrieve', projectId, chapterId, query, limit),
  indexChapter: (projectId: string, chapterId: string, content: string) =>
    ipcRenderer.invoke('context:indexChapter', projectId, chapterId, content),
  rebuildIndex: (projectId: string) => ipcRenderer.invoke('context:rebuildIndex', projectId),
  getIndexStats: (projectId: string) => ipcRenderer.invoke('context:getStats', projectId),
  getProjectContext: (projectId: string) => ipcRenderer.invoke('context:getProjectContext', projectId),
  clearIndex: (projectId: string) => ipcRenderer.invoke('context:clearIndex', projectId),

  // ========== 快照操作 ==========
  createChapterSnapshot: (projectId: string, chapterId: string, operationId?: string) =>
    ipcRenderer.invoke('snapshot:createChapter', projectId, chapterId, operationId),
  createGlobalSnapshot: (projectId: string, description?: string) =>
    ipcRenderer.invoke('snapshot:createGlobal', projectId, description),
  getSnapshots: (projectId: string) => ipcRenderer.invoke('snapshot:list', projectId),
  getSnapshot: (snapshotId: string) => ipcRenderer.invoke('snapshot:get', snapshotId),
  getLatestSnapshot: (projectId: string, type?: string) =>
    ipcRenderer.invoke('snapshot:getLatest', projectId, type),
  rollbackSnapshot: (snapshotId: string) => ipcRenderer.invoke('snapshot:rollback', snapshotId),
  rollbackChapter: (projectId: string, chapterId: string) =>
    ipcRenderer.invoke('snapshot:rollbackChapter', projectId, chapterId),
  deleteSnapshot: (snapshotId: string) => ipcRenderer.invoke('snapshot:delete', snapshotId),
  cleanupSnapshots: (projectId: string, keepCount?: number) =>
    ipcRenderer.invoke('snapshot:cleanup', projectId, keepCount),
  getSnapshotCount: (projectId: string) => ipcRenderer.invoke('snapshot:count', projectId),

  // ========== 检查操作 ==========
  runCheck: (projectId: string) => ipcRenderer.invoke('check:run', projectId),
  checkMissingChapters: (projectId: string) => ipcRenderer.invoke('check:missingChapters', projectId),
  checkTermConsistency: (projectId: string) => ipcRenderer.invoke('check:termConsistency', projectId),
  checkDuplicateContent: (projectId: string) => ipcRenderer.invoke('check:duplicateContent', projectId),
  checkCompletion: (projectId: string, threshold?: number) =>
    ipcRenderer.invoke('check:completion', projectId, threshold),
  checkOutlineDrift: (projectId: string) => ipcRenderer.invoke('check:outlineDrift', projectId),
  resolveIssue: (projectId: string, issue: any) => ipcRenderer.invoke('check:resolveIssue', projectId, issue),
  ignoreIssue: (projectId: string, issue: any) => ipcRenderer.invoke('check:ignoreIssue', projectId, issue),

  // ========== 导出操作 ==========
  exportProject: (projectId: string, format: string) =>
    ipcRenderer.invoke('export:project', projectId, format),
  exportChapters: (projectId: string, chapterIds: string[], format: string) =>
    ipcRenderer.invoke('export:chapters', projectId, chapterIds, format),
  exportPreview: (projectId: string, format: string) =>
    ipcRenderer.invoke('export:preview', projectId, format),
  getExportHistory: (projectId: string) => ipcRenderer.invoke('export:history', projectId),
  deleteExport: (filePath: string) => ipcRenderer.invoke('export:delete', filePath),
  openExportDir: (projectId?: string) => ipcRenderer.invoke('export:openDir', projectId),

  // ========== 统计操作 ==========
  getProjectMetrics: (projectId: string) => ipcRenderer.invoke('metrics:project', projectId),
  getGlobalMetrics: () => ipcRenderer.invoke('metrics:global'),
  logOperation: (params: any) => ipcRenderer.invoke('metrics:log', params),
};

contextBridge.exposeInMainWorld('zide', api);

// 类型声明
export type ZideAPI = typeof api;
