import {
  CandidateDraft,
  ChapterGoal,
  ContinuityIssue,
  ContinuityIssueSeverity,
  ContinuityIssueType,
  ContinuityReport,
  StoryBible,
} from '@zide/domain';
import {
  CandidateDraftRepoPort,
  ChapterGoalRepoPort,
  ChapterRepoPort,
  ContinuityReportRepoPort,
  StoryBibleRepoPort,
} from '../ports';

export class ContinuityReviewUseCase {
  constructor(
    private readonly continuityReportRepo: ContinuityReportRepoPort,
    private readonly candidateDraftRepo: CandidateDraftRepoPort,
    private readonly chapterGoalRepo: ChapterGoalRepoPort,
    private readonly storyBibleRepo: StoryBibleRepoPort,
    private readonly chapterRepo: ChapterRepoPort
  ) {}

  async getOrGenerate(projectId: string, chapterId: string, draftId: string): Promise<ContinuityReport> {
    const existing = await this.continuityReportRepo.findByDraftId(projectId, chapterId, draftId);
    if (existing) {
      return existing;
    }

    return this.generate(projectId, chapterId, draftId);
  }

  async listByChapter(projectId: string, chapterId: string): Promise<ContinuityReport[]> {
    return this.continuityReportRepo.listByChapter(projectId, chapterId);
  }

  async generate(projectId: string, chapterId: string, draftId: string): Promise<ContinuityReport> {
    const [draft, chapterGoal, storyBible, chapter] = await Promise.all([
      this.candidateDraftRepo.findById(projectId, chapterId, draftId),
      this.chapterGoalRepo.findByChapterId(projectId, chapterId),
      this.storyBibleRepo.findByProjectId(projectId),
      this.chapterRepo.findByChapterId(projectId, chapterId),
    ]);

    if (!draft) {
      throw new Error(`Candidate draft not found: ${draftId}`);
    }

    const issues = this.evaluateDraft(draft, chapterGoal, storyBible, chapter?.content || '');
    const score = this.calculateScore(issues);
    const report: ContinuityReport = {
      reportId: `continuity-${draftId}`,
      projectId,
      draftId,
      score,
      passed: !issues.some((issue) => issue.severity === 'error') && score >= 70,
      issues,
      revisionAdvice: this.buildRevisionAdvice(issues, chapterGoal, storyBible),
      createdAt: new Date().toISOString(),
    };

    return this.continuityReportRepo.save(projectId, chapterId, report);
  }

