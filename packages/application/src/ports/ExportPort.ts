import { ExportFormat, ExportConfig, ExportResult } from '@zide/domain';

export interface ExportPort {
  // 执行导出
  export(
    projectId: string,
    format: ExportFormat,
    config?: Partial<ExportConfig>
  ): Promise<ExportResult>;

  // 增量导出（仅导出指定章节）
  exportChapters(
    projectId: string,
    chapterIds: string[],
    format: ExportFormat,
    config?: Partial<ExportConfig>
  ): Promise<ExportResult>;

  // 预览导出内容（不写入文件）
  preview(projectId: string, format: ExportFormat): Promise<string>;

  // 获取导出历史
  getExportHistory(projectId: string): Promise<{
    recent: ExportResult[];
    total: number;
  }>;

  // 删除导出文件
  deleteExport(filePath: string): Promise<void>;

  // 打开导出目录
  openExportDir(): Promise<void>;
}
