import { NovelReference } from './NovelRef';

// retcon 状态
export type RetconStatus = 'proposed' | 'approved' | 'rolled_back';

// retcon 决策
export interface RetconDecision {
  retconId: string;
  projectId: string;
  summary: string;
  reason?: string;
  affectedRefs: NovelReference[];
  status: RetconStatus;
  approvedAt?: string;
  createdAt: string;
}
