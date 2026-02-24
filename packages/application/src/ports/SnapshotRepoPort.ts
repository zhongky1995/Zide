import {
  Snapshot,
  CreateSnapshotParams,
  SnapshotType,
  SnapshotDiff,
} from '@zide/domain';

export interface SnapshotRepoPort {
  // 创建快照
  create(params: CreateSnapshotParams): Promise<Snapshot>;

  // 根据 ID 获取快照
  findById(id: string): Promise<Snapshot | null>;

  // 根据项目 ID 获取快照列表
  findByProjectId(projectId: string): Promise<Snapshot[]>;

  // 获取章节快照
  findChapterSnapshots(projectId: string, chapterId: string): Promise<Snapshot[]>;

  // 获取最新快照
  findLatest(projectId: string, type?: SnapshotType): Promise<Snapshot | null>;

  // 回滚到指定快照
  rollback(snapshotId: string): Promise<{
    projectId: string;
    restoredChapters: string[];
  }>;

  // 删除快照
  delete(id: string): Promise<void>;

  // 清理旧快照（保留最近 N 个）
  cleanup(projectId: string, keepCount: number): Promise<number>;
}
