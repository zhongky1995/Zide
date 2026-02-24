// 导出格式枚举
export enum ExportFormat {
  MARKDOWN = 'md',
  HTML = 'html',
  PDF = 'pdf',
}

// 导出状态枚举
export enum ExportStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

// 导出配置
export interface ExportConfig {
  format: ExportFormat;
  includeToc?: boolean;      // 包含目录
  includeGlossary?: boolean; // 包含术语表
  includeMetadata?: boolean; // 包含元信息
  template?: string;        // 模板名称
  styles?: {
    fontFamily?: string;
    fontSize?: number;
    lineHeight?: number;
    pageSize?: 'a4' | 'letter';
  };
}

// 导出结果
export interface ExportResult {
  jobId: string;
  format: ExportFormat;
  filePath: string;         // 导出文件路径
  fileSize: number;         // 文件大小（字节）
  chapterCount: number;     // 包含的章节数
  wordCount: number;        // 总字数
  createdAt: string;
}

// 导出任务实体
export interface ExportJob {
  id: string;
  projectId: string;
  format: ExportFormat;
  status: ExportStatus;
  config: ExportConfig;
  progress: number;         // 0-100
  result?: ExportResult;
  failedChapters?: string[]; // 失败的章节列表
  error?: string;
  startedAt: string;
  completedAt?: string;
}

// 导出参数
export interface ExportParams {
  projectId: string;
  format: ExportFormat;
  config?: Partial<ExportConfig>;
}
