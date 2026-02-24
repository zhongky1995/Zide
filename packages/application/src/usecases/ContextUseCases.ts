import { IndexPort, ContextChunk, ContextPack, ProjectRepoPort } from '../ports';

// 上下文用例
export class ContextUseCases {
  constructor(
    private readonly projectRepo: ProjectRepoPort,
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

// 项目元信息读取器（使用 ProjectRepoPort）
export class ProjectMetaReader {
  constructor(private readonly projectRepo: ProjectRepoPort) {}

  async getProjectContext(projectId: string): Promise<string> {
    return this.projectRepo.getProjectContext(projectId);
  }

  async getGlossary(projectId: string): Promise<string> {
    return this.projectRepo.getGlossary(projectId);
  }

  async getOutline(projectId: string): Promise<string> {
    return this.projectRepo.getOutline(projectId);
  }
}
