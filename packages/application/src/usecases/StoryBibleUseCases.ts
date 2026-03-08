import { StoryBible } from '@zide/domain';
import { LLMPort, ProjectRepoPort, StoryBibleRepoPort } from '../ports';

interface StoryBibleDraft {
  premise: string;
  theme?: string;
  settingSummary?: string;
  conflictCore?: string;
  toneGuide?: string;
  narrativePromise?: string;
}

export class StoryBibleUseCase {
  constructor(
    private readonly storyBibleRepo: StoryBibleRepoPort,
    private readonly projectRepo: ProjectRepoPort,
    private readonly llmPort?: LLMPort
  ) {}

  async get(projectId: string): Promise<StoryBible | null> {
    const existing = await this.storyBibleRepo.findByProjectId(projectId);
    if (existing) {
      return existing;
    }

    return this.bootstrap(projectId);
  }

  async bootstrap(projectId: string, seed?: string): Promise<StoryBible> {
    const project = await this.projectRepo.findById(projectId);
    if (!project) {
      throw new Error(`Project not found: ${projectId}`);
    }

    const now = new Date().toISOString();
    const storyBible: StoryBible = {
      storyBibleId: `story-bible-${projectId}`,
      projectId,
      premise: seed?.trim() || project.description || `${project.name} 的故事核心尚待补充。`,
      theme: project.meta?.objectives || '',
      settingSummary: project.meta?.background || '',
      conflictCore: project.meta?.constraints || '',
      toneGuide: project.meta?.styleGuide || '',
      narrativePromise: project.targetReaders || '',
      status: 'draft',
      version: 1,
      createdAt: now,
      updatedAt: now,
    };

    return this.storyBibleRepo.save(storyBible);
  }

  async generate(projectId: string, seed?: string): Promise<StoryBible> {
    const project = await this.projectRepo.findById(projectId);
    if (!project) {
      throw new Error(`Project not found: ${projectId}`);
    }

    const existing = await this.storyBibleRepo.findByProjectId(projectId);
    const base = existing || await this.bootstrap(projectId, seed);

    if (!this.llmPort) {
      return base;
    }

    const prompt = this.buildPrompt(project, seed, base);
    const result = await this.llmPort.generate({
      context: {
        projectContext: [
          project.description || '',
          project.meta?.background || '',
          project.meta?.objectives || '',
          project.meta?.constraints || '',
          project.meta?.styleGuide || '',
        ].filter(Boolean).join('\n\n'),
        relatedChapters: [],
        glossary: '',
        outline: await this.projectRepo.getOutline(projectId),
      },
      chapter: {
        id: 'story-bible-generation',
        title: 'Story Bible 生成',
        content: prompt,
        target: '',
      },
      intent: 'polish' as any,
    });

    const draft = this.parseDraft(result.content, base);
    const now = new Date().toISOString();
    const storyBible: StoryBible = {
      ...base,
      ...draft,
      status: 'draft',
      version: base.version + 1,
      updatedAt: now,
    };

    return this.storyBibleRepo.save(storyBible);
  }

  async update(projectId: string, updates: Partial<StoryBibleDraft>): Promise<StoryBible> {
    const existing = await this.get(projectId);
    if (!existing) {
      throw new Error(`StoryBible not found: ${projectId}`);
    }

    const storyBible: StoryBible = {
      ...existing,
      ...updates,
      version: existing.version + 1,
      updatedAt: new Date().toISOString(),
    };

    return this.storyBibleRepo.save(storyBible);
  }

  async confirm(projectId: string): Promise<StoryBible> {
    const existing = await this.get(projectId);
    if (!existing) {
      throw new Error(`StoryBible not found: ${projectId}`);
    }

    return this.storyBibleRepo.save({
      ...existing,
      status: 'confirmed',
      version: existing.version + 1,
      updatedAt: new Date().toISOString(),
    });
  }

  private buildPrompt(project: any, seed: string | undefined, base: StoryBible): string {
    return `你是一位长篇小说策划编辑，请根据以下信息生成一份 Story Bible 草案。

项目名称：${project.name}
故事种子：${seed || project.description || base.premise}
目标读者：${project.targetReaders || '未指定'}
预计规模：${project.targetScale || '未指定'}
已有背景：${project.meta?.background || ''}
已有目标：${project.meta?.objectives || ''}
已有限制：${project.meta?.constraints || ''}
已有风格：${project.meta?.styleGuide || ''}

请输出 JSON：
{
  "premise": "一句话说明故事最核心的前提",
  "theme": "故事主题",
  "settingSummary": "世界观与背景摘要",
  "conflictCore": "主冲突",
  "toneGuide": "文风与叙事语气",
  "narrativePromise": "这部小说会持续兑现给读者的阅读承诺"
}

只输出 JSON，不要解释。所有字段都必须可直接使用，禁止占位符。`;
  }

  private parseDraft(content: string, fallback: StoryBible): StoryBibleDraft {
    const match = content.match(/\{[\s\S]*\}/);
    if (!match) {
      return fallback;
    }

    try {
      const parsed = JSON.parse(match[0]) as Record<string, unknown>;
      return {
        premise: this.normalizeText(parsed.premise) || fallback.premise,
        theme: this.normalizeText(parsed.theme) || fallback.theme,
        settingSummary: this.normalizeText(parsed.settingSummary) || fallback.settingSummary,
        conflictCore: this.normalizeText(parsed.conflictCore) || fallback.conflictCore,
        toneGuide: this.normalizeText(parsed.toneGuide) || fallback.toneGuide,
        narrativePromise: this.normalizeText(parsed.narrativePromise) || fallback.narrativePromise,
      };
    } catch {
      return fallback;
    }
  }

  private normalizeText(value: unknown): string {
    return typeof value === 'string' ? value.trim() : '';
  }
}
