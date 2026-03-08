import { ContinuityReport } from '@zide/domain';

export interface ContinuityReportRepoPort {
  findByDraftId(projectId: string, chapterId: string, draftId: string): Promise<ContinuityReport | null>;
  listByChapter(projectId: string, chapterId: string): Promise<ContinuityReport[]>;
  save(projectId: string, chapterId: string, report: ContinuityReport): Promise<ContinuityReport>;
}
