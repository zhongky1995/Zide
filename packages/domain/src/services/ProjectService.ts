import {
  Project,
  ProjectType,
  ProjectStatus,
  CreateProjectParams,
} from '../entities/Project';
import { DomainError } from '../errors/DomainError';

// 项目领域服务
export class ProjectService {
  // 创建项目实体
  static createEntity(params: CreateProjectParams): Omit<Project, 'id'> {
    const now = new Date().toISOString();

    return {
      name: params.name,
      type: params.type || ProjectType.OTHER,
      description: params.description,
      targetReaders: params.targetReaders,
      targetScale: params.targetScale,
      status: ProjectStatus.DRAFT,
      meta: {
        background: '',
        objectives: '',
        constraints: '',
        styleGuide: '',
      },
      chapterIds: [],
      glossaryCount: 0,
      outlineStatus: 'none',
      createdAt: now,
      updatedAt: now,
    };
  }

  // 验证项目名称
  static validateName(name: string): void {
    if (!name || name.trim().length === 0) {
      throw new DomainError('项目名称不能为空', 'INVALID_PROJECT_NAME');
    }
    if (name.length > 100) {
      throw new DomainError('项目名称不能超过100个字符', 'PROJECT_NAME_TOO_LONG');
    }
  }

  // 验证项目类型
  static validateType(type: ProjectType): void {
    const validTypes = Object.values(ProjectType);
    if (!validTypes.includes(type)) {
      throw new DomainError(`无效的项目类型: ${type}`, 'INVALID_PROJECT_TYPE');
    }
  }
}
