import { ProjectMeta, ProjectSettings, WritingTone } from '@zide/domain';
import { GlossaryTerm } from '@zide/domain';

export interface ProjectSettingsPort {
  // 获取项目设定
  getSettings(projectId: string): Promise<ProjectSettings>;

  // 更新项目元信息
  updateMeta(projectId: string, meta: Partial<ProjectMeta>): Promise<ProjectSettings>;

  // 更新写作风格
  updateWritingTone(projectId: string, tone: WritingTone): Promise<ProjectSettings>;

  // 更新目标读者
  updateTargetAudience(projectId: string, audience: string): Promise<ProjectSettings>;

  // 获取术语表
  getGlossary(projectId: string): Promise<GlossaryTerm[]>;

  // 更新术语表
  updateGlossary(projectId: string, terms: GlossaryTerm[]): Promise<ProjectSettings>;

  // 导出设定（用于AI上下文）
  exportForContext(projectId: string): Promise<{
    background: string;
    objectives: string;
    constraints: string;
    styleGuide: string;
    writingGuide: string;
    glossaryText: string;
    writingTone?: WritingTone;
    targetAudience?: string;
  }>;
}
