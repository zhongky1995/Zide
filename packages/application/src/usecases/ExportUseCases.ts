import { ExportPort, ExportConfig, ExportResult } from '../ports';
import { ExportFormat } from '@zide/domain';

// 导出用例
export class ExportUseCases {
  constructor(
    private readonly exportPort: ExportPort,
    private readonly runtimeBasePath: string
  ) {}

  // 导出项目
  async exportProject(
    projectId: string,
    format: ExportFormat,
    config?: Partial<ExportConfig>
  ): Promise<ExportResult> {
    return this.exportPort.export(projectId, format, config);
  }

  // 导出指定章节
  async exportChapters(
    projectId: string,
    chapterIds: string[],
    format: ExportFormat,
    config?: Partial<ExportConfig>
  ): Promise<ExportResult> {
    return this.exportPort.exportChapters(projectId, chapterIds, format, config);
  }

  // 预览导出内容
  async preview(projectId: string, format: ExportFormat): Promise<string> {
    return this.exportPort.preview(projectId, format);
  }

  // 获取导出历史
  async getExportHistory(projectId: string): Promise<{ recent: ExportResult[]; total: number }> {
    return this.exportPort.getExportHistory(projectId);
  }

  // 删除导出文件
  async deleteExport(filePath: string): Promise<void> {
    return this.exportPort.deleteExport(filePath);
  }

  // 打开导出目录
  async openExportDir(): Promise<void> {
    return this.exportPort.openExportDir();
  }
}
