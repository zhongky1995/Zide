import { ManuscriptBlocker, ManuscriptReadiness } from '@zide/domain';
import { ChapterRepoPort, ContinuityReportRepoPort, StoryBibleRepoPort } from '../ports';

export class ManuscriptUseCase {
  constructor(
    private readonly chapterRepo: ChapterRepoPort,
    private readonly continuityReportRepo: ContinuityReportRepoPort,
    private readonly storyBibleRepo: StoryBibleRepoPort
  ) {}

  async getReadiness(projectId: string): Promise<ManuscriptReadiness> {
    const [chapters, storyBible] = await Promise.all([
      this.chapterRepo.findByProjectId(projectId),
      this.storyBibleRepo.findByProjectId(projectId),
    ]);

    const chapterReports = await Promise.all(
      chapters.map((chapter) => this.continuityReportRepo.listByChapter(projectId, chapter.id))
    );
    const reports = chapterReports.flat();

    const completedChapterCount = chapters.filter((chapter) => chapter.status === 'completed').length;
    const blockers: ManuscriptBlocker[] = [];

    if (!storyBible || storyBible.status !== 'confirmed') {
      blockers.push({
        blockerId: 'story-bible-unconfirmed',
        message: 'Story Bible 尚未确认，长期设定仍不稳定。',
      });
    }

    for (const chapter of chapters) {
      if (chapter.status !== 'completed') {
        blockers.push({
          blockerId: `chapter-${chapter.id}-incomplete`,
          chapterId: chapter.id,
          message: `${chapter.number} ${chapter.title} 仍未完成，暂不适合进入成稿收束。`,
        });
      }
    }

    for (const report of reports.filter((item) => !item.passed)) {
      const blockingIssue = report.issues.find((issue) => issue.severity === 'error') || report.issues[0];
      blockers.push({
        blockerId: `continuity-${report.draftId}`,
        message: `候选稿 ${report.draftId} 未通过连续性检查。`,
        relatedIssue: blockingIssue,
      });
    }

    const completionRatio = chapters.length > 0 ? completedChapterCount / chapters.length : 0;
    const score = Math.max(
      0,
      Math.round(
        completionRatio * 60
        + (storyBible?.status === 'confirmed' ? 15 : 0)
        + (reports.length > 0 ? Math.max(0, 25 - reports.filter((item) => !item.passed).length * 10) : 10)
      )
    );

    return {
      projectId,
      readinessScore: score,
      completedChapterCount,
      blockingIssueCount: blockers.length,
      blockers,
      lastEvaluatedAt: new Date().toISOString(),
    };
  }
}
