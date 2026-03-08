import { ContinuityReport } from '@zide/domain';
import { ContinuityReportRepoPort } from '@zide/application';
import * as fs from 'fs/promises';
import * as path from 'path';

export class FileContinuityReportRepo implements ContinuityReportRepoPort {
  constructor(private readonly runtimeBasePath: string) {}

  private getReportDir(projectId: string, chapterId: string): string {
    return path.join(this.runtimeBasePath, projectId, 'chapters', chapterId, 'continuity-reports');
  }

  private getReportPath(projectId: string, chapterId: string, draftId: string): string {
    return path.join(this.getReportDir(projectId, chapterId), `${draftId}.json`);
  }

  async findByDraftId(projectId: string, chapterId: string, draftId: string): Promise<ContinuityReport | null> {
    try {
      const content = await fs.readFile(this.getReportPath(projectId, chapterId, draftId), 'utf-8');
      return JSON.parse(content) as ContinuityReport;
    } catch {
      return null;
    }
  }

  async listByChapter(projectId: string, chapterId: string): Promise<ContinuityReport[]> {
    try {
      const reportDir = this.getReportDir(projectId, chapterId);
      const files = await fs.readdir(reportDir);
      const reports: ContinuityReport[] = [];

      for (const file of files) {
        if (!file.endsWith('.json')) continue;
        const content = await fs.readFile(path.join(reportDir, file), 'utf-8');
        reports.push(JSON.parse(content) as ContinuityReport);
      }

      return reports.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } catch {
      return [];
    }
  }

  async save(projectId: string, chapterId: string, report: ContinuityReport): Promise<ContinuityReport> {
    const targetDir = this.getReportDir(projectId, chapterId);
    await fs.mkdir(targetDir, { recursive: true });
    await fs.writeFile(this.getReportPath(projectId, chapterId, report.draftId), JSON.stringify(report, null, 2), 'utf-8');
    return report;
  }
}
