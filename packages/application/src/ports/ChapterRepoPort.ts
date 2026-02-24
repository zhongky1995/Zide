import {
  Chapter,
  CreateChapterParams,
  UpdateChapterParams,
  ChapterSummary,
} from '@zide/domain';

export interface ChapterRepoPort {
  // 创建章节
  create(params: CreateChapterParams): Promise<Chapter>;

  // 根据 ID 获取章节
  findById(id: string): Promise<Chapter | null>;

  // 根据项目 ID 获取所有章节
  findByProjectId(projectId: string): Promise<Chapter[]>;

  // 更新章节
  update(id: string, params: UpdateChapterParams): Promise<Chapter>;

  // 删除章节
  delete(id: string): Promise<void>;

  // 更新章节内容
  updateContent(id: string, content: string): Promise<Chapter>;

  // 更新摘要
  updateSummary(id: string, summary: ChapterSummary): Promise<Chapter>;

  // 更新完成度
  updateCompletion(id: string, completion: number): Promise<Chapter>;

  // 更新 AI 操作计数
  incrementOperationCount(id: string): Promise<void>;

  // 设置最后操作 ID
  setLastOperationId(id: string, operationId: string): Promise<void>;

  // 获取下一章节编号
  getNextNumber(projectId: string): Promise<string>;
}
