import { Project, CreateProjectParams, ProjectType, ProjectStatus } from '@zide/domain';
import { ProjectService } from '@zide/domain';
import { ProjectRepoPort } from '../ports/ProjectRepoPort';

// 项目创建用例
export class CreateProjectUseCase {
  constructor(private readonly projectRepo: ProjectRepoPort) {}

  async execute(params: CreateProjectParams): Promise<Project> {
    // 1. 验证输入
    ProjectService.validateName(params.name);
    if (params.type) {
      ProjectService.validateType(params.type);
    }

    // 2. 生成项目 ID（使用时间戳+随机字符串）
    const projectId = this.generateProjectId(params.name);

    // 3. 创建项目实体
    const projectData = ProjectService.createEntity({
      ...params,
      name: params.name.trim(),
    });

    // 4. 创建项目目录结构
    await this.projectRepo.createProjectDirectory(projectId, params);

    // 5. 保存项目元数据（使用已有的projectId）
    const project: Project = {
      ...projectData,
      id: projectId,
    };

    await this.projectRepo.create(params, projectId);

    return project;
  }

  private generateProjectId(name: string): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9\u4e00-\u9fa5]/g, '')
      .substring(0, 10);
    return `${slug}-${timestamp}-${random}`;
  }
}
