import { IndexPort, ContextChunk, ContextPack } from '../ports';
import * as fs from 'fs/promises';
import * as path from 'path';

// 上下文用例
export class ContextUseCases {
  constructor(
    private readonly runtimeBasePath: string,
    private readonly indexPort: IndexPort
  ) {}

  // 打包上下文（用于 AI 生成）
  async packContext(projectId: string, chapterId: string): Promise<ContextPack> {
    return this.indexPort.packContext(projectId, chapterId);
  }

  // 检索相关上下文
  async retrieve(projectId: string, chapterId: string, query: string, limit?: number): Promise<ContextChunk[]> {
    return this.indexPort.retrieve({
      projectId,
      chapterId,
      query,
      limit,
    });
  }

  // 索引章节
  async indexChapter(projectId: string, chapterId: string, content: string): Promise<void> {
    await this.indexPort.indexChapter(projectId, chapterId, content);
  }

  // 重建索引
  async rebuildIndex(projectId: string): Promise<void> {
    await this.indexPort.rebuildProjectIndex(projectId);
  }

  // 获取索引统计
  async getIndexStats(projectId: string): Promise<{
    totalChunks: number;
    indexedChapters: number;
    lastIndexedAt?: string;
  }> {
    return this.indexPort.getStats(projectId);
  }

  // 清理索引
  async clearIndex(projectId: string): Promise<void> {
    await this.indexPort.clear(projectId);
  }
}

// 项目元信息读取器
export class ProjectMetaReader {
  constructor(private readonly runtimeBasePath: string) {}

  async getProjectContext(projectId: string): Promise<string> {
    try {
      const metaPath = path.join(this.runtimeBasePath, projectId, 'meta', 'project.md');
      const content = await fs.readFile(metaPath, 'utf-8');
      return this.extractContext(content);
    } catch {
      return '';
    }
  }

  async getGlossary(projectId: string): Promise<string> {
    try {
      const glossaryPath = path.join(this.runtimeBasePath, projectId, 'meta', 'glossary.md');
      const content = await fs.readFile(glossaryPath, 'utf-8');
      return content;
    } catch {
      return '';
    }
  }

  async getOutline(projectId: string): Promise<string> {
    try {
      const outlinePath = path.join(this.runtimeBasePath, projectId, 'outline', 'outline.md');
      const content = await fs.readFile(outlinePath, 'utf-8');
      return content;
    } catch {
      return '';
    }
  }

  private extractContext(content: string): string {
    // 提取标题、描述等关键信息
    const lines = content.split('\n');
    const context: string[] = [];

    for (const line of lines) {
      if (line.startsWith('# ')) {
        context.push(`项目名称: ${line.replace('# ', '')}`);
      } else if (line.startsWith('- **')) {
        const match = line.match(/- \*\*(.+?)\*\*:?\s*(.*)/);
        if (match) {
          context.push(`${match[1]}: ${match[2]}`);
        }
      }
    }

    return context.join('\n');
  }
}
