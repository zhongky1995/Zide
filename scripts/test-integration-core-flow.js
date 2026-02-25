#!/usr/bin/env node

const assert = require('assert');
const fs = require('fs/promises');
const os = require('os');
const path = require('path');

const {
  FileProjectRepo,
  FileOutlineRepo,
  FileChapterRepo,
  FileSnapshotRepo,
  FileExportAdapter,
  MockLLMAdapter,
  SimpleIndexAdapter,
} = require('@zide/infrastructure');

const {
  CreateProjectUseCase,
  GenerateOutlineUseCase,
  GenerateContentUseCase,
  ChapterWorkbenchUseCase,
  SnapshotUseCases,
  ExportUseCases,
} = require('@zide/application');

async function run() {
  const basePath = path.join(os.tmpdir(), `zide-integration-${Date.now()}`);
  await fs.mkdir(basePath, { recursive: true });

  const projectRepo = new FileProjectRepo(basePath);
  const outlineRepo = new FileOutlineRepo(basePath);
  const chapterRepo = new FileChapterRepo(basePath);
  const snapshotRepo = new FileSnapshotRepo(basePath);
  const exportAdapter = new FileExportAdapter(basePath);
  const llm = new MockLLMAdapter();
  const index = new SimpleIndexAdapter(basePath);

  // 1. 创建项目
  const createProject = new CreateProjectUseCase(projectRepo);
  const project = await createProject.execute({
    name: 'Integration Core Flow',
    type: 'report',
    description: 'integration test',
  });
  assert.ok(project.id, '项目ID生成失败');

  // 2. 生成大纲（应自动创建章节文件）
  const generateOutline = new GenerateOutlineUseCase(outlineRepo, projectRepo, llm);
  const outline = await generateOutline.execute({
    projectId: project.id,
    chapterCount: 3,
    template: 'standard',
  });
  assert.strictEqual(outline.chapters.length, 3, '大纲章节数不符合预期');

  const chapterDir = path.join(basePath, project.id, 'chapters');
  const chapterFiles = (await fs.readdir(chapterDir)).sort();
  assert.deepStrictEqual(chapterFiles, ['01.md', '02.md', '03.md'], '章节文件未按预期创建');

  // 2.1 再生成大纲后，章节工作台应与最新大纲同步（标题更新 + 旧章归档）
  const regeneratedOutline = {
    ...outline,
    chapters: [
      { id: '01', number: '01', title: '新版章节-一', status: 'pending' },
      { id: '02', number: '02', title: '新版章节-二', status: 'pending' },
    ],
    updatedAt: new Date().toISOString(),
  };
  await outlineRepo.save(regeneratedOutline);

  const chapterUseCase = new ChapterWorkbenchUseCase(chapterRepo);
  const summaries = await chapterUseCase.getChapterSummaryList(project.id);
  assert.strictEqual(summaries.length, 2, '章节工作台未同步为最新章节数量');
  assert.deepStrictEqual(
    summaries.map((ch) => ch.title),
    ['新版章节-一', '新版章节-二'],
    '章节工作台标题未与再生成大纲同步'
  );

  const chapterFilesAfterRegenerate = (await fs.readdir(chapterDir)).sort();
  assert.deepStrictEqual(
    chapterFilesAfterRegenerate,
    ['01.md', '02.md', '_orphan'],
    '再生成后旧章节未按预期归档'
  );

  // 3. AI 续写（核心 AI 链路）
  const generateContent = new GenerateContentUseCase(llm, index, chapterRepo);
  const aiResult = await generateContent.generate(project.id, '01', 'continue');
  assert.ok(aiResult.chapter, 'AI 续写未返回章节');
  assert.ok(aiResult.chapter.content.length > 0, 'AI 续写未写入内容');

  // 4. 导出链路
  const exportUseCase = new ExportUseCases(exportAdapter, basePath);
  const exportResult = await exportUseCase.exportProject(project.id, 'md');
  await fs.access(exportResult.filePath);
  assert.ok(exportResult.filePath.endsWith('.md'), '导出文件格式不正确');

  // 5. 快照 + 回滚链路
  await chapterRepo.updateContent(project.id, '01', 'rollback baseline');
  const snapshotUseCase = new SnapshotUseCases(snapshotRepo);
  await snapshotUseCase.createChapterSnapshot(project.id, '01');
  await chapterRepo.updateContent(project.id, '01', 'rollback changed');
  await snapshotUseCase.rollbackChapter(project.id, '01');

  const rolledBackChapter = await chapterRepo.findByChapterId(project.id, '01');
  assert.ok(rolledBackChapter, '回滚后章节不存在');
  assert.ok(
    rolledBackChapter.content.includes('rollback baseline'),
    '章节回滚失败，内容未恢复'
  );

  console.log('Integration core flow passed');
  console.log(`Runtime: ${basePath}`);
}

run().catch((error) => {
  console.error('Integration core flow failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
