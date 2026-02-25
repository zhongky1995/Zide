import {
  Snapshot,
  SnapshotType,
  CreateSnapshotParams,
  SnapshotNotFoundError,
} from '@zide/domain';
import { SnapshotRepoPort } from '../ports';

const MAX_SNAPSHOTS_PER_PROJECT = 50;

// 快照用例
export class SnapshotUseCases {
  constructor(private readonly snapshotRepo: SnapshotRepoPort) {}

  // 创建快照
  async createSnapshot(
    projectId: string,
    type: SnapshotType,
    description?: string,
    chapterId?: string,
    operationId?: string
  ): Promise<Snapshot> {
    const params: CreateSnapshotParams = {
      projectId,
      type,
      description,
      chapterId,
      operationId,
    };

    const snapshot = await this.snapshotRepo.create(params);

    // 自动清理旧快照
    await this.snapshotRepo.cleanup(projectId, MAX_SNAPSHOTS_PER_PROJECT);

    return snapshot;
  }

  // 创建章节快照（自动）
  async createChapterSnapshot(
    projectId: string,
    chapterId: string,
    operationId?: string
  ): Promise<Snapshot> {
    return this.createSnapshot(
      projectId,
      SnapshotType.CHAPTER,
      `自动快照 - 章节 ${chapterId}`,
      chapterId,
      operationId
    );
  }

  // 创建全局快照（手动）
  async createGlobalSnapshot(
    projectId: string,
    description?: string
  ): Promise<Snapshot> {
    return this.createSnapshot(
      projectId,
      SnapshotType.GLOBAL,
      description || '手动全局快照'
    );
  }

  // 获取快照列表
  async getSnapshots(projectId: string): Promise<Snapshot[]> {
    return this.snapshotRepo.findByProjectId(projectId);
  }

  // 获取单个快照
  async getSnapshot(snapshotId: string): Promise<Snapshot | null> {
    return this.snapshotRepo.findById(snapshotId);
  }

  // 获取最新快照
  async getLatestSnapshot(projectId: string, type?: SnapshotType): Promise<Snapshot | null> {
    return this.snapshotRepo.findLatest(projectId, type);
  }

  // 回滚到指定快照
  async rollback(snapshotId: string): Promise<{
    projectId: string;
    restoredChapters: string[];
  }> {
    return this.snapshotRepo.rollback(snapshotId);
  }

  // 回滚到上一版本（章节）
  async rollbackChapter(projectId: string, chapterId: string): Promise<{
    projectId: string;
    restoredChapters: string[];
  }> {
    const chapterSnapshots = await this.snapshotRepo.findChapterSnapshots(projectId, chapterId);
    const latest = chapterSnapshots[0];
    if (!latest?.id) {
      throw new SnapshotNotFoundError('latest');
    }

    return this.snapshotRepo.rollback(latest.id);
  }

  // 删除快照
  async deleteSnapshot(snapshotId: string): Promise<void> {
    return this.snapshotRepo.delete(snapshotId);
  }

  // 清理旧快照
  async cleanup(projectId: string, keepCount?: number): Promise<number> {
    return this.snapshotRepo.cleanup(projectId, keepCount || MAX_SNAPSHOTS_PER_PROJECT);
  }

  // 获取快照数量
  async getSnapshotCount(projectId: string): Promise<number> {
    const snapshots = await this.snapshotRepo.findByProjectId(projectId);
    return snapshots.length;
  }
}
