import { LLMPort, LLMGenerateParams, LLMGenerateResult, LLMProviderConfig } from '@zide/application';
import { ChapterIntent } from '@zide/domain';

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
    const prompt = this.buildPrompt(params);

    let result: { content: string; model: string; tokens: number };

    switch (this.config.provider) {
      case 'openai':
        result = await this.callOpenAI(prompt);
        break;
      case 'anthropic':
        result = await this.callAnthropic(prompt);
        break;
      case 'minimax':
        result = await this.callMinimax(prompt);
        break;
      case 'kimi':
        result = await this.callKimi(prompt);
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

  private buildPrompt(params: LLMGenerateParams): string {
    const parts: string[] = [];

    // 系统提示词
    parts.push(this.getSystemPrompt(params.intent));

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
    parts.push(`\n当前内容:\n${params.chapter.content.slice(-2000)}`);

    return parts.join('\n\n');
  }

  private getSystemPrompt(intent: ChapterIntent): string {
    const prompts: Record<ChapterIntent, string> = {
      [ChapterIntent.CONTINUE]: `你是一位专业的长文写作助手。请根据上下文续写内容，保持风格一致性。`,
      [ChapterIntent.EXPAND]: `你是一位专业的长文写作助手。请扩展当前内容，增加更多细节、案例和说明。`,
      [ChapterIntent.REWRITE]: `你是一位专业的长文写作助手。请重新组织并改写当前内容，使其更加清晰有力。`,
      [ChapterIntent.ADD_ARGUMENT]: `你是一位专业的长文写作助手。请为当前内容补充更多论证、数据和证据。`,
      [ChapterIntent.POLISH]: `你是一位专业的长文写作助手。请润色当前内容，使其更加流畅和专业。`,
      [ChapterIntent.SIMPLIFY]: `你是一位专业的长文写作助手。请简化当前内容，去除冗余，保留核心要点。`,
    };
    return prompts[intent] || prompts[ChapterIntent.CONTINUE];
  }

  // ========== OpenAI 调用 ==========
  private async callOpenAI(prompt: string): Promise<{ content: string; model: string; tokens: number }> {
    const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        model: this.config.model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: this.config.maxTokens,
        temperature: this.config.temperature,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API 错误: ${response.status} - ${error}`);
    }

    const data = await response.json() as any;
    return {
      content: data.choices[0]?.message?.content || '',
      model: data.model,
      tokens: data.usage?.total_tokens || 0,
    };
  }

  private async pingOpenAI(): Promise<boolean> {
    const response = await fetch(`${this.config.baseUrl}/models`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
      },
    });
    return response.ok;
  }

  // ========== Anthropic 调用 ==========
  private async callAnthropic(prompt: string): Promise<{ content: string; model: string; tokens: number }> {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
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
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Anthropic API 错误: ${response.status} - ${error}`);
    }

    const data = await response.json() as any;
    return {
      content: data.content[0]?.text || '',
      model: data.model,
      tokens: data.usage?.input_tokens + data.usage?.output_tokens || 0,
    };
  }

  private async pingAnthropic(): Promise<boolean> {
    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
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
      return response.status === 400 || response.status === 401;
    } catch {
      return false;
    }
  }

  // ========== MiniMax 调用 ==========
  private async callMinimax(prompt: string): Promise<{ content: string; model: string; tokens: number }> {
    const baseUrl = this.config.baseUrl || 'https://api.minimax.chat/v1';
    const response = await fetch(`${baseUrl}/text/chatcompletion_v2`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        model: this.config.model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: this.config.maxTokens,
        temperature: this.config.temperature,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`MiniMax API 错误: ${response.status} - ${error}`);
    }

    const data = await response.json() as any;
    return {
      content: data.choices[0]?.message?.content || '',
      model: data.model,
      tokens: data.usage?.total_tokens || 0,
    };
  }

  private async pingMinimax(): Promise<boolean> {
    try {
      const baseUrl = this.config.baseUrl || 'https://api.minimax.chat/v1';
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
      return response.status !== 500;
    } catch {
      return false;
    }
  }

  // ========== Kimi 调用 (月之暗面) ==========
  private async callKimi(prompt: string): Promise<{ content: string; model: string; tokens: number }> {
    const baseUrl = this.config.baseUrl || 'https://api.moonshot.cn/v1';
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        model: this.config.model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: this.config.maxTokens,
        temperature: this.config.temperature,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Kimi API 错误: ${response.status} - ${error}`);
    }

    const data = await response.json() as any;
    return {
      content: data.choices[0]?.message?.content || '',
      model: data.model,
      tokens: data.usage?.total_tokens || 0,
    };
  }

  private async pingKimi(): Promise<boolean> {
    try {
      const baseUrl = this.config.baseUrl || 'https://api.moonshot.cn/v1';
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
