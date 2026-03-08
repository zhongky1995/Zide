import { NovelReference, TaskContextLayers, TaskRouteDecision } from '@zide/domain';
import {
  ChapterGoalRepoPort,
  ChapterRepoPort,
  ContinuityReportRepoPort,
  MemoryCardRepoPort,
  StoryBibleRepoPort,
} from '../ports';

export class TaskContextUseCase {
  constructor(
    private readonly chapterRepo: ChapterRepoPort,
    private readonly chapterGoalRepo: ChapterGoalRepoPort,
    private readonly storyBibleRepo: StoryBibleRepoPort,
    private readonly memoryCardRepo: MemoryCardRepoPort,
    private readonly continuityReportRepo: ContinuityReportRepoPort
  ) {}

  async assemble(
    projectId: string,
    chapterId: string,
    taskType: string,
    routeDecision: TaskRouteDecision,
    prompt?: string
  ): Promise<TaskContextLayers> {
    const [chapter, chapterGoal, storyBible, memoryCards, continuityReports] = await Promise.all([
      this.chapterRepo.findByChapterId(projectId, chapterId),
      this.chapterGoalRepo.findByChapterId(projectId, chapterId),
      this.storyBibleRepo.findByProjectId(projectId),
      this.memoryCardRepo.listByProjectId(projectId),
      this.continuityReportRepo.listByChapter(projectId, chapterId),
    ]);

    const systemContext = [
      '所有 AI 结果必须先进入候选稿，不得直接污染正式正文。',
      '系统执行链路固定为 Plan -> Execute -> Evaluate -> Revise。',
      `当前路由：${routeDecision.route} / ${routeDecision.complexity}`,
      '连续性未通过时默认禁止普通采纳，需进入 Continuity Review。',
    ];

    const taskContext = [
      `任务类型：${taskType}`,
      chapter ? `当前章节：${chapter.number} ${chapter.title}` : '',
      chapterGoal?.objective ? `章节目标：${chapterGoal.objective}` : '',
      chapterGoal?.conflict ? `关键冲突：${chapterGoal.conflict}` : '',
      chapterGoal?.payoff ? `本章回报：${chapterGoal.payoff}` : '',
      storyBible?.premise ? `故事前提：${storyBible.premise}` : '',
      storyBible?.conflictCore ? `主冲突：${storyBible.conflictCore}` : '',
      prompt ? `作者补充说明：${prompt}` : '',
    ].filter(Boolean);

    const workingMemory: NovelReference[] = [];
    if (chapter) {
      workingMemory.push({
        kind: 'chapter',
        id: chapter.id,
        label: chapter.title,
      });
    }
    if (chapterGoal) {
      workingMemory.push({
        kind: 'timeline_entry',
        id: chapterGoal.chapterId,
        label: chapterGoal.objective.slice(0, 40),
      });
    }
    for (const report of continuityReports.slice(0, 3)) {
      for (const issue of report.issues.slice(0, 2)) {
        workingMemory.push({
          kind: 'continuity_issue',
          id: issue.issueId,
          label: issue.message.slice(0, 40),
        });
      }
    }

    const longTermMemory: NovelReference[] = [];
    if (storyBible) {
      longTermMemory.push({
        kind: 'story_bible',
        id: storyBible.storyBibleId,
        label: storyBible.premise.slice(0, 40),
      });
    }
    for (const card of memoryCards.slice(0, 8)) {
      longTermMemory.push({
        kind: 'memory_card',
        id: card.memoryId,
        label: `${card.title} · ${card.kind}`,
      });
    }

    return {
      systemContext,
      taskContext,
      workingMemory,
      longTermMemory,
    };
  }
}
