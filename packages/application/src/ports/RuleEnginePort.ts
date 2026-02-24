import { CheckIssue, IssueType, GlossaryCheckResult } from '@zide/domain';

// 规则检查结果
export interface RuleCheckResult {
  issues: CheckIssue[];
  checkedAt: string;
}

// 规则引擎端口
export interface RuleEnginePort {
  // 检查缺失章节
  checkMissingChapters(projectId: string): Promise<CheckIssue[]>;

  // 检查术语一致性
  checkTermConsistency(projectId: string): Promise<GlossaryCheckResult>;

  // 检查重复内容
  checkDuplicateContent(projectId: string): Promise<CheckIssue[]>;

  // 检查完成度
  checkCompletion(projectId: string, threshold?: number): Promise<CheckIssue[]>;

  // 检查大纲偏离
  checkOutlineDrift(projectId: string): Promise<CheckIssue[]>;

  // 运行全部检查
  runFullCheck(projectId: string): Promise<RuleCheckResult>;

  // 自动修复（可选）
  autoFix(issueId: string): Promise<{
    success: boolean;
    description: string;
  }>;
}
