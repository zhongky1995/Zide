import * as fs from 'fs';
import * as path from 'path';

/**
 * Prompt加载器
 * 从文件系统加载prompt模板文件
 */
export class PromptLoader {
  private promptsDir: string;
  private cache: Map<string, string> = new Map();

  constructor(promptsDir?: string) {
    // 默认使用项目根目录的prompts文件夹
    this.promptsDir = promptsDir || path.join(process.cwd(), 'prompts');
  }

  /**
   * 加载prompt文件内容
   */
  load(promptId: string, category: string = 'global'): string {
    const cacheKey = `${category}/${promptId}`;

    // 先检查缓存
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    // 构建文件路径
    const filePath = this.resolvePath(promptId, category);

    if (!fs.existsSync(filePath)) {
      console.warn(`Prompt文件不存在: ${filePath}, 使用fallback`);
      return '';
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    this.cache.set(cacheKey, content);

    return content;
  }

  /**
   * 加载prompt并解析metadata
   */
  loadWithMeta(promptId: string, category: string = 'global'): { meta: PromptMeta; content: string } | null {
    const content = this.load(promptId, category);
    if (!content) return null;

    const meta = this.parseMeta(content);
    return { meta, content };
  }

  /**
   * 获取所有可用prompts的列表
   */
  listPrompts(category?: string): PromptInfo[] {
    const results: PromptInfo[] = [];

    const categories = category ? [category] : ['global', 'agents'];

    for (const cat of categories) {
      const dir = path.join(this.promptsDir, cat);
      if (!fs.existsSync(dir)) continue;

      const files = fs.readdirSync(dir).filter(f => f.endsWith('.prompt.md'));

      for (const file of files) {
        const promptId = file.replace('.prompt.md', '');
        const info = this.getPromptInfo(promptId, cat);
        if (info) results.push(info);
      }
    }

    return results;
  }

  /**
   * 清除缓存
   */
  clearCache(): void {
    this.cache.clear();
  }

  private resolvePath(promptId: string, category: string): string {
    return path.join(this.promptsDir, category, `${promptId}.prompt.md`);
  }

  private parseMeta(content: string): PromptMeta {
    const meta: PromptMeta = {
      prompt_id: '',
      version: '1.0.0',
    };

    // 解析YAML风格的metadata
    const lines = content.split('\n');
    for (const line of lines) {
      const match = line.match(/^-\s*(\w+):\s*(.+)$/);
      if (match) {
        const [, key, value] = match;
        (meta as any)[key] = value.trim();
      }
    }

    return meta;
  }

  private getPromptInfo(promptId: string, category: string): PromptInfo | null {
    const result = this.loadWithMeta(promptId, category);
    if (!result) return null;

    return {
      promptId,
      category,
      name: result.meta.name || promptId,
      description: result.meta.description || '',
      version: result.meta.version || '1.0.0',
    };
  }
}

export interface PromptMeta {
  prompt_id: string;
  version: string;
  name?: string;
  description?: string;
  extends?: string;
  [key: string]: string | undefined;
}

export interface PromptInfo {
  promptId: string;
  category: string;
  name: string;
  description: string;
  version: string;
}

// 默认导出单例
export const promptLoader = new PromptLoader();
