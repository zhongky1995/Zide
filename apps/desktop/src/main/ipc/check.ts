import { ipcMain } from 'electron';
import { SimpleRuleEngine } from '@zide/infrastructure';
import { CheckUseCases } from '@zide/application';
import { getRuntimeBasePath } from '../runtimePaths';
import { ErrorCode } from './errors';
import { runIpc } from './response';

// 创建用例实例
function createCheckUseCase(): CheckUseCases {
  const runtimeBasePath = getRuntimeBasePath();
  const ruleEngine = new SimpleRuleEngine(runtimeBasePath);
  return new CheckUseCases(ruleEngine);
}

// 注册检查相关的 IPC 处理函数
export function registerCheckHandlers(): void {
  // 运行完整检查
  ipcMain.handle('check:run', async (_event, projectId: string) => {
    return runIpc(async () => {
      const useCase = createCheckUseCase();
      return useCase.runFullCheck(projectId);
    }, '检查失败', ErrorCode.UNKNOWN, {
      channel: 'check:run',
      args: { projectId },
    });
  });

  // 检查缺失章节
  ipcMain.handle('check:missingChapters', async (_event, projectId: string) => {
    return runIpc(async () => {
      const useCase = createCheckUseCase();
      return useCase.checkMissingChapters(projectId);
    }, '检查失败', ErrorCode.UNKNOWN, {
      channel: 'check:missingChapters',
      args: { projectId },
    });
  });

  // 检查术语一致性
  ipcMain.handle('check:termConsistency', async (_event, projectId: string) => {
    return runIpc(async () => {
      const useCase = createCheckUseCase();
      return useCase.checkTermConsistency(projectId);
    }, '检查失败', ErrorCode.UNKNOWN, {
      channel: 'check:termConsistency',
      args: { projectId },
    });
  });

  // 检查重复内容
  ipcMain.handle('check:duplicateContent', async (_event, projectId: string) => {
    return runIpc(async () => {
      const useCase = createCheckUseCase();
      return useCase.checkDuplicateContent(projectId);
    }, '检查失败', ErrorCode.UNKNOWN, {
      channel: 'check:duplicateContent',
      args: { projectId },
    });
  });

  // 检查完成度
  ipcMain.handle('check:completion', async (_event, projectId: string, threshold?: number) => {
    return runIpc(async () => {
      const useCase = createCheckUseCase();
      return useCase.checkCompletion(projectId, threshold);
    }, '检查失败', ErrorCode.UNKNOWN, {
      channel: 'check:completion',
      args: { projectId, threshold },
    });
  });

  // 检查大纲偏离
  ipcMain.handle('check:outlineDrift', async (_event, projectId: string) => {
    return runIpc(async () => {
      const useCase = createCheckUseCase();
      return useCase.checkOutlineDrift(projectId);
    }, '检查失败', ErrorCode.UNKNOWN, {
      channel: 'check:outlineDrift',
      args: { projectId },
    });
  });

  // 标记问题已解决
  ipcMain.handle('check:resolveIssue', async (_event, projectId: string, issue: any) => {
    return runIpc(async () => {
      const useCase = createCheckUseCase();
      return useCase.resolveIssue(issue);
    }, '操作失败', ErrorCode.UNKNOWN, {
      channel: 'check:resolveIssue',
      args: { projectId, issueId: issue?.id },
    });
  });

  // 忽略问题
  ipcMain.handle('check:ignoreIssue', async (_event, projectId: string, issue: any) => {
    return runIpc(async () => {
      const useCase = createCheckUseCase();
      return useCase.ignoreIssue(issue);
    }, '操作失败', ErrorCode.UNKNOWN, {
      channel: 'check:ignoreIssue',
      args: { projectId, issueId: issue?.id },
    });
  });
}
