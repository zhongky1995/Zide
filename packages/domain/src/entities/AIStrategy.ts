import { ChapterIntent } from './Chapter';

// 生成模式枚举
export enum GenerationMode {
  CONTINUE = 'continue',   // 续写模式
  EXPAND = 'expand',      // 扩写模式
  REWRITE = 'rewrite',    // 重写模式
  CREATIVE = 'creative',  // 创意模式
  RIGOROUS = 'rigorous',  // 严谨模式
}

// 意图配置覆盖
export interface IntentConfig {
  systemPrompt?: string;
  outputMode: 'append' | 'replace';
  minTokens?: number;
  maxTokens?: number;
}

// AI生成策略
export interface AIStrategy {
  id: string;
  name: string;
  mode: GenerationMode;
  provider: 'openai' | 'anthropic' | 'minimax' | 'kimi';
  model: string;
  temperature: number;     // 0-2
  maxTokens: number;
  topP?: number;

  // 策略特定配置
  intentOverrides?: Partial<Record<ChapterIntent, IntentConfig>>;
  contextConfig?: {
    maxProjectContextChars: number;
    maxRelatedChapters: number;
    compressionStrategy: 'slice' | 'summary' | 'core';
  };
}

// 内置策略
export const BUILT_IN_STRATEGIES: AIStrategy[] = [
  {
    id: 'default-continue',
    name: '默认续写',
    mode: GenerationMode.CONTINUE,
    provider: 'openai',
    model: 'gpt-4',
    temperature: 0.7,
    maxTokens: 4000,
    contextConfig: {
      maxProjectContextChars: 3000,
      maxRelatedChapters: 5,
      compressionStrategy: 'slice',
    },
  },
  {
    id: 'creative',
    name: '创意模式',
    mode: GenerationMode.CREATIVE,
    provider: 'openai',
    model: 'gpt-4',
    temperature: 1.2,
    maxTokens: 6000,
    contextConfig: {
      maxProjectContextChars: 5000,
      maxRelatedChapters: 3,
      compressionStrategy: 'summary',
    },
  },
  {
    id: 'rigorous',
    name: '严谨模式',
    mode: GenerationMode.RIGOROUS,
    provider: 'anthropic',
    model: 'claude-3-opus',
    temperature: 0.3,
    maxTokens: 4000,
    contextConfig: {
      maxProjectContextChars: 4000,
      maxRelatedChapters: 8,
      compressionStrategy: 'core',
    },
  },
  {
    id: 'quick-expand',
    name: '快速扩写',
    mode: GenerationMode.EXPAND,
    provider: 'openai',
    model: 'gpt-4o',
    temperature: 0.8,
    maxTokens: 2000,
    contextConfig: {
      maxProjectContextChars: 2000,
      maxRelatedChapters: 3,
      compressionStrategy: 'slice',
    },
  },
];
