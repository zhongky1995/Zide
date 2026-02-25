import { IndexPort, ContextChunk, ContextPack, IndexConfig, RetrieveParams } from '@zide/application';
import { Chapter, ChapterSummary } from '@zide/domain';
import { SimpleIndex } from './SimpleIndex';
import { ContextCompressor, CompressionConfig, CompressionResult } from './ContextCompressor';
import { FileChapterRepo } from '../storage/FileChapterRepo';
import * as fs from 'fs/promises';
import * as path from 'path';

// 基于 SimpleIndex 的索引适配器
export class SimpleIndexAdapter implements IndexPort {
  private index: SimpleIndex;
  private compressor: ContextCompressor;
  private readonly chapterRepo: FileChapterRepo;

  constructor(runtimeBasePath: string, compressionConfig?: Partial<CompressionConfig>) {
    this.index = new SimpleIndex(runtimeBasePath);
    this.compressor = new ContextCompressor(compressionConfig);
    this.chapterRepo = new FileChapterRepo(runtimeBasePath);
  }

  async indexChapter(projectId: string, chapterId: string, content: string): Promise<void> {
    // 需要先获取章节标题
    const title = await this.getChapterTitle(projectId, chapterId);
    await this.index.indexChapter(projectId, chapterId, content, title);
  }

  async removeChapterIndex(chapterId: string): Promise<void> {
    await this.index.removeChapterIndex(chapterId);
  }

  async rebuildProjectIndex(projectId: string): Promise<void> {
    await this.index.rebuildProjectIndex(projectId);
  }

  async retrieve(params: RetrieveParams): Promise<ContextChunk[]> {
    const entries = await this.index.retrieve(
      params.projectId,
      params.chapterId,
      params.query,
      params.limit || 5
    );

    return entries.map(entry => ({
      id: entry.id,
      chapterId: entry.chapterId,
      chapterTitle: entry.chapterTitle,
      content: entry.content,
      keywords: entry.keywords,
      relevance: 0.8, // 简化处理
      position: entry.position,
    }));
  }

  async packContext(projectId: string, chapterId: string): Promise<ContextPack> {
    // 获取项目元信息
    const metaPath = path.join(this.chapterRepo.getRuntimeBasePath(), projectId, 'meta', 'project.md');
    let projectContext = '';
    try {
      // 保留完整项目设定，避免全局背景被关键字过滤后丢失
      projectContext = await fs.readFile(metaPath, 'utf-8');
    } catch {}

    // 获取术语表
    const glossaryPath = path.join(this.chapterRepo.getRuntimeBasePath(), projectId, 'meta', 'glossary.md');
    let glossary = '';
    try {
      glossary = await fs.readFile(glossaryPath, 'utf-8');
    } catch {}

    // 获取大纲
    const outlinePath = path.join(this.chapterRepo.getRuntimeBasePath(), projectId, 'outline', 'outline.md');
    let outline = '';
    try {
      outline = await fs.readFile(outlinePath, 'utf-8');
    } catch {}

    // 前文记忆：优先使用“前文章节摘要”，不足时再回退为正文简要摘要
    const relatedChapters = await this.buildChapterMemories(projectId, chapterId);

    return {
      projectContext,
      relatedChapters,
      glossary,
      outline,
      sources: relatedChapters.map(ch => ({
        chapterId: ch.chapterId,
        chunkIds: [ch.id],
      })),
    };
  }

  // 打包压缩后的上下文（自动选择压缩策略）
  async packCompressedContext(projectId: string, chapterId: string, tokenBudget?: number): Promise<{
    contextPack: ContextPack;
    compressionResult: CompressionResult;
  }> {
    const contextPack = await this.packContext(projectId, chapterId);

    // 如果指定了 token 预算，更新压缩器配置
    if (tokenBudget) {
      this.compressor.setConfig({ tokenBudget });
    }

    // 执行压缩
    const compressionResult = this.compressor.compressForTokenBudget({
      projectContext: contextPack.projectContext,
      relatedChapters: contextPack.relatedChapters.map(ch => ({
        id: ch.id,
        chapterId: ch.chapterId,
        chapterTitle: ch.chapterTitle,
        content: ch.content,
      })),
      glossary: contextPack.glossary,
      outline: contextPack.outline,
    });

    // 构建压缩后的 ContextPack
    const compressedPack: ContextPack = {
      projectContext: compressionResult.projectContext,
      relatedChapters: compressionResult.relatedChapters.map(ch => ({
        id: ch.id,
        chapterId: ch.chapterId,
        chapterTitle: ch.chapterTitle,
        content: ch.content,
        keywords: [],
        relevance: 1 - compressionResult.compressionRatio,
        position: 'middle' as const,
      })),
      glossary: compressionResult.glossary,
      outline: compressionResult.outline,
      sources: compressionResult.relatedChapters.map(ch => ({
        chapterId: ch.chapterId,
        chunkIds: [ch.id],
      })),
    };

    return {
      contextPack: compressedPack,
      compressionResult,
    };
  }

