import { ipcMain } from 'electron';
import * as path from 'path';
import { app } from 'electron';
import { SimpleRuleEngine } from '@zide/infrastructure';
import { CheckUseCases } from '@zide/application';

// 获取运行时基础路径
function getRuntimeBasePath(): string {
  return path.join(app.getPath('userData'), 'projects');
}

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
    try {
      const useCase = createCheckUseCase();
      const result = await useCase.runFullCheck(projectId);
      return { success: true, data: result };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '检查失败'
      };
    }
  });

  // 检查缺失章节
  ipcMain.handle('check:missingChapters', async (_event, projectId: string) => {
    try {
      const useCase = createCheckUseCase();
      const issues = await useCase.checkMissingChapters(projectId);
      return { success: true, data: issues };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '检查失败'
      };
    }
  });

  // 检查术语一致性
  ipcMain.handle('check:termConsistency', async (_event, projectId: string) => {
    try {
      const useCase = createCheckUseCase();
      const result = await useCase.checkTermConsistency(projectId);
      return { success: true, data: result };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '检查失败'
      };
    }
  });

  // 检查重复内容
  ipcMain.handle('check:duplicateContent', async (_event, projectId: string) => {
    try {
      const useCase = createCheckUseCase();
      const issues = await useCase.checkDuplicateContent(projectId);
      return { success: true, data: issues };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '检查失败'
      };
    }
  });

  // 检查完成度
  ipcMain.handle('check:completion', async (_event, projectId: string, threshold?: number) => {
    try {
      const useCase = createCheckUseCase();
      const issues = await useCase.checkCompletion(projectId, threshold);
      return { success: true, data: issues };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '检查失败'
      };
    }
  });

  // 检查大纲偏离
  ipcMain.handle('check:outlineDrift', async (_event, projectId: string) => {
    try {
      const useCase = createCheckUseCase();
      const issues = await useCase.checkOutlineDrift(projectId);
      return { success: true, data: issues };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '检查失败'
      };
    }
  });

  // 标记问题已解决
  ipcMain.handle('check:resolveIssue', async (_event, projectId: string, issue: any) => {
    try {
      const useCase = createCheckUseCase();
      const resolved = await useCase.resolveIssue(issue);
      return { success: true, data: resolved };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '操作失败'
      };
    }
  });

  // 忽略问题
  ipcMain.handle('check:ignoreIssue', async (_event, projectId: string, issue: any) => {
    try {
      const useCase = createCheckUseCase();
      const ignored = await useCase.ignoreIssue(issue);
      return { success: true, data: ignored };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '操作失败'
      };
    }
  });
}
