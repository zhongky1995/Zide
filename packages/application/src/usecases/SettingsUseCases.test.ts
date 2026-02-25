import { ProjectSettingsUseCase } from './SettingsUseCases';
import { ProjectStatus, ProjectType, WritingTone } from '@zide/domain';

function createProject() {
  return {
    id: 'project-1',
    name: '测试项目',
    type: ProjectType.REPORT,
    status: ProjectStatus.DRAFT,
    meta: {
      background: 'bg',
      objectives: '',
      constraints: '',
      styleGuide: '',
    },
    chapterIds: [],
    glossaryCount: 0,
    outlineStatus: 'none' as const,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    writingTone: undefined as WritingTone | undefined,
    targetAudience: undefined as string | undefined,
  };
}

describe('ProjectSettingsUseCase', () => {
  test('updateWritingTone 应写入仓储并可被读取', async () => {
    let project = createProject();

    const repo: any = {
      findById: jest.fn(async () => project),
      update: jest.fn(async (_id: string, params: Record<string, unknown>) => {
        project = {
          ...project,
          ...params,
          meta: { ...project.meta, ...(params.meta as Record<string, unknown> | undefined) },
          updatedAt: new Date().toISOString(),
        } as typeof project;
        return project;
      }),
      getGlossary: jest.fn(async () => ''),
    };

    const useCase = new ProjectSettingsUseCase(repo);
    const result = await useCase.updateWritingTone(project.id, 'professional');

    expect(repo.update).toHaveBeenCalledWith(project.id, { writingTone: 'professional' });
    expect(result.writingTone).toBe('professional');
  });

  test('updateTargetAudience 应写入仓储并可被读取', async () => {
    let project = createProject();

    const repo: any = {
      findById: jest.fn(async () => project),
      update: jest.fn(async (_id: string, params: Record<string, unknown>) => {
        project = {
          ...project,
          ...params,
          meta: { ...project.meta, ...(params.meta as Record<string, unknown> | undefined) },
          updatedAt: new Date().toISOString(),
        } as typeof project;
        return project;
      }),
      getGlossary: jest.fn(async () => ''),
    };

    const useCase = new ProjectSettingsUseCase(repo);
    const result = await useCase.updateTargetAudience(project.id, '管理层');

    expect(repo.update).toHaveBeenCalledWith(project.id, { targetAudience: '管理层' });
    expect(result.targetAudience).toBe('管理层');
  });
});
