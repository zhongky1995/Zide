/**
 * 统一错误码定义
 * 用于规范化项目中的错误类型
 */
export enum ErrorCode {
  // 通用错误 (1xxx)
  UNKNOWN = 'UNKNOWN',
  INVALID_PARAMS = 'INVALID_PARAMS',
  NOT_FOUND = 'NOT_FOUND',
  ALREADY_EXISTS = 'ALREADY_EXISTS',
  PERMISSION_DENIED = 'PERMISSION_DENIED',

  // 项目相关错误 (2xxx)
  PROJECT_NOT_FOUND = 'PROJECT_NOT_FOUND',
  PROJECT_ALREADY_EXISTS = 'PROJECT_ALREADY_EXISTS',
  PROJECT_CREATE_FAILED = 'PROJECT_CREATE_FAILED',
  PROJECT_UPDATE_FAILED = 'PROJECT_UPDATE_FAILED',
  PROJECT_DELETE_FAILED = 'PROJECT_DELETE_FAILED',

  // 大纲相关错误 (3xxx)
  OUTLINE_NOT_FOUND = 'OUTLINE_NOT_FOUND',
  OUTLINE_GENERATE_FAILED = 'OUTLINE_GENERATE_FAILED',
  OUTLINE_UPDATE_FAILED = 'OUTLINE_UPDATE_FAILED',

  // 章节相关错误 (4xxx)
  CHAPTER_NOT_FOUND = 'CHAPTER_NOT_FOUND',
  CHAPTER_CONTENT_EMPTY = 'CHAPTER_CONTENT_EMPTY',
  CHAPTER_SAVE_FAILED = 'CHAPTER_SAVE_FAILED',
  CHAPTER_UPDATE_FAILED = 'CHAPTER_UPDATE_FAILED',

  // AI相关错误 (5xxx)
  AI_GENERATE_FAILED = 'AI_GENERATE_FAILED',
  AI_CONFIG_FAILED = 'AI_CONFIG_FAILED',
  AI_CONFIG_INVALID = 'AI_CONFIG_INVALID',
  AI_PROVIDER_ERROR = 'AI_PROVIDER_ERROR',
  LLM_CALL_FAILED = 'LLM_CALL_FAILED',
  LLM_RESPONSE_EMPTY = 'LLM_RESPONSE_EMPTY',

  // 存储相关错误 (6xxx)
  STORAGE_READ_FAILED = 'STORAGE_READ_FAILED',
  STORAGE_WRITE_FAILED = 'STORAGE_WRITE_FAILED',
  SNAPSHOT_NOT_FOUND = 'SNAPSHOT_NOT_FOUND',
  SNAPSHOT_CREATE_FAILED = 'SNAPSHOT_CREATE_FAILED',

  // 导出相关错误 (7xxx)
  EXPORT_FAILED = 'EXPORT_FAILED',
  EXPORT_FORMAT_NOT_SUPPORTED = 'EXPORT_FORMAT_NOT_SUPPORTED',

  // 检查与统计 (8xxx)
  CHECK_FAILED = 'CHECK_FAILED',
  METRICS_READ_FAILED = 'METRICS_READ_FAILED',
  METRICS_WRITE_FAILED = 'METRICS_WRITE_FAILED',
}

/**
 * 统一错误响应格式
 */
export interface ErrorResponse {
  success: false;
  error: string;
  code?: ErrorCode;
  details?: Record<string, unknown>;
}

/**
 * 成功响应格式
 */
export interface SuccessResponse<T> {
  success: true;
  data: T;
}

/**
 * 统一响应类型
 */
export type ApiResponse<T> = SuccessResponse<T> | ErrorResponse;

/**
 * 创建错误响应的辅助函数
 */
export function createErrorResponse(
  message: string,
  code: ErrorCode = ErrorCode.UNKNOWN,
  details?: Record<string, unknown>
): ErrorResponse {
  return {
    success: false,
    error: message,
    code,
    details,
  };
}

/**
 * 创建成功响应的辅助函数
 */
export function createSuccessResponse<T>(data: T): SuccessResponse<T> {
  return {
    success: true,
    data,
  };
}
