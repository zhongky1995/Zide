import { ipcMain } from 'electron';
import { FileChapterRepo } from '@zide/infrastructure';
import { ChapterWorkbenchUseCase } from '@zide/application';
import { ChapterStatus } from '@zide/domain';
import { getRuntimeBasePath } from '../runtimePaths';
import { ErrorCode } from './errors';
import { runIpc } from './response';

// 创建仓储实例
function createChapterRepo(): FileChapterRepo {
  return new FileChapterRepo(getRuntimeBasePath());
}

// 注册章节相关的 IPC 处理函数
export function registerChapterHandlers(): void {
  // 获取项目所有章节
  ipcMain.handle('chapter:list', async (_event, projectId: string) => {
    return runIpc(async () => {
      const repo = createChapterRepo();
      const useCase = new ChapterWorkbenchUseCase(repo);
      return useCase.getChapters(projectId);
    }, '获取章节列表失败', ErrorCode.UNKNOWN, {
      channel: 'chapter:list',
      args: { projectId },
    });
  });

  // 获取章节摘要列表（侧边栏用）
  ipcMain.handle('chapter:summaryList', async (_event, projectId: string) => {
    return runIpc(async () => {
      const repo = createChapterRepo();
      const useCase = new ChapterWorkbenchUseCase(repo);
      return useCase.getChapterSummaryList(projectId);
    }, '获取章节列表失败', ErrorCode.UNKNOWN, {
      channel: 'chapter:summaryList',
      args: { projectId },
    });
  });

  // 获取单个章节
  ipcMain.handle('chapter:get', async (_event, projectId: string, chapterId: string) => {
    return runIpc(async () => {
      const repo = createChapterRepo();
      const useCase = new ChapterWorkbenchUseCase(repo);
      const chapter = await useCase.getChapter(projectId, chapterId);

      if (!chapter) {
        throw new Error('章节不存在');
      }

      return chapter;
    }, '获取章节失败', ErrorCode.CHAPTER_NOT_FOUND, {
      channel: 'chapter:get',
      args: { projectId, chapterId },
    });
  });

  // 保存章节内容
  ipcMain.handle('chapter:save', async (_event, projectId: string, chapterId: string, content: string) => {
    return runIpc(async () => {
      const repo = createChapterRepo();
      const useCase = new ChapterWorkbenchUseCase(repo);
      return useCase.updateContent(projectId, chapterId, content);
    }, '保存章节失败', ErrorCode.CHAPTER_SAVE_FAILED, {
      channel: 'chapter:save',
      args: { projectId, chapterId },
    });
  });

  // 更新章节状态
  ipcMain.handle('chapter:updateStatus', async (_event, projectId: string, chapterId: string, status: string) => {
    return runIpc(async () => {
      const repo = createChapterRepo();
      const useCase = new ChapterWorkbenchUseCase(repo);
      return useCase.updateStatus(projectId, chapterId, status as ChapterStatus);
    }, '更新章节状态失败', ErrorCode.CHAPTER_UPDATE_FAILED, {
      channel: 'chapter:updateStatus',
      args: { projectId, chapterId, status },
    });
  });

  // 更新章节元信息
  ipcMain.handle('chapter:updateMeta', async (_event, projectId: string, chapterId: string, params: {
    title?: string;
    target?: string;
  }) => {
    return runIpc(async () => {
      const repo = createChapterRepo();
      const useCase = new ChapterWorkbenchUseCase(repo);
      return useCase.updateMeta(projectId, chapterId, params);
    }, '更新章节失败', ErrorCode.CHAPTER_UPDATE_FAILED, {
      channel: 'chapter:updateMeta',
      args: { projectId, chapterId, fields: Object.keys(params || {}) },
    });
  });

  // 更新完成度
  ipcMain.handle('chapter:updateCompletion', async (_event, projectId: string, chapterId: string, completion: number) => {
    return runIpc(async () => {
      const repo = createChapterRepo();
      const useCase = new ChapterWorkbenchUseCase(repo);
      return useCase.updateCompletion(projectId, chapterId, completion);
    }, '更新完成度失败', ErrorCode.CHAPTER_UPDATE_FAILED, {
      channel: 'chapter:updateCompletion',
      args: { projectId, chapterId, completion },
    });
  });

  // 获取下一章节编号
  ipcMain.handle('chapter:getNextNumber', async (_event, projectId: string) => {
    return runIpc(async () => {
      const repo = createChapterRepo();
      const useCase = new ChapterWorkbenchUseCase(repo);
      return useCase.getNextNumber(projectId);
    }, '获取章节编号失败', ErrorCode.UNKNOWN, {
      channel: 'chapter:getNextNumber',
      args: { projectId },
    });
  });
}
