import {
  ChapterIntent,
  AIOperation,
  ChapterStatus,
  ChapterNotFoundError,
} from '@zide/domain';
import {
  LLMPort,
  IndexPort,
  ChapterRepoPort,
} from '../ports';

// AI 内容生成用例
export class GenerateContentUseCase {
  constructor(
    private readonly llmPort: LLMPort,
    private readonly indexPort: IndexPort,
    private readonly chapterRepo: ChapterRepoPort
  ) {}

  // 生成内容
  async generate(
    projectId: string,
    chapterId: string,
    intent: ChapterIntent,
    customPrompt?: string
  ): Promise<{ chapter: any; operation: AIOperation }> {
    // 1. 获取章节信息
    const chapter = await this.chapterRepo.findByChapterId(projectId, chapterId);
    if (!chapter) {
      throw new ChapterNotFoundError(chapterId);
    }

    // 2. 打包上下文
    const contextPack = await this.indexPort.packContext(projectId, chapterId);

    // 3. 调用 LLM 生成
    const result = await this.llmPort.generate({
      context: {
        projectContext: contextPack.projectContext,
        relatedChapters: contextPack.relatedChapters.map(c => c.content),
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

    // 4. 生成操作记录
    const operationId = `op-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const operation: AIOperation = {
      id: operationId,
      chapterId,
      intent,
      input: {
        contextUsed: contextPack.sources.map(s => s.chapterId),
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

    // 5. 保存操作记录
    await this.saveOperation(projectId, chapterId, operation);

    // 6. 更新章节内容（追加或替换）
    let newContent: string;
    switch (intent) {
      case ChapterIntent.REWRITE:
      case ChapterIntent.POLISH:
      case ChapterIntent.SIMPLIFY:
        newContent = result.content;
        break;
      default:
        // 续写、扩写、补论证：追加内容
        newContent = chapter.content + '\n\n' + result.content;
    }

    // 7. 更新章节
    await this.chapterRepo.updateContent(projectId, chapterId, newContent);
    await this.chapterRepo.incrementOperationCount(projectId, chapterId);
    await this.chapterRepo.setLastOperationId(projectId, chapterId, operationId);

    // 8. 更新索引
    await this.indexPort.indexChapter(projectId, chapterId, newContent);

    // 9. 更新状态
    if (chapter.status === ChapterStatus.TODO) {
      await this.chapterRepo.updateByProjectId(projectId, chapterId, {
        status: ChapterStatus.IN_PROGRESS
      });
    }

    // 10. 返回更新后的章节
    const updatedChapter = await this.chapterRepo.findByChapterId(projectId, chapterId);

    return {
      chapter: updatedChapter,
      operation,
    };
  }

  // 保存操作记录
  private async saveOperation(
    projectId: string,
    chapterId: string,
    operation: AIOperation
  ): Promise<void> {
    await this.chapterRepo.saveOperation(projectId, chapterId, operation);
  }

  // 获取操作历史
  async getOperationHistory(
    projectId: string,
    chapterId: string
  ): Promise<AIOperation[]> {
    return this.chapterRepo.getOperations(projectId, chapterId);
  }

  // 采纳操作结果
  async adoptOperation(
    projectId: string,
    chapterId: string,
    operationId: string
  ): Promise<void> {
    await this.chapterRepo.adoptOperation(projectId, chapterId, operationId);
  }

  // 检查 LLM 连接
  async ping(): Promise<boolean> {
    return this.llmPort.ping();
  }

  // 获取 LLM 配置
  getLLMConfig() {
    return this.llmPort.getConfig();
  }
}
