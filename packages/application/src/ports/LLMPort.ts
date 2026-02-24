import { ChapterIntent } from '@zide/domain';

// LLM 调用参数
export interface LLMGenerateParams {
  // 上下文内容
  context: {
    projectContext: string;      // 项目背景/目标
    relatedChapters: string[];    // 相关章节内容
    glossary: string;            // 术语表
    outline: string;             // 大纲
  };
  // 当前章节信息
  chapter: {
    id: string;
    title: string;
    content: string;
    target: string;
  };
  // 生成意图
  intent: ChapterIntent;
  // 自定义提示词（可选）
  customPrompt?: string;
}

// LLM 调用结果
export interface LLMGenerateResult {
  content: string;
  model: string;
  tokens: number;
  finishReason: 'stop' | 'length' | 'content_filter';
}

// LLM 提供商配置
export interface LLMProviderConfig {
  provider: 'openai' | 'anthropic' | 'custom';
  model: string;
  apiKey?: string;
  baseUrl?: string;
  maxTokens?: number;
  temperature?: number;
}

export interface LLMPort {
  // 生成内容
  generate(params: LLMGenerateParams): Promise<LLMGenerateResult>;

  // 检查连接
  ping(): Promise<boolean>;

  // 获取配置
  getConfig(): LLMProviderConfig;

  // 更新配置
  updateConfig(config: Partial<LLMProviderConfig>): void;
}
