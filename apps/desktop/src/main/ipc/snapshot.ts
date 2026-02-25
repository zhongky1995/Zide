import { ipcMain } from 'electron';
import { FileSnapshotRepo } from '@zide/infrastructure';
import { SnapshotUseCases } from '@zide/application';
import { SnapshotType } from '@zide/domain';
import { getRuntimeBasePath } from '../runtimePaths';
import { ErrorCode } from './errors';
import { runIpc } from './response';

// 创建用例实例
function createSnapshotUseCase(): SnapshotUseCases {
  const repo = new FileSnapshotRepo(getRuntimeBasePath());
  return new SnapshotUseCases(repo);
}

// 注册快照相关的 IPC 处理函数
export function registerSnapshotHandlers(): void {
  // 创建章节快照（自动）
  ipcMain.handle('snapshot:createChapter', async (_event, projectId: string, chapterId: string, operationId?: string) => {
    return runIpc(async () => {
      const useCase = createSnapshotUseCase();
      return useCase.createChapterSnapshot(projectId, chapterId, operationId);
    }, '创建快照失败', ErrorCode.STORAGE_WRITE_FAILED, {
      channel: 'snapshot:createChapter',
      args: { projectId, chapterId, operationId },
    });
  });

  // 创建全局快照（手动）
  ipcMain.handle('snapshot:createGlobal', async (_event, projectId: string, description?: string) => {
    return runIpc(async () => {
      const useCase = createSnapshotUseCase();
      return useCase.createGlobalSnapshot(projectId, description);
    }, '创建快照失败', ErrorCode.STORAGE_WRITE_FAILED, {
      channel: 'snapshot:createGlobal',
      args: { projectId },
    });
  });

  // 获取快照列表
  ipcMain.handle('snapshot:list', async (_event, projectId: string) => {
    return runIpc(async () => {
      const useCase = createSnapshotUseCase();
      return useCase.getSnapshots(projectId);
    }, '获取快照列表失败', ErrorCode.STORAGE_READ_FAILED, {
      channel: 'snapshot:list',
      args: { projectId },
    });
  });

  // 获取单个快照
  ipcMain.handle('snapshot:get', async (_event, snapshotId: string) => {
    return runIpc(async () => {
      const useCase = createSnapshotUseCase();
      const snapshot = await useCase.getSnapshot(snapshotId);

      if (!snapshot) {
        throw new Error('快照不存在');
      }

      return snapshot;
    }, '获取快照失败', ErrorCode.NOT_FOUND, {
      channel: 'snapshot:get',
      args: { snapshotId },
    });
  });

  // 获取最新快照
  ipcMain.handle('snapshot:getLatest', async (_event, projectId: string, type?: string) => {
    return runIpc(async () => {
      const useCase = createSnapshotUseCase();
      return useCase.getLatestSnapshot(projectId, type as SnapshotType);
    }, '获取最新快照失败', ErrorCode.STORAGE_READ_FAILED, {
      channel: 'snapshot:getLatest',
      args: { projectId, type },
    });
  });

  // 回滚到指定快照
  ipcMain.handle('snapshot:rollback', async (_event, snapshotId: string) => {
    return runIpc(async () => {
      const useCase = createSnapshotUseCase();
      return useCase.rollback(snapshotId);
    }, '回滚失败', ErrorCode.STORAGE_WRITE_FAILED, {
      channel: 'snapshot:rollback',
      args: { snapshotId },
    });
  });

  // 回滚到上一版本（章节）
  ipcMain.handle('snapshot:rollbackChapter', async (_event, projectId: string, chapterId: string) => {
    return runIpc(async () => {
      const useCase = createSnapshotUseCase();
      return useCase.rollbackChapter(projectId, chapterId);
    }, '章节回滚失败', ErrorCode.STORAGE_WRITE_FAILED, {
      channel: 'snapshot:rollbackChapter',
      args: { projectId, chapterId },
    });
  });

  // 删除快照
  ipcMain.handle('snapshot:delete', async (_event, snapshotId: string) => {
    return runIpc(async () => {
      const useCase = createSnapshotUseCase();
      await useCase.deleteSnapshot(snapshotId);
      return { deleted: true };
    }, '删除快照失败', ErrorCode.STORAGE_WRITE_FAILED, {
      channel: 'snapshot:delete',
      args: { snapshotId },
    });
  });

  // 清理旧快照
  ipcMain.handle('snapshot:cleanup', async (_event, projectId: string, keepCount?: number) => {
    return runIpc(async () => {
      const useCase = createSnapshotUseCase();
      const deletedCount = await useCase.cleanup(projectId, keepCount);
      return { deletedCount };
    }, '清理快照失败', ErrorCode.STORAGE_WRITE_FAILED, {
      channel: 'snapshot:cleanup',
      args: { projectId, keepCount },
    });
  });

  // 获取快照数量
  ipcMain.handle('snapshot:count', async (_event, projectId: string) => {
    return runIpc(async () => {
      const useCase = createSnapshotUseCase();
      const count = await useCase.getSnapshotCount(projectId);
      return { count };
    }, '获取快照数量失败', ErrorCode.STORAGE_READ_FAILED, {
      channel: 'snapshot:count',
      args: { projectId },
    });
  });
}
