import { ipcMain } from 'electron';
import * as path from 'path';
import { app } from 'electron';
import { MetricsUseCases } from '@zide/application';
import { OperationType } from '@zide/domain';

// 获取运行时基础路径
function getRuntimeBasePath(): string {
  return path.join(app.getPath('userData'), 'projects');
}

// 创建用例实例
function createMetricsUseCase(): MetricsUseCases {
  return new MetricsUseCases(getRuntimeBasePath());
}

// 注册统计相关的 IPC 处理函数
export function registerMetricsHandlers(): void {
  // 获取项目统计
  ipcMain.handle('metrics:project', async (_event, projectId: string) => {
    try {
      const useCase = createMetricsUseCase();
      const metrics = await useCase.getProjectMetrics(projectId);
      return { success: true, data: metrics };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '获取统计失败'
      };
    }
  });

  // 获取全局统计
  ipcMain.handle('metrics:global', async () => {
    try {
      const useCase = createMetricsUseCase();
      const metrics = await useCase.getGlobalMetrics();
      return { success: true, data: metrics };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '获取统计失败'
      };
    }
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
    try {
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
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '记录日志失败'
      };
    }
  });
}
