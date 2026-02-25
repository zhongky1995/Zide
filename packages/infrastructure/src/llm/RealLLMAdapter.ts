import { LLMPort, LLMGenerateParams, LLMGenerateResult, LLMProviderConfig } from '@zide/application';
import { ChapterIntent } from '@zide/domain';

interface PromptBundle {
  system: string;
  user: string;
}

/**
 * 真实 LLM 适配器
 * 支持 OpenAI、Anthropic Claude、Minimax、Kimi
 */
export class RealLLMAdapter implements LLMPort {
  private config: LLMProviderConfig = {
    provider: 'openai',
    model: 'gpt-4',
    apiKey: process.env.LLM_API_KEY || '',
    baseUrl: process.env.LLM_BASE_URL || 'https://api.openai.com/v1',
    maxTokens: 4000,
    temperature: 0.7,
  };

  async generate(params: LLMGenerateParams): Promise<LLMGenerateResult> {
    const promptBundle = this.buildPromptBundle(params);

    let result: { content: string; model: string; tokens: number };

    switch (this.config.provider) {
      case 'openai':
        result = await this.callOpenAI(promptBundle);
        break;
      case 'anthropic':
        result = await this.callAnthropic(promptBundle);
        break;
      case 'minimax':
        result = await this.callMinimax(promptBundle);
        break;
      case 'kimi':
        result = await this.callKimi(promptBundle);
        break;
      default:
        throw new Error(`不支持的 LLM 提供商: ${this.config.provider}`);
    }

    return {
      content: result.content,
      model: result.model,
      tokens: result.tokens,
      finishReason: 'stop',
    };
  }

  async ping(): Promise<boolean> {
    try {
      switch (this.config.provider) {
        case 'openai':
          return await this.pingOpenAI();
        case 'anthropic':
          return await this.pingAnthropic();
        case 'minimax':
          return await this.pingMinimax();
        case 'kimi':
          return await this.pingKimi();
        default:
          return false;
      }
    } catch {
      return false;
    }
  }

  getConfig(): LLMProviderConfig {
    // 不返回完整 apiKey 到前端，安全考虑
    return {
      ...this.config,
      apiKey: this.config.apiKey ? '***' + this.config.apiKey.slice(-4) : undefined,
    };
  }

  updateConfig(config: Partial<LLMProviderConfig>): void {
    this.config = { ...this.config, ...config };
  }

  private buildPromptBundle(params: LLMGenerateParams): PromptBundle {
    return {
      system: this.getSystemPrompt(params.intent),
      user: this.buildUserPrompt(params),
    };
  }

  private buildUserPrompt(params: LLMGenerateParams): string {
    const parts: string[] = [];

    parts.push('# 任务输入');
    parts.push(`写作意图: ${this.getIntentLabel(params.intent)} (${params.intent})`);
    parts.push(`输出模式: ${this.getOutputModeRule(params.intent)}`);

    // 用户自定义要求优先于默认意图规则，但不能突破安全边界
    const customPrompt = params.customPrompt?.trim();
    if (customPrompt) {
      parts.push(`## 用户自定义要求\n${this.clip(customPrompt, 1200)}`);
    }

    // 项目上下文
    if (params.context.projectContext) {
      parts.push(`## 项目背景\n${this.clip(params.context.projectContext, 1800)}`);
    }

    // 大纲
    if (params.context.outline) {
      parts.push(`## 大纲\n${this.clip(params.context.outline, 2400)}`);
    }

    // 术语表
    if (params.context.glossary) {
      parts.push(`## 术语表\n${this.clip(params.context.glossary, 1200)}`);
    }

    // 相关章节按相关性取前几段，避免无上限膨胀上下文
    if (params.context.relatedChapters.length > 0) {
      parts.push('## 相关章节片段（按相关性排序）');
      params.context.relatedChapters.slice(0, 5).forEach((chapter, index) => {
        parts.push(`### 相关片段 ${index + 1}\n${this.clip(chapter, 700)}`);
      });
    }

    // 当前章节
    parts.push('## 当前章节');
    parts.push(`标题: ${params.chapter.title}`);
    if (params.chapter.target) {
      parts.push(`目标: ${params.chapter.target}`);
    }
    const currentContent = params.chapter.content.trim()
      ? this.clip(params.chapter.content.slice(-3000), 3000)
      : '[当前章节暂无正文内容]';
    parts.push(`当前内容:\n${currentContent}`);

    return parts.join('\n\n');
  }

