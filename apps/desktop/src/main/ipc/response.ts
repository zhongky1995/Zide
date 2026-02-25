import { ApiResponse, ErrorCode, createErrorResponse, createSuccessResponse } from './errors';
import { logMainError } from '../logger';

interface IpcContext {
  channel: string;
  args?: Record<string, unknown>;
}

const errorCodeSet = new Set<string>(Object.values(ErrorCode));

function resolveErrorCode(error: unknown, fallbackCode: ErrorCode): ErrorCode {
  const rawCode = (error as { code?: unknown })?.code;
  if (typeof rawCode !== 'string') {
    return fallbackCode;
  }

  if (errorCodeSet.has(rawCode)) {
    return rawCode as ErrorCode;
  }

  if (rawCode === 'SNAPSHOT_CREATION_FAILED') {
    return ErrorCode.SNAPSHOT_CREATE_FAILED;
  }

  return fallbackCode;
}

function extractErrorDetails(error: unknown): Record<string, unknown> | undefined {
  const details = (error as { details?: unknown })?.details;
  if (details && typeof details === 'object' && !Array.isArray(details)) {
    return details as Record<string, unknown>;
  }
  return undefined;
}

/**
 * IPC 响应包装器
 * 统一成功/失败结构，减少样板 try/catch 重复代码。
 */
export async function runIpc<T>(
  work: () => Promise<T>,
  fallbackMessage: string,
  errorCode: ErrorCode = ErrorCode.UNKNOWN,
  context?: IpcContext
): Promise<ApiResponse<T>> {
  try {
    const data = await work();
    return createSuccessResponse(data);
  } catch (error) {
    const resolvedCode = resolveErrorCode(error, errorCode);
    const details = extractErrorDetails(error);
    const message = error instanceof Error && error.message ? error.message : fallbackMessage;

    void logMainError(
      `IPC handler failed: ${context?.channel || 'unknown-channel'}`,
      error,
      {
        code: resolvedCode,
        channel: context?.channel,
        args: context?.args,
        details,
      }
    );

    const responseDetails = {
      ...(context ? { channel: context.channel, args: context.args } : {}),
      ...(details || {}),
    };

    return createErrorResponse(
      message,
      resolvedCode,
      Object.keys(responseDetails).length > 0 ? responseDetails : undefined
    );
  }
}
