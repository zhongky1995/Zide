import { ChapterGoal } from '@zide/domain';
import { ChapterGoalRepoPort } from '@zide/application';
import * as fs from 'fs/promises';
import * as path from 'path';

export class FileChapterGoalRepo implements ChapterGoalRepoPort {
  constructor(private readonly runtimeBasePath: string) {}

  private getChapterGoalsPath(projectId: string): string {
    return path.join(this.runtimeBasePath, projectId, 'outline', 'chapter-goals.json');
  }

  async findByChapterId(projectId: string, chapterId: string): Promise<ChapterGoal | null> {
    const goals = await this.listByProjectId(projectId);
    return goals.find((goal) => goal.chapterId === chapterId) || null;
  }

  async listByProjectId(projectId: string): Promise<ChapterGoal[]> {
    try {
      const content = await fs.readFile(this.getChapterGoalsPath(projectId), 'utf-8');
      const parsed = JSON.parse(content);
      return Array.isArray(parsed) ? parsed as ChapterGoal[] : [];
    } catch {
      return [];
    }
  }

  async save(goal: ChapterGoal): Promise<ChapterGoal> {
    const goals = await this.listByProjectId(goal.projectId);
    const nextGoals = goals.some((item) => item.chapterId === goal.chapterId)
      ? goals.map((item) => item.chapterId === goal.chapterId ? goal : item)
      : [...goals, goal];

    await this.write(goal.projectId, nextGoals);
    return goal;
  }

  async replaceByProject(projectId: string, goals: ChapterGoal[]): Promise<ChapterGoal[]> {
    await this.write(projectId, goals);
    return goals;
  }

  private async write(projectId: string, goals: ChapterGoal[]): Promise<void> {
    const targetPath = this.getChapterGoalsPath(projectId);
    await fs.mkdir(path.dirname(targetPath), { recursive: true });
    await fs.writeFile(targetPath, JSON.stringify(goals, null, 2), 'utf-8');
  }
}
