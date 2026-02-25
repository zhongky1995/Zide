import { ipcMain } from 'electron';
import { FileProjectRepo, MockLLMAdapter, RealLLMAdapter } from '@zide/infrastructure';
import { CreateProjectUseCase } from '@zide/application';
import { ProjectType, WritingTone } from '@zide/domain';
import { getCurrentLLMAdapter, ensureLLMReadyForAction } from './ai';
import { getRuntimeBasePath } from '../runtimePaths';
import { ErrorCode } from './errors';
import { runIpc } from './response';

// 创建项目仓储实例
function createProjectRepo(): FileProjectRepo {
  return new FileProjectRepo(getRuntimeBasePath());
}

function createIpcError(message: string, code: ErrorCode, details?: Record<string, unknown>): Error {
  const error = new Error(message) as Error & {
    code?: ErrorCode;
    details?: Record<string, unknown>;
  };
  error.code = code;
  error.details = details;
  return error;
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
    idea?: string;
  }) => {
    return runIpc(async () => {
      const repo = createProjectRepo();
      const useCase = new CreateProjectUseCase(repo);
      let generatedMeta: {
        background: string;
        objectives: string;
        constraints: string;
        styleGuide: string;
      } | null = null;
      let generatedWritingTone: WritingTone | undefined;
      let generatedTargetAudience: string | undefined;

      // 如果有想法，先尝试 AI 生成全局设定；失败时明确报错，不再静默吞掉
      if (config.idea?.trim()) {
        ensureLLMReadyForAction('project:create-settings');

        const llmAdapter = getCurrentLLMAdapter();
        if (llmAdapter instanceof MockLLMAdapter) {
          throw createIpcError(
            '当前为模拟模型，无法生成项目全局设定。请先在设置中配置真实 AI 模型。',
            ErrorCode.AI_CONFIG_INVALID,
            { action: 'project:create-settings' }
          );
        }

        if (llmAdapter instanceof RealLLMAdapter) {
          const current = llmAdapter.getConfig();
          if (!current.apiKey?.trim()) {
            throw createIpcError(
              '未配置 API Key，无法生成项目全局设定。请先在设置中完成模型配置。',
              ErrorCode.AI_CONFIG_INVALID,
              { action: 'project:create-settings', provider: current.provider }
            );
          }
        }

        const { GenerateSettingsUseCase } = await import('@zide/application');
        const settingsUseCase = new GenerateSettingsUseCase(llmAdapter);
        const settings = await settingsUseCase
          .generate({
            name: config.name,
            type: config.type,
            idea: config.idea,
            targetReaders: config.readers,
            targetScale: config.scale,
          })
          .catch((error: unknown) => {
            throw createIpcError(
              `AI 生成项目全局设定失败：${(error as Error).message}`,
              ErrorCode.AI_GENERATE_FAILED,
              { action: 'project:create-settings' }
            );
          });

        generatedMeta = {
          background: settings.background,
          objectives: settings.objectives,
          constraints: settings.constraints,
          styleGuide: settings.style,
        };
        generatedWritingTone = settings.writingTone as WritingTone | undefined;
        generatedTargetAudience = settings.targetAudience;
      }

      const params = {
        name: config.name,
        type: config.type as ProjectType || ProjectType.OTHER,
        targetReaders: config.readers,
        targetScale: config.scale,
        description: config.description,
      };

      const project = await useCase.execute(params);

      if (generatedMeta) {
        await repo.update(project.id, {
          meta: generatedMeta,
          writingTone: generatedWritingTone,
          targetAudience: generatedTargetAudience,
        });
      }

      const latestProject = await repo.findById(project.id);
      if (!latestProject) {
        throw createIpcError('项目创建成功但读取失败', ErrorCode.PROJECT_CREATE_FAILED, { projectId: project.id });
      }

      return latestProject;
    }, '创建项目失败', ErrorCode.PROJECT_CREATE_FAILED, {
      channel: 'project:create',
      args: { name: config.name, type: config.type },
    });
  });

  // 获取项目列表
  ipcMain.handle('project:list', async () => {
    return runIpc(async () => {
      const repo = createProjectRepo();
      return repo.findAll();
    }, '获取项目列表失败', ErrorCode.UNKNOWN, {
      channel: 'project:list',
    });
  });

  // 获取单个项目
  ipcMain.handle('project:get', async (_event, projectId: string) => {
    return runIpc(async () => {
      const repo = createProjectRepo();
      const project = await repo.findById(projectId);

      if (!project) {
        throw new Error('项目不存在');
      }

      return project;
    }, '获取项目失败', ErrorCode.PROJECT_NOT_FOUND, {
      channel: 'project:get',
      args: { projectId },
    });
  });

  // 更新项目
  ipcMain.handle('project:update', async (_event, projectId: string, params: Partial<{
    name: string;
    description: string;
    targetReaders: string;
    targetScale: string;
    status: string;
  }>) => {
    return runIpc(async () => {
      const repo = createProjectRepo();
      return repo.update(projectId, params as any);
    }, '更新项目失败', ErrorCode.PROJECT_UPDATE_FAILED, {
      channel: 'project:update',
      args: { projectId, fields: Object.keys(params || {}) },
    });
  });

  // 删除项目
  ipcMain.handle('project:delete', async (_event, projectId: string) => {
    return runIpc(async () => {
      const repo = createProjectRepo();
      await repo.delete(projectId);
      return { deleted: true };
    }, '删除项目失败', ErrorCode.PROJECT_DELETE_FAILED, {
      channel: 'project:delete',
      args: { projectId },
    });
  });
}
