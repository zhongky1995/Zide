import {
  Chapter,
  ChapterStatus,
  CreateChapterParams,
  UpdateChapterParams,
  ChapterSummary,
  AIOperation,
} from '@zide/domain';
import { ChapterRepoPort } from '@zide/application';
import * as fs from 'fs/promises';
import * as path from 'path';

export class FileChapterRepo implements ChapterRepoPort {
  constructor(private readonly runtimeBasePath: string) {}

  private getChapterPath(projectId: string, chapterId: string): string {
    return path.join(this.runtimeBasePath, projectId, 'chapters', `${chapterId}.md`);
  }

  private getChapterDir(projectId: string): string {
    return path.join(this.runtimeBasePath, projectId, 'chapters');
  }

  async create(params: CreateChapterParams): Promise<Chapter> {
    const now = new Date().toISOString();
    const chapterId = `ch-${Date.now()}`;

    const chapter: Chapter = {
      id: chapterId,
      projectId: params.projectId,
      number: params.number,
      title: params.title,
      target: params.target,
      status: ChapterStatus.TODO,
      wordCount: 0,
      completion: 0,
      content: '',
      operationCount: 0,
      createdAt: now,
      updatedAt: now,
    };

    await this.save(chapter);
    return chapter;
  }

  async findById(id: string): Promise<Chapter | null> {
    // 需要从项目目录中查找，这里简化处理
    // 实际实现需要通过项目列表或索引来定位
    return null;
  }

  async findByProjectId(projectId: string): Promise<Chapter[]> {
    try {
      const chaptersDir = this.getChapterDir(projectId);
      const files = await fs.readdir(chaptersDir);

      const chapters: Chapter[] = [];
      for (const file of files) {
        if (!file.endsWith('.md')) continue;

        const chapterId = file.replace('.md', '');
        const chapter = await this.findByChapterId(projectId, chapterId);
        if (chapter) {
          chapters.push(chapter);
        }
      }

      // 按编号排序
      return chapters.sort((a, b) => {
        const numA = parseInt(a.number) || 0;
        const numB = parseInt(b.number) || 0;
        return numA - numB;
      });
    } catch {
      return [];
    }
  }

  async findByChapterId(projectId: string, chapterId: string): Promise<Chapter | null> {
    try {
      const chapterPath = this.getChapterPath(projectId, chapterId);
      const content = await fs.readFile(chapterPath, 'utf-8');
      return this.parseChapterFile(content, projectId, chapterId);
    } catch {
      // 章节不存在，返回 null
      return null;
    }
  }

  async update(id: string, params: UpdateChapterParams): Promise<Chapter> {
    throw new Error('Use updateByProjectId instead');
  }

  async updateByProjectId(projectId: string, chapterId: string, params: UpdateChapterParams): Promise<Chapter> {
    const chapter = await this.findByChapterId(projectId, chapterId);
    if (!chapter) {
      throw new Error(`Chapter not found: ${chapterId}`);
    }

    const updated: Chapter = {
      ...chapter,
      ...params,
      updatedAt: new Date().toISOString(),
    };

    // 如果更新了内容，同步更新字数
    if (params.content !== undefined) {
      updated.wordCount = this.countWords(params.content);
    }

    await this.save(updated);
    return updated;
  }

  async delete(id: string): Promise<void> {
    throw new Error('Use deleteByProjectId instead');
  }

  async deleteByProjectId(projectId: string, chapterId: string): Promise<void> {
    const chapterPath = this.getChapterPath(projectId, chapterId);
    await fs.unlink(chapterPath).catch(() => {});
  }

  async updateContent(projectId: string, chapterId: string, content: string): Promise<Chapter> {
    return this.updateByProjectId(projectId, chapterId, { content });
  }

  async updateSummary(projectId: string, chapterId: string, summary: ChapterSummary): Promise<Chapter> {
    return this.updateByProjectId(projectId, chapterId, { summary });
  }

  async updateCompletion(projectId: string, chapterId: string, completion: number): Promise<Chapter> {
    return this.updateByProjectId(projectId, chapterId, { completion: Math.min(100, Math.max(0, completion)) });
  }

  async incrementOperationCount(projectId: string, chapterId: string): Promise<void> {
    const chapter = await this.findByChapterId(projectId, chapterId);
    if (chapter) {
      chapter.operationCount += 1;
      chapter.updatedAt = new Date().toISOString();
      await this.save(chapter);
    }
  }

  async setLastOperationId(projectId: string, chapterId: string, operationId: string): Promise<void> {
    const chapter = await this.findByChapterId(projectId, chapterId);
    if (chapter) {
      chapter.lastOperationId = operationId;
      chapter.updatedAt = new Date().toISOString();
      await this.save(chapter);
    }
  }

  async getNextNumber(projectId: string): Promise<string> {
    const chapters = await this.findByProjectId(projectId);
    if (chapters.length === 0) {
      return '01';
    }

    const maxNumber = chapters.reduce((max, ch) => {
      const num = parseInt(ch.number) || 0;
      return num > max ? num : max;
    }, 0);

    return String(maxNumber + 1).padStart(2, '0');
  }

  async saveOperation(projectId: string, chapterId: string, operation: AIOperation): Promise<void> {
    const opsDir = path.join(
      this.runtimeBasePath,
      projectId,
      'chapters',
      chapterId,
      'operations'
    );

    await fs.mkdir(opsDir, { recursive: true });

    const opFile = path.join(opsDir, `${operation.id}.json`);
    await fs.writeFile(opFile, JSON.stringify(operation, null, 2));
  }

