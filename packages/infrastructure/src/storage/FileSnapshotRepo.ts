import {
  Snapshot,
  SnapshotType,
  CreateSnapshotParams,
  ChapterSnapshotContent,
  GlobalSnapshotContent,
} from '@zide/domain';
import { SnapshotRepoPort } from '@zide/application';
import * as fs from 'fs/promises';
import * as path from 'path';

export class FileSnapshotRepo implements SnapshotRepoPort {
  constructor(private readonly runtimeBasePath: string) {}

  private getSnapshotDir(projectId: string, type: SnapshotType): string {
    return path.join(this.runtimeBasePath, projectId, 'snapshots', type);
  }

  async create(params: CreateSnapshotParams): Promise<Snapshot> {
    const snapshotId = `snap-${Date.now()}`;
    const now = new Date().toISOString();

    let content: ChapterSnapshotContent | GlobalSnapshotContent;

    if (params.type === SnapshotType.CHAPTER && params.chapterId) {
      // 章节快照
      content = await this.createChapterSnapshotContent(params.projectId, params.chapterId);
    } else {
      // 全局快照
      content = await this.createGlobalSnapshotContent(params.projectId);
    }

    const snapshot: Snapshot = {
      id: snapshotId,
      projectId: params.projectId,
      type: params.type,
      description: params.description,
      content,
      chapterId: params.chapterId,
      operationId: params.operationId,
      createdAt: now,
    };

    // 保存快照
    const snapshotDir = this.getSnapshotDir(params.projectId, params.type);
    await fs.mkdir(snapshotDir, { recursive: true });

    const snapshotFile = path.join(snapshotDir, `${snapshotId}.json`);
    await fs.writeFile(snapshotFile, JSON.stringify(snapshot, null, 2));

    return snapshot;
  }

  async findById(id: string): Promise<Snapshot | null> {
    // snapshotId 不包含 projectId，需扫描项目目录查找
    try {
      const entries = await fs.readdir(this.runtimeBasePath, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;

        for (const type of [SnapshotType.CHAPTER, SnapshotType.GLOBAL]) {
          const snapshotFile = path.join(
            this.runtimeBasePath,
            entry.name,
            'snapshots',
            type,
            `${id}.json`
          );
          try {
            const content = await fs.readFile(snapshotFile, 'utf-8');
            return JSON.parse(content);
          } catch {
            continue;
          }
        }
      }
    } catch {
      // ignore
    }
    return null;
  }

