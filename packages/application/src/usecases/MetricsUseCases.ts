import {
  ProjectMetrics,
  OperationType,
} from '@zide/domain';
import { MetricsPort } from '../ports';

// 统计用例
export class MetricsUseCases {
  constructor(private readonly metricsPort: MetricsPort) {}

  // 获取项目统计
  async getProjectMetrics(projectId: string): Promise<ProjectMetrics | null> {
    return this.metricsPort.getProjectMetrics(projectId);
  }

  // 获取全局统计
  async getGlobalMetrics(): Promise<ProjectMetrics[]> {
    return this.metricsPort.getGlobalMetrics();
  }

  // 记录操作日志
  async logOperation(
    projectId: string,
    operationType: OperationType,
    status: 'success' | 'failed' | 'pending',
    duration: number,
    metadata?: Record<string, unknown>,
    chapterId?: string,
    errorCode?: string,
    errorMessage?: string
  ): Promise<void> {
    await this.metricsPort.logOperation({
      projectId,
      chapterId,
      operationType,
      status,
      duration,
      errorCode,
      errorMessage,
      metadata,
    });
  }
}
