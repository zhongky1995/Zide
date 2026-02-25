import { ipcMain, shell } from 'electron';
import * as path from 'path';
import * as fs from 'fs/promises';
import { FileExportAdapter } from '@zide/infrastructure';
import { ExportUseCases } from '@zide/application';
import { ExportFormat } from '@zide/domain';
import { getRuntimeBasePath } from '../runtimePaths';
import { ErrorCode } from './errors';
import { runIpc } from './response';

// 创建用例实例
function createExportUseCase(): ExportUseCases {
  const runtimeBasePath = getRuntimeBasePath();
  const exportAdapter = new FileExportAdapter(runtimeBasePath);
  return new ExportUseCases(exportAdapter, runtimeBasePath);
}

function parseExportFormat(format: string): ExportFormat {
  if (format === ExportFormat.MARKDOWN || format === ExportFormat.HTML || format === ExportFormat.PDF) {
    return format;
  }

  const error = new Error(`不支持的导出格式: ${format}`) as Error & {
    code?: ErrorCode;
    details?: Record<string, unknown>;
  };
  error.code = ErrorCode.EXPORT_FORMAT_NOT_SUPPORTED;
  error.details = { format };
  throw error;
}

// 注册导出相关的 IPC 处理函数
export function registerExportHandlers(): void {
  // 导出项目
  ipcMain.handle('export:project', async (_event, projectId: string, format: string) => {
    return runIpc(async () => {
      const useCase = createExportUseCase();
      return useCase.exportProject(projectId, parseExportFormat(format));
    }, '导出失败', ErrorCode.EXPORT_FAILED, {
      channel: 'export:project',
      args: { projectId, format },
    });
  });

  // 导出指定章节
  ipcMain.handle('export:chapters', async (_event, projectId: string, chapterIds: string[], format: string) => {
    return runIpc(async () => {
      const useCase = createExportUseCase();
      return useCase.exportChapters(projectId, chapterIds, parseExportFormat(format));
    }, '导出失败', ErrorCode.EXPORT_FAILED, {
      channel: 'export:chapters',
      args: { projectId, chapterCount: chapterIds?.length || 0, format },
    });
  });

  // 预览导出内容
  ipcMain.handle('export:preview', async (_event, projectId: string, format: string) => {
    return runIpc(async () => {
      const useCase = createExportUseCase();
      return useCase.preview(projectId, parseExportFormat(format));
    }, '预览失败', ErrorCode.EXPORT_FAILED, {
      channel: 'export:preview',
      args: { projectId, format },
    });
  });

  // 获取导出历史
  ipcMain.handle('export:history', async (_event, projectId: string) => {
    return runIpc(async () => {
      const useCase = createExportUseCase();
      const history = await useCase.getExportHistory(projectId);
      return history.recent;
    }, '获取历史失败', ErrorCode.EXPORT_FAILED, {
      channel: 'export:history',
      args: { projectId },
    });
  });

  // 删除导出文件
  ipcMain.handle('export:delete', async (_event, filePath: string) => {
    return runIpc(async () => {
      const useCase = createExportUseCase();
      await useCase.deleteExport(filePath);
      return { deleted: true };
    }, '删除失败', ErrorCode.EXPORT_FAILED, {
      channel: 'export:delete',
      args: { filePath },
    });
  });

  // 打开导出目录
  ipcMain.handle('export:openDir', async (_event, projectId?: string) => {
    return runIpc(async () => {
      const basePath = getRuntimeBasePath();
      const targetDir = projectId
        ? path.join(basePath, projectId, 'output')
        : basePath;

      await fs.mkdir(targetDir, { recursive: true });
      const openError = await shell.openPath(targetDir);
      if (openError) {
        throw new Error(openError);
      }

      return { path: targetDir };
    }, '打开目录失败', ErrorCode.EXPORT_FAILED, {
      channel: 'export:openDir',
      args: { projectId },
    });
  });
}
