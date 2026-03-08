import { ipcMain } from 'electron';
import { LoreMemoryUseCase, StoryBibleUseCase } from '@zide/application';
import { serviceContainer } from '../ServiceContainer';
import { ensureLLMReadyForAction, getCurrentLLMAdapter } from './ai';
import { ErrorCode } from './errors';
import { runIpc } from './response';

function createStoryBibleUseCase(withLLM = false): StoryBibleUseCase {
  return new StoryBibleUseCase(
    serviceContainer.storyBibleRepo,
    serviceContainer.projectRepo,
    withLLM ? getCurrentLLMAdapter() : undefined
  );
}

function createLoreMemoryUseCase(): LoreMemoryUseCase {
  return new LoreMemoryUseCase(
    serviceContainer.memoryCardRepo,
    serviceContainer.storyBibleRepo,
    serviceContainer.chapterGoalRepo,
    serviceContainer.chapterRepo
  );
}

export function registerStoryBibleHandlers(): void {
  ipcMain.handle('storyBible:get', async (_event, projectId: string) => {
    return runIpc(async () => {
      const useCase = createStoryBibleUseCase();
      return useCase.get(projectId);
    }, '获取 Story Bible 失败', ErrorCode.STORAGE_READ_FAILED, {
      channel: 'storyBible:get',
      args: { projectId },
    });
  });

  ipcMain.handle('storyBible:generate', async (_event, projectId: string, seed?: string) => {
    return runIpc(async () => {
      ensureLLMReadyForAction('storyBible:generate');
      const useCase = createStoryBibleUseCase(true);
      return useCase.generate(projectId, seed);
    }, '生成 Story Bible 失败', ErrorCode.AI_GENERATE_FAILED, {
      channel: 'storyBible:generate',
      args: { projectId },
    });
  });

  ipcMain.handle('storyBible:update', async (_event, projectId: string, params: Record<string, unknown>) => {
    return runIpc(async () => {
      const useCase = createStoryBibleUseCase();
      return useCase.update(projectId, params as any);
    }, '更新 Story Bible 失败', ErrorCode.STORAGE_WRITE_FAILED, {
      channel: 'storyBible:update',
      args: { projectId, fields: Object.keys(params || {}) },
    });
  });

  ipcMain.handle('storyBible:confirm', async (_event, projectId: string) => {
    return runIpc(async () => {
      const useCase = createStoryBibleUseCase();
      const storyBible = await useCase.confirm(projectId);
      const loreMemoryUseCase = createLoreMemoryUseCase();
      await loreMemoryUseCase.sync(projectId);
      return storyBible;
    }, '确认 Story Bible 失败', ErrorCode.STORAGE_WRITE_FAILED, {
      channel: 'storyBible:confirm',
      args: { projectId },
    });
  });
}
