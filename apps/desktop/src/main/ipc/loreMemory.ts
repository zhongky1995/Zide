import { ipcMain } from 'electron';
import { LoreMemoryUseCase } from '@zide/application';
import { serviceContainer } from '../ServiceContainer';
import { ErrorCode } from './errors';
import { runIpc } from './response';

function createLoreMemoryUseCase(): LoreMemoryUseCase {
  return new LoreMemoryUseCase(
    serviceContainer.memoryCardRepo,
    serviceContainer.storyBibleRepo,
    serviceContainer.chapterGoalRepo,
    serviceContainer.chapterRepo
  );
}

export function registerLoreMemoryHandlers(): void {
  ipcMain.handle('loreMemory:get', async (_event, projectId: string) => {
    return runIpc(async () => {
      const useCase = createLoreMemoryUseCase();
      return useCase.get(projectId);
    }, '获取 Lore Memory 失败', ErrorCode.STORAGE_READ_FAILED, {
      channel: 'loreMemory:get',
      args: { projectId },
    });
  });

  ipcMain.handle('loreMemory:sync', async (_event, projectId: string) => {
    return runIpc(async () => {
      const useCase = createLoreMemoryUseCase();
      return useCase.sync(projectId);
    }, '同步 Lore Memory 失败', ErrorCode.STORAGE_WRITE_FAILED, {
      channel: 'loreMemory:sync',
      args: { projectId },
    });
  });
}
