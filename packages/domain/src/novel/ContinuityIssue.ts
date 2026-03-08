import { NovelReference } from './NovelRef';

// 连续性问题类型
export type ContinuityIssueType =
  | 'world_rule_conflict'
  | 'character_ooc'
  | 'timeline_conflict'
  | 'relationship_conflict'
  | 'foreshadow_gap'
  | 'plot_gap'
  | 'tone_drift';

// 连续性问题严重度
export type ContinuityIssueSeverity = 'info' | 'warning' | 'error';

// 连续性问题
export interface ContinuityIssue {
  issueId: string;
  type: ContinuityIssueType;
  severity: ContinuityIssueSeverity;
  message: string;
  suggestion?: string;
  sourceRefs: NovelReference[];
}