  async getOperations(projectId: string, chapterId: string): Promise<AIOperation[]> {
    const opsDir = path.join(
      this.runtimeBasePath,
      projectId,
      'chapters',
      chapterId,
      'operations'
    );

    try {
      const files = await fs.readdir(opsDir);
      const operations: AIOperation[] = [];

      for (const file of files) {
        if (!file.endsWith('.json')) continue;

        const content = await fs.readFile(path.join(opsDir, file), 'utf-8');
        operations.push(JSON.parse(content));
      }

      // 按时间倒序
      return operations.sort((a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    } catch {
      return [];
    }
  }

  async adoptOperation(projectId: string, chapterId: string, operationId: string): Promise<void> {
    const opsDir = path.join(
      this.runtimeBasePath,
      projectId,
      'chapters',
      chapterId,
      'operations'
    );

    const opFile = path.join(opsDir, `${operationId}.json`);
    const content = await fs.readFile(opFile, 'utf-8');
    const operation: AIOperation = JSON.parse(content);

    operation.adopted = true;
    await fs.writeFile(opFile, JSON.stringify(operation, null, 2));
  }

  getRuntimeBasePath(): string {
    return this.runtimeBasePath;
  }

  private async save(chapter: Chapter): Promise<void> {
    const chapterDir = this.getChapterDir(chapter.projectId);
    await fs.mkdir(chapterDir, { recursive: true });

    const chapterPath = this.getChapterPath(chapter.projectId, chapter.id);
    const content = this.serializeChapter(chapter);
    await fs.writeFile(chapterPath, content, 'utf-8');
  }

  private serializeChapter(chapter: Chapter): string {
    const lines: string[] = [];

    // 标题
    lines.push(`# ${chapter.title}`);
    lines.push('');

    // 元数据
    lines.push('---');
    lines.push(`number: ${chapter.number}`);
    lines.push(`status: ${chapter.status}`);
    lines.push(`completion: ${chapter.completion}`);
    if (chapter.target) {
      lines.push(`target: ${chapter.target}`);
    }
    if (chapter.summary) {
      lines.push(`summary: ${JSON.stringify(chapter.summary)}`);
    }
    lines.push(`operationCount: ${chapter.operationCount}`);
    if (chapter.lastOperationId) {
      lines.push(`lastOperationId: ${chapter.lastOperationId}`);
    }
    lines.push(`createdAt: ${chapter.createdAt}`);
    lines.push(`updatedAt: ${chapter.updatedAt}`);
    lines.push('---');
    lines.push('');

    // 正文
    lines.push(chapter.content);

    return lines.join('\n');
  }

  private parseChapterFile(content: string, projectId: string, chapterId: string): Chapter {
    const lines = content.split('\n');
    let status: ChapterStatus = ChapterStatus.TODO;
    let number = chapterId.replace('ch-', '');
    let title = '';
    let target = '';
    let summary: ChapterSummary | undefined;
    let completion = 0;
    let operationCount = 0;
    let createdAt = new Date().toISOString();
    let updatedAt = new Date().toISOString();
    let lastOperationId: string | undefined;
    let bodyStartIndex = 0;

    // 解析 frontmatter
    let inFrontmatter = false;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      if (line === '---') {
        if (!inFrontmatter) {
          inFrontmatter = true;
        } else {
          inFrontmatter = false;
          bodyStartIndex = i + 1;
        }
        continue;
      }

      if (inFrontmatter) {
        if (line.startsWith('number: ')) {
          number = line.replace('number: ', '');
        } else if (line.startsWith('status: ')) {
          status = line.replace('status: ', '') as ChapterStatus;
        } else if (line.startsWith('completion: ')) {
          completion = parseInt(line.replace('completion: ', '')) || 0;
        } else if (line.startsWith('target: ')) {
          target = line.replace('target: ', '');
        } else if (line.startsWith('summary: ')) {
          try {
            summary = JSON.parse(line.replace('summary: ', ''));
          } catch {}
        } else if (line.startsWith('operationCount: ')) {
          operationCount = parseInt(line.replace('operationCount: ', '')) || 0;
        } else if (line.startsWith('createdAt: ')) {
          createdAt = line.replace('createdAt: ', '');
        } else if (line.startsWith('updatedAt: ')) {
          updatedAt = line.replace('updatedAt: ', '');
        } else if (line.startsWith('lastOperationId: ')) {
          lastOperationId = line.replace('lastOperationId: ', '');
        }
      } else if (line.startsWith('# ')) {
        title = line.replace('# ', '');
      }
    }

    // 获取正文
    const body = lines.slice(bodyStartIndex).join('\n').trim();

    return {
      id: chapterId,
      projectId,
      number,
      title: title || chapterId,
      status,
      wordCount: this.countWords(body),
      completion,
      target: target || undefined,
      summary,
      content: body,
      operationCount,
      lastOperationId,
      createdAt,
      updatedAt,
    };
  }

  private countWords(text: string): number {
    if (!text) return 0;
    // 简单按字符计算，中文按字符，英文按单词
    const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
    const englishWords = text.replace(/[\u4e00-\u9fa5]/g, '').split(/\s+/).filter(w => w.length > 0).length;
    return chineseChars + englishWords;
  }
}
