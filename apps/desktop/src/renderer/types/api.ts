// API类型定义
export interface ProjectSettings {
  background?: string;
  goals?: string;
  constraints?: string;
  style?: string;
}

export interface ProjectMetaSettings {
  background: string;
  objectives: string;
  constraints: string;
  styleGuide: string;
  targetAudience?: string;
}

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
  settings?: ProjectSettings;
  meta?: ProjectMetaSettings;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProjectParams {
  name: string;
  type?: string;
  readers?: string;
  scale?: string;
  description?: string;
  idea?: string;
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

export type CandidateDraftStatus =
  | 'pending_review'
  | 'needs_revision'
  | 'approved'
  | 'rejected'
  | 'adopted'
  | 'superseded';

export interface CandidateDraft {
  draftId: string;
  projectId: string;
  chapterId: string;
  taskRunId: string;
  sourceIntent: string;
  content: string;
  summary?: string;
  status: CandidateDraftStatus;
  createdAt: string;
  updatedAt: string;
}

export interface ContinuityIssue {
  issueId: string;
  type:
    | 'world_rule_conflict'
    | 'character_ooc'
    | 'timeline_conflict'
    | 'relationship_conflict'
    | 'foreshadow_gap'
    | 'plot_gap'
    | 'tone_drift';
  severity: 'info' | 'warning' | 'error';
  message: string;
  suggestion?: string;
  sourceRefs: Array<{ kind: string; id: string; label?: string }>;
}

export interface ContinuityReport {
  reportId: string;
  projectId: string;
  draftId: string;
  score: number;
  passed: boolean;
  issues: ContinuityIssue[];
  revisionAdvice?: string;
  createdAt: string;
}

export type NovelTaskType =
  | 'advance_scene'
  | 'expand_scene'
  | 'rewrite_scene'
  | 'polish_scene'
  | 'polish'
  | 'rewrite_plot';

export type TaskComplexity = 'quick' | 'standard' | 'deep';

export type TaskContextMode = 'auto' | 'focused' | 'broad';

export type TaskRunRoute = 'fast-path' | 'standard-path' | 'deep-path';

export type TaskRunStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface NovelTaskEnvelope {
  taskId?: string;
  projectId: string;
  chapterId: string;
  taskType: NovelTaskType;
  prompt?: string;
  complexity?: TaskComplexity;
  contextMode?: TaskContextMode;
  targetRef?: {
    kind: string;
    id: string;
    label?: string;
  };
  context?: {
    systemContext: string[];
    taskContext: string[];
    workingMemory: Array<{ kind: string; id: string; label?: string }>;
    longTermMemory: Array<{ kind: string; id: string; label?: string }>;
  };
  requestedAt?: string;
}

export interface TaskRunStep {
  stepId: string;
  label: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  note?: string;
}

export interface NovelTaskRouteDecision {
  route: TaskRunRoute;
  complexity: TaskComplexity;
  mappedIntent: string;
  executionMode: 'legacy-inline-write' | 'candidate-draft';
  pipelineStages: Array<'plan' | 'execute' | 'evaluate' | 'revise'>;
  routeSignals: string[];
}

export interface NovelTaskRun {
  runId: string;
  projectId: string;
  taskType: NovelTaskType;
  route: TaskRunRoute;
  status: TaskRunStatus;
  revisionCount: number;
  startedAt: string;
  finishedAt?: string;
  steps: TaskRunStep[];
}

export interface NovelTaskAttempt {
  round: number;
  operation: AIOperation;
  candidateDraft: CandidateDraft;
  continuityReport: ContinuityReport;
}

export interface NovelTaskExecutionResult {
  envelope: Required<Omit<NovelTaskEnvelope, 'prompt'>> & { prompt?: string };
  routeDecision: NovelTaskRouteDecision;
  taskRun: NovelTaskRun;
  chapter: Chapter | null;
  operation: AIOperation;
  candidateDraft: CandidateDraft;
  continuityReport: ContinuityReport;
  attempts: NovelTaskAttempt[];
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

export interface StoryBible {
  storyBibleId: string;
  projectId: string;
  premise: string;
  theme?: string;
  settingSummary?: string;
  conflictCore?: string;
  toneGuide?: string;
  narrativePromise?: string;
  status: 'draft' | 'confirmed' | 'locked';
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface ChapterGoal {
  chapterId: string;
  projectId: string;
  arcId?: string;
  title: string;
  objective: string;
  conflict?: string;
  emotionalShift?: string;
  payoff?: string;
  status: 'planned' | 'drafting' | 'revising' | 'completed';
  createdAt: string;
  updatedAt: string;
}

export interface PlotBoardSnapshot {
  outline: Outline | null;
  chapterGoals: ChapterGoal[];
}

export interface MemoryCard {
  memoryId: string;
  projectId: string;
  kind: 'character' | 'world_rule' | 'relationship' | 'timeline' | 'plot_decision' | 'tone';
  title: string;
  summary: string;
  confidence: number;
  confirmed: boolean;
  sourceRefs: Array<{ kind: string; id: string; label?: string }>;
  createdAt: string;
  updatedAt: string;
}

export interface RetconDecision {
  retconId: string;
  projectId: string;
  summary: string;
  reason?: string;
  affectedRefs: Array<{ kind: string; id: string; label?: string }>;
  status: 'proposed' | 'approved' | 'rolled_back';
  approvedAt?: string;
  createdAt: string;
}

export interface ManuscriptBlocker {
  blockerId: string;
  chapterId?: string;
  message: string;
  relatedIssue?: ContinuityIssue;
}

export interface ManuscriptReadiness {
  projectId: string;
  readinessScore: number;
  completedChapterCount: number;
  blockingIssueCount: number;
  blockers: ManuscriptBlocker[];
  lastEvaluatedAt: string;
}
