import { Project, CreateProjectParams, UpdateProjectParams } from '@zide/domain';

export interface ProjectRepoPort {
  // 创建项目（可选传入projectId）
  create(params: CreateProjectParams, projectId?: string): Promise<Project>;

  // 根据 ID 获取项目
  findById(id: string): Promise<Project | null>;

  // 获取所有项目
  findAll(): Promise<Project[]>;

  // 更新项目
  update(id: string, params: UpdateProjectParams): Promise<Project>;

  // 删除项目
  delete(id: string): Promise<void>;

  // 更新大纲状态
  updateOutlineStatus(id: string, status: 'none' | 'draft' | 'confirmed'): Promise<void>;

  // 添加章节到项目
  addChapter(projectId: string, chapterId: string): Promise<void>;

  // 从项目移除章节
  removeChapter(projectId: string, chapterId: string): Promise<void>;

  // 创建项目目录结构
  createProjectDirectory(projectId: string, params: CreateProjectParams): Promise<void>;

  // 获取项目上下文（用于AI生成）
  getProjectContext(projectId: string): Promise<string>;

  // 获取术语表
  getGlossary(projectId: string): Promise<string>;

  // 获取大纲
  getOutline(projectId: string): Promise<string>;

  // 获取项目运行时基础路径
  getRuntimeBasePath(): string;
}
