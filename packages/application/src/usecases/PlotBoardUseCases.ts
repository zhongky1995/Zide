import { ChapterGoal, Outline } from '@zide/domain';
import { ChapterGoalRepoPort, OutlineRepoPort } from '../ports';

export interface PlotBoardSnapshot {
  outline: Outline | null;
  chapterGoals: ChapterGoal[];
}

export class PlotBoardUseCase {
  constructor(
    private readonly chapterGoalRepo: ChapterGoalRepoPort,
    private readonly outlineRepo: OutlineRepoPort
  ) {}

  async get(projectId: string): Promise<PlotBoardSnapshot> {
    const outline = await this.outlineRepo.findByProjectId(projectId);
    if (!outline) {
      return {
        outline: null,
        chapterGoals: [],
      };
    }

    const chapterGoals = await this.syncFromOutline(projectId, outline);
    return {
      outline,
      chapterGoals,
    };
  }

  async updateChapterGoal(
    projectId: string,
    chapterId: string,
    updates: Partial<Pick<ChapterGoal, 'title' | 'objective' | 'conflict' | 'emotionalShift' | 'payoff' | 'status'>>
  ): Promise<PlotBoardSnapshot> {
    const outline = await this.outlineRepo.findByProjectId(projectId);
    if (!outline) {
      throw new Error(`Outline not found: ${projectId}`);
    }

    const existing = await this.chapterGoalRepo.findByChapterId(projectId, chapterId);
    const outlineChapter = outline.chapters.find((chapter) => chapter.id === chapterId);
    if (!existing || !outlineChapter) {
      throw new Error(`Chapter goal not found: ${chapterId}`);
    }

    const goal: ChapterGoal = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    await this.chapterGoalRepo.save(goal);

    const outlineUpdates: { title?: string; target?: string } = {};
    if (typeof updates.title === 'string' && updates.title.trim()) {
      outlineUpdates.title = updates.title.trim();
    }
    if (typeof updates.objective === 'string' && updates.objective.trim()) {
      outlineUpdates.target = updates.objective.trim();
    }
    if (Object.keys(outlineUpdates).length > 0) {
      await this.outlineRepo.updateChapter(projectId, chapterId, outlineUpdates);
    }

    return this.get(projectId);
  }

  private async syncFromOutline(projectId: string, outline: Outline): Promise<ChapterGoal[]> {
    const existingGoals = await this.chapterGoalRepo.listByProjectId(projectId);
    const now = new Date().toISOString();
    const goals = outline.chapters.map((chapter) => {
      const existing = existingGoals.find((goal) => goal.chapterId === chapter.id);
      return {
        chapterId: chapter.id,
        projectId,
        arcId: existing?.arcId,
        title: existing?.title || chapter.title,
        objective: existing?.objective || chapter.target || `推进「${chapter.title}」的核心剧情。`,
        conflict: existing?.conflict || '',
        emotionalShift: existing?.emotionalShift || '',
        payoff: existing?.payoff || '',
        status: existing?.status || 'planned',
        createdAt: existing?.createdAt || now,
        updatedAt: now,
      } satisfies ChapterGoal;
    });

    return this.chapterGoalRepo.replaceByProject(projectId, goals);
  }
}
