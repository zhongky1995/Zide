import { ipcMain } from 'electron';
import { SimpleIndexAdapter, FileProjectRepo } from '@zide/infrastructure';
import { ContextUseCases, ProjectMetaReader } from '@zide/application';
import { getRuntimeBasePath } from '../runtimePaths';
import { ErrorCode } from './errors';
import { runIpc } from './response';

// 创建用例实例
function createContextUseCases(): ContextUseCases {
  const runtimeBasePath = getRuntimeBasePath();
  const projectRepo = new FileProjectRepo(runtimeBasePath);
  const indexAdapter = new SimpleIndexAdapter(runtimeBasePath);
  return new ContextUseCases(projectRepo, indexAdapter as any);
}

function createMetaReader(): ProjectMetaReader {
  const runtimeBasePath = getRuntimeBasePath();
  const projectRepo = new FileProjectRepo(runtimeBasePath);
  return new ProjectMetaReader(projectRepo);
}

// 注册上下文相关的 IPC 处理函数
export function registerContextHandlers(): void {
  // 打包上下文（用于 AI 生成）
  ipcMain.handle('context:pack', async (_event, projectId: string, chapterId: string) => {
    return runIpc(async () => {
      const useCase = createContextUseCases();
      return useCase.packContext(projectId, chapterId);
    }, '打包上下文失败', ErrorCode.STORAGE_READ_FAILED, {
      channel: 'context:pack',
      args: { projectId, chapterId },
    });
  });

  // 检索相关上下文
  ipcMain.handle('context:retrieve', async (_event, projectId: string, chapterId: string, query: string, limit?: number) => {
    return runIpc(async () => {
      const useCase = createContextUseCases();
      return useCase.retrieve(projectId, chapterId, query, limit);
    }, '检索上下文失败', ErrorCode.STORAGE_READ_FAILED, {
      channel: 'context:retrieve',
      args: { projectId, chapterId, query, limit },
    });
  });

  // 索引章节
  ipcMain.handle('context:indexChapter', async (_event, projectId: string, chapterId: string, content: string) => {
    return runIpc(async () => {
      const useCase = createContextUseCases();
      await useCase.indexChapter(projectId, chapterId, content);
      return { indexed: true };
    }, '索引章节失败', ErrorCode.STORAGE_WRITE_FAILED, {
      channel: 'context:indexChapter',
      args: { projectId, chapterId, contentLength: content?.length || 0 },
    });
  });

  // 重建索引
  ipcMain.handle('context:rebuildIndex', async (_event, projectId: string) => {
    return runIpc(async () => {
      const useCase = createContextUseCases();
      await useCase.rebuildIndex(projectId);
      return { rebuilt: true };
    }, '重建索引失败', ErrorCode.STORAGE_WRITE_FAILED, {
      channel: 'context:rebuildIndex',
      args: { projectId },
    });
  });

  // 获取索引统计
  ipcMain.handle('context:getStats', async (_event, projectId: string) => {
    return runIpc(async () => {
      const useCase = createContextUseCases();
      return useCase.getIndexStats(projectId);
    }, '获取索引统计失败', ErrorCode.STORAGE_READ_FAILED, {
      channel: 'context:getStats',
      args: { projectId },
    });
  });

  // 获取项目上下文（元信息）
  ipcMain.handle('context:getProjectContext', async (_event, projectId: string) => {
    return runIpc(async () => {
      const reader = createMetaReader();
      const [projectContext, glossary, outline] = await Promise.all([
        reader.getProjectContext(projectId),
        reader.getGlossary(projectId),
        reader.getOutline(projectId),
      ]);
      return { projectContext, glossary, outline };
    }, '获取项目上下文失败', ErrorCode.STORAGE_READ_FAILED, {
      channel: 'context:getProjectContext',
      args: { projectId },
    });
  });

  // 清理索引
  ipcMain.handle('context:clearIndex', async (_event, projectId: string) => {
    return runIpc(async () => {
      const useCase = createContextUseCases();
      await useCase.clearIndex(projectId);
      return { cleared: true };
    }, '清理索引失败', ErrorCode.STORAGE_WRITE_FAILED, {
      channel: 'context:clearIndex',
      args: { projectId },
    });
  });
}
