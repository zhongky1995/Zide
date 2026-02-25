import * as fs from 'fs/promises';
import * as path from 'path';

// 索引配置
export interface IndexConfig {
  chunkSize: number;        // 切片大小（字符数）
  chunkOverlap: number;     // 切片重叠
}

// 索引项
export interface IndexEntry {
  id: string;
  chapterId: string;
  chapterTitle: string;
  content: string;
  keywords: string[];
  position: 'start' | 'middle' | 'end';
}

// 简单索引实现
export class SimpleIndex {
  private index: Map<string, IndexEntry[]> = new Map();
  private config: IndexConfig;

  constructor(
    private readonly runtimeBasePath: string,
    config: Partial<IndexConfig> = {}
  ) {
    this.config = {
      chunkSize: config.chunkSize || 2000,
      chunkOverlap: config.chunkOverlap || 200,
    };
  }

  // 索引章节内容
  async indexChapter(projectId: string, chapterId: string, content: string, title: string): Promise<void> {
    // 先移除旧索引
    await this.removeChapterIndex(chapterId);

    // 切片
    const chunks = this.chunkContent(content);

    // 生成索引项
    const entries: IndexEntry[] = chunks.map((chunk, index) => ({
      id: `${chapterId}-chunk-${index}`,
      chapterId,
      chapterTitle: title,
      content: chunk,
      keywords: this.extractKeywords(chunk),
      position: index === 0 ? 'start' : index === chunks.length - 1 ? 'end' : 'middle',
    }));

    this.index.set(chapterId, entries);

    // 保存到文件
    await this.persist(projectId);
  }

  // 移除章节索引
  async removeChapterIndex(chapterId: string): Promise<void> {
    this.index.delete(chapterId);
  }

  // 检索相关上下文
  async retrieve(projectId: string, chapterId: string, query: string, limit: number = 5): Promise<IndexEntry[]> {
    // 确保加载索引
    await this.load(projectId);

    const allEntries = Array.from(this.index.values()).flat();
    if (allEntries.length === 0) {
      return [];
    }

    const normalizedQuery = query.trim();
    const queryKeywords = this.extractKeywords(normalizedQuery);

    // 计算相关度
    const scored = allEntries.map(entry => {
      let score = 0;

      // 当前章节内容降权，避免“检索相关上下文”时反复命中自己
      if (entry.chapterId === chapterId) {
        score -= 5;
      }

      // 空查询默认按章节顺序与内容位置给基础分（越近章节、末段优先）
      if (!normalizedQuery) {
        score += this.parseChapterOrder(entry.chapterId) / 100;
        if (entry.position === 'end') score += 3;
        if (entry.position === 'middle') score += 1;
      }

      // 标题匹配
      if (normalizedQuery && entry.chapterTitle.includes(normalizedQuery)) {
        score += 10;
      }

      // 关键词匹配
      for (const kw of queryKeywords) {
        if (entry.keywords.includes(kw)) {
          score += 5;
        }
        if (entry.content.includes(kw)) {
          score += 1;
        }
      }

      return { entry, score };
    });

    // 排序并返回 top N
    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(s => s.entry);
  }

  // 获取索引统计
  async getStats(projectId: string): Promise<{
    totalChunks: number;
    indexedChapters: number;
  }> {
    await this.load(projectId);

    let totalChunks = 0;
    for (const entries of this.index.values()) {
      totalChunks += entries.length;
    }

    return {
      totalChunks,
      indexedChapters: this.index.size,
    };
  }

  // 清理索引
  async clear(projectId: string): Promise<void> {
    this.index.clear();
    await this.persist(projectId);
  }

  // 重建项目索引
  async rebuildProjectIndex(projectId: string): Promise<void> {
    const chaptersDir = path.join(this.runtimeBasePath, projectId, 'chapters');

    try {
      const files = await fs.readdir(chaptersDir);
      this.index.clear();

      for (const file of files) {
        if (!file.endsWith('.md')) continue;

        const chapterId = file.replace('.md', '');
        const chapterPath = path.join(chaptersDir, file);
        const content = await fs.readFile(chapterPath, 'utf-8');

        // 解析章节（提取正文和标题）
        const lines = content.split('\n');
        let title = chapterId;
        let bodyStart = 0;

        for (let i = 0; i < lines.length; i++) {
          if (lines[i].startsWith('# ')) {
            title = lines[i].replace('# ', '');
          }
          if (lines[i].trim() === '---') {
            bodyStart = i + 1;
            break;
          }
        }

        const body = lines.slice(bodyStart).join('\n').trim();

        if (body) {
          await this.indexChapter(projectId, chapterId, body, title);
        }
      }
    } catch {
      // 目录不存在，忽略
    }
  }

  // 内容切片
  private chunkContent(content: string): string[] {
    if (content.length <= this.config.chunkSize) {
      return [content];
    }

    const chunks: string[] = [];
    let start = 0;

    while (start < content.length) {
      const end = start + this.config.chunkSize;
      let chunk = content.slice(start, end);

      // 尝试在句子边界切分
      const lastPeriod = Math.max(
        chunk.lastIndexOf('。'),
        chunk.lastIndexOf('.'),
        chunk.lastIndexOf('！'),
        chunk.lastIndexOf('!'),
        chunk.lastIndexOf('？'),
        chunk.lastIndexOf('?')
      );

      if (lastPeriod > start && lastPeriod < end - 10) {
        chunk = content.slice(start, start + lastPeriod + 1);
      }

      chunks.push(chunk);
      start += chunk.length - this.config.chunkOverlap;

      if (start >= content.length) break;
    }

    return chunks;
  }

  // 提取关键词
  private extractKeywords(text: string): string[] {
    // 简单实现：提取连续的中文词和英文单词
    const keywords: string[] = [];

    // 中文提取（2-6个连续汉字）
    const chineseMatches = text.match(/[\u4e00-\u9fa5]{2,6}/g) || [];
    keywords.push(...chineseMatches);

    // 英文提取
    const englishMatches = text.match(/[a-zA-Z]{3,}/g) || [];
    keywords.push(...englishMatches);

    // 去重并返回 top 20
    const unique = [...new Set(keywords)];
    return unique.slice(0, 20);
  }

  // 持久化
  private async persist(projectId: string): Promise<void> {
    const indexData: Record<string, IndexEntry[]> = {};
    for (const [chapterId, entries] of this.index) {
      indexData[chapterId] = entries;
    }

    const indexPath = path.join(this.runtimeBasePath, projectId, '.index.json');
    const dir = path.dirname(indexPath);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(indexPath, JSON.stringify(indexData, null, 2));
  }

  // 加载
  private async load(projectId: string): Promise<void> {
    const indexPath = path.join(this.runtimeBasePath, projectId, '.index.json');

    try {
      const content = await fs.readFile(indexPath, 'utf-8');
      const data = JSON.parse(content);
      this.index = new Map(Object.entries(data));
    } catch {
      // 文件不存在，需要重建索引
      await this.rebuildProjectIndex(projectId);
    }
  }

  private parseChapterOrder(raw: string): number {
    const normalized = raw.replace(/^ch-/i, '');
    const parsed = parseInt(normalized, 10);
    return Number.isFinite(parsed) ? parsed : 0;
  }
}
