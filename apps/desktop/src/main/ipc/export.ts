import { ipcMain } from 'electron';
import * as path from 'path';
import { app } from 'electron';
import { FileExportAdapter } from '@zide/infrastructure';
import { ExportUseCases } from '@zide/application';
import { ExportFormat } from '@zide/domain';

// 获取运行时基础路径
function getRuntimeBasePath(): string {
  return path.join(app.getPath('userData'), 'projects');
}

// 创建用例实例
function createExportUseCase(): ExportUseCases {
  const runtimeBasePath = getRuntimeBasePath();
  const exportAdapter = new FileExportAdapter(runtimeBasePath);
  return new ExportUseCases(exportAdapter, runtimeBasePath);
}

// 注册导出相关的 IPC 处理函数
export function registerExportHandlers(): void {
  // 导出项目
  ipcMain.handle('export:project', async (_event, projectId: string, format: string) => {
    try {
      const useCase = createExportUseCase();
      const result = await useCase.exportProject(projectId, format as ExportFormat);
      return { success: true, data: result };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '导出失败'
      };
    }
  });

  // 导出指定章节
  ipcMain.handle('export:chapters', async (_event, projectId: string, chapterIds: string[], format: string) => {
    try {
      const useCase = createExportUseCase();
      const result = await useCase.exportChapters(projectId, chapterIds, format as ExportFormat);
      return { success: true, data: result };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '导出失败'
      };
    }
  });

  // 预览导出内容
  ipcMain.handle('export:preview', async (_event, projectId: string, format: string) => {
    try {
      const useCase = createExportUseCase();
      const content = await useCase.preview(projectId, format as ExportFormat);
      return { success: true, data: content };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '预览失败'
      };
    }
  });

  // 获取导出历史
  ipcMain.handle('export:history', async (_event, projectId: string) => {
    try {
      const useCase = createExportUseCase();
      const history = await useCase.getExportHistory(projectId);
      return { success: true, data: history };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '获取历史失败'
      };
    }
  });

  // 删除导出文件
  ipcMain.handle('export:delete', async (_event, filePath: string) => {
    try {
      const useCase = createExportUseCase();
      await useCase.deleteExport(filePath);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '删除失败'
      };
    }
  });

  // 打开导出目录
  ipcMain.handle('export:openDir', async () => {
    try {
      const useCase = createExportUseCase();
      await useCase.openExportDir();
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '打开目录失败'
      };
    }
  });
}
