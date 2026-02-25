import { LLMPort, LLMGenerateParams, LLMGenerateResult, LLMProviderConfig } from '@zide/application';
import { AIStrategy, ChapterIntent, IntentConfig, GenerationMode } from '@zide/domain';
import { AIStrategyManager } from './StrategyManager';

/**
 * 策略感知的 LLM 适配器
 * 包装基础 LLM 适配器，根据当前策略配置调用参数
 */
export class StrategyAwareLLMAdapter implements LLMPort {
  constructor(
    private readonly baseAdapter: LLMPort,
    private readonly strategyManager: AIStrategyManager
  ) {}

  async generate(params: LLMGenerateParams): Promise<LLMGenerateResult> {
    const strategy = this.strategyManager.getActiveStrategy();
    const intentConfig = this.strategyManager.getIntentConfig(params.intent);

    // 应用策略特定的 provider 和 model 配置
    const enhancedParams = this.applyStrategyConfig(params, strategy);

    // 应用意图特定的 system prompt
    const enhancedParamsWithIntent = this.applyIntentPrompt(enhancedParams, intentConfig, params.intent);

    return this.baseAdapter.generate(enhancedParamsWithIntent);
  }

  async ping(): Promise<boolean> {
    return this.baseAdapter.ping();
  }

  getConfig(): LLMProviderConfig {
    const strategy = this.strategyManager.getActiveStrategy();
    const baseConfig = this.baseAdapter.getConfig();

    return {
      ...baseConfig,
      provider: strategy.provider,
      model: strategy.model,
      maxTokens: strategy.maxTokens,
      temperature: strategy.temperature,
    };
  }

  updateConfig(config: Partial<LLMProviderConfig>): void {
    this.baseAdapter.updateConfig(config);
  }

  // 应用策略级别的配置
  private applyStrategyConfig(params: LLMGenerateParams, strategy: AIStrategy): LLMGenerateParams {
    // 根据策略的 contextConfig 裁剪上下文
    const contextConfig = strategy.contextConfig || {
      maxProjectContextChars: 3000,
      maxRelatedChapters: 5,
      compressionStrategy: 'slice' as const,
    };

    return {
      ...params,
      context: {
        projectContext: this.clip(params.context.projectContext, contextConfig.maxProjectContextChars),
        relatedChapters: params.context.relatedChapters.slice(0, contextConfig.maxRelatedChapters),
        glossary: params.context.glossary,
        outline: params.context.outline,
      },
    };
  }

  // 应用意图特定的 prompt 修改
  private applyIntentPrompt(
    params: LLMGenerateParams,
    intentConfig: IntentConfig,
    intent: ChapterIntent
  ): LLMGenerateParams {
    // 如果策略定义了意图特定的 system prompt，使用它
    if (intentConfig.systemPrompt) {
      return {
        ...params,
        customPrompt: [params.customPrompt, intentConfig.systemPrompt].filter(Boolean).join('\n\n'),
      };
    }

    return params;
  }

  private clip(value: string, maxChars: number): string {
    const normalized = value.trim();
    if (normalized.length <= maxChars) {
      return normalized;
    }
    return `${normalized.slice(0, maxChars)}\n...[已截断]`;
  }
}
