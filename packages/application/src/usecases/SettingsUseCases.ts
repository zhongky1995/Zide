import { ProjectRepoPort, ProjectSettingsPort } from '../ports';
import { ProjectMeta, ProjectSettings, WritingTone, GlossaryTerm } from '@zide/domain';

// 项目设定用例实现
export class ProjectSettingsUseCase implements ProjectSettingsPort {
  constructor(
    private readonly projectRepo: ProjectRepoPort
  ) {}

  // 获取完整项目设定
  async getSettings(projectId: string): Promise<ProjectSettings> {
    const project = await this.projectRepo.findById(projectId);
    if (!project) {
      throw new Error(`Project not found: ${projectId}`);
    }

    return {
      projectId,
      meta: project.meta,
      glossaryCount: project.glossaryCount,
      writingTone: (project as any).writingTone,
      targetAudience: (project as any).targetAudience,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
    };
  }

  // 更新项目元信息
  async updateMeta(projectId: string, meta: Partial<ProjectMeta>): Promise<ProjectSettings> {
    const project = await this.projectRepo.findById(projectId);
    if (!project) {
      throw new Error(`Project not found: ${projectId}`);
    }

    const updatedMeta = { ...project.meta, ...meta };
    await this.projectRepo.update(projectId, { meta: updatedMeta });

    return this.getSettings(projectId);
  }

  // 更新写作风格
  async updateWritingTone(
    projectId: string,
    tone: WritingTone
  ): Promise<ProjectSettings> {
    const project = await this.projectRepo.findById(projectId);
    if (!project) {
      throw new Error(`Project not found: ${projectId}`);
    }

    await this.projectRepo.update(projectId, {
      meta: { ...project.meta },
    } as any);

    // 注意：writingTone 存储在扩展字段中
    (project as any).writingTone = tone;

    return this.getSettings(projectId);
  }

  // 更新目标读者
  async updateTargetAudience(projectId: string, audience: string): Promise<ProjectSettings> {
    const project = await this.projectRepo.findById(projectId);
    if (!project) {
      throw new Error(`Project not found: ${projectId}`);
    }

    (project as any).targetAudience = audience;

    return this.getSettings(projectId);
  }

  // 获取术语表（从 ProjectRepo 获取）
  async getGlossary(projectId: string): Promise<GlossaryTerm[]> {
    // TODO: 实现术语表存储后从 GlossaryRepo 获取
    // 当前通过 getGlossary 获取 markdown 内容
    const glossaryText = await this.projectRepo.getGlossary(projectId);
    return []; // 临时返回空数组
  }

  // 更新术语表
  async updateGlossary(projectId: string, terms: GlossaryTerm[]): Promise<ProjectSettings> {
    // TODO: 实现术语表存储逻辑
    return this.getSettings(projectId);
  }

  // 导出为AI可用格式
  async exportForContext(projectId: string) {
    const settings = await this.getSettings(projectId);
    const glossaryText = await this.projectRepo.getGlossary(projectId);

    return {
      background: settings.meta.background || '',
      objectives: settings.meta.objectives || '',
      constraints: settings.meta.constraints || '',
      styleGuide: settings.meta.styleGuide || '',
      writingGuide: settings.meta.writingGuide || '',
      glossaryText: glossaryText || '',
      writingTone: settings.writingTone,
      targetAudience: settings.targetAudience,
    };
  }
}
