import { CandidateDraft, CandidateDraftStatus } from '@zide/domain';

export interface CandidateDraftRepoPort {
  create(draft: CandidateDraft): Promise<void>;
  findById(projectId: string, chapterId: string, draftId: string): Promise<CandidateDraft | null>;
  listByChapter(projectId: string, chapterId: string): Promise<CandidateDraft[]>;
  updateStatus(projectId: string, chapterId: string, draftId: string, status: CandidateDraftStatus): Promise<CandidateDraft>;
}
