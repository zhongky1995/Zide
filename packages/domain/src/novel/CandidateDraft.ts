import { ChapterIntent } from '../entities/Chapter';

// 候选稿状态
export type CandidateDraftStatus =
  | 'pending_review'
  | 'needs_revision'
  | 'approved'
  | 'rejected'
  | 'adopted'
  | 'superseded';

// 候选稿
export interface CandidateDraft {
  draftId: string;
  projectId: string;
  chapterId: string;
  taskRunId: string;
  sourceIntent: ChapterIntent;
  content: string;
  summary?: string;
  status: CandidateDraftStatus;
  createdAt: string;
  updatedAt: string;
}
