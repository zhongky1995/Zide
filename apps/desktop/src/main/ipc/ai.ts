import { ipcMain } from 'electron';
import { MockLLMAdapter, RealLLMAdapter, AIStrategyManager } from '@zide/infrastructure';
import { GenerateContentUseCase } from '@zide/application';
import { ChapterIntent } from '@zide/domain';
import { LLMProviderConfig } from '@zide/application';
import { serviceContainer } from '../ServiceContainer';

// LLM 适配器实例（单例）
let llmAdapter: MockLLMAdapter | RealLLMAdapter = new MockLLMAdapter();
let useRealLLM = false;

// AI 策略管理器实例（单例）
const strategyManager = new AIStrategyManager();

// 创建用例实例（使用服务容器单例）
function createGenerateUseCase(): GenerateContentUseCase {
  // 从策略管理器获取上下文压缩配置
  const contextConfig = strategyManager.getContextConfig();

  // 使用策略配置创建索引适配器（包含 ContextCompressor）
  // 这里暂时还需要创建新的，因为配置可能每次不同
  const { SimpleIndexAdapter } = require('@zide/infrastructure');
  const indexAdapter = new SimpleIndexAdapter(serviceContainer.runtimeBasePath, {
    maxProjectContextChars: contextConfig.maxProjectContextChars,
    maxRelatedChapters: contextConfig.maxRelatedChapters,
    compressionStrategy: contextConfig.compressionStrategy,
    tokenBudget: 8000,
  });

  return new GenerateContentUseCase(llmAdapter, indexAdapter, serviceContainer.chapterRepo);
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

  // 更新 LLM 配置
  ipcMain.handle('ai:updateConfig', async (_event, config: Partial<LLMProviderConfig>) => {
    try {
      // 如果配置了 apiKey 或切换到真实模型，切换到真实适配器
      if (config.apiKey || config.provider === 'openai' || config.provider === 'anthropic' ||
          config.provider === 'minimax' || config.provider === 'kimi') {
        if (!useRealLLM || !(llmAdapter instanceof RealLLMAdapter)) {
          llmAdapter = new RealLLMAdapter();
          useRealLLM = true;
        }
        llmAdapter.updateConfig(config);
      } else {
        // 否则使用 mock 适配器
        if (!(llmAdapter instanceof MockLLMAdapter)) {
          llmAdapter = new MockLLMAdapter();
          useRealLLM = false;
        }
        llmAdapter.updateConfig(config);
      }

      return { success: true, data: llmAdapter.getConfig() };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : '更新配置失败' };
    }
  });

  // 切换 LLM 适配器（mock / real）
  ipcMain.handle('ai:switchAdapter', async (_event, useReal: boolean) => {
    try {
      if (useReal && !(llmAdapter instanceof RealLLMAdapter)) {
        llmAdapter = new RealLLMAdapter();
        useRealLLM = true;
      } else if (!useReal && !(llmAdapter instanceof MockLLMAdapter)) {
        llmAdapter = new MockLLMAdapter();
        useRealLLM = false;
      }

      return { success: true };
    } catch (error) {
      return { success: false, error: '切换适配器失败' };
    }
  });

  // 获取当前策略
  ipcMain.handle('ai:getStrategy', async () => {
    try {
      const strategy = strategyManager.getActiveStrategy();
      return { success: true, data: strategy };
    } catch (error) {
      return { success: false, error: '获取策略失败' };
    }
  });

  // 获取所有可用策略
  ipcMain.handle('ai:listStrategies', async () => {
    try {
      const strategies = strategyManager.listStrategies();
      return { success: true, data: strategies };
    } catch (error) {
      return { success: false, error: '获取策略列表失败' };
    }
  });

  // 切换 AI 策略
  ipcMain.handle('ai:setStrategy', async (_event, strategyId: string) => {
    try {
      strategyManager.setActiveStrategy(strategyId);
      return { success: true };
    } catch (error) {
      return { success: false, error: '切换策略失败' };
    }
  });

  // 获取意图配置
  ipcMain.handle('ai:getIntentConfig', async (_event, intent: string) => {
    try {
      const config = strategyManager.getIntentConfig(intent as ChapterIntent);
      return { success: true, data: config };
    } catch (error) {
      return { success: false, error: '获取意图配置失败' };
    }
  });
}
