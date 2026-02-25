import {
  Chapter,
  ChapterStatus,
  ChapterSummary,
  UpdateChapterParams,
  ChapterNotFoundError,
} from '@zide/domain';
import { ChapterRepoPort } from '../ports';

// 章节工作台用例
export class ChapterWorkbenchUseCase {
  constructor(private readonly chapterRepo: ChapterRepoPort) {}

  // 获取章节
  async getChapter(projectId: string, chapterId: string): Promise<Chapter | null> {
    return this.chapterRepo.findByChapterId(projectId, chapterId);
  }

  // 获取项目所有章节
  async getChapters(projectId: string): Promise<Chapter[]> {
    return this.chapterRepo.findByProjectId(projectId);
  }

  // 更新章节内容
  async updateContent(projectId: string, chapterId: string, content: string): Promise<Chapter> {
    const chapter = await this.chapterRepo.findByChapterId(projectId, chapterId);
    if (!chapter) {
      throw new ChapterNotFoundError(chapterId);
    }

    // 自动计算完成度
    const completion = this.calculateCompletion(content);

    return this.chapterRepo.updateByProjectId(projectId, chapterId, {
      content,
      completion,
    });
  }

  // 更新章节状态
  async updateStatus(projectId: string, chapterId: string, status: ChapterStatus): Promise<Chapter> {
    return this.chapterRepo.updateByProjectId(projectId, chapterId, { status });
  }

  // 更新章节元信息
  async updateMeta(
    projectId: string,
    chapterId: string,
    params: { title?: string; target?: string }
  ): Promise<Chapter> {
    return this.chapterRepo.updateByProjectId(projectId, chapterId, params);
  }

  // 更新摘要
  async updateSummary(projectId: string, chapterId: string, summary: ChapterSummary): Promise<Chapter> {
    return this.chapterRepo.updateSummary(projectId, chapterId, summary);
  }

  // 手动更新完成度
  async updateCompletion(projectId: string, chapterId: string, completion: number): Promise<Chapter> {
    return this.chapterRepo.updateCompletion(projectId, chapterId, completion);
  }

  // 获取下一章节编号
  async getNextNumber(projectId: string): Promise<string> {
    return this.chapterRepo.getNextNumber(projectId);
  }

  // 计算完成度（基于内容长度和结构）
  private calculateCompletion(content: string): number {
    if (!content || content.trim().length === 0) {
      return 0;
    }

    // 基础完成度：基于字数估算
    // 假设 2000 字为 100%
    const baseScore = Math.min(100, (content.length / 2000) * 100);

    // 结构加成：有标题、段落组织
    let structureBonus = 0;
    if (content.includes('# ')) structureBonus += 10; // 有章节标题
    if (content.includes('\n\n')) structureBonus += 10; // 有段落分隔

    return Math.min(100, Math.round(baseScore + structureBonus));
  }

  // 批量获取章节摘要列表（用于侧边栏展示）
  async getChapterSummaryList(projectId: string): Promise<{
    id: string;
    number: string;
    title: string;
    status: ChapterStatus;
    completion: number;
    wordCount: number;
  }[]> {
    const chapters = await this.chapterRepo.findByProjectId(projectId);

    return chapters.map(ch => ({
      id: ch.id,
      number: ch.number,
      title: ch.title,
      status: ch.status,
      completion: ch.completion,
      wordCount: ch.wordCount,
    }));
  }
}
