import { ipcMain } from 'electron';
import * as path from 'path';
import { app } from 'electron';
import { SimpleIndexAdapter } from '@zide/infrastructure';
import { ContextUseCases, ProjectMetaReader } from '@zide/application';

// 获取运行时基础路径
function getRuntimeBasePath(): string {
  return path.join(app.getPath('userData'), 'projects');
}

// 创建用例实例
function createContextUseCases(): ContextUseCases {
  const runtimeBasePath = getRuntimeBasePath();
  const indexAdapter = new SimpleIndexAdapter(runtimeBasePath);
  return new ContextUseCases(runtimeBasePath, indexAdapter);
}

function createMetaReader(): ProjectMetaReader {
  return new ProjectMetaReader(getRuntimeBasePath());
}

// 注册上下文相关的 IPC 处理函数
export function registerContextHandlers(): void {
  // 打包上下文（用于 AI 生成）
  ipcMain.handle('context:pack', async (_event, projectId: string, chapterId: string) => {
    try {
      const useCase = createContextUseCases();
      const context = await useCase.packContext(projectId, chapterId);
      return { success: true, data: context };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '打包上下文失败'
      };
    }
  });

  // 检索相关上下文
  ipcMain.handle('context:retrieve', async (_event, projectId: string, chapterId: string, query: string, limit?: number) => {
    try {
      const useCase = createContextUseCases();
      const chunks = await useCase.retrieve(projectId, chapterId, query, limit);
      return { success: true, data: chunks };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '检索上下文失败'
      };
    }
  });

  // 索引章节
  ipcMain.handle('context:indexChapter', async (_event, projectId: string, chapterId: string, content: string) => {
    try {
      const useCase = createContextUseCases();
      await useCase.indexChapter(projectId, chapterId, content);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '索引章节失败'
      };
    }
  });

  // 重建索引
  ipcMain.handle('context:rebuildIndex', async (_event, projectId: string) => {
    try {
      const useCase = createContextUseCases();
      await useCase.rebuildIndex(projectId);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '重建索引失败'
      };
    }
  });

  // 获取索引统计
  ipcMain.handle('context:getStats', async (_event, projectId: string) => {
    try {
      const useCase = createContextUseCases();
      const stats = await useCase.getIndexStats(projectId);
      return { success: true, data: stats };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '获取索引统计失败'
      };
    }
  });

  // 获取项目上下文（元信息）
  ipcMain.handle('context:getProjectContext', async (_event, projectId: string) => {
    try {
      const reader = createMetaReader();
      const [projectContext, glossary, outline] = await Promise.all([
        reader.getProjectContext(projectId),
        reader.getGlossary(projectId),
        reader.getOutline(projectId),
      ]);
      return { success: true, data: { projectContext, glossary, outline } };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '获取项目上下文失败'
      };
    }
  });

  // 清理索引
  ipcMain.handle('context:clearIndex', async (_event, projectId: string) => {
    try {
      const useCase = createContextUseCases();
      await useCase.clearIndex(projectId);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '清理索引失败'
      };
    }
  });
}
