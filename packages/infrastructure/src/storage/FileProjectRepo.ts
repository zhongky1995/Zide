import {
  Project,
  ProjectType,
  ProjectStatus,
  CreateProjectParams,
  UpdateProjectParams,
} from '@zide/domain';
import { ProjectRepoPort } from '@zide/application';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as yaml from 'yaml';

// 文件系统项目仓储实现
export class FileProjectRepo implements ProjectRepoPort {
  private projectsCache: Map<string, Project> = new Map();

  constructor(private readonly runtimeBasePath: string) {}

  private getProjectPath(projectId: string): string {
    return path.join(this.runtimeBasePath, projectId, 'meta', 'project.md');
  }

  private getProjectDir(projectId: string): string {
    return path.join(this.runtimeBasePath, projectId);
  }

  async create(params: CreateProjectParams): Promise<Project> {
    const projectId = this.generateProjectId(params.name);
    const now = new Date().toISOString();

    const project: Project = {
      id: projectId,
      name: params.name.trim(),
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

    await this.save(project);
    this.projectsCache.set(projectId, project);

    return project;
  }

  async findById(id: string): Promise<Project | null> {
    // 先检查缓存
    if (this.projectsCache.has(id)) {
      return this.projectsCache.get(id)!;
    }

    try {
      const projectPath = this.getProjectPath(id);
      const content = await fs.readFile(projectPath, 'utf-8');
      const project = this.parseProjectFile(content, id);
      this.projectsCache.set(id, project);
      return project;
    } catch {
      return null;
    }
  }

  async findAll(): Promise<Project[]> {
    try {
      const entries = await fs.readdir(this.runtimeBasePath, { withFileTypes: true });
      const projects: Project[] = [];

      for (const entry of entries) {
        if (entry.isDirectory()) {
          const project = await this.findById(entry.name);
          if (project) {
            projects.push(project);
          }
        }
      }

      return projects;
    } catch {
      return [];
    }
  }

  async update(id: string, params: UpdateProjectParams): Promise<Project> {
    const project = await this.findById(id);
    if (!project) {
      throw new Error(`Project not found: ${id}`);
    }

    const updated: Project = {
      ...project,
      ...params,
      meta: { ...project.meta, ...params.meta },
      updatedAt: new Date().toISOString(),
    };

    await this.save(updated);
    this.projectsCache.set(id, updated);

    return updated;
  }

  async delete(id: string): Promise<void> {
    const projectDir = this.getProjectDir(id);
    await fs.rm(projectDir, { recursive: true, force: true });
    this.projectsCache.delete(id);
  }

  async updateOutlineStatus(
    id: string,
    status: 'none' | 'draft' | 'confirmed'
  ): Promise<void> {
    // 直接更新并保存
    const project = await this.findById(id);
    if (!project) {
      throw new Error(`Project not found: ${id}`);
    }

    project.outlineStatus = status;
    project.updatedAt = new Date().toISOString();
    await this.save(project);
    this.projectsCache.set(id, project);
  }

  async addChapter(projectId: string, chapterId: string): Promise<void> {
    const project = await this.findById(projectId);
    if (!project) {
      throw new Error(`Project not found: ${projectId}`);
    }

    if (!project.chapterIds.includes(chapterId)) {
      project.chapterIds.push(chapterId);
      project.updatedAt = new Date().toISOString();
      await this.save(project);
    }
  }

  async removeChapter(projectId: string, chapterId: string): Promise<void> {
    const project = await this.findById(projectId);
    if (!project) {
      throw new Error(`Project not found: ${projectId}`);
    }

    project.chapterIds = project.chapterIds.filter((id) => id !== chapterId);
    project.updatedAt = new Date().toISOString();
    await this.save(project);
  }

  private async save(project: Project): Promise<void> {
    const projectPath = this.getProjectPath(project.id);
    const content = this.serializeProject(project);
    await fs.writeFile(projectPath, content, 'utf-8');
  }

  private serializeProject(project: Project): string {
    const frontmatter = {
      id: project.id,
      name: project.name,
      type: project.type,
      status: project.status,
      description: project.description,
      target_readers: project.targetReaders,
      target_scale: project.targetScale,
      outline_status: project.outlineStatus,
      glossary_count: project.glossaryCount,
      chapter_ids: project.chapterIds,
      created_at: project.createdAt,
      updated_at: project.updatedAt,
    };

    let content = `# ${project.name}\n\n`;
    if (project.description) {
      content += `${project.description}\n\n`;
    }

    content += `\`\`\`yaml\n${yaml.stringify(frontmatter)}\n\`\`\``;

    return content;
  }

  private parseProjectFile(content: string, id: string): Project {
    // 简单解析：从 YAML frontmatter 中提取
    const yamlMatch = content.match(/```yaml([\s\S]*?)```/);
    let data: Record<string, unknown> = {};

    if (yamlMatch) {
      try {
        data = yaml.parse(yamlMatch[1]) || {};
      } catch {
        // 解析失败使用默认值
      }
    }

    // 从标题获取名称
    const titleMatch = content.match(/^#\s+(.+)$/m);
    const name = (data.name as string) || (titleMatch ? titleMatch[1] : id);

    return {
      id: (data.id as string) || id,
      name,
      type: (data.type as ProjectType) || ProjectType.OTHER,
      status: (data.status as ProjectStatus) || ProjectStatus.DRAFT,
      description: data.description as string | undefined,
      targetReaders: data.target_readers as string | undefined,
      targetScale: data.target_scale as string | undefined,
      outlineStatus: (data.outline_status as 'none' | 'draft' | 'confirmed') || 'none',
      glossaryCount: (data.glossary_count as number) || 0,
      chapterIds: (data.chapter_ids as string[]) || [],
      meta: {
        background: '',
        objectives: '',
        constraints: '',
        styleGuide: '',
      },
      createdAt: (data.created_at as string) || new Date().toISOString(),
      updatedAt: (data.updated_at as string) || new Date().toISOString(),
    };
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
