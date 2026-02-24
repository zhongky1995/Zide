import { Project, CreateProjectParams, ProjectType, ProjectStatus } from '@zide/domain';
import { ProjectService } from '@zide/domain';
import { ProjectRepoPort } from '../ports/ProjectRepoPort';
import * as path from 'path';
import * as fs from 'fs/promises';

// 项目创建用例
export class CreateProjectUseCase {
  constructor(private readonly projectRepo: ProjectRepoPort) {}

  async execute(params: CreateProjectParams, runtimeBasePath: string): Promise<Project> {
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
    await this.createProjectDirectory(runtimeBasePath, projectId, params);

    // 5. 保存项目元数据
    const project: Project = {
      ...projectData,
      id: projectId,
    };

    await this.projectRepo.create(params);

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

  private async createProjectDirectory(
    basePath: string,
    projectId: string,
    params: CreateProjectParams
  ): Promise<void> {
    const projectPath = path.join(basePath, projectId);

    // 创建目录结构
    await fs.mkdir(path.join(projectPath, 'meta'), { recursive: true });
    await fs.mkdir(path.join(projectPath, 'chapters'), { recursive: true });
    await fs.mkdir(path.join(projectPath, 'snapshots', 'chapter'), { recursive: true });
    await fs.mkdir(path.join(projectPath, 'snapshots', 'global'), { recursive: true });
    await fs.mkdir(path.join(projectPath, 'artifacts', 'references'), { recursive: true });
    await fs.mkdir(path.join(projectPath, 'output'), { recursive: true });
    await fs.mkdir(path.join(projectPath, 'logs'), { recursive: true });

    // 创建初始文件
    await this.createMetaFiles(projectPath, params);
    await this.createOutlineFile(projectPath);
  }

  private async createMetaFiles(
    projectPath: string,
    params: CreateProjectParams
  ): Promise<void> {
    const projectId = path.basename(projectPath);

    // project.md
    const projectContent = `# ${params.name}

- **类型**: ${params.type || '其他'}
- **目标读者**: ${params.targetReaders || '未指定'}
- **目标规模**: ${params.targetScale || '未指定'}
- **描述**: ${params.description || '无'}

\`\`\`yaml
id: ${projectId}
created_at: ${new Date().toISOString()}
status: draft
\`\`\`
`;
    await fs.writeFile(path.join(projectPath, 'meta', 'project.md'), projectContent);

    // constraints.md
    const constraintsContent = `# 项目约束

## 目标

## 限制条件

## 风格指南

`;
    await fs.writeFile(path.join(projectPath, 'meta', 'constraints.md'), constraintsContent);

    // glossary.md
    const glossaryContent = `# 术语表

> 本项目的专业术语定义

`;
    await fs.writeFile(path.join(projectPath, 'meta', 'glossary.md'), glossaryContent);
  }

  private async createOutlineFile(projectPath: string): Promise<void> {
    const outlineContent = `# 大纲

> 章节结构将在这里定义

- [ ] 第1章：待添加

`;
    await fs.mkdir(path.join(projectPath, 'outline'), { recursive: true });
    await fs.writeFile(path.join(projectPath, 'outline', 'outline.md'), outlineContent);
  }
}
