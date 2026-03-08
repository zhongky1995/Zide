import { ipcMain } from 'electron';
import { PlotBoardUseCase } from '@zide/application';
import { serviceContainer } from '../ServiceContainer';
import { ErrorCode } from './errors';
import { runIpc } from './response';

function createPlotBoardUseCase(): PlotBoardUseCase {
  return new PlotBoardUseCase(
    serviceContainer.chapterGoalRepo,
    serviceContainer.outlineRepo
  );
}

export function registerPlotBoardHandlers(): void {
  ipcMain.handle('plotBoard:get', async (_event, projectId: string) => {
    return runIpc(async () => {
      const useCase = createPlotBoardUseCase();
      return useCase.get(projectId);
    }, '获取 Plot Board 失败', ErrorCode.STORAGE_READ_FAILED, {
      channel: 'plotBoard:get',
      args: { projectId },
    });
  });

  ipcMain.handle('plotBoard:updateChapterGoal', async (_event, projectId: string, chapterId: string, params: Record<string, unknown>) => {
    return runIpc(async () => {
      const useCase = createPlotBoardUseCase();
      return useCase.updateChapterGoal(projectId, chapterId, params as any);
    }, '更新 Plot Board 章节目标失败', ErrorCode.STORAGE_WRITE_FAILED, {
      channel: 'plotBoard:updateChapterGoal',
      args: { projectId, chapterId, fields: Object.keys(params || {}) },
    });
  });
}
