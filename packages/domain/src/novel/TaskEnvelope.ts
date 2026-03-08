import type { AIOperation, Chapter, ChapterIntent } from '../entities/Chapter';
import type { CandidateDraft } from './CandidateDraft';
import type { ContinuityReport } from './ContinuityReport';
import type { NovelReference } from './NovelRef';
import type { SceneTaskType, TaskRun, TaskRunRoute } from './TaskRun';

// 任务复杂度
export type TaskComplexity = 'quick' | 'standard' | 'deep';

// 上下文装配方式
export type TaskContextMode = 'auto' | 'focused' | 'broad';

// 推理阶段
export type TaskPipelineStage = 'plan' | 'execute' | 'evaluate' | 'revise';

// 四层上下文摘要
export interface TaskContextLayers {
  systemContext: string[];
  taskContext: string[];
  workingMemory: NovelReference[];
  longTermMemory: NovelReference[];
}

// 统一任务入口
export interface TaskEnvelope {
  taskId: string;
  projectId: string;
  chapterId: string;
  taskType: SceneTaskType;
  prompt?: string;
  complexity: TaskComplexity;
  contextMode: TaskContextMode;
  targetRef: NovelReference;
  context: TaskContextLayers;
  requestedAt: string;
}

// Router 当前阶段的桥接决策
export interface TaskRouteDecision {
  route: TaskRunRoute;
  complexity: TaskComplexity;
  mappedIntent: ChapterIntent;
  executionMode: 'legacy-inline-write' | 'candidate-draft';
  pipelineStages: TaskPipelineStage[];
  routeSignals: string[];
}

// 单次执行产物
export interface TaskAttemptArtifact {
  round: number;
  operation: AIOperation;
  candidateDraft: CandidateDraft;
  continuityReport: ContinuityReport;
}

// 统一任务入口的兼容返回
export interface TaskExecutionBridgeResult {
  envelope: TaskEnvelope;
  routeDecision: TaskRouteDecision;
  taskRun: TaskRun;
  chapter: Chapter | null;
  operation: AIOperation;
  candidateDraft: CandidateDraft;
  continuityReport: ContinuityReport;
  attempts: TaskAttemptArtifact[];
}
