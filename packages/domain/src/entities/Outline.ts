// 大纲章节项
export interface OutlineChapter {
  id: string;
  number: string;          // 章节编号，如 "01", "02"
  title: string;           // 章节标题
  target?: string;        // 章节目标/要求
  status: 'pending' | 'draft' | 'completed';
  wordCount?: number;      // 预估字数
  createdAt?: string;
  updatedAt?: string;
}

// 大纲实体
export interface Outline {
  projectId: string;
  chapters: OutlineChapter[];
  status: 'none' | 'draft' | 'confirmed';
  version: number;          // 版本号
  parentVersion?: number;  // 父版本（支持回溯）
  generatedAt?: string;
  updatedAt: string;
  confirmedAt?: string;
}

// 大纲模板类型
export enum OutlineTemplate {
  STANDARD = 'standard',     // 标准结构（背景-问题-方案-总结）
  RESEARCH = 'research',     // 研究报告（摘要-引言-方法-结果-讨论）
  NOVEL = 'novel',          // 小说（背景-冲突-高潮-结局）
  CUSTOM = 'custom',        // 自定义
}

// 大纲生成参数
export interface GenerateOutlineParams {
  projectId: string;
  template?: OutlineTemplate;
  chapterCount?: number;
  customChapters?: string[];  // 自定义章节标题
}

// 更新大纲参数
export interface UpdateOutlineParams {
  chapters?: OutlineChapter[];
  status?: 'draft' | 'confirmed';
}

// 章节操作类型
export enum ChapterOperation {
  ADD = 'add',
  UPDATE = 'update',
  DELETE = 'delete',
  REORDER = 'reorder',
}

// 章节操作参数
export interface ChapterOperationParams {
  projectId: string;
  operation: ChapterOperation;
  chapterId?: string;
  chapter?: Partial<OutlineChapter>;
  targetIndex?: number;  // 用于排序
}

// 大纲变更记录
export interface OutlineChange {
  id: string;
  outlineId: string;
  version: number;
  changes: {
    type: 'add' | 'update' | 'delete' | 'reorder' | 'confirm';
    chapterId?: string;
    field?: string;
    oldValue?: unknown;
    newValue?: unknown;
    details?: string;
  }[];
  createdAt: string;
}
