import { ContinuityIssue } from './ContinuityIssue';

// 连续性报告
export interface ContinuityReport {
  reportId: string;
  projectId: string;
  draftId: string;
  score: number;
  passed: boolean;
  issues: ContinuityIssue[];
  revisionAdvice?: string;
  createdAt: string;
}
