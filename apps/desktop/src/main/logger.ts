import { app } from 'electron';
import * as fs from 'fs/promises';
import * as path from 'path';

type LogLevel = 'INFO' | 'WARN' | 'ERROR';

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  meta?: Record<string, unknown>;
}

function getLogDir(): string {
  if (app.isReady()) {
    return path.join(app.getPath('userData'), 'logs');
  }
  return path.join(process.cwd(), '.tmp-logs');
}

async function appendLog(entry: LogEntry): Promise<void> {
  try {
    const logDir = getLogDir();
    await fs.mkdir(logDir, { recursive: true });
    const logFile = path.join(logDir, 'app.log');
    await fs.appendFile(logFile, `${JSON.stringify(entry)}\n`, 'utf-8');
  } catch {
    // 日志失败不能影响业务主流程
  }
}

export async function logMainInfo(message: string, meta?: Record<string, unknown>): Promise<void> {
  await appendLog({
    level: 'INFO',
    message,
    timestamp: new Date().toISOString(),
    meta,
  });
}

export async function logMainWarn(message: string, meta?: Record<string, unknown>): Promise<void> {
  await appendLog({
    level: 'WARN',
    message,
    timestamp: new Date().toISOString(),
    meta,
  });
}

export async function logMainError(
  message: string,
  error: unknown,
  meta?: Record<string, unknown>
): Promise<void> {
  const errorMeta = error instanceof Error
    ? {
        errorName: error.name,
        errorMessage: error.message,
        stack: error.stack,
      }
    : {
        errorMessage: String(error),
      };

  await appendLog({
    level: 'ERROR',
    message,
    timestamp: new Date().toISOString(),
    meta: {
      ...meta,
      ...errorMeta,
    },
  });
}
