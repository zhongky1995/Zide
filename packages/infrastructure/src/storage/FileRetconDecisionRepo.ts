import { RetconDecision } from '@zide/domain';
import { RetconDecisionRepoPort } from '@zide/application';
import * as fs from 'fs/promises';
import * as path from 'path';

export class FileRetconDecisionRepo implements RetconDecisionRepoPort {
  constructor(private readonly runtimeBasePath: string) {}

  private getRetconPath(projectId: string): string {
    return path.join(this.runtimeBasePath, projectId, 'meta', 'retcon-decisions.json');
  }

  async findById(projectId: string, retconId: string): Promise<RetconDecision | null> {
    const decisions = await this.listByProjectId(projectId);
    return decisions.find((item) => item.retconId === retconId) || null;
  }

  async listByProjectId(projectId: string): Promise<RetconDecision[]> {
    try {
      const content = await fs.readFile(this.getRetconPath(projectId), 'utf-8');
      const parsed = JSON.parse(content);
      if (!Array.isArray(parsed)) {
        return [];
      }

      return (parsed as RetconDecision[]).sort((a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    } catch {
      return [];
    }
  }

  async save(decision: RetconDecision): Promise<RetconDecision> {
    const targetPath = this.getRetconPath(decision.projectId);
    const decisions = await this.listByProjectId(decision.projectId);
    const next = [
      decision,
      ...decisions.filter((item) => item.retconId !== decision.retconId),
    ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    await fs.mkdir(path.dirname(targetPath), { recursive: true });
    await fs.writeFile(targetPath, JSON.stringify(next, null, 2), 'utf-8');
    return decision;
  }
}
