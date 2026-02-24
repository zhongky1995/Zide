import {
  CheckIssue,
  IssueType,
  IssueSeverity,
  GlossaryCheckResult,
} from '@zide/domain';
import { RuleEnginePort } from '@zide/application';
import * as fs from 'fs/promises';
import * as path from 'path';

export class SimpleRuleEngine implements RuleEnginePort {
  constructor(private readonly runtimeBasePath: string) {}

  // 检查缺失章节
  async checkMissingChapters(projectId: string): Promise<CheckIssue[]> {
    const issues: CheckIssue[] = [];

    try {
      // 读取大纲
      const outlinePath = path.join(this.runtimeBasePath, projectId, 'outline', 'outline.md');
      const outlineContent = await fs.readFile(outlinePath, 'utf-8');

      // 提取大纲中的章节
      const outlineChapters = this.extractOutlineChapters(outlineContent);

      // 读取实际章节
      const chaptersDir = path.join(this.runtimeBasePath, projectId, 'chapters');
      const files = await fs.readdir(chaptersDir);
      const existingChapters = files.filter(f => f.endsWith('.md')).map(f => f.replace('.md', ''));

      // 检查缺失
      for (const ch of outlineChapters) {
        if (!existingChapters.includes(ch.number)) {
          issues.push({
            id: `issue-missing-${ch.number}`,
            projectId,
            type: IssueType.MISSING_CHAPTER,
            severity: IssueSeverity.ERROR,
            title: `缺失章节：${ch.title}`,
            description: `大纲中定义的章节 "${ch.title}" (${ch.number}) 尚未创建`,
            affectedChapters: [],
            suggestion: `创建章节 "${ch.title}"`,
            autoFixable: false,
            status: 'open',
            createdAt: new Date().toISOString(),
          });
        }
      }
    } catch {
      // 目录不存在，忽略
    }

    return issues;
  }

  // 检查术语一致性
  async checkTermConsistency(projectId: string): Promise<GlossaryCheckResult> {
    const conflicts: GlossaryCheckResult['conflicts'] = [];

    try {
      // 读取术语表
      const glossaryPath = path.join(this.runtimeBasePath, projectId, 'meta', 'glossary.md');
      const glossaryContent = await fs.readFile(glossaryPath, 'utf-8');

      // 提取术语
      const terms = this.extractTerms(glossaryContent);

      // 检查冲突（同义术语）
      const termMap = new Map<string, string[]>();
      for (const term of terms) {
        // 简单实现：按首字母分组检测
        const key = term.term[0].toLowerCase();
        if (!termMap.has(key)) {
          termMap.set(key, []);
        }
        termMap.get(key)!.push(term.term);
      }

      // 检测冲突（同组术语）
      for (const [, groupTerms] of termMap) {
        if (groupTerms.length > 1) {
          // 简单判断：如果术语相似度过高则视为冲突
          for (let i = 0; i < groupTerms.length; i++) {
            for (let j = i + 1; j < groupTerms.length; j++) {
              if (this.isSimilar(groupTerms[i], groupTerms[j])) {
                conflicts.push({
                  termId: `conflict-${i}-${j}`,
                  term: groupTerms[i],
                  conflictingTerms: [{ id: `term-${j}`, expression: groupTerms[j] }],
                  severity: 'warning',
                });
              }
            }
          }
        }
      }
    } catch {
      // 文件不存在
    }

    return {
      projectId,
      totalTerms: 0,
      conflicts,
      checkedAt: new Date().toISOString(),
    };
  }

  // 检查重复内容
  async checkDuplicateContent(projectId: string): Promise<CheckIssue[]> {
    const issues: CheckIssue[] = [];

    try {
      const chaptersDir = path.join(this.runtimeBasePath, projectId, 'chapters');
      const files = await fs.readdir(chaptersDir);

      const chapterContents: { id: string; content: string }[] = [];

      for (const file of files) {
        if (!file.endsWith('.md')) continue;

        const chapterPath = path.join(chaptersDir, file);
        const content = await fs.readFile(chapterPath, 'utf-8');
        const body = this.extractBody(content);

        if (body.length > 100) {
          chapterContents.push({ id: file.replace('.md', ''), content: body });
        }
      }

      // 简单检测：相同或高度相似的内容
      for (let i = 0; i < chapterContents.length; i++) {
        for (let j = i + 1; j < chapterContents.length; j++) {
          const similarity = this.calculateSimilarity(
            chapterContents[i].content,
            chapterContents[j].content
          );

          if (similarity > 0.8) {
            issues.push({
              id: `issue-dup-${i}-${j}`,
              projectId,
              type: IssueType.DUPLICATE_CONTENT,
              severity: IssueSeverity.WARNING,
              title: `章节内容重复：${chapterContents[i].id} 与 ${chapterContents[j].id}`,
              description: `两个章节的内容相似度达到 ${Math.round(similarity * 100)}%`,
              affectedChapters: [chapterContents[i].id, chapterContents[j].id],
              suggestion: '检查是否需要合并或区分内容',
              autoFixable: false,
              status: 'open',
              createdAt: new Date().toISOString(),
            });
          }
        }
      }
    } catch {
      // 目录不存在
    }

    return issues;
  }

