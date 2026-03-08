import { CandidateDraft, CandidateDraftStatus } from '@zide/domain';
import { CandidateDraftRepoPort } from '@zide/application';
import * as fs from 'fs/promises';
import * as path from 'path';

export class FileCandidateDraftRepo implements CandidateDraftRepoPort {
  constructor(private readonly runtimeBasePath: string) {}

  private getDraftDir(projectId: string, chapterId: string): string {
    return path.join(this.runtimeBasePath, projectId, 'chapters', chapterId, 'candidate-drafts');
  }

  private getDraftPath(projectId: string, chapterId: string, draftId: string): string {
    return path.join(this.getDraftDir(projectId, chapterId), `${draftId}.json`);
  }

  async create(draft: CandidateDraft): Promise<void> {
    const draftDir = this.getDraftDir(draft.projectId, draft.chapterId);
    await fs.mkdir(draftDir, { recursive: true });
    await fs.writeFile(this.getDraftPath(draft.projectId, draft.chapterId, draft.draftId), JSON.stringify(draft, null, 2), 'utf-8');
  }

  async findById(projectId: string, chapterId: string, draftId: string): Promise<CandidateDraft | null> {
    try {
      const content = await fs.readFile(this.getDraftPath(projectId, chapterId, draftId), 'utf-8');
      return JSON.parse(content) as CandidateDraft;
    } catch {
      return null;
    }
  }

  async listByChapter(projectId: string, chapterId: string): Promise<CandidateDraft[]> {
    try {
      const draftDir = this.getDraftDir(projectId, chapterId);
      const files = await fs.readdir(draftDir);
      const drafts: CandidateDraft[] = [];

      for (const file of files) {
        if (!file.endsWith('.json')) continue;
        const content = await fs.readFile(path.join(draftDir, file), 'utf-8');
        drafts.push(JSON.parse(content) as CandidateDraft);
      }

      return drafts.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } catch {
      return [];
    }
  }

  async updateStatus(projectId: string, chapterId: string, draftId: string, status: CandidateDraftStatus): Promise<CandidateDraft> {
    const draft = await this.findById(projectId, chapterId, draftId);
    if (!draft) {
      throw new Error(`Candidate draft not found: ${draftId}`);
    }

    const updatedDraft: CandidateDraft = {
      ...draft,
      status,
      updatedAt: new Date().toISOString(),
    };

    await this.create(updatedDraft);
    return updatedDraft;
  }
}