  // 获取压缩器实例（用于高级配置）
  getCompressor(): ContextCompressor {
    return this.compressor;
  }

  async getStats(projectId: string): Promise<{
    totalChunks: number;
    indexedChapters: number;
    lastIndexedAt?: string;
  }> {
    return this.index.getStats(projectId);
  }

  async clear(projectId: string): Promise<void> {
    await this.index.clear(projectId);
  }

  private async getChapterTitle(projectId: string, chapterId: string): Promise<string> {
    try {
      const chapterPath = path.join(
        this.chapterRepo.getRuntimeBasePath(),
        projectId,
        'chapters',
        `${chapterId}.md`
      );
      const content = await fs.readFile(chapterPath, 'utf-8');
      const match = content.match(/^#\s+(.+)$/m);
      return match ? match[1] : chapterId;
    } catch {
      return chapterId;
    }
  }

  private async buildChapterMemories(projectId: string, chapterId: string): Promise<ContextChunk[]> {
    const chapters = await this.chapterRepo.findByProjectId(projectId);
    if (chapters.length === 0) return [];

    const normalizedCurrentId = this.normalizeChapterId(chapterId);
    const currentChapter = chapters.find((chapter) => (
      chapter.id === chapterId ||
      chapter.number === chapterId ||
      chapter.id === normalizedCurrentId ||
      chapter.number === normalizedCurrentId
    ));

    const currentNumber = this.parseChapterNumber(currentChapter?.number || normalizedCurrentId);
    const maxRelatedChapters = this.compressor.getConfig().maxRelatedChapters;

    const candidates = chapters
      .filter((chapter) => {
        const chapterNumber = this.parseChapterNumber(chapter.number);
        const hasContent = chapter.content && chapter.content.trim().length > 0;
        if (!hasContent) return false;
        if (!Number.isFinite(currentNumber)) {
          return chapter.id !== chapterId && chapter.number !== chapterId;
        }
        return Number.isFinite(chapterNumber) && chapterNumber < currentNumber;
      })
      .slice(-maxRelatedChapters);

    return candidates.map((chapter, index) => {
      const memoryText = this.buildMemoryText(chapter);
      return {
        id: `${chapter.id}-memory`,
        chapterId: chapter.id,
        chapterTitle: chapter.title,
        content: memoryText,
        keywords: [],
        relevance: 0.95 - index * 0.05,
        position: 'middle',
      };
    });
  }

  private buildMemoryText(chapter: Chapter): string {
    if (chapter.summary && this.hasSummaryContent(chapter.summary)) {
      const parts: string[] = [];
      if (chapter.summary.mainPoint) {
        parts.push(`核心观点：${chapter.summary.mainPoint}`);
      }
      if (chapter.summary.keyPoints && chapter.summary.keyPoints.length > 0) {
        parts.push(`关键要点：${chapter.summary.keyPoints.join('；')}`);
      }
      if (chapter.summary.conclusion) {
        parts.push(`结论：${chapter.summary.conclusion}`);
      }
      return `章节：${chapter.title}\n${parts.join('\n')}`;
    }

    const simplified = this.buildFallbackSummary(chapter.content);
    return `章节：${chapter.title}\n摘要：${simplified}`;
  }

  private hasSummaryContent(summary: ChapterSummary): boolean {
    return Boolean(
      (summary.mainPoint && summary.mainPoint.trim()) ||
      (summary.keyPoints && summary.keyPoints.length > 0) ||
      (summary.conclusion && summary.conclusion.trim())
    );
  }

  private buildFallbackSummary(content: string): string {
    const cleaned = content
      .replace(/^#+\s.*$/gm, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
    if (!cleaned) return '暂无可用前文摘要。';

    const paragraphs = cleaned.split(/\n\n+/).map((item) => item.trim()).filter(Boolean);
    if (paragraphs.length === 0) {
      return cleaned.slice(0, 180);
    }

    const head = paragraphs[0].slice(0, 120);
    const tail = paragraphs.length > 1 ? paragraphs[paragraphs.length - 1].slice(0, 120) : '';
    return tail ? `${head} … ${tail}` : head;
  }

  private normalizeChapterId(rawChapterId: string): string {
    const match = rawChapterId.match(/^ch-(\d+)/i);
    if (!match) return rawChapterId;
    return match[1].padStart(2, '0');
  }

  private parseChapterNumber(raw: string): number {
    const normalized = this.normalizeChapterId(raw);
    const parsed = parseInt(normalized, 10);
    return Number.isFinite(parsed) ? parsed : Number.NaN;
  }
}
