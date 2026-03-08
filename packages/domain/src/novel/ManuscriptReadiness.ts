import { ContinuityIssue } from './ContinuityIssue';

// 成稿准备度阻塞项
export interface ManuscriptBlocker {
  blockerId: string;
  chapterId?: string;
  message: string;
  relatedIssue?: ContinuityIssue;
}

// 成稿准备度
export interface ManuscriptReadiness {
  projectId: string;
  readinessScore: number;
  completedChapterCount: number;
  blockingIssueCount: number;
  blockers: ManuscriptBlocker[];
  lastEvaluatedAt: string;
}
