import { LLMPort, LLMGenerateParams, LLMGenerateResult, LLMProviderConfig } from '@zide/application';
import { ChapterIntent } from '@zide/domain';

// LLM 适配器（模拟实现）
// TODO: 后续接入真实 LLM API（OpenAI / Anthropic）
export class MockLLMAdapter implements LLMPort {
  private config: LLMProviderConfig = {
    provider: 'custom',
    model: 'mock-model',
    maxTokens: 4000,
    temperature: 0.7,
  };

  async generate(params: LLMGenerateParams): Promise<LLMGenerateResult> {
    // 构建提示词
    const prompt = this.buildPrompt(params);

    // 模拟 LLM 生成
    const content = await this.mockGenerate(params.intent, params.chapter.content, prompt);

    return {
      content,
      model: this.config.model,
      tokens: Math.ceil(content.length / 4), // 粗略估算
      finishReason: 'stop',
    };
  }

  async ping(): Promise<boolean> {
    // 模拟连接检查
    return true;
  }

  getConfig(): LLMProviderConfig {
    return { ...this.config };
  }

  updateConfig(config: Partial<LLMProviderConfig>): void {
    this.config = { ...this.config, ...config };
  }

  private buildPrompt(params: LLMGenerateParams): string {
    const parts: string[] = [];

    // 项目上下文
    if (params.context.projectContext) {
      parts.push(`## 项目背景\n${params.context.projectContext}`);
    }

    // 大纲
    if (params.context.outline) {
      parts.push(`## 大纲\n${params.context.outline}`);
    }

    // 术语表
    if (params.context.glossary) {
      parts.push(`## 术语表\n${params.context.glossary}`);
    }

    // 相关章节
    if (params.context.relatedChapters.length > 0) {
      parts.push('## 相关章节\n');
      for (const ch of params.context.relatedChapters) {
        parts.push(`\n### ${ch.slice(0, 500)}...`);
      }
    }

    // 当前章节
    parts.push(`\n## 当前章节\n`);
    parts.push(`标题: ${params.chapter.title}`);
    if (params.chapter.target) {
      parts.push(`目标: ${params.chapter.target}`);
    }
    parts.push(`\n当前内容:\n${params.chapter.content.slice(-1000)}`);

    return parts.join('\n\n');
  }

  private async mockGenerate(intent: ChapterIntent, currentContent: string, prompt: string): Promise<string> {
    // 模拟生成延迟
    await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 1000));

    const intentText = this.getIntentText(intent);
    const extension = this.getExtensionByIntent(intent, currentContent);

    return `\n\n${intentText}：\n\n${extension}`;
  }

  private getIntentText(intent: ChapterIntent): string {
    const map: Record<ChapterIntent, string> = {
      [ChapterIntent.CONTINUE]: '续写内容',
      [ChapterIntent.EXPAND]: '扩展内容',
      [ChapterIntent.REWRITE]: '改写内容',
      [ChapterIntent.ADD_ARGUMENT]: '补充论证',
      [ChapterIntent.POLISH]: '润色内容',
      [ChapterIntent.SIMPLIFY]: '简化内容',
    };
    return map[intent] || '生成内容';
  }

  private getExtensionByIntent(intent: ChapterIntent, content: string): string {
    const templates: Record<ChapterIntent, string> = {
      [ChapterIntent.CONTINUE]: `根据上述上下文，延续当前内容进行续写。\n\n${content.slice(-200)}... 此外，我们还需要进一步探讨这个问题。\n\n首先，从技术角度来看，该方案具有以下优势：\n1. 高效性：能够快速处理大规模数据\n2. 可扩展性：支持横向扩展以应对增长\n3. 稳定性：经过充分测试，确保可靠运行\n\n其次，在实际应用中，需要注意以下事项：\n- 数据安全必须得到充分保障\n- 性能优化是一个持续的过程\n- 用户体验始终是核心关注点`,

      [ChapterIntent.EXPAND]: `对当前内容进行详细扩展，增加更多细节和说明。\n\n具体来说，可以从以下几个方面进行深入分析：\n\n**一、背景介绍**\n随着技术的快速发展，相关领域正在经历深刻的变革。这不仅改变了行业的运作方式，也提出了新的挑战和机遇。\n\n**二、详细分析**\n1. 技术层面：涉及多个子系统的协同工作\n2. 业务层面：需要综合考虑各方需求\n3. 用户层面：关注使用体验和效率提升\n\n**三、实施建议**\n- 制定详细的实施计划\n- 建立有效的监控机制\n- 持续收集反馈并迭代优化`,

      [ChapterIntent.REWRITE]: `对当前内容进行重新组织和表达，使其更加清晰有力。\n\n【改写后的内容】\n\n在当今快速发展的时代背景下，本章节将深入探讨核心议题。\n\n首先，我们需要明确基本概念和定义。这为后续的讨论奠定了理论基础。\n\n接着，通过案例分析和数据支撑，验证了所提出观点的可行性。实践表明，这种方法能够有效解决实际问题。\n\n最后，总结经验教训，为后续工作提供参考和借鉴。`,

      [ChapterIntent.ADD_ARGUMENT]: `为当前内容补充更多论证和证据。\n\n**补充论证：**\n\n1. **数据支撑**\n根据最新的行业报告，相关领域的市场规模预计将达到 XX 亿元，年复合增长率为 XX%。\n\n2. **案例分析**\n以某知名企业为例，其采用该方案后，效率提升了 XX%，成本降低了 XX%。\n\n3. **专家观点**\n业界专家普遍认为，这一方向具有巨大的发展潜力和应用前景。\n\n4. **对比研究**\n与传统方案相比，本方案在性能、成本、用户体验等方面都具有明显优势。`,

      [ChapterIntent.POLISH]: `对当前内容进行润色，使其更加流畅和专业。\n\n（润色后的内容）\n\n在当今数字化时代背景下，企业面临着前所未有的机遇与挑战。如何在激烈的竞争中保持领先，成为每一位管理者必须思考的问题。\n\n本方案从实际需求出发，结合前沿技术手段，提出了一套完整且可落地的解决策略。通过系统化的分析和实践验证，能够为企业发展提供有力支撑。`,

      [ChapterIntent.SIMPLIFY]: `简化当前内容，去除冗余，保留核心要点。\n\n（简化版）\n\n核心要点：\n1. 问题：行业面临的主要挑战\n2. 方案：推荐的解决策略\n3. 价值：预期达成的效果\n4. 行动：下一步的具体措施`,
    };

    return templates[intent] || templates[ChapterIntent.CONTINUE];
  }
}
