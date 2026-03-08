import { ipcMain } from 'electron';
import { MetricsUseCases, RetconFlowUseCase, SnapshotUseCases } from '@zide/application';
import { OperationType } from '@zide/domain';
import { FileMetricsAdapter } from '@zide/infrastructure';
import { serviceContainer } from '../ServiceContainer';
import { ErrorCode } from './errors';
import { runIpc } from './response';
import { getRuntimeBasePath } from '../runtimePaths';

function createSnapshotUseCases(): SnapshotUseCases {
  return new SnapshotUseCases(serviceContainer.snapshotRepo);
}

function createRetconFlowUseCase(): RetconFlowUseCase {
  return new RetconFlowUseCase(
    serviceContainer.retconDecisionRepo,
    serviceContainer.chapterRepo,
    serviceContainer.memoryCardRepo,
    createSnapshotUseCases()
  );
}

function createMetricsUseCase(): MetricsUseCases {
  return new MetricsUseCases(new FileMetricsAdapter(getRuntimeBasePath()));
}

export function registerRetconHandlers(): void {
  ipcMain.handle('retcon:list', async (_event, projectId: string) => {
    return runIpc(async () => {
      const useCase = createRetconFlowUseCase();
      return useCase.list(projectId);
    }, '获取 Retcon 列表失败', ErrorCode.STORAGE_READ_FAILED, {
      channel: 'retcon:list',
      args: { projectId },
    });
  });

  ipcMain.handle('retcon:propose', async (_event, projectId: string, params: Record<string, unknown>) => {
    return runIpc(async () => {
      const useCase = createRetconFlowUseCase();
      const decision = await useCase.propose(projectId, {
        summary: typeof params.summary === 'string' ? params.summary : '',
        reason: typeof params.reason === 'string' ? params.reason : undefined,
        affectedChapterIds: Array.isArray(params.affectedChapterIds) ? params.affectedChapterIds.filter((item): item is string => typeof item === 'string') : [],
        affectedCharacters: Array.isArray(params.affectedCharacters) ? params.affectedCharacters.filter((item): item is string => typeof item === 'string') : [],
      });

      console.log('[Retcon] 已创建 retcon 提案', {
        projectId,
        retconId: decision.retconId,
        affectedRefs: decision.affectedRefs.length,
      });

      return decision;
    }, '创建 Retcon 提案失败', ErrorCode.STORAGE_WRITE_FAILED, {
      channel: 'retcon:propose',
      args: { projectId },
    });
  });

  ipcMain.handle('retcon:approve', async (_event, projectId: string, retconId: string) => {
    return runIpc(async () => {
      const startedAtMs = Date.now();
      const useCase = createRetconFlowUseCase();
      const result = await useCase.approve(projectId, retconId);

      console.log('[Retcon] 已批准 retcon', {
        projectId,
        retconId,
        snapshotIds: result.snapshotIds,
      });

      const metricsUseCase = createMetricsUseCase();
      await metricsUseCase.logOperation(
        projectId,
        OperationType.RETCON_APPLY,
        'success',
        Date.now() - startedAtMs,
        {
          retconId,
          affectedRefs: result.decision.affectedRefs.length,
          snapshotCount: result.snapshotIds.length,
        }
      );

      return result;
    }, '批准 Retcon 失败', ErrorCode.STORAGE_WRITE_FAILED, {
      channel: 'retcon:approve',
      args: { projectId, retconId },
    });
  });

  ipcMain.handle('retcon:rollback', async (_event, projectId: string, retconId: string) => {
    return runIpc(async () => {
      const startedAtMs = Date.now();
      const useCase = createRetconFlowUseCase();
      const decision = await useCase.rollback(projectId, retconId);

      console.log('[Retcon] 已回滚 retcon', {
        projectId,
        retconId,
      });

      const metricsUseCase = createMetricsUseCase();
      await metricsUseCase.logOperation(
        projectId,
        OperationType.RETCON_ROLLBACK,
        'success',
        Date.now() - startedAtMs,
        {
          retconId,
          affectedRefs: decision.affectedRefs.length,
        }
      );

      return decision;
    }, '回滚 Retcon 失败', ErrorCode.STORAGE_WRITE_FAILED, {
      channel: 'retcon:rollback',
      args: { projectId, retconId },
    });
  });
}
