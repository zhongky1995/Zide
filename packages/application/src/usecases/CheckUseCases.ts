import { CheckIssue, CheckResult } from '@zide/domain';
import { RuleEnginePort } from '../ports';

// 检查用例
export class CheckUseCases {
  constructor(private readonly ruleEngine: RuleEnginePort) {}

  // 运行完整检查
  async runFullCheck(projectId: string): Promise<CheckResult> {
    const result = await this.ruleEngine.runFullCheck(projectId);

    // 统计
    let errors = 0;
    let warnings = 0;
    let infos = 0;

    for (const issue of result.issues) {
      if (issue.severity === 'error') errors++;
      else if (issue.severity === 'warning') warnings++;
      else infos++;
    }

    return {
      projectId,
      totalIssues: result.issues.length,
      errors,
      warnings,
      infos,
      resolved: 0,
      checkType: 'full',
      checkedAt: result.checkedAt,
      issues: result.issues,
    };
  }

  // 检查缺失章节
  async checkMissingChapters(projectId: string): Promise<CheckIssue[]> {
    return this.ruleEngine.checkMissingChapters(projectId);
  }

  // 检查术语一致性
  async checkTermConsistency(projectId: string) {
    return this.ruleEngine.checkTermConsistency(projectId);
  }

  // 检查重复内容
  async checkDuplicateContent(projectId: string): Promise<CheckIssue[]> {
    return this.ruleEngine.checkDuplicateContent(projectId);
  }

  // 检查完成度
  async checkCompletion(projectId: string, threshold?: number): Promise<CheckIssue[]> {
    return this.ruleEngine.checkCompletion(projectId, threshold);
  }

  // 检查大纲偏离
  async checkOutlineDrift(projectId: string): Promise<CheckIssue[]> {
    return this.ruleEngine.checkOutlineDrift(projectId);
  }

  // 标记问题已解决
  async resolveIssue(issue: CheckIssue): Promise<CheckIssue> {
    return {
      ...issue,
      status: 'resolved',
      resolvedAt: new Date().toISOString(),
    };
  }

  // 忽略问题
  async ignoreIssue(issue: CheckIssue): Promise<CheckIssue> {
    return {
      ...issue,
      status: 'ignored',
    };
  }
}
