import { Outline, OutlineChapter, OutlineChange, UpdateOutlineParams } from '@zide/domain';

export interface OutlineRepoPort {
  // 获取大纲
  findByProjectId(projectId: string): Promise<Outline | null>;

  // 保存大纲
  save(outline: Outline): Promise<void>;

  // 更新大纲
  update(projectId: string, params: UpdateOutlineParams): Promise<Outline>;

  // 添加章节
  addChapter(projectId: string, chapter: OutlineChapter): Promise<Outline>;

  // 更新章节
  updateChapter(projectId: string, chapterId: string, chapter: Partial<OutlineChapter>): Promise<Outline>;

  // 删除章节
  deleteChapter(projectId: string, chapterId: string): Promise<Outline>;

  // 排序章节
  reorderChapters(projectId: string, chapterIds: string[]): Promise<Outline>;

  // 确认大纲
  confirm(projectId: string): Promise<Outline>;

  // 删除大纲
  delete(projectId: string): Promise<void>;

  // 版本管理：获取指定版本
  getVersion(projectId: string, version: number): Promise<Outline | null>;

  // 版本管理：列出所有版本
  listVersions(projectId: string): Promise<{ version: number; createdAt: string }[]>;

  // 版本管理：回滚到指定版本
  rollback(projectId: string, targetVersion: number): Promise<Outline>;

  // 变更历史：获取变更记录
  getChangeHistory(projectId: string, limit?: number): Promise<OutlineChange[]>;
}
