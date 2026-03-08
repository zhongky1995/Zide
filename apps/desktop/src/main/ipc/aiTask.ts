import { ipcMain } from 'electron';
import {
  OperationType,
  SnapshotType,
  type SceneTaskType,
  type TaskComplexity,
  type TaskContextMode,
  type TaskEnvelope,
  type TaskExecutionBridgeResult,
  type TaskRouteDecision,
  type TaskRun,
} from '@zide/domain';
import {
  CandidateDraftUseCase,
  ContinuityReviewUseCase,
  LoreMemoryUseCase,
  MetricsUseCases,
  SnapshotUseCases,
  TaskContextUseCase,
  TaskPipelineUseCase,
  TaskRouterUseCase,
} from '@zide/application';
import { FileMetricsAdapter } from '@zide/infrastructure';
import { createAIIndexAdapter, ensureLLMReadyForAction, getCurrentLLMAdapter } from './ai';
import { serviceContainer } from '../ServiceContainer';
import { ErrorCode } from './errors';
import { runIpc } from './response';
import { getRuntimeBasePath } from '../runtimePaths';

const SUPPORTED_TASK_TYPES: SceneTaskType[] = [
  'advance_scene',
  'expand_scene',
  'rewrite_scene',
  'polish_scene',
  'polish',
  'rewrite_plot',
];

