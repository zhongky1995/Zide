// 领域错误基类
export class DomainError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'DomainError';
  }
}

// 项目相关错误
export class ProjectNotFoundError extends DomainError {
  constructor(projectId: string) {
    super(`项目不存在: ${projectId}`, 'PROJECT_NOT_FOUND', { projectId });
    this.name = 'ProjectNotFoundError';
  }
}

export class ProjectAlreadyExistsError extends DomainError {
  constructor(name: string) {
    super(`项目已存在: ${name}`, 'PROJECT_ALREADY_EXISTS', { name });
    this.name = 'ProjectAlreadyExistsError';
  }
}

// 章节相关错误
export class ChapterNotFoundError extends DomainError {
  constructor(chapterId: string) {
    super(`章节不存在: ${chapterId}`, 'CHAPTER_NOT_FOUND', { chapterId });
    this.name = 'ChapterNotFoundError';
  }
}

export class ChapterContentEmptyError extends DomainError {
  constructor(chapterId: string) {
    super(`章节内容为空: ${chapterId}`, 'CHAPTER_CONTENT_EMPTY', { chapterId });
    this.name = 'ChapterContentEmptyError';
  }
}

// 快照相关错误
export class SnapshotNotFoundError extends DomainError {
  constructor(snapshotId: string) {
    super(`快照不存在: ${snapshotId}`, 'SNAPSHOT_NOT_FOUND', { snapshotId });
    this.name = 'SnapshotNotFoundError';
  }
}

export class SnapshotCreationFailedError extends DomainError {
  constructor(reason: string) {
    super(`快照创建失败: ${reason}`, 'SNAPSHOT_CREATION_FAILED', { reason });
    this.name = 'SnapshotCreationFailedError';
  }
}

// 导出相关错误
export class ExportFailedError extends DomainError {
  constructor(format: string, reason: string) {
    super(`导出失败 [${format}]: ${reason}`, 'EXPORT_FAILED', { format, reason });
    this.name = 'ExportFailedError';
  }
}

export class ExportFormatNotSupportedError extends DomainError {
  constructor(format: string) {
    super(`不支持的导出格式: ${format}`, 'EXPORT_FORMAT_NOT_SUPPORTED', { format });
    this.name = 'ExportFormatNotSupportedError';
  }
}

// 检查相关错误
export class CheckFailedError extends DomainError {
  constructor(reason: string) {
    super(`检查失败: ${reason}`, 'CHECK_FAILED', { reason });
    this.name = 'CheckFailedError';
  }
}

// LLM 相关错误
export class LLMCallFailedError extends DomainError {
  constructor(reason: string) {
    super(`LLM 调用失败: ${reason}`, 'LLM_CALL_FAILED', { reason });
    this.name = 'LLMCallFailedError';
  }
}

export class LLMResponseEmptyError extends DomainError {
  constructor() {
    super('LLM 返回内容为空', 'LLM_RESPONSE_EMPTY');
    this.name = 'LLMResponseEmptyError';
  }
}
