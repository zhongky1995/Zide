import { ipcMain } from 'electron';
import * as path from 'path';
import { app } from 'electron';
import { FileSnapshotRepo } from '@zide/infrastructure';
import { SnapshotUseCases } from '@zide/application';
import { SnapshotType } from '@zide/domain';

// 获取运行时基础路径
function getRuntimeBasePath(): string {
  return path.join(app.getPath('userData'), 'projects');
}

// 创建用例实例
function createSnapshotUseCase(): SnapshotUseCases {
  const repo = new FileSnapshotRepo(getRuntimeBasePath());
  return new SnapshotUseCases(repo);
}

// 注册快照相关的 IPC 处理函数
export function registerSnapshotHandlers(): void {
  // 创建章节快照（自动）
  ipcMain.handle('snapshot:createChapter', async (_event, projectId: string, chapterId: string, operationId?: string) => {
    try {
      const useCase = createSnapshotUseCase();
      const snapshot = await useCase.createChapterSnapshot(projectId, chapterId, operationId);
      return { success: true, data: snapshot };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '创建快照失败'
      };
    }
  });

  // 创建全局快照（手动）
  ipcMain.handle('snapshot:createGlobal', async (_event, projectId: string, description?: string) => {
    try {
      const useCase = createSnapshotUseCase();
      const snapshot = await useCase.createGlobalSnapshot(projectId, description);
      return { success: true, data: snapshot };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '创建快照失败'
      };
    }
  });

  // 获取快照列表
  ipcMain.handle('snapshot:list', async (_event, projectId: string) => {
    try {
      const useCase = createSnapshotUseCase();
      const snapshots = await useCase.getSnapshots(projectId);
      return { success: true, data: snapshots };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '获取快照列表失败'
      };
    }
  });

  // 获取单个快照
  ipcMain.handle('snapshot:get', async (_event, snapshotId: string) => {
    try {
      const useCase = createSnapshotUseCase();
      const snapshot = await useCase.getSnapshot(snapshotId);

      if (!snapshot) {
        return { success: false, error: '快照不存在' };
      }

      return { success: true, data: snapshot };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '获取快照失败'
      };
    }
  });

  // 获取最新快照
  ipcMain.handle('snapshot:getLatest', async (_event, projectId: string, type?: string) => {
    try {
      const useCase = createSnapshotUseCase();
      const snapshot = await useCase.getLatestSnapshot(projectId, type as SnapshotType);
      return { success: true, data: snapshot };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '获取最新快照失败'
      };
    }
  });

  // 回滚到指定快照
  ipcMain.handle('snapshot:rollback', async (_event, snapshotId: string) => {
    try {
      const useCase = createSnapshotUseCase();
      const result = await useCase.rollback(snapshotId);
      return { success: true, data: result };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '回滚失败'
      };
    }
  });

  // 回滚到上一版本（章节）
  ipcMain.handle('snapshot:rollbackChapter', async (_event, projectId: string, chapterId: string) => {
    try {
      const useCase = createSnapshotUseCase();
      const result = await useCase.rollbackChapter(projectId, chapterId);
      return { success: true, data: result };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '章节回滚失败'
      };
    }
  });

  // 删除快照
  ipcMain.handle('snapshot:delete', async (_event, snapshotId: string) => {
    try {
      const useCase = createSnapshotUseCase();
      await useCase.deleteSnapshot(snapshotId);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '删除快照失败'
      };
    }
  });

  // 清理旧快照
  ipcMain.handle('snapshot:cleanup', async (_event, projectId: string, keepCount?: number) => {
    try {
      const useCase = createSnapshotUseCase();
      const deletedCount = await useCase.cleanup(projectId, keepCount);
      return { success: true, data: { deletedCount } };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '清理快照失败'
      };
    }
  });

  // 获取快照数量
  ipcMain.handle('snapshot:count', async (_event, projectId: string) => {
    try {
      const useCase = createSnapshotUseCase();
      const count = await useCase.getSnapshotCount(projectId);
      return { success: true, data: { count } };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '获取快照数量失败'
      };
    }
  });
}