  private evaluateDraft(
    draft: CandidateDraft,
    chapterGoal: ChapterGoal | null,
    storyBible: StoryBible | null,
    originalContent: string
  ): ContinuityIssue[] {
    const issues: ContinuityIssue[] = [];
    const content = draft.content.trim();

    if (content.length < 250) {
      issues.push(this.createIssue(
        'plot_gap',
        'warning',
        '候选稿篇幅偏短，可能不足以支撑一个完整场景推进。',
        '建议补充动作、冲突推进或人物反应，让本章变化更明确。',
        draft.chapterId
      ));
    }

    if (originalContent.trim() && this.normalizeText(originalContent) === this.normalizeText(content)) {
      issues.push(this.createIssue(
        'plot_gap',
        'warning',
        '候选稿与当前正文几乎一致，没有体现出有效推进。',
        '建议重写任务说明，明确本次需要新增的剧情推进或改写目标。',
        draft.chapterId
      ));
    }

    if (chapterGoal) {
      if (chapterGoal.objective && !this.containsSignal(content, chapterGoal.objective)) {
        issues.push(this.createIssue(
          'plot_gap',
          'error',
          '候选稿没有明显覆盖本章目标，可能会导致剧情偏离 Plot Board。',
          `请围绕章节目标“${chapterGoal.objective}”重写或补足场景推进。`,
          draft.chapterId
        ));
      }

      if (chapterGoal.conflict && !this.containsSignal(content, chapterGoal.conflict)) {
        issues.push(this.createIssue(
          'plot_gap',
          'warning',
          '候选稿没有明显体现本章设定的关键冲突。',
          `建议让冲突“${chapterGoal.conflict}”在场景中真正发生，而不是只做背景说明。`,
          draft.chapterId
        ));
      }

      if (chapterGoal.emotionalShift && !this.containsSignal(content, chapterGoal.emotionalShift)) {
        issues.push(this.createIssue(
          'character_ooc',
          'warning',
          '候选稿没有明显体现 Plot Board 预设的情绪变化，人物反应可能偏离原定弧线。',
          `建议围绕情绪变化“${chapterGoal.emotionalShift}”补出人物决策、肢体反应或语气变化。`,
          draft.chapterId
        ));
      }

      if (chapterGoal.payoff && !this.containsSignal(content, chapterGoal.payoff)) {
        issues.push(this.createIssue(
          'foreshadow_gap',
          'info',
          '候选稿暂未体现本章预期回报或伏笔兑现。',
          `如本章应交付“${chapterGoal.payoff}”，建议补出明确结果。`,
          draft.chapterId
        ));
      }
    }

    if (storyBible) {
      if (storyBible.conflictCore && !this.containsSignal(content, storyBible.conflictCore)) {
        issues.push(this.createIssue(
          'plot_gap',
          'info',
          '候选稿与 Story Bible 的主冲突连接较弱。',
          `建议让场景更直接服务于主冲突“${storyBible.conflictCore}”。`,
          draft.chapterId
        ));
      }

      if (this.hasForbiddenWorldRule(storyBible.settingSummary || '', content)) {
        issues.push(this.createIssue(
          'world_rule_conflict',
          'error',
          '候选稿可能触碰了 Story Bible 中已有的世界规则限制。',
          '请检查世界规则描述中的“不能/不得/禁止”条目，并修正冲突内容。',
          draft.chapterId
        ));
      }

      const toneIssue = this.detectToneDrift(storyBible.toneGuide || '', content, draft.chapterId);
      if (toneIssue) {
        issues.push(toneIssue);
      }
    }

    const timelineIssue = this.detectTimelineConflict(content, draft.chapterId);
    if (timelineIssue) {
      issues.push(timelineIssue);
    }

    return issues;
  }

  private calculateScore(issues: ContinuityIssue[]): number {
    let score = 100;
    for (const issue of issues) {
      if (issue.severity === 'error') score -= 30;
      else if (issue.severity === 'warning') score -= 15;
      else score -= 6;
    }
    return Math.max(0, score);
  }

  private buildRevisionAdvice(
    issues: ContinuityIssue[],
    chapterGoal: ChapterGoal | null,
    storyBible: StoryBible | null
  ): string {
    if (issues.length === 0) {
      return '当前候选稿没有发现明显连续性问题，可以进入采纳评估。';
    }

    const topIssues = issues.slice(0, 3).map((issue) => issue.message).join('；');
    const anchors = [
      chapterGoal?.objective ? `章节目标：${chapterGoal.objective}` : '',
      chapterGoal?.conflict ? `关键冲突：${chapterGoal.conflict}` : '',
      storyBible?.conflictCore ? `主冲突：${storyBible.conflictCore}` : '',
    ].filter(Boolean).join('；');

    return [topIssues, anchors].filter(Boolean).join('。');
  }

