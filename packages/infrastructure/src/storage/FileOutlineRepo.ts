import {
  Outline,
  OutlineChapter,
  OutlineChange,
  UpdateOutlineParams,
} from '@zide/domain';
import { OutlineRepoPort } from '@zide/application';
import * as fs from 'fs/promises';
import * as path from 'path';
import { FileChapterRepo } from './FileChapterRepo';

export class FileOutlineRepo implements OutlineRepoPort {
  constructor(private readonly runtimeBasePath: string) {}

  private getOutlinePath(projectId: string): string {
    return path.join(this.runtimeBasePath, projectId, 'outline', 'outline.md');
  }

  private getChaptersDir(projectId: string): string {
    return path.join(this.runtimeBasePath, projectId, 'chapters');
  }

  async findByProjectId(projectId: string): Promise<Outline | null> {
    try {
      const outlinePath = this.getOutlinePath(projectId);
      const content = await fs.readFile(outlinePath, 'utf-8');
      return this.parseOutlineFile(content, projectId);
    } catch {
      return null;
    }
  }

  async save(outline: Outline): Promise<void> {
    const outlinePath = this.getOutlinePath(outline.projectId);
    await fs.mkdir(path.dirname(outlinePath), { recursive: true });
    const content = this.serializeOutline(outline);
    await fs.writeFile(outlinePath, content, 'utf-8');

    // 保证大纲中的章节都具备可编辑的章节文件（最小可用桩文件）
    await this.ensureChapterFiles(outline);
  }

  async update(projectId: string, params: UpdateOutlineParams): Promise<Outline> {
    const outline = await this.findByProjectId(projectId);
    if (!outline) {
      throw new Error(`Outline not found for project: ${projectId}`);
    }

    const updated: Outline = {
      ...outline,
      ...params,
      updatedAt: new Date().toISOString(),
    };

    await this.save(updated);
    return updated;
  }

  async addChapter(projectId: string, chapter: OutlineChapter): Promise<Outline> {
    const outline = await this.findByProjectId(projectId);
    if (!outline) {
      throw new Error(`Outline not found for project: ${projectId}`);
    }

    outline.chapters.push(chapter);
    outline.updatedAt = new Date().toISOString();
    outline.status = 'draft';

    await this.save(outline);

    return outline;
  }

  async updateChapter(
    projectId: string,
    chapterId: string,
    chapter: Partial<OutlineChapter>
  ): Promise<Outline> {
    const outline = await this.findByProjectId(projectId);
    if (!outline) {
      throw new Error(`Outline not found for project: ${projectId}`);
    }

    const index = this.findChapterIndex(outline.chapters, chapterId);
    if (index === -1) {
      throw new Error(`Chapter not found: ${chapterId}`);
    }

    outline.chapters[index] = { ...outline.chapters[index], ...chapter };
    outline.updatedAt = new Date().toISOString();

    await this.save(outline);

    // 更新章节文件
    const chapterFile = outline.chapters[index];
    const chapterPath = path.join(this.getChaptersDir(projectId), `${chapterFile.number}.md`);
    let content = '';
    try {
      content = await fs.readFile(chapterPath, 'utf-8');
    } catch {
      // 文件不存在则跳过
      return outline;
    }
    // 更新标题
    const updatedContent = content.replace(
      /^# .+$/m,
      `# ${chapterFile.title}`
    );
    await fs.writeFile(chapterPath, updatedContent, 'utf-8');

    return outline;
  }

  async deleteChapter(projectId: string, chapterId: string): Promise<Outline> {
    const outline = await this.findByProjectId(projectId);
    if (!outline) {
      throw new Error(`Outline not found for project: ${projectId}`);
    }

    const chapter = outline.chapters[this.findChapterIndex(outline.chapters, chapterId)];
    if (!chapter) {
      throw new Error(`Chapter not found: ${chapterId}`);
    }

    // 删除章节文件
    const chapterPath = path.join(
      this.getChaptersDir(projectId),
      `${chapter.number}.md`
    );
    await fs.unlink(chapterPath).catch(() => {
      // 忽略文件不存在错误
    });

    outline.chapters = outline.chapters.filter((c) => c.id !== chapter.id);
    outline.updatedAt = new Date().toISOString();

    await this.save(outline);
    return outline;
  }

