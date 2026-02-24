// 章节状态枚举
export enum ChapterStatus {
  TODO = 'todo',           // 待处理
  IN_PROGRESS = 'in_progress',  // 进行中
  DRAFT = 'draft',         // 草稿
  REVIEW = 'review',      // 审核中
  COMPLETED = 'completed', // 已完成
  ARCHIVED = 'archived',  // 已归档
}

// 章节内容摘要
export interface ChapterSummary {
  mainPoint?: string;      // 主要论点
  keyPoints?: string[];    // 关键要点
  conclusion?: string;     // 小结
}

// 章节基础信息
export interface ChapterBase {
  id: string;
  projectId: string;
  number: string;          // 章节编号，如 "01", "02-intro"
  title: string;
  status: ChapterStatus;
  wordCount: number;      // 字数
  completion: number;     // 完成度 0-100
  summary?: ChapterSummary;
  target?: string;         // 章节目标/要求
  createdAt: string;
  updatedAt: string;
}

// 章节完整实体
export interface Chapter extends ChapterBase {
  content: string;        // 正文内容（Markdown）
  operationCount: number; // AI 操作次数
  lastOperationId?: string; // 最近一次操作的 ID
}

// 章节创建参数
export interface CreateChapterParams {
  projectId: string;
  number: string;
  title: string;
  target?: string;
}

// 章节更新参数
export interface UpdateChapterParams {
  title?: string;
  content?: string;
  status?: ChapterStatus;
  target?: string;
  completion?: number;
  summary?: ChapterSummary;
}

// 章节操作意图
export enum ChapterIntent {
  CONTINUE = 'continue',   // 续写
  EXPAND = 'expand',       // 扩写
  REWRITE = 'rewrite',    // 重写
  ADD_ARGUMENT = 'add_argument', // 补论证
  POLISH = 'polish',       // 润色
  SIMPLIFY = 'simplify',  // 简化
}

// AI 操作记录
export interface AIOperation {
  id: string;
  chapterId: string;
  intent: ChapterIntent;
  input: {
    contextUsed: string[];  // 使用的上下文章节 ID
    prompt?: string;        // 自定义提示词
  };
  output: {
    content: string;       // 生成的内容
    model: string;         // 使用的模型
    tokens: number;        // 消耗的 token 数
  };
  createdAt: string;
  adopted: boolean;        // 是否被用户采纳
}