  private getSystemPrompt(intent: ChapterIntent): string {
    const basePrompt = `你是 Zide 长文 AI 生产系统中的章节写作代理。

## 任务定位
在“可回滚、可检查、可交付”的写作流程中，根据给定上下文完成单次章节生成任务。

## 通用硬约束
1. 严格遵循输入中的项目背景、大纲、术语、章节目标。
2. 输出必须是可直接写入章节的 Markdown 正文，不要输出解释、前言、道歉、过程说明。
3. 保持原文语言、风格、术语一致；禁止无依据地改变立场或结论。
4. 禁止编造具体数据、机构、研究结论；若事实依据不足，使用“[待补充数据]”占位。
5. 若多条指令冲突，优先级为：项目/章节硬约束 > 用户自定义要求 > 默认意图策略。`;

    const prompts: Record<ChapterIntent, string> = {
      [ChapterIntent.CONTINUE]: `## 意图策略：续写（append）
1. 从“当前内容”的末尾自然接续，延展后续论述，不回写已存在段落。
2. 优先推进章节目标中尚未覆盖的点；若目标为空，按大纲顺序推进。
3. 若当前内容以列表/提纲结尾，先转为连贯段落再继续展开。
4. 建议输出 400-1200 字的新增内容。
输出要求：只输出新增片段（append 内容）。`,

      [ChapterIntent.EXPAND]: `## 意图策略：扩写（append）
1. 识别当前内容中信息稀薄的 2-3 个点，分别补充细节、案例或机制解释。
2. 新增内容必须与现有段落逻辑一致，不能重复改写原句。
3. 可使用 1-2 个小标题提升可读性，但不要重建整章结构。
4. 建议输出 500-1500 字的新增内容。
输出要求：只输出新增扩展片段（append 内容），不要返回整章全文。`,

      [ChapterIntent.REWRITE]: `## 意图策略：重写（replace）
1. 在不改变核心观点的前提下，重组段落顺序和表达，提升逻辑清晰度。
2. 合并重复论述，补齐过渡句，让段落之间形成完整叙事链。
3. 保留关键信息和术语，不删除必要结论。
4. 建议重写后长度保持在原文的 80%-120%。
输出要求：返回完整重写后的章节全文（replace 内容）。`,

      [ChapterIntent.ADD_ARGUMENT]: `## 意图策略：补论证（append）
1. 找出当前内容中证据不足的观点，补充数据、案例、逻辑推导或反例对比。
2. 论证必须与章节主题直接相关，避免引入无关知识点。
3. 若缺少可验证事实，使用“[待补充数据: 说明用途]”占位，避免编造。
4. 每段新增论证都要明确“论点 -> 证据 -> 结论”关系。
输出要求：只输出新增论证片段（append 内容）。`,

      [ChapterIntent.POLISH]: `## 意图策略：润色（replace）
1. 优化语法、标点、句式和段落节奏，提升可读性与专业度。
2. 不新增事实，不改变原意，不引入与上下文无关的新观点。
3. 统一 Markdown 格式，保持标题层级与列表样式一致。
4. 对明显口语化或含糊表达进行专业化改写。
输出要求：返回完整润色后的章节全文（replace 内容）。`,

      [ChapterIntent.SIMPLIFY]: `## 意图策略：简化（replace）
1. 保留核心结论与关键步骤，删除重复、绕行和低信息密度句子。
2. 将长句拆分为短句，优先使用直接表达。
3. 术语首次出现时给出一句简明解释，降低理解门槛。
4. 建议简化后长度控制在原文的 60%-80%。
输出要求：返回完整简化后的章节全文（replace 内容）。`,
    };

    return [basePrompt, prompts[intent] || prompts[ChapterIntent.CONTINUE]].join('\n\n');
  }

  private getIntentLabel(intent: ChapterIntent): string {
    const labels: Record<ChapterIntent, string> = {
      [ChapterIntent.CONTINUE]: '续写',
      [ChapterIntent.EXPAND]: '扩写',
      [ChapterIntent.REWRITE]: '重写',
      [ChapterIntent.ADD_ARGUMENT]: '补论证',
      [ChapterIntent.POLISH]: '润色',
      [ChapterIntent.SIMPLIFY]: '简化',
    };
    return labels[intent] || labels[ChapterIntent.CONTINUE];
  }

  private getOutputModeRule(intent: ChapterIntent): string {
    if (
      intent === ChapterIntent.CONTINUE ||
      intent === ChapterIntent.EXPAND ||
      intent === ChapterIntent.ADD_ARGUMENT
    ) {
      return '追加模式（append）：只生成新增片段，系统会自动追加到当前章节末尾。';
    }

    return '替换模式（replace）：请返回完整章节全文，系统会用该结果替换当前章节。';
  }

  private clip(value: string, maxChars: number): string {
    const normalized = value.trim();
    if (normalized.length <= maxChars) {
      return normalized;
    }

    return `${normalized.slice(0, maxChars)}\n...[已截断 ${normalized.length - maxChars} 字符]`;
  }

  private resolveBaseUrl(defaultUrl: string): string {
    const configured = (this.config.baseUrl || '').trim();
    if (!configured) {
      return defaultUrl;
    }

    // Provider 切换后若仍保留 OpenAI 默认地址，则回退到当前 provider 默认地址
    if (configured === 'https://api.openai.com/v1' && defaultUrl !== 'https://api.openai.com/v1') {
      return defaultUrl;
    }

    return configured;
  }

