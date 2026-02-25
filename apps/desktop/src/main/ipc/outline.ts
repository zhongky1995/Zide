import { ipcMain } from 'electron';
import { FileProjectRepo, FileOutlineRepo, RealLLMAdapter, MockLLMAdapter } from '@zide/infrastructure';
import {
  GenerateOutlineUseCase,
  UpdateOutlineUseCase,
  ManageChapterUseCase,
} from '@zide/application';
import { LLMPort } from '@zide/application';
import { getRuntimeBasePath } from '../runtimePaths';
import { ErrorCode } from './errors';
import { runIpc } from './response';

// LLM 适配器单例（与 ai.ts 共享）
let llmAdapter: LLMPort | null = null;

// 导出函数供 ai.ts 调用以更新适配器实例
export function updateLLMAdapter(adapter: LLMPort): void {
  llmAdapter = adapter;
}

// 获取 LLM 适配器
function getLLMAdapter(): LLMPort | null {
  return llmAdapter;
}

// 创建仓储实例
function createRepos() {
  const runtimeBasePath = getRuntimeBasePath();
  console.log('[outline] runtimeBasePath:', runtimeBasePath);
  return {
    projectRepo: new FileProjectRepo(runtimeBasePath),
    outlineRepo: new FileOutlineRepo(runtimeBasePath),
    llmAdapter: getLLMAdapter() ?? undefined,
  };
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

function ensureOutlineLLMReady(): LLMPort {
  const adapter = getLLMAdapter();
  if (!adapter) {
    throw createIpcError(
      'AI 模型未初始化，请先在设置中配置模型后再生成大纲。',
      ErrorCode.AI_CONFIG_INVALID
    );
  }

  if (adapter instanceof MockLLMAdapter) {
    throw createIpcError(
      '当前为模拟模型，已禁用模拟大纲输出。请先配置真实 AI 模型。',
      ErrorCode.AI_CONFIG_INVALID
    );
  }

  if (adapter instanceof RealLLMAdapter) {
    const config = adapter.getConfig();
    if (!config.apiKey?.trim()) {
      throw createIpcError(
        '未配置 API Key，无法进行 AI 大纲生成。请先在设置页面完成配置。',
        ErrorCode.AI_CONFIG_INVALID,
        { provider: config.provider }
      );
    }
  }

  return adapter;
}

// 同步项目上的章节引用和大纲状态，避免项目卡片与实际章节脱节
async function syncProjectChapterRefs(projectId: string, outline: { chapters: { number: string }[]; status: 'none' | 'draft' | 'confirmed' }): Promise<void> {
  const { projectRepo } = createRepos();
  await projectRepo.update(projectId, {
    chapterIds: outline.chapters.map(ch => ch.number),
    outlineStatus: outline.status,
  } as any);
}

// 注册大纲相关的 IPC 处理函数
export function registerOutlineHandlers(): void {
  // 生成大纲
  ipcMain.handle('outline:generate', async (_event, params: {
    projectId: string;
    template?: string;
    chapterCount?: number;
    customChapters?: string[];
  }) => {
    console.log('[outline:generate] params:', JSON.stringify(params));
    return runIpc(async () => {
      const llm = ensureOutlineLLMReady();
      const { projectRepo, outlineRepo } = createRepos();
      const useCase = new GenerateOutlineUseCase(outlineRepo, projectRepo, llm);
      console.log('[outline:generate] useCase created, calling execute...');

      const outline = await useCase.execute({
        projectId: params.projectId,
        // AI 自主决定章节数量，前端不再传递建议章节数
        template: undefined,
        customChapters: params.customChapters,
      });

      await syncProjectChapterRefs(params.projectId, outline);

      console.log('[outline:generate] SUCCESS, chapters:', outline.chapters?.length, 'status:', outline.status);
      return outline;
    }, '生成大纲失败', ErrorCode.OUTLINE_GENERATE_FAILED, {
      channel: 'outline:generate',
      args: {
        projectId: params.projectId,
        template: params.template,
        chapterCount: params.chapterCount,
      },
    });
  });

  // 获取大纲
  ipcMain.handle('outline:get', async (_event, projectId: string) => {
    return runIpc(async () => {
      const { outlineRepo } = createRepos();
      const useCase = new UpdateOutlineUseCase(outlineRepo);
      return useCase.getOutline(projectId);
    }, '获取大纲失败', ErrorCode.OUTLINE_NOT_FOUND, {
      channel: 'outline:get',
      args: { projectId },
    });
  });

  // 更新大纲
  ipcMain.handle('outline:update', async (_event, projectId: string, params: {
    status?: 'draft' | 'confirmed';
  }) => {
    return runIpc(async () => {
      const { outlineRepo } = createRepos();
      const useCase = new UpdateOutlineUseCase(outlineRepo);
      const outline = await useCase.execute(projectId, params);
      await syncProjectChapterRefs(projectId, outline);

      return outline;
    }, '更新大纲失败', ErrorCode.OUTLINE_UPDATE_FAILED, {
      channel: 'outline:update',
      args: { projectId, fields: Object.keys(params || {}) },
    });
  });

  // 确认大纲
  ipcMain.handle('outline:confirm', async (_event, projectId: string) => {
    return runIpc(async () => {
      const { outlineRepo } = createRepos();
      const useCase = new UpdateOutlineUseCase(outlineRepo);
      const outline = await useCase.confirm(projectId);
      await syncProjectChapterRefs(projectId, outline);

      return outline;
    }, '确认大纲失败', ErrorCode.OUTLINE_UPDATE_FAILED, {
      channel: 'outline:confirm',
      args: { projectId },
    });
  });

  // 添加章节
  ipcMain.handle('outline:addChapter', async (_event, projectId: string, params: {
    title: string;
    target?: string;
  }) => {
    return runIpc(async () => {
      const { outlineRepo } = createRepos();
      const useCase = new ManageChapterUseCase(outlineRepo);
      const outline = await useCase.addChapter(projectId, params.title, params.target);
      await syncProjectChapterRefs(projectId, outline);

      return outline;
    }, '添加章节失败', ErrorCode.OUTLINE_UPDATE_FAILED, {
      channel: 'outline:addChapter',
      args: { projectId, title: params.title },
    });
  });

  // 更新章节
  ipcMain.handle('outline:updateChapter', async (_event, projectId: string, chapterId: string, params: {
    title?: string;
    target?: string;
    status?: 'pending' | 'draft' | 'completed';
  }) => {
    return runIpc(async () => {
      const { outlineRepo } = createRepos();
      const useCase = new ManageChapterUseCase(outlineRepo);
      const outline = await useCase.updateChapter(projectId, chapterId, params);
      await syncProjectChapterRefs(projectId, outline);

      return outline;
    }, '更新章节失败', ErrorCode.OUTLINE_UPDATE_FAILED, {
      channel: 'outline:updateChapter',
      args: { projectId, chapterId, fields: Object.keys(params || {}) },
    });
  });

  // 删除章节
  ipcMain.handle('outline:deleteChapter', async (_event, projectId: string, chapterId: string) => {
    return runIpc(async () => {
      const { outlineRepo } = createRepos();
      const useCase = new ManageChapterUseCase(outlineRepo);
      const outline = await useCase.deleteChapter(projectId, chapterId);
      await syncProjectChapterRefs(projectId, outline);

      return outline;
    }, '删除章节失败', ErrorCode.OUTLINE_UPDATE_FAILED, {
      channel: 'outline:deleteChapter',
      args: { projectId, chapterId },
    });
  });

  // 排序章节
  ipcMain.handle('outline:reorderChapters', async (_event, projectId: string, chapterIds: string[]) => {
    return runIpc(async () => {
      const { outlineRepo } = createRepos();
      const useCase = new ManageChapterUseCase(outlineRepo);
      const outline = await useCase.reorderChapters(projectId, chapterIds);
      await syncProjectChapterRefs(projectId, outline);

      return outline;
    }, '排序章节失败', ErrorCode.OUTLINE_UPDATE_FAILED, {
      channel: 'outline:reorderChapters',
      args: { projectId, chapterCount: chapterIds?.length || 0 },
    });
  });
}
