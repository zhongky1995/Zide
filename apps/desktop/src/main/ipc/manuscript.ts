import { ipcMain } from 'electron';
import { ManuscriptUseCase } from '@zide/application';
import { serviceContainer } from '../ServiceContainer';
import { ErrorCode } from './errors';
import { runIpc } from './response';

function createManuscriptUseCase(): ManuscriptUseCase {
  return new ManuscriptUseCase(
    serviceContainer.chapterRepo,
    serviceContainer.continuityReportRepo,
    serviceContainer.storyBibleRepo
  );
}

export function registerManuscriptHandlers(): void {
  ipcMain.handle('manuscript:getReadiness', async (_event, projectId: string) => {
    return runIpc(async () => {
      const useCase = createManuscriptUseCase();
      return useCase.getReadiness(projectId);
    }, '获取成稿准备度失败', ErrorCode.STORAGE_READ_FAILED, {
      channel: 'manuscript:getReadiness',
      args: { projectId },
    });
  });
}
