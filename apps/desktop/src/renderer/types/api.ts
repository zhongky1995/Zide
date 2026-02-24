// API类型定义
export interface Project {
  id: string;
  name: string;
  type: string;
  status: string;
  description?: string;
  targetReaders?: string;
  targetScale?: string;
  outlineStatus: string;
  glossaryCount: number;
  chapterIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateProjectParams {
  name: string;
  type?: string;
  readers?: string;
  scale?: string;
  description?: string;
}

export interface Chapter {
  id: string;
  projectId: string;
  number: string;
  title: string;
  target?: string;
  status: string;
  wordCount: number;
  completion: number;
  content: string;
  operationCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ChapterSummary {
  id: string;
  number: string;
  title: string;
  status: string;
  completion: number;
  wordCount: number;
}

export interface Outline {
  projectId: string;
  chapters: OutlineChapter[];
  status: string;
  generatedAt: string;
  updatedAt: string;
}

export interface OutlineChapter {
  id: string;
  number: string;
  title: string;
  target?: string;
  status: string;
}

export interface AIOperation {
  id: string;
  chapterId: string;
  intent: string;
  input: {
    contextUsed: string[];
    prompt?: string;
  };
  output: {
    content: string;
    model: string;
    tokens: number;
  };
  createdAt: string;
  adopted: boolean;
}

export interface Snapshot {
  id: string;
  projectId: string;
  type: string;
  description?: string;
  chapterId?: string;
  createdAt: string;
}

export interface ProjectMetrics {
  projectId: string;
  projectName: string;
  totalProjects: number;
  totalChapters: number;
  completedChapters: number;
  totalWords: number;
  aiOperations: number;
  adoptedOperations: number;
  snapshotsCreated: number;
  rollbacksPerformed: number;
  exportsCompleted: number;
  checksRun: number;
  averageGenerationTime: number;
  createdAt: string;
  lastActivityAt: string;
}
