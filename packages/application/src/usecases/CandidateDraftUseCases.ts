import {
  AIOperation,
  CandidateDraft,
  ChapterIntent,
  ChapterNotFoundError,
} from '@zide/domain';
import {
  CandidateDraftRepoPort,
  ChapterRepoPort,
  IndexPort,
  LLMPort,
} from '../ports';

export class CandidateDraftUseCase {
  constructor(
    private readonly llmPort: LLMPort,
    private readonly indexPort: IndexPort,
    private readonly chapterRepo: ChapterRepoPort,
    private readonly candidateDraftRepo: CandidateDraftRepoPort
  ) {}

  async generate(
    projectId: string,
    chapterId: string,
    intent: ChapterIntent,
    taskRunId: string,
    customPrompt?: string
  ): Promise<{ chapter: any; operation: AIOperation; candidateDraft: CandidateDraft }> {
    const chapter = await this.chapterRepo.findByChapterId(projectId, chapterId);
    if (!chapter) {
      throw new ChapterNotFoundError(chapterId);
    }

    let contextPack;
    if (typeof (this.indexPort as any).packCompressedContext === 'function') {
      const result = await (this.indexPort as any).packCompressedContext(projectId, chapterId, 8000);
      contextPack = result.contextPack;
    } else {
      contextPack = await this.indexPort.packContext(projectId, chapterId);
    }

    const result = await this.llmPort.generate({
      context: {
        projectContext: contextPack.projectContext,
        relatedChapters: contextPack.relatedChapters.map((c: any) => c.content),
        glossary: contextPack.glossary,
        outline: contextPack.outline,
      },
      chapter: {
        id: chapter.id,
        title: chapter.title,
        content: chapter.content,
        target: chapter.target || '',
      },
      intent,
      customPrompt,
    });

    const operationId = `op-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const operation: AIOperation = {
      id: operationId,
      chapterId,
      intent,
      input: {
        contextUsed: contextPack.sources.map((s: any) => s.chapterId),
        prompt: customPrompt,
      },
      output: {
        content: result.content,
        model: result.model,
        tokens: result.tokens,
      },
      createdAt: new Date().toISOString(),
      adopted: false,
    };

    await this.chapterRepo.saveOperation(projectId, chapterId, operation);
    await this.chapterRepo.incrementOperationCount(projectId, chapterId);
    await this.chapterRepo.setLastOperationId(projectId, chapterId, operationId);

    const draftId = `draft-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const candidateDraft: CandidateDraft = {
      draftId,
      projectId,
      chapterId,
      taskRunId,
      sourceIntent: intent,
      content: this.composeDraftContent(intent, chapter.content, result.content),
      summary: this.createSummary(result.content),
      status: 'pending_review',
      createdAt: operation.createdAt,
      updatedAt: operation.createdAt,
    };

    await this.candidateDraftRepo.create(candidateDraft);

    return {
      chapter,
      operation,
      candidateDraft,
    };
  }

  async list(projectId: string, chapterId: string): Promise<CandidateDraft[]> {
    return this.candidateDraftRepo.listByChapter(projectId, chapterId);
  }

  async adopt(projectId: string, chapterId: string, draftId: string): Promise<{ chapter: any; candidateDraft: CandidateDraft }> {
    const draft = await this.candidateDraftRepo.findById(projectId, chapterId, draftId);
    if (!draft) {
      throw new Error(`Candidate draft not found: ${draftId}`);
    }

    const updatedChapter = await this.chapterRepo.updateContent(projectId, chapterId, draft.content);
    await this.indexPort.indexChapter(projectId, chapterId, draft.content);
    const updatedDraft = await this.candidateDraftRepo.updateStatus(projectId, chapterId, draftId, 'adopted');

    return {
      chapter: updatedChapter,
      candidateDraft: updatedDraft,
    };
  }

  async reject(projectId: string, chapterId: string, draftId: string): Promise<CandidateDraft> {
    return this.candidateDraftRepo.updateStatus(projectId, chapterId, draftId, 'rejected');
  }

  private composeDraftContent(intent: ChapterIntent, originalContent: string, generatedContent: string): string {
    switch (intent) {
      case ChapterIntent.REWRITE:
      case ChapterIntent.POLISH:
      case ChapterIntent.SIMPLIFY:
        return generatedContent;
      default:
        return [originalContent, generatedContent].filter(Boolean).join('\n\n');
    }
  }

  private createSummary(content: string): string {
    const normalized = content.replace(/\s+/g, ' ').trim();
    return normalized.slice(0, 120);
  }
}
