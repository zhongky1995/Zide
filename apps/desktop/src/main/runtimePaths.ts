import { app } from 'electron';
import * as path from 'path';

/**
 * 运行时路径统一入口
 * 约束：所有主进程读写 runtime 数据必须通过这里获取根路径
 */
export function getRuntimeBasePath(): string {
  // 支持测试环境覆盖 runtime 路径，避免 UI 回归污染真实用户数据
  const override = process.env.ZIDE_RUNTIME_BASE_PATH?.trim();
  if (override) {
    return path.resolve(override);
  }

  return path.join(app.getPath('userData'), 'projects');
}

export function getProjectPath(projectId: string): string {
  return path.join(getRuntimeBasePath(), projectId);
}

export function getProjectOutputPath(projectId: string): string {
  return path.join(getProjectPath(projectId), 'output');
}
