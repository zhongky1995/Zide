import { NovelReference } from './NovelRef';

// 任务类型
export type SceneTaskType =
  | 'advance_scene'
  | 'expand_scene'
  | 'rewrite_scene'
  | 'polish_scene'
  | 'review_continuity'
  | 'refresh_memory'
  | 'polish'
  | 'rewrite_plot';

// 路由结果
export type TaskRunRoute = 'fast-path' | 'standard-path' | 'deep-path';

// 任务运行状态
export type TaskRunStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';

// 任务步骤轨迹
export interface RunStepTrace {
  stepId: string;
  label: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  note?: string;
}

// 任务运行记录
export interface TaskRun {
  runId: string;
  projectId: string;
  taskType: SceneTaskType;
  route: TaskRunRoute;
  targetRef: NovelReference;
  status: TaskRunStatus;
  revisionCount: number;
  steps: RunStepTrace[];
  startedAt: string;
  finishedAt?: string;
}
