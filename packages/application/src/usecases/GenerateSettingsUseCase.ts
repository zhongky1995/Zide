import { LLMPort, LLMProviderConfig } from '../ports/LLMPort';
import * as fs from 'fs';
import * as path from 'path';

export interface GenerateSettingsParams {
  name: string;
  type: string;
  idea: string;
  targetReaders?: string;
  targetScale?: string;
}

export interface ProjectSettings {
  background: string;      // 项目背景
  objectives: string;      // 项目目标
  constraints: string;     // 限制条件
  style: string;          // 风格指南
  targetAudience: string; // 目标读者
  writingTone?: string;   // 写作基调
}

/**
 * 生成全局设定的用例
 * 基于用户的想法，调用 AI 生成项目的全局设定
 */
export class GenerateSettingsUseCase {
  constructor(private readonly llmPort: LLMPort) {}

  async generate(params: GenerateSettingsParams): Promise<ProjectSettings> {
    const prompt = this.buildPrompt(params);
    const result = await this.llmPort.generate({
      context: {
        projectContext: '',
        relatedChapters: [],
        glossary: '',
        outline: '',
      },
      chapter: {
        id: 'settings-generation',
        title: '全局设定生成',
        content: prompt,
        target: '',
      },
      intent: 'polish' as any,
    });

    return this.parseResult(result.content);
  }

  private buildPrompt(params: GenerateSettingsParams): string {
    // 尝试从外部prompt文件加载
    const promptTemplate = this.loadExternalPrompt('generate-settings');

    if (promptTemplate) {
      // 替换模板变量
      return promptTemplate
        .replace(/\$\{name\}/g, params.name)
        .replace(/\$\{type\}/g, params.type)
        .replace(/\$\{targetReaders\}/g, params.targetReaders || '未指定')
        .replace(/\$\{targetScale\}/g, params.targetScale || '未指定')
        .replace(/\$\{idea\}/g, params.idea);
    }

    // Fallback: 使用内置prompt
    return `你是一位专业的写作顾问。用户想要创建一个写作项目，请根据以下信息生成项目的全局设定。

## 项目信息
- 项目名称：${params.name}
- 项目类型：${params.type}
- 目标读者：${params.targetReaders || '未指定'}
- 目标规模：${params.targetScale || '未指定'}

## 用户的想法
${params.idea}

## 请生成以下全局设定

1. **项目背景** (background)：这个项目的背景是什么？为什么要写这个内容？
2. **项目目标** (objectives)：通过这个项目要达成什么目的？解决什么问题？
3. **限制条件** (constraints)：有什么需要特别注意的限制？
4. **风格指南** (style)：应该用什么风格来写？
5. **目标读者** (targetAudience)：本项目最终服务给谁？
6. **写作语气** (writingTone)：只能从 professional/academic/casual/creative 中选一个

请用 JSON 格式输出：
{
  "background": "",
  "objectives": "",
  "constraints": "",
  "style": "",
  "targetAudience": "",
  "writingTone": ""
}

只输出 JSON，不要其他内容。
禁止使用“...”“…”“待补充”“暂无”等占位符，所有字段都必须是可直接使用的完整内容。`;
  }

  /**
   * 从外部prompt文件加载
   */
  private loadExternalPrompt(promptId: string): string | null {
    const promptFile = `${promptId}.prompt.md`;
    const candidatePaths = new Set([
      path.join(process.cwd(), 'prompts', 'global', promptFile),
      path.join(process.cwd(), '..', 'prompts', 'global', promptFile),
      path.join(process.cwd(), '..', '..', 'prompts', 'global', promptFile),
      path.join(__dirname, '..', '..', '..', '..', 'prompts', 'global', promptFile),
    ]);

    for (const promptPath of candidatePaths) {
      try {
        if (!fs.existsSync(promptPath)) {
          continue;
        }
        const content = fs.readFileSync(promptPath, 'utf-8');
        return this.extractPromptBody(content);
      } catch (e) {
        console.warn(`加载外部prompt失败: ${promptPath}`, e);
      }
    }

    return null;
  }

  /**
   * 提取prompt正文（去掉顶部元数据）
   */
  private extractPromptBody(content: string): string {
    const lines = content.split('\n');
    let start = 0;

    while (start < lines.length) {
      const trimmed = lines[start].trim();
      if (
        trimmed === '' ||
        trimmed.startsWith('# Prompt:') ||
        trimmed.startsWith('- prompt_id:') ||
        trimmed.startsWith('- version:') ||
        trimmed.startsWith('- created_at:') ||
        trimmed.startsWith('- description:') ||
        trimmed.startsWith('- extends:')
      ) {
        start += 1;
        continue;
      }
      break;
    }

    return lines.slice(start).join('\n').trim();
  }

  private parseResult(content: string): ProjectSettings {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('AI 返回的全局设定格式无效：未找到 JSON 对象');
    }

    let parsed: any;
    try {
      parsed = JSON.parse(jsonMatch[0]);
    } catch (e) {
      throw new Error('AI 返回的全局设定格式无效：JSON 解析失败');
    }

    const background = this.normalizeText(parsed.background);
    const objectives = this.normalizeText(parsed.objectives);
    const constraints = this.normalizeText(parsed.constraints);
    const style = this.normalizeText(parsed.style);
    const targetAudienceRaw = this.normalizeText(parsed.targetAudience);

    const invalidRequiredFields = [
      { key: 'background', label: '背景设定', value: background },
      { key: 'objectives', label: '目标', value: objectives },
      { key: 'constraints', label: '约束条件', value: constraints },
      { key: 'style', label: '风格', value: style },
    ]
      .filter((item) => this.isPlaceholderValue(item.value))
      .map((item) => item.label);

    if (invalidRequiredFields.length > 0) {
      throw new Error(`AI 返回的全局设定包含占位内容（${invalidRequiredFields.join('、')}），请检查输入后重试`);
    }

    const result: ProjectSettings = {
      background,
      objectives,
      constraints,
      style,
      targetAudience: this.isPlaceholderValue(targetAudienceRaw) ? '通用专业读者' : targetAudienceRaw,
      writingTone: this.normalizeWritingTone(parsed.writingTone),
    };

    if (!result.background && !result.objectives && !result.constraints && !result.style) {
      throw new Error('AI 返回的全局设定内容为空，请完善输入后重试');
    }

    return result;
  }

  private normalizeText(value: unknown): string {
    return typeof value === 'string' ? value.trim() : '';
  }

  private normalizeWritingTone(value: unknown): string {
    const tone = this.normalizeText(value).toLowerCase();
    const validTones = new Set(['professional', 'academic', 'casual', 'creative']);
    return validTones.has(tone) ? tone : 'professional';
  }

  private isPlaceholderValue(value: string): boolean {
    const normalized = value.trim().toLowerCase();
    if (!normalized) {
      return true;
    }

    const compact = normalized.replace(/[\s\u3000]/g, '');

    if (/^(\.{2,}|…+|。{2,}|、{2,}|-+|_+)$/u.test(compact)) {
      return true;
    }

    if (/^(todo|tbd|na|n\/a|null|none|unknown)$/i.test(compact)) {
      return true;
    }

    if (/^(待补充|待完善|待定|未填写|未提供|暂无|无|略)$/u.test(compact)) {
      return true;
    }

    // 仅包含符号或标点，视为无效占位内容
    const contentOnly = compact.replace(/[\p{P}\p{S}]/gu, '');
    return contentOnly.length === 0;
  }
}
