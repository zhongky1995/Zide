import { Project, ProjectStatus, ProjectType } from '@zide/domain';
import { LLMPort, OutlineRepoPort, ProjectRepoPort } from '../ports';
import { GenerateOutlineUseCase } from './OutlineUseCases';

function createProject(projectId: string): Project {
  const now = new Date().toISOString();
  return {
    id: projectId,
    name: '测试项目',
    type: ProjectType.REPORT,
    status: ProjectStatus.DRAFT,
    meta: {
      background: '全局背景',
      objectives: '全局目标',
      constraints: '全局约束',
      styleGuide: '专业表达',
    },
    chapterIds: [],
    glossaryCount: 0,
    outlineStatus: 'none',
    writingTone: 'professional',
    targetAudience: '管理层',
    createdAt: now,
    updatedAt: now,
  };
}

function createLLMMock(content: string): LLMPort {
  return {
    generate: jest.fn().mockResolvedValue({
      content,
      model: 'test-model',
      tokens: 120,
      finishReason: 'stop',
    }),
    ping: jest.fn().mockResolvedValue(true),
    getConfig: jest.fn().mockReturnValue({
      provider: 'custom',
      model: 'test-model',
    }),
    updateConfig: jest.fn(),
  };
}

describe('GenerateOutlineUseCase', () => {
  test('AI 返回章节标题与梗概时应完整落地到 outline.target', async () => {
    const projectId = 'project-outline-target';
    let savedOutline: any = null;

    const outlineRepo = {
      save: jest.fn(async (outline) => {
        savedOutline = outline;
      }),
    } as unknown as OutlineRepoPort;

    const projectRepo = {
      findById: jest.fn().mockResolvedValue(createProject(projectId)),
      updateOutlineStatus: jest.fn().mockResolvedValue(undefined),
    } as unknown as ProjectRepoPort;

    const llm = createLLMMock(JSON.stringify([
      {
        title: '项目背景与问题定义',
        target: '说明背景、现状与关键问题，明确边界。',
      },
      {
        title: '方案设计与实施路径',
        target: '给出方案对比、实施步骤与关键里程碑。',
      },
    ]));

    const useCase = new GenerateOutlineUseCase(outlineRepo, projectRepo, llm);
    const outline = await useCase.execute({ projectId });

    expect(outline.chapters).toHaveLength(2);
    expect(outline.chapters[0].title).toBe('项目背景与问题定义');
    expect(outline.chapters[0].target).toContain('背景');
    expect(outline.chapters[1].target).toContain('里程碑');
    expect(savedOutline?.chapters?.[0]?.target).toContain('背景');
  });

  test('AI 仅返回标题数组时应自动补齐章节梗概', async () => {
    const projectId = 'project-outline-target-fallback';

    const outlineRepo = {
      save: jest.fn(async () => undefined),
    } as unknown as OutlineRepoPort;

    const projectRepo = {
      findById: jest.fn().mockResolvedValue(createProject(projectId)),
      updateOutlineStatus: jest.fn().mockResolvedValue(undefined),
    } as unknown as ProjectRepoPort;

    const llm = createLLMMock(JSON.stringify([
      '问题分析',
      '解决方案',
      '实施计划',
    ]));

    const useCase = new GenerateOutlineUseCase(outlineRepo, projectRepo, llm);
    const outline = await useCase.execute({ projectId });

    expect(outline.chapters).toHaveLength(3);
    for (const chapter of outline.chapters) {
      expect(chapter.target).toBeTruthy();
      expect(chapter.target).toContain('围绕');
    }
  });
});
