// 快照类型枚举
export enum SnapshotType {
  CHAPTER = 'chapter',     // 章节快照
  GLOBAL = 'global',      // 全局快照（整个项目）
}

// 快照状态
export interface SnapshotBase {
  id: string;
  projectId: string;
  type: SnapshotType;
  description?: string;
  createdAt: string;
}

// 章节快照内容
export interface ChapterSnapshotContent {
  chapterId: string;
  number: string;
  title: string;
  content: string;
  summary: string;
  wordCount: number;
}

// 全局快照内容
export interface GlobalSnapshotContent {
  project: {
    name: string;
    meta: Record<string, unknown>;
    status: string;
  };
  chapters: ChapterSnapshotContent[];
  glossary: string[];
  outline: string;
}

// 完整快照实体
export interface Snapshot extends SnapshotBase {
  content: ChapterSnapshotContent | GlobalSnapshotContent;
  chapterId?: string;       // 章节快照时关联的章节 ID
  operationId?: string;    // 触发快照的操作 ID
}

// 快照创建参数
export interface CreateSnapshotParams {
  projectId: string;
  type: SnapshotType;
  description?: string;
  chapterId?: string;
  operationId?: string;
}

// 快照对比结果
export interface SnapshotDiff {
  snapshotId: string;
  type: SnapshotType;
  changes: {
    added?: string[];
    removed?: string[];
    modified?: { field: string; oldValue: string; newValue: string }[];
  };
}
