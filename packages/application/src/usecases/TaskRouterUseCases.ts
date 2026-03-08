import { ChapterIntent, SceneTaskType, TaskComplexity, TaskRouteDecision, TaskPipelineStage } from '@zide/domain';
import { ChapterGoalRepoPort, ChapterRepoPort, StoryBibleRepoPort } from '../ports';

const DEFAULT_PIPELINE_STAGES: TaskPipelineStage[] = ['plan', 'execute', 'evaluate', 'revise'];

export class TaskRouterUseCase {
  constructor(
    private readonly chapterRepo: ChapterRepoPort,
    private readonly chapterGoalRepo: ChapterGoalRepoPort,
    private readonly storyBibleRepo: StoryBibleRepoPort
  ) {}

  async decide(
    projectId: string,
    chapterId: string,
    taskType: SceneTaskType,
    prompt?: string,
    preferredComplexity?: TaskComplexity
  ): Promise<TaskRouteDecision> {
    const [chapter, chapterGoal, storyBible] = await Promise.all([
      this.chapterRepo.findByChapterId(projectId, chapterId),
      this.chapterGoalRepo.findByChapterId(projectId, chapterId),
      this.storyBibleRepo.findByProjectId(projectId),
    ]);

    const routeSignals: string[] = [];
    let score = 0;

    if (preferredComplexity === 'deep') {
      routeSignals.push('用户显式要求 deep complexity');
      score += 3;
    } else if (preferredComplexity === 'standard') {
      routeSignals.push('用户显式要求 standard complexity');
      score += 2;
    }

    if (taskType === 'rewrite_scene' || taskType === 'rewrite_plot') {
      routeSignals.push('任务属于重写/重构类');
      score += 2;
    }

    if ((prompt || '').trim().length > 120) {
      routeSignals.push('任务补充说明较长，约束较多');
      score += 1;
    }

    if ((chapter?.content || '').length > 2500) {
      routeSignals.push('当前章节正文较长');
      score += 1;
    }

    if (chapterGoal?.conflict || chapterGoal?.payoff) {
      routeSignals.push('Plot Board 已配置冲突或回报点');
      score += 1;
    }

    if (storyBible?.status === 'confirmed') {
      routeSignals.push('Story Bible 已确认，适合走更严格链路');
      score += 1;
    }

    const route = score >= 4 ? 'deep-path' : score >= 2 ? 'standard-path' : 'fast-path';
    const complexity = route === 'deep-path' ? 'deep' : route === 'standard-path' ? 'standard' : 'quick';

    return {
      route,
      complexity,
      mappedIntent: this.mapTaskTypeToIntent(taskType),
      executionMode: 'candidate-draft',
      pipelineStages: DEFAULT_PIPELINE_STAGES,
      routeSignals,
    };
  }

  private mapTaskTypeToIntent(taskType: SceneTaskType): ChapterIntent {
    switch (taskType) {
      case 'advance_scene':
        return ChapterIntent.CONTINUE;
      case 'expand_scene':
        return ChapterIntent.EXPAND;
      case 'rewrite_scene':
      case 'rewrite_plot':
        return ChapterIntent.REWRITE;
      case 'polish_scene':
      case 'polish':
        return ChapterIntent.POLISH;
      default:
        return ChapterIntent.POLISH;
    }
  }
}
