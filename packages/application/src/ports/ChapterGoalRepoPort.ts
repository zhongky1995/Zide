import { ChapterGoal } from '@zide/domain';

export interface ChapterGoalRepoPort {
  findByChapterId(projectId: string, chapterId: string): Promise<ChapterGoal | null>;
  listByProjectId(projectId: string): Promise<ChapterGoal[]>;
  save(goal: ChapterGoal): Promise<ChapterGoal>;
  replaceByProject(projectId: string, goals: ChapterGoal[]): Promise<ChapterGoal[]>;
}
