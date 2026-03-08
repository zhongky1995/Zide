import { ChapterGoal, MemoryCard, StoryBible } from '@zide/domain';
import {
  ChapterGoalRepoPort,
  ChapterRepoPort,
  MemoryCardRepoPort,
  StoryBibleRepoPort,
} from '../ports';

export class LoreMemoryUseCase {
  constructor(
    private readonly memoryCardRepo: MemoryCardRepoPort,
    private readonly storyBibleRepo: StoryBibleRepoPort,
    private readonly chapterGoalRepo: ChapterGoalRepoPort,
    private readonly chapterRepo: ChapterRepoPort
  ) {}

  async get(projectId: string): Promise<MemoryCard[]> {
    return this.memoryCardRepo.listByProjectId(projectId);
  }

  async sync(projectId: string): Promise<MemoryCard[]> {
    const [storyBible, chapterGoals, chapters, existingCards] = await Promise.all([
      this.storyBibleRepo.findByProjectId(projectId),
      this.chapterGoalRepo.listByProjectId(projectId),
      this.chapterRepo.findByProjectId(projectId),
      this.memoryCardRepo.listByProjectId(projectId),
    ]);

    const cards: MemoryCard[] = [];
    const now = new Date().toISOString();

    if (storyBible?.status === 'confirmed') {
      cards.push(...this.buildStoryBibleCards(projectId, storyBible, now));
    }

    for (const goal of chapterGoals) {
      const chapter = chapters.find((item) => item.id === goal.chapterId);
      if (!chapter || chapter.status !== 'completed') {
        continue;
      }

      cards.push({
        memoryId: `memory-plot-${goal.chapterId}`,
        projectId,
        kind: 'plot_decision',
        title: `${chapter.number} ${goal.title}`,
        summary: [goal.objective, goal.conflict, goal.payoff].filter(Boolean).join('；'),
        confidence: 0.78,
        confirmed: true,
        sourceRefs: [
          {
            kind: 'chapter',
            id: goal.chapterId,
            label: goal.title,
          },
        ],
        createdAt: now,
        updatedAt: now,
      });
    }

    const preservedRetconCards = existingCards.filter((card) =>
      card.sourceRefs.some((ref) => ref.kind === 'retcon_decision')
    );

    return this.memoryCardRepo.replaceByProject(
      projectId,
      this.deduplicateCards([...preservedRetconCards, ...cards])
    );
  }

  private buildStoryBibleCards(projectId: string, storyBible: StoryBible, now: string): MemoryCard[] {
    const cards: MemoryCard[] = [];

    const pushCard = (memoryId: string, kind: MemoryCard['kind'], title: string, summary?: string, confidence = 0.92) => {
      if (!summary || !summary.trim()) return;
      cards.push({
        memoryId,
        projectId,
        kind,
        title,
        summary: summary.trim(),
        confidence,
        confirmed: true,
        sourceRefs: [
          {
            kind: 'story_bible',
            id: storyBible.storyBibleId,
            label: title,
          },
        ],
        createdAt: now,
        updatedAt: now,
      });
    };

    pushCard('memory-premise', 'plot_decision', '故事前提', storyBible.premise);
    pushCard('memory-conflict', 'plot_decision', '主冲突', storyBible.conflictCore);
    pushCard('memory-tone', 'tone', '叙事语气', storyBible.toneGuide, 0.95);
    pushCard('memory-promise', 'plot_decision', '叙事承诺', storyBible.narrativePromise);

    const worldRules = Array.from((storyBible.settingSummary || '').matchAll(/(?:必须|不能|不得|禁止)[^。；;\n]{1,30}/g))
      .map((match) => match[0].trim())
      .slice(0, 6);

    if (worldRules.length > 0) {
      worldRules.forEach((rule, index) => {
        pushCard(`memory-world-rule-${index}`, 'world_rule', `世界规则 ${index + 1}`, rule, 0.9);
      });
    } else {
      pushCard('memory-world-summary', 'world_rule', '世界观摘要', storyBible.settingSummary, 0.85);
    }

    return cards;
  }

  private deduplicateCards(cards: MemoryCard[]): MemoryCard[] {
    const cardMap = new Map<string, MemoryCard>();
    for (const card of cards) {
      if (!cardMap.has(card.memoryId)) {
        cardMap.set(card.memoryId, card);
      }
    }
    return Array.from(cardMap.values());
  }
}
