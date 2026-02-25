import { ipcMain } from 'electron';
import * as path from 'path';
import * as fs from 'fs/promises';
import { app } from 'electron';
import { MockLLMAdapter, RealLLMAdapter, AIStrategyManager } from '@zide/infrastructure';
import { GenerateContentUseCase } from '@zide/application';
import { ChapterIntent } from '@zide/domain';
import { LLMProviderConfig } from '@zide/application';
import { serviceContainer } from '../ServiceContainer';
import { updateLLMAdapter } from './outline';
import { ErrorCode } from './errors';
import { runIpc } from './response';

// LLM 适配器实例（单例）
let llmAdapter: MockLLMAdapter | RealLLMAdapter = new RealLLMAdapter();
let useRealLLM = true;

// AI 策略管理器实例（单例）
const strategyManager = new AIStrategyManager();

// 启动时加载保存的 LLM 配置
async function loadSavedConfig(): Promise<void> {
  try {
    const configPath = path.join(app.getPath('userData'), 'config', 'settings.json');
    const data = await fs.readFile(configPath, 'utf-8');
    const settings = JSON.parse(data);

    if (settings.llmConfig) {
      llmAdapter = new RealLLMAdapter();
      llmAdapter.updateConfig(settings.llmConfig);
      useRealLLM = true;
      console.log(
        '[AI] 已加载保存的 LLM 配置:',
        settings.llmConfig.provider,
        settings.llmConfig.model,
        'apiKey:',
        settings.llmConfig.apiKey ? '已设置' : '未设置'
      );
    }
  } catch (error) {
    // 没有保存的配置，保持真实适配器默认配置并要求用户设置 API Key
    console.log('[AI] 未找到保存的 LLM 配置，需要在设置页配置 API Key 后才能使用 AI');
  }

  // 无论是否读取到配置，都同步给 outline 模块，避免出现未注入导致的降级行为
  updateLLMAdapter(llmAdapter);
}

// 导出初始化函数供主进程调用
export async function initializeAIHandlers(): Promise<void> {
  await loadSavedConfig();
}

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

function createIpcError(message: string, code: ErrorCode, details?: Record<string, unknown>): Error {
  const error = new Error(message) as Error & {
    code?: ErrorCode;
    details?: Record<string, unknown>;
  };
  error.code = code;
  error.details = details;
  return error;
}

function ensureLLMReady(action: string): void {
  if (llmAdapter instanceof MockLLMAdapter) {
    throw createIpcError(
      '当前为模拟模型，已禁用模拟输出。请在设置页面配置真实 AI 模型后重试。',
      ErrorCode.AI_CONFIG_INVALID,
      { action }
    );
  }

  const config = llmAdapter.getConfig();
  const apiKey = typeof config.apiKey === 'string' ? config.apiKey.trim() : '';
  if (!apiKey) {
    throw createIpcError(
      '当前已启用真实模型，但未配置 API Key，请先在设置页面保存配置。',
      ErrorCode.AI_CONFIG_INVALID,
      {
        action,
        provider: config.provider,
      }
    );
  }
}

export function ensureLLMReadyForAction(action: string): void {
  ensureLLMReady(action);
}

function parseIntent(intent: string): ChapterIntent {
  const validIntents = Object.values(ChapterIntent) as string[];
  if (!validIntents.includes(intent)) {
    throw createIpcError(`不支持的 AI 意图: ${intent}`, ErrorCode.INVALID_PARAMS, { intent });
  }
  return intent as ChapterIntent;
}

// 注册 AI 相关的 IPC 处理函数
// 导出获取当前 LLM 适配器的函数（供其他模块使用）
export function getCurrentLLMAdapter(): MockLLMAdapter | RealLLMAdapter {
  return llmAdapter;
}

