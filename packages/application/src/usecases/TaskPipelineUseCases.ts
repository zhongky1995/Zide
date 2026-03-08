import { TaskAttemptArtifact, TaskContextLayers, TaskRouteDecision } from '@zide/domain';
import { CandidateDraftUseCase } from './CandidateDraftUseCases';
import { ContinuityReviewUseCase } from './ContinuityReviewUseCases';

export interface TaskPipelineResult {
  attempts: TaskAttemptArtifact[];
  finalAttempt: TaskAttemptArtifact;
  revisionCount: number;
  planNote: string;
  executeNote: string;
  evaluateNote: string;
  reviseNote: string;
  context: TaskContextLayers;
}

interface RunTaskPipelineParams {
  projectId: string;
  chapterId: string;
  runId: string;
  taskPrompt?: string;
  routeDecision: TaskRouteDecision;
  context: TaskContextLayers;
}

export class TaskPipelineUseCase {
  constructor(
    private readonly candidateDraftUseCase: CandidateDraftUseCase,
    private readonly continuityReviewUseCase: ContinuityReviewUseCase
  ) {}

  async run(params: RunTaskPipelineParams): Promise<TaskPipelineResult> {
    const maxRevisions = params.routeDecision.route === 'deep-path'
      ? 2
      : params.routeDecision.route === 'standard-path'
        ? 1
        : 0;

    const attempts: TaskAttemptArtifact[] = [];
    let revisionPrompt = params.taskPrompt;

    for (let round = 0; round <= maxRevisions; round += 1) {
      const executionPrompt = this.buildExecutionPrompt(revisionPrompt, params.context, round);
      const generated = await this.candidateDraftUseCase.generate(
        params.projectId,
        params.chapterId,
        params.routeDecision.mappedIntent,
        params.runId,
        executionPrompt
      );
      const continuityReport = await this.continuityReviewUseCase.generate(
        params.projectId,
        params.chapterId,
        generated.candidateDraft.draftId
      );

      attempts.push({
        round,
        operation: generated.operation,
        candidateDraft: generated.candidateDraft,
        continuityReport,
      });

      if (continuityReport.passed || round === maxRevisions) {
        break;
      }

      revisionPrompt = this.buildRevisionPrompt(
        params.taskPrompt,
        params.context,
        continuityReport.revisionAdvice,
        round + 1
      );
    }

    const finalAttempt = attempts[attempts.length - 1];
    const revisionCount = Math.max(0, attempts.length - 1);
    const requiresManualIntervention = !finalAttempt.continuityReport.passed;

    return {
      attempts,
      finalAttempt,
      revisionCount,
      planNote: this.buildPlanNote(params.routeDecision, params.context),
      executeNote: `共执行 ${attempts.length} 轮生成，最终候选稿为 ${finalAttempt.candidateDraft.draftId}`,
      evaluateNote: `最终连续性结果：${finalAttempt.continuityReport.passed ? '通过' : '未通过'}，得分 ${finalAttempt.continuityReport.score}`,
      reviseNote: requiresManualIntervention
        ? this.buildManualInterventionNote(revisionCount)
        : revisionCount > 0
          ? `共进行了 ${revisionCount} 轮自动修订`
          : '当前任务未触发自动修订',
      context: params.context,
    };
  }

  private buildPlanNote(routeDecision: TaskRouteDecision, context: TaskContextLayers): string {
    const anchor = context.taskContext.slice(0, 3).join(' / ');
    const signals = routeDecision.routeSignals.join('；') || '无额外信号';
    return `按 ${routeDecision.route} 执行。任务锚点：${anchor || '无'}。路由信号：${signals}`;
  }

  private buildExecutionPrompt(
    taskPrompt: string | undefined,
    context: TaskContextLayers,
    round: number
  ): string {
    const systemRules = context.systemContext.map((item) => `- ${item}`).join('\n');
    const taskAnchors = context.taskContext.map((item) => `- ${item}`).join('\n');
    const workingRefs = context.workingMemory
      .map((ref) => `- ${ref.kind}：${ref.label || ref.id}`)
      .join('\n');
    const longTermRefs = context.longTermMemory
      .map((ref) => `- ${ref.kind}：${ref.label || ref.id}`)
      .join('\n');

    return [
      `当前为第 ${round + 1} 轮小说任务生成。`,
      '必须先输出候选稿，不得假设自己可以直接修改正式正文。',
      systemRules ? `系统约束：\n${systemRules}` : '',
      taskAnchors ? `任务锚点：\n${taskAnchors}` : '',
      workingRefs ? `工作记忆：\n${workingRefs}` : '',
      longTermRefs ? `长期记忆：\n${longTermRefs}` : '',
      taskPrompt ? `作者要求：\n${taskPrompt}` : '',
    ].filter(Boolean).join('\n\n');
  }

  private buildRevisionPrompt(
    originalPrompt: string | undefined,
    context: TaskContextLayers,
    revisionAdvice: string | undefined,
    round: number
  ): string {
    const taskAnchors = context.taskContext.slice(0, 4).join('\n');
    return [
      originalPrompt || '',
      `第 ${round} 轮修订，请优先修正以下问题：`,
      revisionAdvice || '请根据连续性检查结果提升章节目标覆盖度，并修正明显冲突。',
      '必须继续服从这些任务锚点：',
      taskAnchors,
    ].filter(Boolean).join('\n\n');
  }

  private buildManualInterventionNote(revisionCount: number): string {
    if (revisionCount > 0) {
      return `已达到自动修订上限，并在 ${revisionCount} 轮修订后仍未通过连续性检查。系统已停止自动处理，请作者人工介入。`;
    }

    return '当前路径未触发自动修订且连续性仍未通过。系统已停止自动处理，请作者人工介入。';
  }
}