function createIpcError(message: string, code: ErrorCode, details?: Record<string, unknown>): Error {
  const error = new Error(message) as Error & {
    code?: ErrorCode;
    details?: Record<string, unknown>;
  };
  error.code = code;
  error.details = details;
  return error;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeTaskType(value: unknown): SceneTaskType {
  if (typeof value !== 'string' || !SUPPORTED_TASK_TYPES.includes(value as SceneTaskType)) {
    throw createIpcError('暂不支持该小说任务类型', ErrorCode.INVALID_PARAMS, {
      taskType: value,
      supportedTaskTypes: SUPPORTED_TASK_TYPES,
    });
  }

  return value as SceneTaskType;
}

function normalizeComplexity(value: unknown, taskType: SceneTaskType, prompt?: string): TaskComplexity {
  if (value === 'quick' || value === 'standard' || value === 'deep') {
    return value;
  }

  if (taskType === 'rewrite_scene' || taskType === 'rewrite_plot') {
    return prompt && prompt.trim().length > 120 ? 'deep' : 'standard';
  }

  if (taskType === 'expand_scene') {
    return 'standard';
  }

  return 'quick';
}

function normalizeContextMode(value: unknown): TaskContextMode {
  if (value === 'focused' || value === 'broad' || value === 'auto') {
    return value;
  }

  return 'auto';
}

function normalizeTaskEnvelope(raw: unknown): TaskEnvelope {
  if (!isRecord(raw)) {
    throw createIpcError('任务参数必须是对象', ErrorCode.INVALID_PARAMS);
  }

  const projectId = typeof raw.projectId === 'string' ? raw.projectId.trim() : '';
  const chapterId = typeof raw.chapterId === 'string' ? raw.chapterId.trim() : '';
  if (!projectId || !chapterId) {
    throw createIpcError('projectId 和 chapterId 为必填项', ErrorCode.INVALID_PARAMS, {
      projectId,
      chapterId,
    });
  }

  const taskType = normalizeTaskType(raw.taskType);
  const prompt = typeof raw.prompt === 'string' && raw.prompt.trim() ? raw.prompt.trim() : undefined;
  const complexity = normalizeComplexity(raw.complexity, taskType, prompt);
  const contextMode = normalizeContextMode(raw.contextMode);
  const taskId = typeof raw.taskId === 'string' && raw.taskId.trim()
    ? raw.taskId.trim()
    : `task-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const requestedAt = typeof raw.requestedAt === 'string' && raw.requestedAt.trim()
    ? raw.requestedAt.trim()
    : new Date().toISOString();

  return {
    taskId,
    projectId,
    chapterId,
    taskType,
    prompt,
    complexity,
    contextMode,
    targetRef: {
      kind: 'chapter',
      id: chapterId,
    },
    context: {
      systemContext: [],
      taskContext: [],
      workingMemory: [],
      longTermMemory: [],
    },
    requestedAt,
  };
}

function createRunId(): string {
  return `run-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function buildTaskRun(
  runId: string,
  envelope: TaskEnvelope,
  routeDecision: TaskRouteDecision,
  pipelineResult: Awaited<ReturnType<TaskPipelineUseCase['run']>>,
  finishedAt: string
): TaskRun {
  const continuityPassed = pipelineResult.finalAttempt.continuityReport.passed;
  const reviseStatus = continuityPassed ? 'completed' : 'failed';

  return {
    runId,
    projectId: envelope.projectId,
    taskType: envelope.taskType,
    route: routeDecision.route,
    targetRef: envelope.targetRef,
    status: continuityPassed ? 'completed' : 'failed',
    revisionCount: pipelineResult.revisionCount,
    steps: [
      {
        stepId: `${envelope.taskId}-plan`,
        label: 'Plan',
        status: 'completed',
        note: pipelineResult.planNote,
      },
      {
        stepId: `${envelope.taskId}-execute`,
        label: 'Execute',
        status: 'completed',
        note: pipelineResult.executeNote,
      },
      {
        stepId: `${envelope.taskId}-evaluate`,
        label: 'Evaluate',
        status: continuityPassed ? 'completed' : 'failed',
        note: pipelineResult.evaluateNote,
      },
      {
        stepId: `${envelope.taskId}-revise`,
        label: 'Revise',
        status: reviseStatus,
        note: pipelineResult.reviseNote,
      },
    ],
    startedAt: envelope.requestedAt,
    finishedAt,
  };
}

function createCandidateDraftUseCase(): CandidateDraftUseCase {
  return new CandidateDraftUseCase(
    getCurrentLLMAdapter(),
    createAIIndexAdapter(),
    serviceContainer.chapterRepo,
    serviceContainer.candidateDraftRepo
  );
}

function createContinuityReviewUseCase(): ContinuityReviewUseCase {
  return new ContinuityReviewUseCase(
    serviceContainer.continuityReportRepo,
    serviceContainer.candidateDraftRepo,
    serviceContainer.chapterGoalRepo,
    serviceContainer.storyBibleRepo,
    serviceContainer.chapterRepo
  );
}

function createSnapshotUseCases(): SnapshotUseCases {
  return new SnapshotUseCases(serviceContainer.snapshotRepo);
}

function createTaskRouterUseCase(): TaskRouterUseCase {
  return new TaskRouterUseCase(
    serviceContainer.chapterRepo,
    serviceContainer.chapterGoalRepo,
    serviceContainer.storyBibleRepo
  );
}

function createTaskContextUseCase(): TaskContextUseCase {
  return new TaskContextUseCase(
    serviceContainer.chapterRepo,
    serviceContainer.chapterGoalRepo,
    serviceContainer.storyBibleRepo,
    serviceContainer.memoryCardRepo,
    serviceContainer.continuityReportRepo
  );
}

function createTaskPipelineUseCase(): TaskPipelineUseCase {
  return new TaskPipelineUseCase(
    createCandidateDraftUseCase(),
    createContinuityReviewUseCase()
  );
}

function createLoreMemoryUseCase(): LoreMemoryUseCase {
  return new LoreMemoryUseCase(
    serviceContainer.memoryCardRepo,
    serviceContainer.storyBibleRepo,
    serviceContainer.chapterGoalRepo,
    serviceContainer.chapterRepo
  );
}

function createMetricsUseCase(): MetricsUseCases {
  return new MetricsUseCases(new FileMetricsAdapter(getRuntimeBasePath()));
}

function buildTaskArgs(rawTask: unknown): Record<string, unknown> | undefined {
  if (!isRecord(rawTask)) {
    return undefined;
  }

  return {
    projectId: rawTask.projectId,
    chapterId: rawTask.chapterId,
    taskType: rawTask.taskType,
  };
}

export function registerAITaskHandlers(): void {
  ipcMain.handle('ai:task', async (_event, rawTask: unknown) => {
    return runIpc(async () => {
      const startedAtMs = Date.now();
      ensureLLMReadyForAction('ai:task');

      const envelope = normalizeTaskEnvelope(rawTask);
      const routerUseCase = createTaskRouterUseCase();
      const routeDecision = await routerUseCase.decide(
        envelope.projectId,
        envelope.chapterId,
        envelope.taskType,
        envelope.prompt,
        envelope.complexity
      );
      const runId = createRunId();
      const taskContextUseCase = createTaskContextUseCase();
      const context = await taskContextUseCase.assemble(
        envelope.projectId,
        envelope.chapterId,
        envelope.taskType,
        routeDecision,
        envelope.prompt
      );
      const hydratedEnvelope: TaskEnvelope = {
        ...envelope,
        context,
      };

      console.log('[AITask] 收到统一任务入口请求', {
        taskId: envelope.taskId,
        projectId: envelope.projectId,
        chapterId: envelope.chapterId,
        taskType: envelope.taskType,
        complexity: routeDecision.complexity,
        route: routeDecision.route,
        executionMode: routeDecision.executionMode,
        systemContext: context.systemContext.length,
        taskContext: context.taskContext.length,
        workingMemory: context.workingMemory.length,
        longTermMemory: context.longTermMemory.length,
      });

      const taskPipelineUseCase = createTaskPipelineUseCase();
      const pipelineResult = await taskPipelineUseCase.run({
        projectId: envelope.projectId,
        chapterId: envelope.chapterId,
        runId,
        taskPrompt: envelope.prompt,
        routeDecision,
        context,
      });
      const chapter = await serviceContainer.chapterRepo.findByChapterId(envelope.projectId, envelope.chapterId);
      const finishedAt = new Date().toISOString();
      const taskRun = buildTaskRun(runId, hydratedEnvelope, routeDecision, pipelineResult, finishedAt);
      const response: TaskExecutionBridgeResult = {
        envelope: hydratedEnvelope,
        routeDecision,
        taskRun,
        chapter,
        operation: pipelineResult.finalAttempt.operation,
        candidateDraft: pipelineResult.finalAttempt.candidateDraft,
        continuityReport: pipelineResult.finalAttempt.continuityReport,
        attempts: pipelineResult.attempts,
      };

      console.log('[AITask] 统一任务执行完成', {
        taskId: envelope.taskId,
        runId: taskRun.runId,
        chapterId: envelope.chapterId,
        operationId: pipelineResult.finalAttempt.operation.id,
        candidateDraftId: pipelineResult.finalAttempt.candidateDraft.draftId,
        continuityScore: pipelineResult.finalAttempt.continuityReport.score,
        continuityPassed: pipelineResult.finalAttempt.continuityReport.passed,
        attemptCount: pipelineResult.attempts.length,
        revisionCount: pipelineResult.revisionCount,
      });

      const metricsUseCase = createMetricsUseCase();
      await metricsUseCase.logOperation(
        envelope.projectId,
        OperationType.AI_GENERATE,
        pipelineResult.finalAttempt.continuityReport.passed ? 'success' : 'failed',
        Date.now() - startedAtMs,
        {
          taskType: envelope.taskType,
          route: routeDecision.route,
          continuityPassed: pipelineResult.finalAttempt.continuityReport.passed,
          continuityScore: pipelineResult.finalAttempt.continuityReport.score,
          revisionCount: pipelineResult.revisionCount,
          attemptCount: pipelineResult.attempts.length,
        },
        envelope.chapterId
      );

      return response;
    }, '统一任务执行失败', ErrorCode.AI_GENERATE_FAILED, {
      channel: 'ai:task',
      args: buildTaskArgs(rawTask),
    });
  });

  ipcMain.handle('ai:listCandidateDrafts', async (_event, projectId: string, chapterId: string) => {
    return runIpc(async () => {
      const useCase = createCandidateDraftUseCase();
      return useCase.list(projectId, chapterId);
    }, '获取候选稿列表失败', ErrorCode.STORAGE_READ_FAILED, {
      channel: 'ai:listCandidateDrafts',
      args: { projectId, chapterId },
    });
  });

  ipcMain.handle('ai:adoptCandidateDraft', async (_event, projectId: string, chapterId: string, draftId: string, force = false) => {
    return runIpc(async () => {
      const startedAtMs = Date.now();
      const continuityReviewUseCase = createContinuityReviewUseCase();
      const continuityReport = await continuityReviewUseCase.getOrGenerate(projectId, chapterId, draftId);
      if (!continuityReport.passed && !force) {
        throw createIpcError(
          '候选稿未通过连续性检查，请先到 Continuity Review 修订或执行强制采纳。',
          ErrorCode.CHECK_FAILED,
          {
            projectId,
            chapterId,
            draftId,
            continuityReport,
          }
        );
      }

      let snapshotId: string | undefined;
      if (force) {
        const snapshotUseCases = createSnapshotUseCases();
        const snapshot = await snapshotUseCases.createSnapshot(
          projectId,
          SnapshotType.CHAPTER,
          `强制采纳候选稿前自动快照 - ${draftId}`,
          chapterId
        );
        snapshotId = snapshot.id;
      }

      const useCase = createCandidateDraftUseCase();
      const result = await useCase.adopt(projectId, chapterId, draftId);
      const loreMemoryUseCase = createLoreMemoryUseCase();
      await loreMemoryUseCase.sync(projectId);

      console.log('[AITask] 已采纳候选稿', {
        projectId,
        chapterId,
        draftId,
        force,
        snapshotId,
      });

      const metricsUseCase = createMetricsUseCase();
      await metricsUseCase.logOperation(
        projectId,
        OperationType.AI_ADOPT,
        'success',
        Date.now() - startedAtMs,
        {
          draftId,
          forced: force,
          continuityPassed: continuityReport.passed,
          snapshotId,
        },
        chapterId
      );

      return {
        ...result,
        continuityReport,
        forced: force,
        snapshotId,
      };
    }, '采纳候选稿失败', ErrorCode.STORAGE_WRITE_FAILED, {
      channel: 'ai:adoptCandidateDraft',
      args: { projectId, chapterId, draftId, force },
    });
  });

  ipcMain.handle('ai:rejectCandidateDraft', async (_event, projectId: string, chapterId: string, draftId: string) => {
    return runIpc(async () => {
      const useCase = createCandidateDraftUseCase();
      const result = await useCase.reject(projectId, chapterId, draftId);

      console.log('[AITask] 已放弃候选稿', {
        projectId,
        chapterId,
        draftId,
      });

      return result;
    }, '放弃候选稿失败', ErrorCode.STORAGE_WRITE_FAILED, {
      channel: 'ai:rejectCandidateDraft',
      args: { projectId, chapterId, draftId },
    });
  });

  ipcMain.handle('continuity:listByChapter', async (_event, projectId: string, chapterId: string) => {
    return runIpc(async () => {
      const useCase = createContinuityReviewUseCase();
      return useCase.listByChapter(projectId, chapterId);
    }, '获取连续性报告列表失败', ErrorCode.STORAGE_READ_FAILED, {
      channel: 'continuity:listByChapter',
      args: { projectId, chapterId },
    });
  });

  ipcMain.handle('continuity:getByDraft', async (_event, projectId: string, chapterId: string, draftId: string) => {
    return runIpc(async () => {
      const useCase = createContinuityReviewUseCase();
      return useCase.getOrGenerate(projectId, chapterId, draftId);
    }, '获取连续性报告失败', ErrorCode.STORAGE_READ_FAILED, {
      channel: 'continuity:getByDraft',
      args: { projectId, chapterId, draftId },
    });
  });

  ipcMain.handle('continuity:regenerate', async (_event, projectId: string, chapterId: string, draftId: string) => {
    return runIpc(async () => {
      const useCase = createContinuityReviewUseCase();
      return useCase.generate(projectId, chapterId, draftId);
    }, '重新生成连续性报告失败', ErrorCode.CHECK_FAILED, {
      channel: 'continuity:regenerate',
      args: { projectId, chapterId, draftId },
    });
  });
}
