import {
  Chapter,
  CreateChapterParams,
  UpdateChapterParams,
  ChapterSummary,
} from '@zide/domain';

export interface ChapterRepoPort {
  // 创建章节
  create(params: CreateChapterParams): Promise<Chapter>;

  // 根据项目 ID 和章节 ID 获取章节
  findByChapterId(projectId: string, chapterId: string): Promise<Chapter | null>;

  // 根据 ID 获取章节（兼容旧接口）
  findById(id: string): Promise<Chapter | null>;

  // 根据项目 ID 获取所有章节
  findByProjectId(projectId: string): Promise<Chapter[]>;

  // 更新章节（需 projectId）
  updateByProjectId(projectId: string, chapterId: string, params: UpdateChapterParams): Promise<Chapter>;

  // 更新章节（兼容旧接口）
  update(id: string, params: UpdateChapterParams): Promise<Chapter>;

  // 删除章节（需 projectId）
  deleteByProjectId(projectId: string, chapterId: string): Promise<void>;

  // 删除章节（兼容旧接口）
  delete(id: string): Promise<void>;

  // 更新章节内容
  updateContent(projectId: string, chapterId: string, content: string): Promise<Chapter>;

  // 更新摘要
  updateSummary(projectId: string, chapterId: string, summary: ChapterSummary): Promise<Chapter>;

  // 更新完成度
  updateCompletion(projectId: string, chapterId: string, completion: number): Promise<Chapter>;

  // 更新 AI 操作计数
  incrementOperationCount(projectId: string, chapterId: string): Promise<void>;

  // 设置最后操作 ID
  setLastOperationId(projectId: string, chapterId: string, operationId: string): Promise<void>;

  // 获取下一章节编号
  getNextNumber(projectId: string): Promise<string>;
}
