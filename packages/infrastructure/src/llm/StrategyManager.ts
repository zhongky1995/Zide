import { AIStrategy, BUILT_IN_STRATEGIES, ChapterIntent, IntentConfig, GenerationMode } from '@zide/domain';

/**
 * AI 策略管理器
 * 负责策略的加载、切换、查询
 */
export class AIStrategyManager {
  private strategies: Map<string, AIStrategy> = new Map();
  private activeStrategyId: string = 'default-continue';

  constructor() {
    // 加载内置策略
    BUILT_IN_STRATEGIES.forEach(s => this.strategies.set(s.id, s));
  }

  // 获取当前策略
  getActiveStrategy(): AIStrategy {
    return this.strategies.get(this.activeStrategyId) || BUILT_IN_STRATEGIES[0];
  }

  // 切换策略
  setActiveStrategy(strategyId: string): void {
    if (this.strategies.has(strategyId)) {
      this.activeStrategyId = strategyId;
    }
  }

  // 获取当前激活策略ID
  getActiveStrategyId(): string {
    return this.activeStrategyId;
  }

  // 获取所有策略
  listStrategies(): AIStrategy[] {
    return Array.from(this.strategies.values());
  }

  // 添加自定义策略
  addStrategy(strategy: AIStrategy): void {
    this.strategies.set(strategy.id, strategy);
  }

  // 删除自定义策略（不能删除内置策略）
  deleteStrategy(strategyId: string): boolean {
    const isBuiltIn = BUILT_IN_STRATEGIES.some(s => s.id === strategyId);
    if (isBuiltIn) {
      return false;
    }
    return this.strategies.delete(strategyId);
  }

  // 获取意图配置
  getIntentConfig(intent: ChapterIntent): IntentConfig {
    const strategy = this.getActiveStrategy();
    return strategy.intentOverrides?.[intent] || this.getDefaultIntentConfig(intent);
  }

  // 获取默认意图配置
  private getDefaultIntentConfig(intent: ChapterIntent): IntentConfig {
    const configs: Record<ChapterIntent, IntentConfig> = {
      [ChapterIntent.CONTINUE]: { outputMode: 'append', minTokens: 400, maxTokens: 1200 },
      [ChapterIntent.EXPAND]: { outputMode: 'append', minTokens: 500, maxTokens: 1500 },
      [ChapterIntent.REWRITE]: { outputMode: 'replace', minTokens: 800, maxTokens: 3000 },
      [ChapterIntent.ADD_ARGUMENT]: { outputMode: 'append', minTokens: 300, maxTokens: 1000 },
      [ChapterIntent.POLISH]: { outputMode: 'replace', minTokens: 500, maxTokens: 2500 },
      [ChapterIntent.SIMPLIFY]: { outputMode: 'replace', minTokens: 300, maxTokens: 1500 },
    };
    return configs[intent] || configs[ChapterIntent.CONTINUE];
  }

  // 获取策略特定配置
  getContextConfig() {
    const strategy = this.getActiveStrategy();
    return strategy.contextConfig || {
      maxProjectContextChars: 3000,
      maxRelatedChapters: 5,
      compressionStrategy: 'slice' as const,
    };
  }

  // 根据模式获取推荐策略
  getStrategyByMode(mode: GenerationMode): AIStrategy | undefined {
    return Array.from(this.strategies.values()).find(s => s.mode === mode);
  }
}
