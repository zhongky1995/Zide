// 章节目标状态
export type ChapterGoalStatus = 'planned' | 'drafting' | 'revising' | 'completed';

// 章节目标
export interface ChapterGoal {
  chapterId: string;
  projectId: string;
  arcId?: string;
  title: string;
  objective: string;
  conflict?: string;
  emotionalShift?: string;
  payoff?: string;
  status: ChapterGoalStatus;
  createdAt: string;
  updatedAt: string;
}