  // 检查完成度
  async checkCompletion(projectId: string, threshold: number = 30): Promise<CheckIssue[]> {
    const issues: CheckIssue[] = [];

    try {
      const chaptersDir = path.join(this.runtimeBasePath, projectId, 'chapters');
      const files = await fs.readdir(chaptersDir);

      for (const file of files) {
        if (!file.endsWith('.md')) continue;

        const chapterPath = path.join(chaptersDir, file);
        const content = await fs.readFile(chapterPath, 'utf-8');

        const completion = this.extractCompletion(content);

        if (completion < threshold) {
          issues.push({
            id: `issue-completion-${file}`,
            projectId,
            type: IssueType.COMPLETION_LOW,
            severity: IssueSeverity.WARNING,
            title: `章节完成度过低：${file.replace('.md', '')}`,
            description: `完成度仅 ${completion}%，低于阈值 ${threshold}%`,
            affectedChapters: [file.replace('.md', '')],
            suggestion: '继续完善章节内容',
            autoFixable: false,
            status: 'open',
            createdAt: new Date().toISOString(),
          });
        }
      }
    } catch {
      // 目录不存在
    }

    return issues;
  }

  // 检查大纲偏离
  async checkOutlineDrift(projectId: string): Promise<CheckIssue[]> {
    // 简化实现：暂不检测大纲偏离
    return [];
  }

  // 运行全部检查
  async runFullCheck(projectId: string): Promise<{ issues: CheckIssue[]; checkedAt: string }> {
    const allIssues: CheckIssue[] = [];

    const [missingIssues, duplicateIssues, completionIssues] = await Promise.all([
      this.checkMissingChapters(projectId),
      this.checkDuplicateContent(projectId),
      this.checkCompletion(projectId),
    ]);

    allIssues.push(...missingIssues, ...duplicateIssues, ...completionIssues);

    return {
      issues: allIssues,
      checkedAt: new Date().toISOString(),
    };
  }

  // 自动修复（暂不支持）
  async autoFix(issueId: string): Promise<{ success: boolean; description: string }> {
    return {
      success: false,
      description: '暂不支持自动修复',
    };
  }

  private extractOutlineChapters(content: string): { number: string; title: string }[] {
    const chapters: { number: string; title: string }[] = [];
    const lines = content.split('\n');

    for (const line of lines) {
      const match = line.match(/^-\s*\[.*?\]\s*(\d+)\s+(.+)$/);
      if (match) {
        chapters.push({
          number: match[1].padStart(2, '0'),
          title: match[2].trim(),
        });
      }
    }

    return chapters;
  }

  private extractTerms(content: string): { term: string; definition: string }[] {
    const terms: { term: string; definition: string }[] = [];
    const lines = content.split('\n');

    for (const line of lines) {
      // 匹配 - **术语**: 定义 格式
      const match = line.match(/^- \*\*(.+?)\*\*:?\s*(.*)$/);
      if (match) {
        terms.push({
          term: match[1].trim(),
          definition: match[2].trim(),
        });
      }
    }

    return terms;
  }

  private extractBody(content: string): string {
    const lines = content.split('\n');
    let bodyStart = 0;

    for (let i = 0; i < lines.length; i++) {
      if (lines[i].trim() === '---') {
        // 找到 frontmatter 结束
        bodyStart = i + 1;
        break;
      }
    }

    return lines.slice(bodyStart).join(' ').trim();
  }

  private extractCompletion(content: string): number {
    const match = content.match(/completion:\s*(\d+)/);
    return match ? parseInt(match[1]) : 0;
  }

  private isSimilar(a: string, b: string): boolean {
    // 简单相似度判断
    const shorter = a.length < b.length ? a : b;
    const longer = a.length < b.length ? b : a;

    if (shorter.length < 2) return false;

    let matches = 0;
    for (let i = 0; i < shorter.length - 1; i++) {
      if (longer.includes(shorter.slice(i, i + 2))) {
        matches++;
      }
    }

    return matches / shorter.length > 0.5;
  }

  private calculateSimilarity(a: string, b: string): number {
    if (a === b) return 1;
    if (a.length === 0 || b.length === 0) return 0;

    // 简单实现：最长公共子串
    const dp: number[][] = Array(a.length + 1).fill(null).map(() => Array(b.length + 1).fill(0));

    for (let i = 1; i <= a.length; i++) {
      for (let j = 1; j <= b.length; j++) {
        if (a[i - 1] === b[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1] + 1;
        } else {
          dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
        }
      }
    }

    const lcs = dp[a.length][b.length];
    return (2 * lcs) / (a.length + b.length);
  }
}
