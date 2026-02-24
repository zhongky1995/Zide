import { ipcMain } from 'electron';
import * as path from 'path';
import { app } from 'electron';
import { FileProjectRepo } from '@zide/infrastructure';
import { CreateProjectUseCase } from '@zide/application';
import { Project, ProjectType } from '@zide/domain';

// 获取运行时基础路径
function getRuntimeBasePath(): string {
  return path.join(app.getPath('userData'), 'projects');
}

// 创建项目仓储实例
function createProjectRepo(): FileProjectRepo {
  return new FileProjectRepo(getRuntimeBasePath());
}

// 注册项目相关的 IPC 处理函数
export function registerProjectHandlers(): void {
  // 创建项目
  ipcMain.handle('project:create', async (_event, config: {
    name: string;
    type: string;
    readers?: string;
    scale?: string;
    description?: string;
  }) => {
    try {
      const repo = createProjectRepo();
      const useCase = new CreateProjectUseCase(repo);

      const params = {
        name: config.name,
        type: config.type as ProjectType || ProjectType.OTHER,
        targetReaders: config.readers,
        targetScale: config.scale,
        description: config.description,
      };

      const project = await useCase.execute(params);
      return { success: true, data: project };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '创建项目失败'
      };
    }
  });

  // 获取项目列表
  ipcMain.handle('project:list', async () => {
    try {
      const repo = createProjectRepo();
      const projects = await repo.findAll();
      return { success: true, data: projects };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '获取项目列表失败'
      };
    }
  });

  // 获取单个项目
  ipcMain.handle('project:get', async (_event, projectId: string) => {
    try {
      const repo = createProjectRepo();
      const project = await repo.findById(projectId);

      if (!project) {
        return { success: false, error: '项目不存在' };
      }

      return { success: true, data: project };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '获取项目失败'
      };
    }
  });

  // 更新项目
  ipcMain.handle('project:update', async (_event, projectId: string, params: Partial<{
    name: string;
    description: string;
    targetReaders: string;
    targetScale: string;
    status: string;
  }>) => {
    try {
      const repo = createProjectRepo();
      const project = await repo.update(projectId, params as any);
      return { success: true, data: project };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '更新项目失败'
      };
    }
  });

  // 删除项目
  ipcMain.handle('project:delete', async (_event, projectId: string) => {
    try {
      const repo = createProjectRepo();
      await repo.delete(projectId);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '删除项目失败'
      };
    }
  });
}
