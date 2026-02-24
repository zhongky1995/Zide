// 项目类型枚举
export enum ProjectType {
  PROPOSAL = 'proposal',    // 方案
  REPORT = 'report',        // 报告
  RESEARCH = 'research',    // 研究报告
  NOVEL = 'novel',          // 小说
  OTHER = 'other',         // 其他
}

// 项目状态枚举
export enum ProjectStatus {
  DRAFT = 'draft',         // 草稿
  IN_PROGRESS = 'in_progress',  // 进行中
  REVIEW = 'review',      // 审核中
  COMPLETED = 'completed', // 已完成
  ARCHIVED = 'archived',  // 已归档
}

// 项目基础信息
export interface ProjectBase {
  id: string;
  name: string;
  type: ProjectType;
  description?: string;
  targetReaders?: string;     // 目标读者
  targetScale?: string;      // 目标规模（如：3万字）
  status: ProjectStatus;
  createdAt: string;
  updatedAt: string;
}

// 项目元信息（运行时存储）
export interface ProjectMeta {
  background?: string;      // 项目背景
  objectives?: string;     // 项目目标
  constraints?: string;    // 限制条件
  styleGuide?: string;     // 风格指南
}

// 完整项目实体
export interface Project extends ProjectBase {
  meta: ProjectMeta;
  chapterIds: string[];     // 章节 ID 列表
  glossaryCount: number;   // 术语数量
  outlineStatus: 'none' | 'draft' | 'confirmed'; // 大纲状态
}

// 项目创建参数
export interface CreateProjectParams {
  name: string;
  type: ProjectType;
  targetReaders?: string;
  targetScale?: string;
  description?: string;
}

// 项目更新参数
export interface UpdateProjectParams {
  name?: string;
  description?: string;
  targetReaders?: string;
  targetScale?: string;
  status?: ProjectStatus;
  meta?: Partial<ProjectMeta>;
}
