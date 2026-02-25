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

请用 JSON 格式输出：
{
  "background": "...",
  "objectives": "...",
  "constraints": "...",
  "style": "...",
  "targetAudience": "..."
}

只输出 JSON，不要其他内容。`;
  }

  /**
   * 从外部prompt文件加载
   */
  private loadExternalPrompt(promptId: string): string | null {
    try {
      // 尝试从prompts/global目录加载
      const promptsDir = path.join(process.cwd(), 'prompts', 'global');
      const promptPath = path.join(promptsDir, `${promptId}.prompt.md`);

      if (fs.existsSync(promptPath)) {
        const content = fs.readFileSync(promptPath, 'utf-8');
        // 提取Task部分（跳过metadata）
        const lines = content.split('\n');
        const taskLines: string[] = [];
        let inTask = false;

        for (const line of lines) {
          if (line.trim() === '## Task' || line.trim() === '## Output Format') {
            inTask = true;
            continue;
          }
          if (inTask && line.startsWith('## ')) {
            break;
          }
          if (inTask) {
            taskLines.push(line);
          }
        }

        return taskLines.join('\n').trim();
      }
    } catch (e) {
      console.warn(`加载外部prompt失败: ${promptId}`, e);
    }
    return null;
  }

  private parseResult(content: string): ProjectSettings {
    try {
      // 尝试提取 JSON
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          background: parsed.background || '',
          objectives: parsed.objectives || '',
          constraints: parsed.constraints || '',
          style: parsed.style || '',
          targetAudience: parsed.targetAudience || '',
          writingTone: parsed.writingTone || 'professional',
        };
      }
    } catch (e) {
      console.error('解析设定失败:', e);
    }

    // 解析失败，返回默认值
    return {
      background: '',
      objectives: '',
      constraints: '',
      style: '',
      targetAudience: '',
      writingTone: 'professional',
    };
  }
}
