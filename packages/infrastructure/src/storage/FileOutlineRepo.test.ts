import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { Outline } from '@zide/domain';
import { FileProjectRepo } from './FileProjectRepo';
import { FileOutlineRepo } from './FileOutlineRepo';

describe('FileOutlineRepo', () => {
  test('重生成大纲后，章节文件标题应与大纲同步', async () => {
    const basePath = await fs.mkdtemp(path.join(os.tmpdir(), 'zide-outline-sync-'));
    const projectId = 'project-outline-sync';
    const projectRepo = new FileProjectRepo(basePath);
    const outlineRepo = new FileOutlineRepo(basePath);

    await projectRepo.create(
      {
        name: '章节同步测试',
        type: 'report' as any,
      },
      projectId
    );

    const firstOutline: Outline = {
      projectId,
      status: 'draft',
      version: 1,
      generatedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      chapters: [
        { id: '01', number: '01', title: '旧标题-一', status: 'pending' },
        { id: '02', number: '02', title: '旧标题-二', status: 'pending' },
        { id: '03', number: '03', title: '旧标题-三', status: 'pending' },
      ],
    };
    await outlineRepo.save(firstOutline);

    const regeneratedOutline: Outline = {
      ...firstOutline,
      chapters: [
        { id: '01', number: '01', title: '新标题-一', status: 'pending' },
        { id: '02', number: '02', title: '新标题-二', status: 'pending' },
        { id: '03', number: '03', title: '新标题-三', status: 'pending' },
      ],
      updatedAt: new Date().toISOString(),
    };
    await outlineRepo.save(regeneratedOutline);

    const chapter01 = await fs.readFile(path.join(basePath, projectId, 'chapters', '01.md'), 'utf-8');
    const chapter02 = await fs.readFile(path.join(basePath, projectId, 'chapters', '02.md'), 'utf-8');
    const chapter03 = await fs.readFile(path.join(basePath, projectId, 'chapters', '03.md'), 'utf-8');

    expect(chapter01.startsWith('# 新标题-一')).toBe(true);
    expect(chapter02.startsWith('# 新标题-二')).toBe(true);
    expect(chapter03.startsWith('# 新标题-三')).toBe(true);
  });

  test('重生成后不在大纲中的章节文件应归档，避免工作台显示陈旧章节', async () => {
    const basePath = await fs.mkdtemp(path.join(os.tmpdir(), 'zide-outline-orphan-'));
    const projectId = 'project-outline-orphan';
    const projectRepo = new FileProjectRepo(basePath);
    const outlineRepo = new FileOutlineRepo(basePath);

    await projectRepo.create(
      {
        name: '章节归档测试',
        type: 'report' as any,
      },
      projectId
    );

    const initialOutline: Outline = {
      projectId,
      status: 'draft',
      version: 1,
      generatedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      chapters: [
        { id: '01', number: '01', title: '第一章', status: 'pending' },
        { id: '02', number: '02', title: '第二章', status: 'pending' },
        { id: '03', number: '03', title: '第三章', status: 'pending' },
      ],
    };
    await outlineRepo.save(initialOutline);

    const reducedOutline: Outline = {
      ...initialOutline,
      chapters: [
        { id: '01', number: '01', title: '第一章-新版', status: 'pending' },
        { id: '02', number: '02', title: '第二章-新版', status: 'pending' },
      ],
      updatedAt: new Date().toISOString(),
    };
    await outlineRepo.save(reducedOutline);

    await expect(fs.access(path.join(basePath, projectId, 'chapters', '03.md'))).rejects.toThrow();

    const orphanDir = path.join(basePath, projectId, 'chapters', '_orphan');
    const archived = await fs.readdir(orphanDir);
    expect(archived.some(file => file.endsWith('-03.md'))).toBe(true);
  });
});