  private createIssue(
    type: ContinuityIssueType,
    severity: ContinuityIssueSeverity,
    message: string,
    suggestion: string,
    chapterId: string
  ): ContinuityIssue {
    return {
      issueId: `issue-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type,
      severity,
      message,
      suggestion,
      sourceRefs: [
        {
          kind: 'chapter',
          id: chapterId,
        },
      ],
    };
  }

  private containsSignal(content: string, reference: string): boolean {
    const normalizedContent = this.normalizeText(content);
    return this.extractSignals(reference).some((signal) => normalizedContent.includes(signal));
  }

  private extractSignals(reference: string): string[] {
    const phrases = reference
      .split(/[\n,，。！!？?；;、]/)
      .map((item) => item.trim())
      .filter((item) => item.length >= 2);

    return Array.from(new Set(phrases.slice(0, 6).map((item) => this.normalizeText(item))));
  }

  private hasForbiddenWorldRule(settingSummary: string, content: string): boolean {
    if (!settingSummary.trim()) return false;

    const rules = Array.from(settingSummary.matchAll(/(?:不能|不得|禁止)(.{1,12})/g))
      .map((match) => this.normalizeText(match[1]))
      .filter((item) => item.length >= 2);

    if (rules.length === 0) return false;

    const normalizedContent = this.normalizeText(content);
    return rules.some((rule) => normalizedContent.includes(rule));
  }

  private detectToneDrift(toneGuide: string, content: string, chapterId: string): ContinuityIssue | null {
    const normalizedTone = this.normalizeText(toneGuide);
    const normalizedContent = this.normalizeText(content);

    if (!normalizedTone) return null;

    const excessiveMarks = (content.match(/[!?！？]/g) || []).length;
    const containsSlang = /(哈哈|卧槽|牛逼|妈呀)/.test(content);

    if ((normalizedTone.includes('克制') || normalizedTone.includes('冷峻') || normalizedTone.includes('压抑')) && (excessiveMarks >= 6 || containsSlang)) {
      return this.createIssue(
        'tone_drift',
        'warning',
        '候选稿的语气表现偏跳脱，和 Story Bible 中设定的叙事语气不一致。',
        '建议收敛感叹、口语化表达和夸张反应，让文风回到既定叙事语气。',
        chapterId
      );
    }

    if ((normalizedTone.includes('轻松') || normalizedTone.includes('幽默')) && /(尸体|残肢|血泊|窒息)/.test(normalizedContent)) {
      return this.createIssue(
        'tone_drift',
        'warning',
        '候选稿的画面强度偏重，和 Story Bible 当前设定的轻松语气不一致。',
        '建议降低血腥或压迫感描写，保持整体阅读感受一致。',
        chapterId
      );
    }

    return null;
  }

  private detectTimelineConflict(content: string, chapterId: string): ContinuityIssue | null {
    const normalizedContent = this.normalizeText(content);
    const timelineBuckets = [
      { label: '黎明/清晨', patterns: ['凌晨', '拂晓', '黎明', '清晨', '天刚亮'] },
      { label: '白天', patterns: ['上午', '中午', '午后', '下午', '日落前'] },
      { label: '夜晚', patterns: ['傍晚', '夜里', '深夜', '午夜', '子夜'] },
    ];

    const hits = timelineBuckets.filter((bucket) => bucket.patterns.some((pattern) => normalizedContent.includes(pattern)));
    const hasTransition = /(次日|翌日|第二天|数小时后|几小时后|直到|后来|入夜后|天亮后)/.test(normalizedContent);

    if (hits.length >= 3 && !hasTransition) {
      return this.createIssue(
        'timeline_conflict',
        'warning',
        '候选稿出现了多个时间段信号，但缺少清晰的时间推进说明，读者可能无法判断事件顺序。',
        '建议补出明确的时间跳转语句，或收敛为同一时间窗口内的连续场景。',
        chapterId
      );
    }

    if (
      hits.length >= 2
      && normalizedContent.includes('同时')
      && /(次日|翌日|第二天|午夜|黎明)/.test(normalizedContent)
    ) {
      return this.createIssue(
        'timeline_conflict',
        'warning',
        '候选稿同时使用了“同时”与明显跨时段信号，时间线表达可能自相矛盾。',
        '建议拆开并重写时间描述，避免把并发动作和跨时段跳转混在同一段里。',
        chapterId
      );
    }

    return null;
  }

  private normalizeText(value: string): string {
    return value.replace(/\s+/g, '').trim();
  }
}