  async findByProjectId(projectId: string): Promise<Snapshot[]> {
    const snapshots: Snapshot[] = [];

    for (const type of [SnapshotType.CHAPTER, SnapshotType.GLOBAL]) {
      const snapshotDir = this.getSnapshotDir(projectId, type);

      try {
        const files = await fs.readdir(snapshotDir);

        for (const file of files) {
          if (!file.endsWith('.json')) continue;

          const content = await fs.readFile(path.join(snapshotDir, file), 'utf-8');
          snapshots.push(JSON.parse(content));
        }
      } catch {
        // 目录不存在，跳过
      }
    }

    // 按时间倒序
    return snapshots.sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  async findChapterSnapshots(projectId: string, chapterId: string): Promise<Snapshot[]> {
    const snapshots: Snapshot[] = [];
    const snapshotDir = path.join(this.runtimeBasePath, projectId, 'snapshots', 'chapter');

    try {
      const files = await fs.readdir(snapshotDir);

      for (const file of files) {
        if (!file.endsWith('.json')) continue;

        const content = await fs.readFile(path.join(snapshotDir, file), 'utf-8');
        const snapshot = JSON.parse(content) as Snapshot;
        if (snapshot.chapterId === chapterId) {
          snapshots.push(snapshot);
        }
      }
    } catch {
      // 目录不存在
    }

    return snapshots.sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  async findLatest(projectId: string, type?: SnapshotType): Promise<Snapshot | null> {
    const snapshots = await this.findByProjectId(projectId);

    let filtered = snapshots;
    if (type) {
      filtered = snapshots.filter(s => s.type === type);
    }

    return filtered[0] || null;
  }

  async rollback(snapshotId: string): Promise<{ projectId: string; restoredChapters: string[] }> {
    const snapshot = await this.findById(snapshotId);
    if (!snapshot) {
      throw new Error(`Snapshot not found: ${snapshotId}`);
    }

    const projectId = snapshot.projectId;
    const restoredChapters: string[] = [];

    if (snapshot.type === SnapshotType.CHAPTER) {
      // 章节快照回滚
      const chapterContent = snapshot.content as ChapterSnapshotContent;
      const chapterId = chapterContent.chapterId;

      const chapterPath = path.join(
        this.runtimeBasePath,
        projectId,
        'chapters',
        `${chapterId}.md`
      );

      const content = `# ${chapterContent.title}\n\n---\nnumber: ${chapterContent.number}\nstatus: draft\ncompletion: ${Math.round((chapterContent.wordCount / 2000) * 100)}\noperationCount: 0\ncreatedAt: ${snapshot.createdAt}\nupdatedAt: ${snapshot.createdAt}\n---\n\n${chapterContent.content}`;

      await fs.writeFile(chapterPath, content);
      restoredChapters.push(chapterId);
    } else {
      // 全局快照回滚
      const globalContent = snapshot.content as GlobalSnapshotContent;

      // 回滚每个章节
      for (const chapterSnap of globalContent.chapters) {
        const chapterPath = path.join(
          this.runtimeBasePath,
          projectId,
          'chapters',
          `${chapterSnap.chapterId}.md`
        );

        const content = `# ${chapterSnap.title}\n\n---\nnumber: ${chapterSnap.number}\nstatus: draft\ncompletion: ${Math.round((chapterSnap.wordCount / 2000) * 100)}\noperationCount: 0\ncreatedAt: ${snapshot.createdAt}\nupdatedAt: ${snapshot.createdAt}\n---\n\n${chapterSnap.content}`;

        await fs.writeFile(chapterPath, content);
        restoredChapters.push(chapterSnap.chapterId);
      }
    }

    return { projectId, restoredChapters };
  }

  async delete(id: string): Promise<void> {
    const snapshot = await this.findById(id);
    if (!snapshot) return;

    const snapshotDir = this.getSnapshotDir(snapshot.projectId, snapshot.type);
    const snapshotFile = path.join(snapshotDir, `${id}.json`);

    await fs.unlink(snapshotFile).catch(() => {});
  }

  async cleanup(projectId: string, keepCount: number): Promise<number> {
    const snapshots = await this.findByProjectId(projectId);
    const toDelete = snapshots.slice(keepCount);

    for (const snapshot of toDelete) {
      await this.delete(snapshot.id);
    }

    return toDelete.length;
  }

  private async createChapterSnapshotContent(projectId: string, chapterId: string): Promise<ChapterSnapshotContent> {
    const chapterPath = path.join(this.runtimeBasePath, projectId, 'chapters', `${chapterId}.md`);
    const content = await fs.readFile(chapterPath, 'utf-8');

    // 解析章节内容
    const lines = content.split('\n');
    let title = chapterId;
    let body = '';
    let number = chapterId;
    let inFrontmatter = false;
    let frontmatterEnded = false;
    let bodyStartIndex = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      if (line.startsWith('# ')) {
        title = line.replace('# ', '');
      }

      if (line === '---') {
        if (!inFrontmatter && !frontmatterEnded) {
          inFrontmatter = true;
          continue;
        }

        if (inFrontmatter) {
          inFrontmatter = false;
          frontmatterEnded = true;
          bodyStartIndex = i + 1;
          continue;
        }
      }

      if (inFrontmatter && line.startsWith('number: ')) {
        number = line.replace('number: ', '').trim();
      }
    }

    if (frontmatterEnded) {
      body = lines.slice(bodyStartIndex).join('\n').trim();
    } else {
      // 兼容旧文件：没有 frontmatter 时去掉首行标题
      body = lines.slice(1).join('\n').trim();
    }

    return {
      chapterId,
      number,
      title,
      content: body,
      summary: '',
      wordCount: this.countWords(body),
    };
  }

  private async createGlobalSnapshotContent(projectId: string): Promise<GlobalSnapshotContent> {
    const chapters: ChapterSnapshotContent[] = [];

    // 读取所有章节
    const chaptersDir = path.join(this.runtimeBasePath, projectId, 'chapters');

    try {
      const files = await fs.readdir(chaptersDir);

      for (const file of files) {
        if (!file.endsWith('.md')) continue;

        const chapterId = file.replace('.md', '');
        const chapterContent = await this.createChapterSnapshotContent(projectId, chapterId);
        chapters.push(chapterContent);
      }
    } catch {
      // 目录不存在
    }

    // 读取大纲
    let outline = '';
    try {
      const outlinePath = path.join(this.runtimeBasePath, projectId, 'outline', 'outline.md');
      outline = await fs.readFile(outlinePath, 'utf-8');
    } catch {}

    // 读取术语表
    let glossary: string[] = [];
    try {
      const glossaryPath = path.join(this.runtimeBasePath, projectId, 'meta', 'glossary.md');
      const glossaryContent = await fs.readFile(glossaryPath, 'utf-8');
      // 简单提取术语
      const matches = glossaryContent.match(/- \*\*(.+?)\*\*/g) || [];
      glossary = matches.map(m => m.replace(/(- \*\*|\*\*)/g, '').trim());
    } catch {}

    // 读取项目信息
    let projectMeta: Record<string, unknown> = {};
    try {
      const projectPath = path.join(this.runtimeBasePath, projectId, 'meta', 'project.md');
      const projectContent = await fs.readFile(projectPath, 'utf-8');
      projectMeta = { raw: projectContent.slice(0, 500) };
    } catch {}

    return {
      project: {
        name: projectId,
        meta: projectMeta,
        status: 'draft',
      },
      chapters,
      glossary,
      outline,
    };
  }

  private countWords(text: string): number {
    if (!text) return 0;
    const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
    const englishWords = text.replace(/[\u4e00-\u9fa5]/g, '').split(/\s+/).filter(w => w.length > 0).length;
    return chineseChars + englishWords;
  }
}
