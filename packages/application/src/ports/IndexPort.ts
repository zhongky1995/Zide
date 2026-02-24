// 上下文片段
export interface ContextChunk {
  id: string;
  chapterId: string;
  chapterTitle: string;
  content: string;
  keywords: string[];
  relevance: number;        // 相关度 0-1
  position: 'start' | 'middle' | 'end';
}

// 上下文包
export interface ContextPack {
  projectContext: string;
  relatedChapters: ContextChunk[];
  glossary: string;
  outline: string;
  sources: {
    chapterId: string;
    chunkIds: string[];
  }[];
}

// 索引配置
export interface IndexConfig {
  chunkSize: number;        // 切片大小（字符数）
  chunkOverlap: number;     // 切片重叠（字符数）
  keywordsPerChunk: number; // 每个切片提取的关键词数
}

// 检索参数
export interface RetrieveParams {
  projectId: string;
  chapterId: string;
  query: string;
  limit?: number;           // 返回结果数量限制
}

// 索引端口
export interface IndexPort {
  // 索引章节内容
  indexChapter(projectId: string, chapterId: string, content: string): Promise<void>;

  // 移除章节索引
  removeChapterIndex(chapterId: string): Promise<void>;

  // 重建项目索引
  rebuildProjectIndex(projectId: string): Promise<void>;

  // 检索相关上下文
  retrieve(params: RetrieveParams): Promise<ContextChunk[]>;

  // 打包上下文（用于 AI 生成）
  packContext(projectId: string, chapterId: string): Promise<ContextPack>;

  // 获取索引统计
  getStats(projectId: string): Promise<{
    totalChunks: number;
    indexedChapters: number;
    lastIndexedAt?: string;
  }>;

  // 清理索引
  clear(projectId: string): Promise<void>;
}
