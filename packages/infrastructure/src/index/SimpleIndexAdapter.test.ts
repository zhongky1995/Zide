import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { Outline } from '@zide/domain';
import { FileChapterRepo } from '../storage/FileChapterRepo';
import { FileOutlineRepo } from '../storage/FileOutlineRepo';
import { FileProjectRepo } from '../storage/FileProjectRepo';
import { SimpleIndexAdapter } from './SimpleIndexAdapter';

describe('SimpleIndexAdapter', () => {
  test('packContext 应包含全局设定 + 前文章节摘要记忆', async () => {
    const basePath = await fs.mkdtemp(path.join(os.tmpdir(), 'zide-context-memory-'));
    const projectId = 'project-context-memory';
    const projectRepo = new FileProjectRepo(basePath);
    const outlineRepo = new FileOutlineRepo(basePath);
    const chapterRepo = new FileChapterRepo(basePath);

    await projectRepo.create(
      {
        name: '上下文测试',
        type: 'report' as any,
      },
      projectId
    );

    await projectRepo.update(projectId, {
      meta: {
        background: '这是项目背景A',
        objectives: '这是项目目标A',
        constraints: '这是项目约束A',
        styleGuide: '这是风格A',
      },
    });

    const outline: Outline = {
      projectId,
      status: 'draft',
      version: 1,
      generatedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      chapters: [
        { id: '01', number: '01', title: '第一章', target: '第一章梗概', status: 'pending' },
        { id: '02', number: '02', title: '第二章', target: '第二章梗概', status: 'pending' },
      ],
    };
    await outlineRepo.save(outline);

    await chapterRepo.updateByProjectId(projectId, '01', {
      content: '第一章正文：这是历史内容，包含关键论点与证据。',
      summary: {
        mainPoint: '第一章核心观点',
        keyPoints: ['要点A', '要点B'],
        conclusion: '第一章结论',
      },
    });

    const adapter = new SimpleIndexAdapter(basePath, { maxRelatedChapters: 5 });
    const pack = await adapter.packContext(projectId, '02');

    expect(pack.projectContext).toContain('项目背景');
    expect(pack.projectContext).toContain('这是项目背景A');
    expect(pack.relatedChapters).toHaveLength(1);
    expect(pack.relatedChapters[0].chapterId).toBe('01');
    expect(pack.relatedChapters[0].content).toContain('核心观点：第一章核心观点');
    expect(pack.sources[0].chapterId).toBe('01');
    expect(pack.outline).toContain('第一章');
  });

  test('packContext 在无结构化摘要时应回退到正文摘要', async () => {
    const basePath = await fs.mkdtemp(path.join(os.tmpdir(), 'zide-context-fallback-'));
    const projectId = 'project-context-fallback';
    const projectRepo = new FileProjectRepo(basePath);
    const outlineRepo = new FileOutlineRepo(basePath);
    const chapterRepo = new FileChapterRepo(basePath);

    await projectRepo.create(
      {
        name: '上下文回退测试',
        type: 'report' as any,
      },
      projectId
    );

    const outline: Outline = {
      projectId,
      status: 'draft',
      version: 1,
      generatedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      chapters: [
        { id: '01', number: '01', title: '第一章', target: '第一章梗概', status: 'pending' },
        { id: '02', number: '02', title: '第二章', target: '第二章梗概', status: 'pending' },
        { id: '03', number: '03', title: '第三章', target: '第三章梗概', status: 'pending' },
      ],
    };
    await outlineRepo.save(outline);

    await chapterRepo.updateByProjectId(projectId, '01', {
      content: '第一章第一段：建立背景。\n\n第一章第二段：提出问题并说明影响。\n\n第一章第三段：给出阶段结论。',
    });
    await chapterRepo.updateByProjectId(projectId, '02', {
      content: '第二章正文：承接第一章并展开解决路径。',
    });

    const adapter = new SimpleIndexAdapter(basePath, { maxRelatedChapters: 5 });
    const pack = await adapter.packContext(projectId, '03');

    expect(pack.relatedChapters.length).toBeGreaterThan(0);
    expect(pack.relatedChapters[0].content).toContain('摘要：');
  });
});
