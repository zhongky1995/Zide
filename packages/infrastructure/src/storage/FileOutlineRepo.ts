import {
  Outline,
  OutlineChapter,
  UpdateOutlineParams,
} from '@zide/domain';
import { OutlineRepoPort } from '@zide/application';
import * as fs from 'fs/promises';
import * as path from 'path';

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
    const content = this.serializeOutline(outline);
    await fs.writeFile(outlinePath, content, 'utf-8');
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

    // 创建章节文件
    const chapterPath = path.join(this.getChaptersDir(projectId), `${chapter.number}.md`);
    const chapterContent = `# ${chapter.title}\n\n${chapter.target || ''}\n`;
    await fs.writeFile(chapterPath, chapterContent, 'utf-8');

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

    const index = outline.chapters.findIndex((c) => c.id === chapterId);
    if (index === -1) {
      throw new Error(`Chapter not found: ${chapterId}`);
    }

    outline.chapters[index] = { ...outline.chapters[index], ...chapter };
    outline.updatedAt = new Date().toISOString();

    await this.save(outline);

    // 更新章节文件
    const chapterFile = outline.chapters[index];
    const chapterPath = path.join(
      this.getChaptersDir(projectId),
      `${chapterFile.number}.md`
    );
    const content = await fs.readFile(chapterPath, 'utf-8');
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

    const chapter = outline.chapters.find((c) => c.id === chapterId);
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

    outline.chapters = outline.chapters.filter((c) => c.id !== chapterId);
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
      const chapter = outline.chapters.find((c) => c.id === id);
      if (chapter) {
        reordered.push(chapter);
      }
    }

    // 更新编号
    reordered.forEach((chapter, index) => {
      chapter.number = String(index + 1).padStart(2, '0');
    });

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

    for (const line of lines) {
      // 解析章节
      const chapterMatch = line.match(/^-\s*\[([√✓]?)\s*\]\s*(\d+)\s+(.+)$/);
      if (chapterMatch) {
        const [, checked, number, title] = chapterMatch;
        chapters.push({
          id: `ch-${number}`,
          number,
          title: title.trim(),
          status: checked ? 'completed' : 'pending',
        });
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
      generatedAt,
      updatedAt: new Date().toISOString(),
    };
  }
}
