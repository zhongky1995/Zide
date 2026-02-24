import { IndexPort, ContextChunk, ContextPack, IndexConfig, RetrieveParams } from '@zide/application';
import { SimpleIndex } from './SimpleIndex';
import * as fs from 'fs/promises';
import * as path from 'path';

// 基于 SimpleIndex 的索引适配器
export class SimpleIndexAdapter implements IndexPort {
  private index: SimpleIndex;

  constructor(runtimeBasePath: string) {
    this.index = new SimpleIndex(runtimeBasePath);
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
    const metaPath = path.join(this.index['runtimeBasePath'], projectId, 'meta', 'project.md');
    let projectContext = '';
    try {
      projectContext = await fs.readFile(metaPath, 'utf-8');
      // 提取关键信息
      const lines = projectContext.split('\n');
      const keyLines = lines.filter(l =>
        l.startsWith('# ') ||
        l.includes('目标') ||
        l.includes('读者') ||
        l.includes('规模')
      );
      projectContext = keyLines.join('\n');
    } catch {}

    // 获取术语表
    const glossaryPath = path.join(this.index['runtimeBasePath'], projectId, 'meta', 'glossary.md');
    let glossary = '';
    try {
      glossary = await fs.readFile(glossaryPath, 'utf-8');
    } catch {}

    // 获取大纲
    const outlinePath = path.join(this.index['runtimeBasePath'], projectId, 'outline', 'outline.md');
    let outline = '';
    try {
      outline = await fs.readFile(outlinePath, 'utf-8');
    } catch {}

    // 获取相关章节
    const relatedChunks = await this.index.retrieve(projectId, chapterId, '', 10);

    const relatedChapters: ContextChunk[] = relatedChunks.map(entry => ({
      id: entry.id,
      chapterId: entry.chapterId,
      chapterTitle: entry.chapterTitle,
      content: entry.content,
      keywords: entry.keywords,
      relevance: 0.8,
      position: entry.position,
    }));

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
        this.index['runtimeBasePath'],
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
}
