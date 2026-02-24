// 操作日志实体
export interface OperationLog {
  id: string;
  projectId?: string;
  chapterId?: string;
  operationType: OperationType;
  status: 'success' | 'failed' | 'pending';
  duration: number;        // 耗时（毫秒）
  errorCode?: string;
  errorMessage?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

// 操作类型
export enum OperationType {
  // 项目操作
  PROJECT_CREATE = 'project_create',
  PROJECT_UPDATE = 'project_update',
  PROJECT_DELETE = 'project_delete',

  // 大纲操作
  OUTLINE_GENERATE = 'outline_generate',
  OUTLINE_UPDATE = 'outline_update',

  // 章节操作
  CHAPTER_CREATE = 'chapter_create',
  CHAPTER_UPDATE = 'chapter_update',
  CHAPTER_DELETE = 'chapter_delete',

  // AI 操作
  AI_GENERATE = 'ai_generate',
  AI_RETRY = 'ai_retry',

  // 快照操作
  SNAPSHOT_CREATE = 'snapshot_create',
  SNAPSHOT_ROLLBACK = 'snapshot_rollback',

  // 检查操作
  CHECK_RUN = 'check_run',

  // 导出操作
  EXPORT_RUN = 'export_run',
}

// 统计指标
export interface Metrics {
  projectId: string;
  totalProjects: number;
  totalChapters: number;
  completedChapters: number;
  totalWords: number;
  aiOperations: number;
  adoptedOperations: number;
  snapshotsCreated: number;
  rollbacksPerformed: number;
  exportsCompleted: number;
  checksRun: number;
  averageGenerationTime: number;
}

// 项目统计
export interface ProjectMetrics extends Metrics {
  projectId: string;
  projectName: string;
  createdAt: string;
  lastActivityAt: string;
}
