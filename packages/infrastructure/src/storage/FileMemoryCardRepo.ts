import { MemoryCard } from '@zide/domain';
import { MemoryCardRepoPort } from '@zide/application';
import * as fs from 'fs/promises';
import * as path from 'path';

export class FileMemoryCardRepo implements MemoryCardRepoPort {
  constructor(private readonly runtimeBasePath: string) {}

  private getMemoryPath(projectId: string): string {
    return path.join(this.runtimeBasePath, projectId, 'memory', 'memory-cards.json');
  }

  async listByProjectId(projectId: string): Promise<MemoryCard[]> {
    try {
      const content = await fs.readFile(this.getMemoryPath(projectId), 'utf-8');
      const parsed = JSON.parse(content);
      return Array.isArray(parsed) ? parsed as MemoryCard[] : [];
    } catch {
      return [];
    }
  }

  async replaceByProject(projectId: string, cards: MemoryCard[]): Promise<MemoryCard[]> {
    const targetPath = this.getMemoryPath(projectId);
    await fs.mkdir(path.dirname(targetPath), { recursive: true });
    await fs.writeFile(targetPath, JSON.stringify(cards, null, 2), 'utf-8');
    return cards;
  }
}