  async reorderChapters(projectId: string, chapterIds: string[]): Promise<Outline> {
    const outline = await this.findByProjectId(projectId);
    if (!outline) {
      throw new Error(`Outline not found for project: ${projectId}`);
    }

    const reordered: OutlineChapter[] = [];
    for (const id of chapterIds) {
      const index = this.findChapterIndex(outline.chapters, id);
      if (index === -1) continue;
      reordered.push(outline.chapters[index]);
    }

    if (reordered.length !== outline.chapters.length) {
      throw new Error('排序章节失败：输入章节列表与当前大纲不一致');
    }

    // 更新编号
    const renamePairs: { fromNumber: string; toNumber: string }[] = [];
    reordered.forEach((chapter, index) => {
      const newNumber = String(index + 1).padStart(2, '0');
      if (chapter.number !== newNumber) {
        renamePairs.push({
          fromNumber: chapter.number,
          toNumber: newNumber,
        });
      }
      chapter.number = newNumber;
      chapter.id = newNumber;
    });

    await this.renameChapterFiles(projectId, renamePairs);

    outline.chapters = reordered;
    outline.updatedAt = new Date().toISOString();

    await this.save(outline);
    return outline;
  }

  async confirm(projectId: string): Promise<Outline> {
    const outline = await this.findByProjectId(projectId);
    if (!outline) {
      throw new Error(`Outline not found for project: ${projectId}`);
    }

    outline.status = 'confirmed';
    outline.updatedAt = new Date().toISOString();

    await this.save(outline);
    return outline;
  }

  async delete(projectId: string): Promise<void> {
    const outlinePath = this.getOutlinePath(projectId);
    await fs.unlink(outlinePath).catch(() => {
      // 忽略文件不存在错误
    });
  }

  // 版本管理：获取指定版本
  async getVersion(projectId: string, version: number): Promise<Outline | null> {
    const outline = await this.findByProjectId(projectId);
    return outline; // 当前实现不支持多版本，返回当前版本
  }

  // 版本管理：列出所有版本
  async listVersions(projectId: string): Promise<{ version: number; createdAt: string }[]> {
    const outline = await this.findByProjectId(projectId);
    if (!outline) return [];
    return [{
      version: 1,
      createdAt: outline.updatedAt,
    }];
  }

  // 版本管理：回滚到指定版本
  async rollback(projectId: string, targetVersion: number): Promise<Outline> {
    const outline = await this.findByProjectId(projectId);
    if (!outline) {
      throw new Error(`Outline not found for project: ${projectId}`);
    }
    return outline;
  }

  // 变更历史：获取变更记录
  async getChangeHistory(projectId: string, limit: number = 10): Promise<OutlineChange[]> {
    // 当前实现不支持变更历史，返回空数组
    return [];
  }

  private serializeOutline(outline: Outline): string {
    const lines = ['# 大纲\n'];

    for (const chapter of outline.chapters) {
      const statusIcon = chapter.status === 'completed' ? '✓' : '○';
      lines.push(`- [${statusIcon}] ${chapter.number} ${chapter.title}`);
      if (chapter.target) {
        lines.push(`  - 目标: ${chapter.target}`);
      }
    }

    lines.push('');
    lines.push('---');
    lines.push('');
    lines.push(`> 项目ID: ${outline.projectId}`);
    lines.push(`> 状态: ${outline.status}`);
    if (outline.generatedAt) {
      lines.push(`> 生成时间: ${outline.generatedAt}`);
    }
    lines.push(`> 更新时间: ${outline.updatedAt}`);

    return lines.join('\n');
  }

  private parseOutlineFile(content: string, projectId: string): Outline {
    const chapters: OutlineChapter[] = [];
    const lines = content.split('\n');
    let status: 'draft' | 'confirmed' = 'draft';
    let generatedAt: string | undefined;
    let lastChapterIndex = -1;

    for (const line of lines) {
      // 解析章节 - 支持 [○], [√], [✓], [x] 等标记
      const chapterMatch = line.match(/^-\s*\[([^\]]*)\s*\]\s*(\d+)\s+(.+)$/);
      if (chapterMatch) {
        const [, checked, number, title] = chapterMatch;
        // 完成状态：√, ✓, x, X 表示完成，○, 待定表示未完成
        const isCompleted = checked && /^[√✓xX]$/.test(checked.trim());
        chapters.push({
          id: number,
          number,
          title: title.trim(),
          status: isCompleted ? 'completed' : 'pending',
        });
        lastChapterIndex = chapters.length - 1;
        continue;
      }

      // 解析章节目标（梗概）
      const targetMatch = line.match(/^\s*-\s*目标:\s*(.+)$/);
      if (targetMatch && lastChapterIndex >= 0) {
        chapters[lastChapterIndex].target = targetMatch[1].trim();
        continue;
      }

      // 解析状态
      const statusMatch = line.match(/^>\s*状态:\s*(\w+)$/);
      if (statusMatch) {
        status = statusMatch[1] as 'draft' | 'confirmed';
      }

      // 解析生成时间
      const generatedMatch = line.match(/^>\s*生成时间:\s*(.+)$/);
      if (generatedMatch) {
        generatedAt = generatedMatch[1].trim();
      }
    }

