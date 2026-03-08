import { RetconDecision } from '@zide/domain';

export interface RetconDecisionRepoPort {
  findById(projectId: string, retconId: string): Promise<RetconDecision | null>;
  listByProjectId(projectId: string): Promise<RetconDecision[]>;
  save(decision: RetconDecision): Promise<RetconDecision>;
}
