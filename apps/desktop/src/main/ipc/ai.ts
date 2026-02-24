import { ipcMain } from 'electron';
import * as path from 'path';
import { app } from 'electron';
import { MockLLMAdapter, SimpleIndexAdapter } from '@zide/infrastructure';
import { FileChapterRepo } from '@zide/infrastructure';
import { GenerateContentUseCase } from '@zide/application';
import { ChapterIntent } from '@zide/domain';

// 获取运行时基础路径
function getRuntimeBasePath(): string {
  return path.join(app.getPath('userData'), 'projects');
}

// 创建用例实例
function createGenerateUseCase(): GenerateContentUseCase {
  const runtimeBasePath = getRuntimeBasePath();
  const llmAdapter = new MockLLMAdapter();
  const indexAdapter = new SimpleIndexAdapter(runtimeBasePath);
  const chapterRepo = new FileChapterRepo(runtimeBasePath);

  return new GenerateContentUseCase(llmAdapter, indexAdapter, chapterRepo);
}

// 注册 AI 相关的 IPC 处理函数
export function registerAIHandlers(): void {
  // 生成内容
  ipcMain.handle('ai:generate', async (_event, projectId: string, chapterId: string, intent: string, customPrompt?: string) => {
    try {
      const useCase = createGenerateUseCase();
      const result = await useCase.generate(
        projectId,
        chapterId,
        intent as ChapterIntent,
        customPrompt
      );

      return {
        success: true,
        data: {
          chapter: result.chapter,
          operation: result.operation,
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '生成内容失败'
      };
    }
  });

  // 续写
  ipcMain.handle('ai:continue', async (_event, projectId: string, chapterId: string) => {
    try {
      const useCase = createGenerateUseCase();
      const result = await useCase.generate(projectId, chapterId, ChapterIntent.CONTINUE);

      return {
        success: true,
        data: {
          chapter: result.chapter,
          operation: result.operation,
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '续写失败'
      };
    }
  });

  // 扩写
  ipcMain.handle('ai:expand', async (_event, projectId: string, chapterId: string) => {
    try {
      const useCase = createGenerateUseCase();
      const result = await useCase.generate(projectId, chapterId, ChapterIntent.EXPAND);

      return {
        success: true,
        data: {
          chapter: result.chapter,
          operation: result.operation,
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '扩写失败'
      };
    }
  });

  // 重写
  ipcMain.handle('ai:rewrite', async (_event, projectId: string, chapterId: string) => {
    try {
      const useCase = createGenerateUseCase();
      const result = await useCase.generate(projectId, chapterId, ChapterIntent.REWRITE);

      return {
        success: true,
        data: {
          chapter: result.chapter,
          operation: result.operation,
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '重写失败'
      };
    }
  });

  // 补论证
  ipcMain.handle('ai:addArgument', async (_event, projectId: string, chapterId: string) => {
    try {
      const useCase = createGenerateUseCase();
      const result = await useCase.generate(projectId, chapterId, ChapterIntent.ADD_ARGUMENT);

      return {
        success: true,
        data: {
          chapter: result.chapter,
          operation: result.operation,
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '补论证失败'
      };
    }
  });

  // 润色
  ipcMain.handle('ai:polish', async (_event, projectId: string, chapterId: string) => {
    try {
      const useCase = createGenerateUseCase();
      const result = await useCase.generate(projectId, chapterId, ChapterIntent.POLISH);

      return {
        success: true,
        data: {
          chapter: result.chapter,
          operation: result.operation,
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '润色失败'
      };
    }
  });

  // 简化
  ipcMain.handle('ai:simplify', async (_event, projectId: string, chapterId: string) => {
    try {
      const useCase = createGenerateUseCase();
      const result = await useCase.generate(projectId, chapterId, ChapterIntent.SIMPLIFY);

      return {
        success: true,
        data: {
          chapter: result.chapter,
          operation: result.operation,
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '简化失败'
      };
    }
  });

  // 获取操作历史
  ipcMain.handle('ai:getOperationHistory', async (_event, projectId: string, chapterId: string) => {
    try {
      const useCase = createGenerateUseCase();
      const history = await useCase.getOperationHistory(projectId, chapterId);

      return { success: true, data: history };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '获取操作历史失败'
      };
    }
  });

  // 采纳操作
  ipcMain.handle('ai:adoptOperation', async (_event, projectId: string, chapterId: string, operationId: string) => {
    try {
      const useCase = createGenerateUseCase();
      await useCase.adoptOperation(projectId, chapterId, operationId);

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '采纳操作失败'
      };
    }
  });

  // 检查 LLM 连接
  ipcMain.handle('ai:ping', async () => {
    try {
      const useCase = createGenerateUseCase();
      const connected = await useCase.ping();

      return { success: true, data: connected };
    } catch (error) {
      return { success: false, error: '检查连接失败' };
    }
  });

  // 获取 LLM 配置
  ipcMain.handle('ai:getConfig', async () => {
    try {
      const useCase = createGenerateUseCase();
      const config = useCase.getLLMConfig();

      return { success: true, data: config };
    } catch (error) {
      return { success: false, error: '获取配置失败' };
    }
  });
}
