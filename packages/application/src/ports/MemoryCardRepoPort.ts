import { MemoryCard } from '@zide/domain';

export interface MemoryCardRepoPort {
  listByProjectId(projectId: string): Promise<MemoryCard[]>;
  replaceByProject(projectId: string, cards: MemoryCard[]): Promise<MemoryCard[]>;
}
