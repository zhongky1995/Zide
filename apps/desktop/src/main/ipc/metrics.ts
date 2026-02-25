import { ipcMain } from 'electron';
import { FileMetricsAdapter } from '@zide/infrastructure';
import { MetricsUseCases } from '@zide/application';
import { OperationType } from '@zide/domain';
import { getRuntimeBasePath } from '../runtimePaths';
import { ErrorCode } from './errors';
import { runIpc } from './response';

// 创建用例实例
function createMetricsUseCase(): MetricsUseCases {
  const metricsAdapter = new FileMetricsAdapter(getRuntimeBasePath());
  return new MetricsUseCases(metricsAdapter);
}

// 注册统计相关的 IPC 处理函数
export function registerMetricsHandlers(): void {
  // 获取项目统计
  ipcMain.handle('metrics:project', async (_event, projectId: string) => {
    return runIpc(async () => {
      const useCase = createMetricsUseCase();
      return useCase.getProjectMetrics(projectId);
    }, '获取统计失败', ErrorCode.METRICS_READ_FAILED, {
      channel: 'metrics:project',
      args: { projectId },
    });
  });

  // 获取全局统计
  ipcMain.handle('metrics:global', async () => {
    return runIpc(async () => {
      const useCase = createMetricsUseCase();
      return useCase.getGlobalMetrics();
    }, '获取统计失败', ErrorCode.METRICS_READ_FAILED, {
      channel: 'metrics:global',
    });
  });

  // 记录操作日志
  ipcMain.handle('metrics:log', async (_event, params: {
    projectId: string;
    operationType: string;
    status: 'success' | 'failed' | 'pending';
    duration: number;
    metadata?: Record<string, unknown>;
    chapterId?: string;
    errorCode?: string;
    errorMessage?: string;
  }) => {
    return runIpc(async () => {
      const useCase = createMetricsUseCase();
      await useCase.logOperation(
        params.projectId,
        params.operationType as OperationType,
        params.status,
        params.duration,
        params.metadata,
        params.chapterId,
        params.errorCode,
        params.errorMessage
      );
      return { logged: true };
    }, '记录日志失败', ErrorCode.METRICS_WRITE_FAILED, {
      channel: 'metrics:log',
      args: {
        projectId: params.projectId,
        operationType: params.operationType,
        status: params.status,
      },
    });
  });
}
