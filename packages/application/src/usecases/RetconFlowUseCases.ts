import {
  MemoryCard,
  NovelReference,
  RetconDecision,
  SnapshotType,
} from '@zide/domain';
import {
  ChapterRepoPort,
  MemoryCardRepoPort,
  RetconDecisionRepoPort,
} from '../ports';
import { SnapshotUseCases } from './SnapshotUseCases';

export interface ProposeRetconParams {
  summary: string;
  reason?: string;
  affectedChapterIds?: string[];
  affectedCharacters?: string[];
}

export class RetconFlowUseCase {
  constructor(
    private readonly retconDecisionRepo: RetconDecisionRepoPort,
    private readonly chapterRepo: ChapterRepoPort,
    private readonly memoryCardRepo: MemoryCardRepoPort,
    private readonly snapshotUseCases: SnapshotUseCases
  ) {}

  async list(projectId: string): Promise<RetconDecision[]> {
    return this.retconDecisionRepo.listByProjectId(projectId);
  }

  async propose(projectId: string, params: ProposeRetconParams): Promise<RetconDecision> {
    const summary = params.summary.trim();
    if (!summary) {
      throw new Error('retcon summary is required');
    }

    const affectedRefs = await this.buildAffectedRefs(projectId, params);
    const now = new Date().toISOString();
    const decision: RetconDecision = {
      retconId: `retcon-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      projectId,
      summary,
      reason: params.reason?.trim() || undefined,
      affectedRefs: affectedRefs.length > 0
        ? affectedRefs
        : [{ kind: 'project', id: projectId, label: '全局设定' }],
      status: 'proposed',
      createdAt: now,
    };

    return this.retconDecisionRepo.save(decision);
  }

  async approve(projectId: string, retconId: string): Promise<{ decision: RetconDecision; snapshotIds: string[] }> {
    const current = await this.retconDecisionRepo.findById(projectId, retconId);
    if (!current) {
      throw new Error(`Retcon decision not found: ${retconId}`);
    }

    const snapshotIds: string[] = [];
    const chapterRefs = current.affectedRefs.filter((ref) => ref.kind === 'chapter');

    if (chapterRefs.length > 0) {
      for (const ref of chapterRefs) {
        const snapshot = await this.snapshotUseCases.createSnapshot(
          projectId,
          SnapshotType.CHAPTER,
          `批准 Retcon 前自动快照 - ${current.summary}`,
          ref.id
        );
        snapshotIds.push(snapshot.id);
      }
    } else {
      const snapshot = await this.snapshotUseCases.createGlobalSnapshot(
        projectId,
        `批准 Retcon 前自动快照 - ${current.summary}`
      );
      snapshotIds.push(snapshot.id);
    }

    const approved: RetconDecision = {
      ...current,
      status: 'approved',
      approvedAt: new Date().toISOString(),
    };
    await this.retconDecisionRepo.save(approved);

    const existingCards = await this.memoryCardRepo.listByProjectId(projectId);
    const nextCards = [
      this.buildRetconMemoryCard(approved),
      ...existingCards.filter((card) => card.memoryId !== this.getRetconMemoryId(retconId)),
    ];
    await this.memoryCardRepo.replaceByProject(projectId, nextCards);

    return {
      decision: approved,
      snapshotIds,
    };
  }

  async rollback(projectId: string, retconId: string): Promise<RetconDecision> {
    const current = await this.retconDecisionRepo.findById(projectId, retconId);
    if (!current) {
      throw new Error(`Retcon decision not found: ${retconId}`);
    }

    const rolledBack: RetconDecision = {
      ...current,
      status: 'rolled_back',
    };
    await this.retconDecisionRepo.save(rolledBack);

    const existingCards = await this.memoryCardRepo.listByProjectId(projectId);
    await this.memoryCardRepo.replaceByProject(
      projectId,
      existingCards.filter((card) => card.memoryId !== this.getRetconMemoryId(retconId))
    );

    return rolledBack;
  }

  private async buildAffectedRefs(projectId: string, params: ProposeRetconParams): Promise<NovelReference[]> {
    const refs: NovelReference[] = [];
    const chapterIds = Array.from(new Set((params.affectedChapterIds || []).filter(Boolean)));

    for (const chapterId of chapterIds) {
      const chapter = await this.chapterRepo.findByChapterId(projectId, chapterId);
      refs.push({
        kind: 'chapter',
        id: chapterId,
        label: chapter ? `${chapter.number} ${chapter.title}` : chapterId,
      });
    }

    for (const name of Array.from(new Set((params.affectedCharacters || []).map((item) => item.trim()).filter(Boolean)))) {
      refs.push({
        kind: 'character',
        id: name,
        label: name,
      });
    }

    return refs;
  }

  private buildRetconMemoryCard(decision: RetconDecision): MemoryCard {
    const now = new Date().toISOString();
    const kind = this.inferMemoryKind(decision);
    const affectedSummary = decision.affectedRefs
      .slice(0, 4)
      .map((ref) => ref.label || ref.id)
      .join('；');

    return {
      memoryId: this.getRetconMemoryId(decision.retconId),
      projectId: decision.projectId,
      kind,
      title: `Retcon · ${decision.summary.slice(0, 24)}`,
      summary: [decision.summary, decision.reason, affectedSummary].filter(Boolean).join('；'),
      confidence: 0.96,
      confirmed: true,
      sourceRefs: [
        {
          kind: 'retcon_decision',
          id: decision.retconId,
          label: decision.summary,
        },
        ...decision.affectedRefs.slice(0, 4),
      ],
      createdAt: now,
      updatedAt: now,
    };
  }

  private getRetconMemoryId(retconId: string): string {
    return `memory-retcon-${retconId}`;
  }

  private inferMemoryKind(decision: RetconDecision): MemoryCard['kind'] {
    if (decision.affectedRefs.some((ref) => ref.kind === 'character')) {
      return 'character';
    }

    if (/(设定|规则|世界|法则)/.test(decision.summary)) {
      return 'world_rule';
    }

    if (/(时间|时序|黎明|清晨|午后|深夜|次日)/.test(decision.summary)) {
      return 'timeline';
    }

    return 'plot_decision';
  }
}
