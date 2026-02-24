import { ipcMain } from 'electron';
import * as path from 'path';
import { app } from 'electron';
import { FileChapterRepo, FileOutlineRepo } from '@zide/infrastructure';
import { ChapterWorkbenchUseCase } from '@zide/application';
import { ChapterStatus } from '@zide/domain';

// 获取运行时基础路径
function getRuntimeBasePath(): string {
  return path.join(app.getPath('userData'), 'projects');
}

// 创建仓储实例
function createChapterRepo(): FileChapterRepo {
  return new FileChapterRepo(getRuntimeBasePath());
}

// 注册章节相关的 IPC 处理函数
export function registerChapterHandlers(): void {
  // 获取项目所有章节
  ipcMain.handle('chapter:list', async (_event, projectId: string) => {
    try {
      const repo = createChapterRepo();
      const useCase = new ChapterWorkbenchUseCase(repo);
      const chapters = await useCase.getChapters(projectId);

      return { success: true, data: chapters };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '获取章节列表失败'
      };
    }
  });

  // 获取章节摘要列表（侧边栏用）
  ipcMain.handle('chapter:summaryList', async (_event, projectId: string) => {
    try {
      const repo = createChapterRepo();
      const useCase = new ChapterWorkbenchUseCase(repo);
      const chapters = await useCase.getChapterSummaryList(projectId);

      return { success: true, data: chapters };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '获取章节列表失败'
      };
    }
  });

  // 获取单个章节
  ipcMain.handle('chapter:get', async (_event, projectId: string, chapterId: string) => {
    try {
      const repo = createChapterRepo();
      const useCase = new ChapterWorkbenchUseCase(repo);
      const chapter = await useCase.getChapter(projectId, chapterId);

      if (!chapter) {
        return { success: false, error: '章节不存在' };
      }

      return { success: true, data: chapter };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '获取章节失败'
      };
    }
  });

  // 保存章节内容
  ipcMain.handle('chapter:save', async (_event, projectId: string, chapterId: string, content: string) => {
    try {
      const repo = createChapterRepo();
      const useCase = new ChapterWorkbenchUseCase(repo);
      const chapter = await useCase.updateContent(projectId, chapterId, content);

      return { success: true, data: chapter };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '保存章节失败'
      };
    }
  });

  // 更新章节状态
  ipcMain.handle('chapter:updateStatus', async (_event, projectId: string, chapterId: string, status: string) => {
    try {
      const repo = createChapterRepo();
      const useCase = new ChapterWorkbenchUseCase(repo);
      const chapter = await useCase.updateStatus(projectId, chapterId, status as ChapterStatus);

      return { success: true, data: chapter };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '更新章节状态失败'
      };
    }
  });

  // 更新章节元信息
  ipcMain.handle('chapter:updateMeta', async (_event, projectId: string, chapterId: string, params: {
    title?: string;
    target?: string;
  }) => {
    try {
      const repo = createChapterRepo();
      const useCase = new ChapterWorkbenchUseCase(repo);
      const chapter = await useCase.updateMeta(projectId, chapterId, params);

      return { success: true, data: chapter };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '更新章节失败'
      };
    }
  });

  // 更新完成度
  ipcMain.handle('chapter:updateCompletion', async (_event, projectId: string, chapterId: string, completion: number) => {
    try {
      const repo = createChapterRepo();
      const useCase = new ChapterWorkbenchUseCase(repo);
      const chapter = await useCase.updateCompletion(projectId, chapterId, completion);

      return { success: true, data: chapter };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '更新完成度失败'
      };
    }
  });

  // 获取下一章节编号
  ipcMain.handle('chapter:getNextNumber', async (_event, projectId: string) => {
    try {
      const repo = createChapterRepo();
      const useCase = new ChapterWorkbenchUseCase(repo);
      const number = await useCase.getNextNumber(projectId);

      return { success: true, data: number };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '获取章节编号失败'
      };
    }
  });
}
