import { contextBridge, ipcRenderer } from 'electron';

// 预加载脚本 - 安全桥接层
// 暴露给渲染进程的 API 白名单

const api = {
  // 项目操作
  createProject: (config: { name: string; type: string; readers: string; scale: string }) =>
    ipcRenderer.invoke('project:create', config),
  getProjects: () => ipcRenderer.invoke('project:list'),
  getProject: (id: string) => ipcRenderer.invoke('project:get', id),

  // 章节操作
  getChapters: (projectId: string) => ipcRenderer.invoke('chapter:list', projectId),
  getChapter: (chapterId: string) => ipcRenderer.invoke('chapter:get', chapterId),
  saveChapter: (chapterId: string, content: string) =>
    ipcRenderer.invoke('chapter:save', chapterId, content),

  // AI 操作
  generateContent: (chapterId: string, intent: string) =>
    ipcRenderer.invoke('ai:generate', chapterId, intent),

  // 导出操作
  exportProject: (projectId: string, format: 'md' | 'html' | 'pdf') =>
    ipcRenderer.invoke('export:project', projectId, format),

  // 快照操作
  createSnapshot: (projectId: string, type: 'chapter' | 'global') =>
    ipcRenderer.invoke('snapshot:create', projectId, type),
  rollbackSnapshot: (snapshotId: string) =>
    ipcRenderer.invoke('snapshot:rollback', snapshotId),

  // 检查操作
  runCheck: (projectId: string) => ipcRenderer.invoke('check:run', projectId),
};

contextBridge.exposeInMainWorld('zide', api);

// 类型声明
export type ZideAPI = typeof api;