export function registerAIHandlers(): void {
  // 生成内容
  ipcMain.handle('ai:generate', async (_event, projectId: string, chapterId: string, intent: string, customPrompt?: string) => {
    return runIpc(async () => {
      ensureLLMReady('ai:generate');
      const useCase = createGenerateUseCase();
      const result = await useCase.generate(
        projectId,
        chapterId,
        parseIntent(intent),
        customPrompt
      );

      return {
        chapter: result.chapter,
        operation: result.operation,
      };
    }, '生成内容失败', ErrorCode.AI_GENERATE_FAILED, {
      channel: 'ai:generate',
      args: { projectId, chapterId, intent },
    });
  });

  // 续写
  ipcMain.handle('ai:continue', async (_event, projectId: string, chapterId: string) => {
    return runIpc(async () => {
      ensureLLMReady('ai:continue');
      const useCase = createGenerateUseCase();
      const result = await useCase.generate(projectId, chapterId, ChapterIntent.CONTINUE);

      return {
        chapter: result.chapter,
        operation: result.operation,
      };
    }, '续写失败', ErrorCode.AI_GENERATE_FAILED, {
      channel: 'ai:continue',
      args: { projectId, chapterId },
    });
  });

  // 扩写
  ipcMain.handle('ai:expand', async (_event, projectId: string, chapterId: string) => {
    return runIpc(async () => {
      ensureLLMReady('ai:expand');
      const useCase = createGenerateUseCase();
      const result = await useCase.generate(projectId, chapterId, ChapterIntent.EXPAND);

      return {
        chapter: result.chapter,
        operation: result.operation,
      };
    }, '扩写失败', ErrorCode.AI_GENERATE_FAILED, {
      channel: 'ai:expand',
      args: { projectId, chapterId },
    });
  });

  // 重写
  ipcMain.handle('ai:rewrite', async (_event, projectId: string, chapterId: string) => {
    return runIpc(async () => {
      ensureLLMReady('ai:rewrite');
      const useCase = createGenerateUseCase();
      const result = await useCase.generate(projectId, chapterId, ChapterIntent.REWRITE);

      return {
        chapter: result.chapter,
        operation: result.operation,
      };
    }, '重写失败', ErrorCode.AI_GENERATE_FAILED, {
      channel: 'ai:rewrite',
      args: { projectId, chapterId },
    });
  });

  // 补论证
  ipcMain.handle('ai:addArgument', async (_event, projectId: string, chapterId: string) => {
    return runIpc(async () => {
      ensureLLMReady('ai:addArgument');
      const useCase = createGenerateUseCase();
      const result = await useCase.generate(projectId, chapterId, ChapterIntent.ADD_ARGUMENT);

      return {
        chapter: result.chapter,
        operation: result.operation,
      };
    }, '补论证失败', ErrorCode.AI_GENERATE_FAILED, {
      channel: 'ai:addArgument',
      args: { projectId, chapterId },
    });
  });

  // 润色
  ipcMain.handle('ai:polish', async (_event, projectId: string, chapterId: string) => {
    return runIpc(async () => {
      ensureLLMReady('ai:polish');
      const useCase = createGenerateUseCase();
      const result = await useCase.generate(projectId, chapterId, ChapterIntent.POLISH);

      return {
        chapter: result.chapter,
        operation: result.operation,
      };
    }, '润色失败', ErrorCode.AI_GENERATE_FAILED, {
      channel: 'ai:polish',
      args: { projectId, chapterId },
    });
  });

  // 简化
  ipcMain.handle('ai:simplify', async (_event, projectId: string, chapterId: string) => {
    return runIpc(async () => {
      ensureLLMReady('ai:simplify');
      const useCase = createGenerateUseCase();
      const result = await useCase.generate(projectId, chapterId, ChapterIntent.SIMPLIFY);

      return {
        chapter: result.chapter,
        operation: result.operation,
      };
    }, '简化失败', ErrorCode.AI_GENERATE_FAILED, {
      channel: 'ai:simplify',
      args: { projectId, chapterId },
    });
  });

  // 获取操作历史
  ipcMain.handle('ai:getOperationHistory', async (_event, projectId: string, chapterId: string) => {
    return runIpc(async () => {
      const useCase = createGenerateUseCase();
      return useCase.getOperationHistory(projectId, chapterId);
    }, '获取操作历史失败', ErrorCode.STORAGE_READ_FAILED, {
      channel: 'ai:getOperationHistory',
      args: { projectId, chapterId },
    });
  });

  // 采纳操作
  ipcMain.handle('ai:adoptOperation', async (_event, projectId: string, chapterId: string, operationId: string) => {
    return runIpc(async () => {
      const useCase = createGenerateUseCase();
      await useCase.adoptOperation(projectId, chapterId, operationId);

      return { adopted: true };
    }, '采纳操作失败', ErrorCode.STORAGE_WRITE_FAILED, {
      channel: 'ai:adoptOperation',
      args: { projectId, chapterId, operationId },
    });
  });

  // 检查 LLM 连接
  ipcMain.handle('ai:ping', async () => {
    return runIpc(async () => {
      ensureLLMReady('ai:ping');
      const useCase = createGenerateUseCase();
      const connected = await useCase.ping();
      if (!connected) {
        const config = llmAdapter.getConfig();
        throw createIpcError(
          'LLM 连接测试失败，请检查 API Key、Base URL 和网络连通性。',
          ErrorCode.AI_PROVIDER_ERROR,
          {
            provider: config.provider,
            baseUrl: config.baseUrl,
          }
        );
      }

      return connected;
    }, '检查连接失败', ErrorCode.AI_CONFIG_FAILED, {
      channel: 'ai:ping',
    });
  });

  // 获取 LLM 配置
  ipcMain.handle('ai:getConfig', async () => {
    return runIpc(async () => {
      const useCase = createGenerateUseCase();
      return useCase.getLLMConfig();
    }, '获取配置失败', ErrorCode.AI_CONFIG_FAILED, {
      channel: 'ai:getConfig',
    });
  });

  // 更新 LLM 配置
  ipcMain.handle('ai:updateConfig', async (_event, config: Partial<LLMProviderConfig>) => {
    return runIpc(async () => {
      const safeConfig: Partial<LLMProviderConfig> = { ...config };
      // 兼容旧前端：如果传来掩码 key，保留当前已配置的真实 key
      if (typeof safeConfig.apiKey === 'string' && /^\*{3,}/.test(safeConfig.apiKey)) {
        delete safeConfig.apiKey;
      }

      // 始终使用真实模型适配器；未配置 key 时由 ensureLLMReady 在调用时给出明确错误
      if (!useRealLLM || !(llmAdapter instanceof RealLLMAdapter)) {
        llmAdapter = new RealLLMAdapter();
        useRealLLM = true;
      }
      llmAdapter.updateConfig(safeConfig);

      // 同步更新 outline 模块的 LLM 适配器
      updateLLMAdapter(llmAdapter);

      // 保存配置到文件
      const configPath = path.join(app.getPath('userData'), 'config', 'settings.json');
      const currentConfig = llmAdapter.getConfig();
      await fs.mkdir(path.dirname(configPath), { recursive: true });
      await fs.writeFile(configPath, JSON.stringify({ llmConfig: currentConfig }, null, 2), 'utf-8');
      console.log('[AI] 配置已保存到:', configPath);

      return currentConfig;
    }, '更新配置失败', ErrorCode.AI_CONFIG_FAILED, {
      channel: 'ai:updateConfig',
      args: {
        provider: config?.provider,
        model: config?.model,
      },
    });
  });

  // 切换 LLM 适配器（mock / real）
  ipcMain.handle('ai:switchAdapter', async (_event, useReal: boolean) => {
    return runIpc(async () => {
      if (!useReal) {
        throw createIpcError(
          '已禁用模拟模型，避免产生误导性内容。请配置真实 AI 模型后使用。',
          ErrorCode.AI_CONFIG_INVALID,
          { useReal }
        );
      }

      if (useReal && !(llmAdapter instanceof RealLLMAdapter)) {
        llmAdapter = new RealLLMAdapter();
        useRealLLM = true;
      }

      // 同步更新 outline 模块的 LLM 适配器
      updateLLMAdapter(llmAdapter);

      return { useRealLLM };
    }, '切换适配器失败', ErrorCode.AI_CONFIG_FAILED, {
      channel: 'ai:switchAdapter',
      args: { useReal },
    });
  });

  // 获取当前策略
  ipcMain.handle('ai:getStrategy', async () => {
    return runIpc(async () => strategyManager.getActiveStrategy(), '获取策略失败', ErrorCode.AI_CONFIG_FAILED, {
      channel: 'ai:getStrategy',
    });
  });

  // 获取所有可用策略
  ipcMain.handle('ai:listStrategies', async () => {
    return runIpc(async () => strategyManager.listStrategies(), '获取策略列表失败', ErrorCode.AI_CONFIG_FAILED, {
      channel: 'ai:listStrategies',
    });
  });

  // 切换 AI 策略
  ipcMain.handle('ai:setStrategy', async (_event, strategyId: string) => {
    return runIpc(async () => {
      strategyManager.setActiveStrategy(strategyId);
      return { strategyId };
    }, '切换策略失败', ErrorCode.AI_CONFIG_FAILED, {
      channel: 'ai:setStrategy',
      args: { strategyId },
    });
  });

  // 获取意图配置
  ipcMain.handle('ai:getIntentConfig', async (_event, intent: string) => {
    return runIpc(async () => {
      const parsedIntent = parseIntent(intent);
      return strategyManager.getIntentConfig(parsedIntent);
    }, '获取意图配置失败', ErrorCode.AI_CONFIG_FAILED, {
      channel: 'ai:getIntentConfig',
      args: { intent },
    });
  });

  // AI 对话
  ipcMain.handle('ai:chat', async (_event, projectId: string, message: string, chapterId?: string) => {
    return runIpc(async () => {
      ensureLLMReady('ai:chat');
      if (!message || !message.trim()) {
        throw createIpcError('消息内容不能为空', ErrorCode.INVALID_PARAMS, { message });
      }

      // 获取项目上下文
      const projectContext = await serviceContainer.projectRepo.getProjectContext(projectId);
      const glossary = await serviceContainer.projectRepo.getGlossary(projectId);

      // 获取当前章节内容（如果有）
      let chapterContent = '';
      if (chapterId) {
        const chapter = await serviceContainer.chapterRepo.findByChapterId(projectId, chapterId);
        chapterContent = chapter?.content || '';
      }

      // 构建对话上下文
      const contextParts: string[] = [];
      if (projectContext) contextParts.push(`## 项目背景\n${projectContext}`);
      if (glossary) contextParts.push(`## 术语表\n${glossary}`);
      if (chapterContent) contextParts.push(`## 当前章节内容\n${chapterContent.slice(-2000)}`);

      const result = await llmAdapter.generate({
        context: {
          projectContext: [message, contextParts.join('\n\n')].filter(Boolean).join('\n\n'),
          relatedChapters: [],
          glossary: '',
          outline: '',
        },
        chapter: {
          id: chapterId || 'chat',
          title: 'AI对话',
          content: chapterContent,
          target: '',
        },
        intent: ChapterIntent.POLISH,
      });

      return {
        message: result.content,
        model: result.model,
      };
    }, '对话失败', ErrorCode.AI_GENERATE_FAILED, {
      channel: 'ai:chat',
      args: { projectId, chapterId, messageLength: message?.length || 0 },
    });
  });
}
