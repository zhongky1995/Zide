import { ProjectMetrics, OperationType } from '../entities/OperationLog';

// 统计端口 - 移到domain层以避免循环依赖
export interface MetricsPort {
  // 获取项目统计
  getProjectMetrics(projectId: string): Promise<ProjectMetrics | null>;

  // 获取全局统计
  getGlobalMetrics(): Promise<ProjectMetrics[]>;

  // 记录操作日志
  logOperation(params: {
    projectId: string;
    chapterId?: string;
    operationType: OperationType;
    status: 'success' | 'failed' | 'pending';
    duration: number;
    errorCode?: string;
    errorMessage?: string;
    metadata?: Record<string, unknown>;
  }): Promise<void>;

  // 获取运行时基础路径
  getRuntimeBasePath(): string;
}
