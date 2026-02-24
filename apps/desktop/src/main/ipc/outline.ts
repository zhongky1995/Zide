import { ipcMain } from 'electron';
import * as path from 'path';
import { app } from 'electron';
import { FileProjectRepo, FileOutlineRepo } from '@zide/infrastructure';
import {
  GenerateOutlineUseCase,
  UpdateOutlineUseCase,
  ManageChapterUseCase,
} from '@zide/application';
import { OutlineTemplate } from '@zide/domain';

// 获取运行时基础路径
function getRuntimeBasePath(): string {
  return path.join(app.getPath('userData'), 'projects');
}

// 创建仓储实例
function createRepos() {
  const runtimeBasePath = getRuntimeBasePath();
  return {
    projectRepo: new FileProjectRepo(runtimeBasePath),
    outlineRepo: new FileOutlineRepo(runtimeBasePath),
  };
}

// 注册大纲相关的 IPC 处理函数
export function registerOutlineHandlers(): void {
  // 生成大纲
  ipcMain.handle('outline:generate', async (_event, params: {
    projectId: string;
    template?: string;
    chapterCount?: number;
    customChapters?: string[];
  }) => {
    try {
      const { projectRepo, outlineRepo } = createRepos();
      const useCase = new GenerateOutlineUseCase(outlineRepo, projectRepo);

      const outline = await useCase.execute({
        projectId: params.projectId,
        template: params.template as OutlineTemplate || OutlineTemplate.STANDARD,
        chapterCount: params.chapterCount,
        customChapters: params.customChapters,
      });

      return { success: true, data: outline };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '生成大纲失败'
      };
    }
  });

  // 获取大纲
  ipcMain.handle('outline:get', async (_event, projectId: string) => {
    try {
      const { outlineRepo } = createRepos();
      const useCase = new UpdateOutlineUseCase(outlineRepo);
      const outline = await useCase.getOutline(projectId);

      return { success: true, data: outline };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '获取大纲失败'
      };
    }
  });

  // 更新大纲
  ipcMain.handle('outline:update', async (_event, projectId: string, params: {
    status?: 'draft' | 'confirmed';
  }) => {
    try {
      const { outlineRepo } = createRepos();
      const useCase = new UpdateOutlineUseCase(outlineRepo);
      const outline = await useCase.execute(projectId, params);

      return { success: true, data: outline };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '更新大纲失败'
      };
    }
  });

  // 确认大纲
  ipcMain.handle('outline:confirm', async (_event, projectId: string) => {
    try {
      const { outlineRepo } = createRepos();
      const useCase = new UpdateOutlineUseCase(outlineRepo);
      const outline = await useCase.confirm(projectId);

      return { success: true, data: outline };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '确认大纲失败'
      };
    }
  });

  // 添加章节
  ipcMain.handle('outline:addChapter', async (_event, projectId: string, params: {
    title: string;
    target?: string;
  }) => {
    try {
      const { outlineRepo } = createRepos();
      const useCase = new ManageChapterUseCase(outlineRepo);
      const outline = await useCase.addChapter(projectId, params.title, params.target);

      return { success: true, data: outline };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '添加章节失败'
      };
    }
  });

  // 更新章节
  ipcMain.handle('outline:updateChapter', async (_event, projectId: string, chapterId: string, params: {
    title?: string;
    target?: string;
    status?: 'pending' | 'draft' | 'completed';
  }) => {
    try {
      const { outlineRepo } = createRepos();
      const useCase = new ManageChapterUseCase(outlineRepo);
      const outline = await useCase.updateChapter(projectId, chapterId, params);

      return { success: true, data: outline };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '更新章节失败'
      };
    }
  });

  // 删除章节
  ipcMain.handle('outline:deleteChapter', async (_event, projectId: string, chapterId: string) => {
    try {
      const { outlineRepo } = createRepos();
      const useCase = new ManageChapterUseCase(outlineRepo);
      const outline = await useCase.deleteChapter(projectId, chapterId);

      return { success: true, data: outline };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '删除章节失败'
      };
    }
  });

  // 排序章节
  ipcMain.handle('outline:reorderChapters', async (_event, projectId: string, chapterIds: string[]) => {
    try {
      const { outlineRepo } = createRepos();
      const useCase = new ManageChapterUseCase(outlineRepo);
      const outline = await useCase.reorderChapters(projectId, chapterIds);

      return { success: true, data: outline };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '排序章节失败'
      };
    }
  });
}