    return {
      projectId,
      chapters,
      status,
      version: 1,
      generatedAt,
      updatedAt: new Date().toISOString(),
    };
  }

  // 根据大纲兜底创建章节文件，避免“已生成大纲但章节工作台为空”
  private async ensureChapterFiles(outline: Outline): Promise<void> {
    const chaptersDir = this.getChaptersDir(outline.projectId);
    await fs.mkdir(chaptersDir, { recursive: true });
    const chapterRepo = new FileChapterRepo(this.runtimeBasePath);
    const expectedChapterNumbers = new Set(outline.chapters.map(ch => ch.number));

    await this.archiveOrphanChapterFiles(outline.projectId, expectedChapterNumbers);

    for (const chapter of outline.chapters) {
      const chapterPath = path.join(chaptersDir, `${chapter.number}.md`);

      try {
        await fs.access(chapterPath);
        // 已存在章节文件：同步标题/目标，正文与进度保留
        await chapterRepo.updateByProjectId(outline.projectId, chapter.number, {
          title: chapter.title,
          target: chapter.target,
        });
        continue;
      } catch {
        // 文件不存在，创建最小章节文件
      }

      const now = new Date().toISOString();
      const safeTarget = chapter.target?.trim() || '';
      const contentLines = [
        `# ${chapter.title}`,
        '',
        '---',
        `number: ${chapter.number}`,
        'status: todo',
        'completion: 0',
        ...(safeTarget ? [`target: ${safeTarget}`] : []),
        'operationCount: 0',
        `createdAt: ${now}`,
        `updatedAt: ${now}`,
        '---',
        '',
        ...(safeTarget ? [`> 写作目标：${safeTarget}`, ''] : []),
      ];

      await fs.writeFile(chapterPath, contentLines.join('\n'), 'utf-8');
    }
  }

  // 将不在当前大纲中的章节文件归档，避免章节工作台出现陈旧数据
  private async archiveOrphanChapterFiles(projectId: string, expectedChapterNumbers: Set<string>): Promise<void> {
    const chapterDir = this.getChaptersDir(projectId);
    let files: string[] = [];

    try {
      files = await fs.readdir(chapterDir);
    } catch {
      return;
    }

    const orphanFiles = files.filter((file) => (
      file.endsWith('.md') && !expectedChapterNumbers.has(file.replace('.md', ''))
    ));

    if (orphanFiles.length === 0) return;

    const archiveDir = path.join(chapterDir, '_orphan');
    await fs.mkdir(archiveDir, { recursive: true });

    const timestamp = Date.now();
    for (const file of orphanFiles) {
      const fromPath = path.join(chapterDir, file);
      const toPath = path.join(archiveDir, `${timestamp}-${file}`);
      await fs.rename(fromPath, toPath);
    }
  }

  private findChapterIndex(chapters: OutlineChapter[], rawChapterId: string): number {
    const normalized = this.normalizeChapterId(rawChapterId);
    return chapters.findIndex((chapter) => (
      chapter.id === rawChapterId ||
      chapter.id === normalized ||
      chapter.number === rawChapterId ||
      chapter.number === normalized
    ));
  }

  private normalizeChapterId(rawChapterId: string): string {
    const match = rawChapterId.match(/^ch-(\d+)/i);
    if (!match) return rawChapterId;
    return match[1].padStart(2, '0');
  }

  // 章节重排后同步重命名文件，保证编号与文件名一致
  private async renameChapterFiles(
    projectId: string,
    pairs: { fromNumber: string; toNumber: string }[]
  ): Promise<void> {
    if (pairs.length === 0) return;

    const chapterDir = this.getChaptersDir(projectId);
    const stagedMoves: { tempPath: string; finalPath: string }[] = [];
    const stamp = Date.now();

    for (let i = 0; i < pairs.length; i++) {
      const pair = pairs[i];
      const fromPath = path.join(chapterDir, `${pair.fromNumber}.md`);
      const toPath = path.join(chapterDir, `${pair.toNumber}.md`);
      const tempPath = path.join(chapterDir, `.__reorder_${stamp}_${i}.md`);

      try {
        await fs.access(fromPath);
      } catch {
        continue;
      }

      await fs.rename(fromPath, tempPath);
      stagedMoves.push({ tempPath, finalPath: toPath });
    }

    for (const move of stagedMoves) {
      await fs.rename(move.tempPath, move.finalPath);
    }
  }
}