  // ========== OpenAI 调用 ==========
  private async callOpenAI(prompt: PromptBundle): Promise<{ content: string; model: string; tokens: number }> {
    const baseUrl = this.resolveBaseUrl('https://api.openai.com/v1');
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        model: this.config.model,
        messages: [
          { role: 'system', content: prompt.system },
          { role: 'user', content: prompt.user },
        ],
        max_tokens: this.config.maxTokens,
        temperature: this.config.temperature,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API 错误: ${response.status} - ${error}`);
    }

    const data = await response.json() as {
      choices: Array<{ message?: { content: string } }>;
      model: string;
      usage?: { total_tokens: number };
    };
    return {
      content: data.choices[0]?.message?.content || '',
      model: data.model,
      tokens: data.usage?.total_tokens || 0,
    };
  }

  private async pingOpenAI(): Promise<boolean> {
    const baseUrl = this.resolveBaseUrl('https://api.openai.com/v1');
    const response = await fetch(`${baseUrl}/models`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
      },
    });
    return response.ok;
  }

  // ========== Anthropic 调用 ==========
  private async callAnthropic(prompt: PromptBundle): Promise<{ content: string; model: string; tokens: number }> {
    const baseUrl = this.resolveBaseUrl('https://api.anthropic.com/v1');
    const response = await fetch(`${baseUrl}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.config.apiKey || '',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: this.config.model,
        max_tokens: this.config.maxTokens || 1024,
        temperature: this.config.temperature,
        system: prompt.system,
        messages: [{ role: 'user', content: prompt.user }],
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Anthropic API 错误: ${response.status} - ${error}`);
    }

    const data = await response.json() as {
      content: Array<{ text: string }>;
      model: string;
      usage?: { input_tokens: number; output_tokens: number };
    };
    return {
      content: data.content[0]?.text || '',
      model: data.model,
      tokens: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0),
    };
  }

  private async pingAnthropic(): Promise<boolean> {
    try {
      const baseUrl = this.resolveBaseUrl('https://api.anthropic.com/v1');
      const response = await fetch(`${baseUrl}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.config.apiKey || '',
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: this.config.model,
          max_tokens: 1,
          messages: [{ role: 'user', content: 'ping' }],
        }),
      });
      // 400/401 表示认证失败但服务器可达，视为连接正常
      return response.ok || response.status === 400 || response.status === 401;
    } catch {
      return false;
    }
  }

  // ========== MiniMax 调用 ==========
  private async callMinimax(prompt: PromptBundle): Promise<{ content: string; model: string; tokens: number }> {
    const baseUrl = this.resolveBaseUrl('https://api.minimax.chat/v1');
    const response = await fetch(`${baseUrl}/text/chatcompletion_v2`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        model: this.config.model,
        messages: [
          { role: 'system', content: prompt.system },
          { role: 'user', content: prompt.user },
        ],
        max_tokens: this.config.maxTokens,
        temperature: this.config.temperature,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`MiniMax API 错误: ${response.status} - ${error}`);
    }

    const data = await response.json() as {
      choices: Array<{ message?: { content: string } }>;
      model: string;
      usage?: { total_tokens: number };
    };
    return {
      content: data.choices[0]?.message?.content || '',
      model: data.model,
      tokens: data.usage?.total_tokens || 0,
    };
  }

  private async pingMinimax(): Promise<boolean> {
    try {
      const baseUrl = this.resolveBaseUrl('https://api.minimax.chat/v1');
      const response = await fetch(`${baseUrl}/text/chatcompletion_v2`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify({
          model: this.config.model,
          messages: [{ role: 'user', content: 'ping' }],
          max_tokens: 1,
        }),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  // ========== Kimi 调用 (月之暗面) ==========
  private async callKimi(prompt: PromptBundle): Promise<{ content: string; model: string; tokens: number }> {
    const baseUrl = this.resolveBaseUrl('https://api.moonshot.cn/v1');
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        model: this.config.model,
        messages: [
          { role: 'system', content: prompt.system },
          { role: 'user', content: prompt.user },
        ],
        max_tokens: this.config.maxTokens,
        temperature: this.config.temperature,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Kimi API 错误: ${response.status} - ${error}`);
    }

    const data = await response.json() as {
      choices: Array<{ message?: { content: string } }>;
      model: string;
      usage?: { total_tokens: number };
    };
    return {
      content: data.choices[0]?.message?.content || '',
      model: data.model,
      tokens: data.usage?.total_tokens || 0,
    };
  }

  private async pingKimi(): Promise<boolean> {
    try {
      const baseUrl = this.resolveBaseUrl('https://api.moonshot.cn/v1');
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify({
          model: this.config.model,
          messages: [{ role: 'user', content: 'ping' }],
          max_tokens: 1,
        }),
      });
      return response.ok || response.status === 400;
    } catch {
      return false;
    }
  }
}
