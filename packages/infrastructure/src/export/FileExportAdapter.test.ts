import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { ExportFormat } from '@zide/domain';
import { FileExportAdapter } from './FileExportAdapter';

async function createRuntimeProject(basePath: string, projectId: string): Promise<void> {
  const projectDir = path.join(basePath, projectId);
  await fs.mkdir(path.join(projectDir, 'meta'), { recursive: true });
  await fs.mkdir(path.join(projectDir, 'chapters'), { recursive: true });

  await fs.writeFile(
    path.join(projectDir, 'meta', 'project.md'),
    '# 导出测试项目\n',
    'utf-8'
  );

  const chapter = [
    '# 第一章',
    '',
    '---',
    'number: 01',
    'status: todo',
    'completion: 30',
    'operationCount: 0',
    `createdAt: ${new Date().toISOString()}`,
    `updatedAt: ${new Date().toISOString()}`,
    '---',
    '',
    '测试正文内容',
  ].join('\n');

  await fs.writeFile(path.join(projectDir, 'chapters', '01.md'), chapter, 'utf-8');
}

describe('FileExportAdapter', () => {
  test('支持格式应成功导出', async () => {
    const basePath = await fs.mkdtemp(path.join(os.tmpdir(), 'zide-export-ok-'));
    const projectId = 'project-ok';
    await createRuntimeProject(basePath, projectId);

    const adapter = new FileExportAdapter(basePath);
    const result = await adapter.export(projectId, ExportFormat.MARKDOWN);

    expect(result.filePath.endsWith('.md')).toBe(true);
    await fs.access(result.filePath);
  });

  test('非法格式应抛出 EXPORT_FORMAT_NOT_SUPPORTED', async () => {
    const basePath = await fs.mkdtemp(path.join(os.tmpdir(), 'zide-export-invalid-'));
    const projectId = 'project-invalid';
    await createRuntimeProject(basePath, projectId);

    const adapter = new FileExportAdapter(basePath);
    await expect(adapter.export(projectId, 'markdown' as any)).rejects.toMatchObject({
      code: 'EXPORT_FORMAT_NOT_SUPPORTED',
    });
  });
});
