// 问题严重程度
export enum IssueSeverity {
  ERROR = 'error',         // 错误，必须修复
  WARNING = 'warning',     // 警告，建议修复
  INFO = 'info',          // 信息，提示关注
}

// 问题类型枚举
export enum IssueType {
  MISSING_CHAPTER = 'missing_chapter',     // 缺章
  TERM_CONFLICT = 'term_conflict',         // 术语冲突
  DUPLICATE_CONTENT = 'duplicate_content', // 重复内容
  LOGIC_CONFLICT = 'logic_conflict',       // 逻辑冲突
  STYLE_ISSUE = 'style_issue',            // 风格问题
  OUTLINE_DRIFT = 'outline_drift',         // 大纲偏离
  COMPLETION_LOW = 'completion_low',       // 完成度过低
}

// 检查问题实体
export interface CheckIssue {
  id: string;
  projectId: string;
  type: IssueType;
  severity: IssueSeverity;
  title: string;
  description: string;
  affectedChapters?: string[];  // 受影响的章节 ID
  suggestion?: string;          // 修复建议
  autoFixable: boolean;         // 是否可自动修复
  status: 'open' | 'resolved' | 'ignored'; // 状态
  createdAt: string;
  resolvedAt?: string;
  resolvedBy?: string;         // 修复人
}

// 检查结果摘要
export interface CheckSummary {
  projectId: string;
  totalIssues: number;
  errors: number;
  warnings: number;
  infos: number;
  resolved: number;
  checkType: 'full' | 'partial';  // 完整检查或增量检查
  checkedAt: string;
}

// 检查详情（包含问题列表）
export interface CheckResult extends CheckSummary {
  issues: CheckIssue[];
}

// 检查任务元数据
export interface CheckJob {
  id: string;
  projectId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;           // 0-100
  checkType: 'full' | 'partial';
  startedAt: string;
  completedAt?: string;
  error?: string;
}
