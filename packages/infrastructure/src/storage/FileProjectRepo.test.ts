import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { ProjectType } from '@zide/domain';
import { FileProjectRepo } from './FileProjectRepo';

describe('FileProjectRepo', () => {
  test('writingTone 和 targetAudience 应可持久化', async () => {
    const basePath = await fs.mkdtemp(path.join(os.tmpdir(), 'zide-project-repo-'));
    const repo = new FileProjectRepo(basePath);

    const created = await repo.create(
      {
        name: '持久化测试项目',
        type: ProjectType.REPORT,
      },
      'project-persist-1'
    );

    await repo.update(created.id, {
      writingTone: 'professional',
      targetAudience: '管理层',
    });

    // 重新实例化仓储，验证从磁盘读取后的结果
    const reloadedRepo = new FileProjectRepo(basePath);
    const loaded = await reloadedRepo.findById(created.id);

    expect(loaded).not.toBeNull();
    expect(loaded?.writingTone).toBe('professional');
    expect(loaded?.targetAudience).toBe('管理层');
  });
});
