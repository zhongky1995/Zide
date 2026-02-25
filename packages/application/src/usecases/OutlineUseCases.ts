import {
  Outline,
  OutlineChapter,
  OutlineChange,
  OutlineTemplate,
  GenerateOutlineParams,
  UpdateOutlineParams,
  ProjectNotFoundError,
  OutlineNotFoundError,
} from '@zide/domain';
import { OutlineRepoPort, ProjectRepoPort, LLMPort } from '../ports';

interface OutlinePlanItem {
  title: string;
  target?: string;
}

// 大纲模板预定义结构
const TEMPLATES: Record<OutlineTemplate, string[]> = {
  [OutlineTemplate.STANDARD]: [
    '项目背景',
    '问题分析',
    '解决方案',
    '实施计划',
    '总结与展望',
  ],
  [OutlineTemplate.RESEARCH]: [
    '摘要',
    '引言',
    '研究方法',
    '研究结果',
    '讨论与分析',
    '结论',
  ],
  [OutlineTemplate.NOVEL]: [
    '楔子',
    '第一章：起因',
    '第二章：冲突',
    '第三章：高潮',
    '第四章：结局',
    '尾声',
  ],
  [OutlineTemplate.CUSTOM]: [],
};

// 生成大纲用例
export class GenerateOutlineUseCase {
  constructor(
    private readonly outlineRepo: OutlineRepoPort,
    private readonly projectRepo: ProjectRepoPort,
    private readonly llmPort?: LLMPort
  ) {}

  async execute(params: GenerateOutlineParams): Promise<Outline> {
    const { projectId, template, chapterCount, customChapters } = params;

    // 获取项目信息
    const project = await this.projectRepo.findById(projectId);
    if (!project) {
      throw new ProjectNotFoundError(projectId);
    }

    // 确定章节列表
    let chapterPlans: OutlinePlanItem[];

    // 优先使用AI生成（如果有LLM适配器）
    if (this.llmPort) {
      chapterPlans = await this.generateWithAI(project, chapterCount);
    } else if (customChapters && customChapters.length > 0) {
      chapterPlans = customChapters.map((title) => ({
        title,
        target: this.buildDefaultTarget(title),
      }));
    } else {
      chapterPlans = this.getTemplateChapters(template, chapterCount).map((title) => ({
        title,
        target: this.buildDefaultTarget(title),
      }));
    }

    // 生成大纲章节
    const chapters: OutlineChapter[] = chapterPlans.map((plan, index) => {
      const number = String(index + 1).padStart(2, '0');
      return {
        id: number,
        number,
        title: plan.title,
        target: plan.target,
        status: 'pending',
      };
    });

    // 创建大纲
    const outline: Outline = {
      projectId,
      chapters,
      status: 'draft',
      version: 1,
      generatedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await this.outlineRepo.save(outline);

    // 更新项目大纲状态
    await this.projectRepo.updateOutlineStatus(projectId, 'draft');

    return outline;
  }

  // 使用AI生成大纲
  private async generateWithAI(project: any, chapterCount?: number): Promise<OutlinePlanItem[]> {
    // 构建上下文提示
    const contextParts: string[] = [];
    if (project.meta?.background) {
      contextParts.push(`项目背景：${project.meta.background}`);
    }
    if (project.meta?.objectives) {
      contextParts.push(`项目目标：${project.meta.objectives}`);
    }
    if (project.meta?.constraints) {
      contextParts.push(`约束条件：${project.meta.constraints}`);
    }
    if (project.meta?.styleGuide) {
      contextParts.push(`风格指南：${project.meta.styleGuide}`);
    }

    const desiredCountHint = chapterCount && chapterCount > 0
      ? `用户倾向章节数：${chapterCount}（仅作参考，不是硬约束）`
      : '章节数：请根据内容复杂度自主判断，不需要固定数量';

    const prompt = `你是一位专业的写作顾问。请为以下写作项目生成一个清晰、合理的大纲。

${contextParts.join('\n')}

项目名称：${project.name}
项目类型：${project.type}
目标读者：${project.targetReaders || '未指定'}
目标规模：${project.targetScale || '未指定'}
${desiredCountHint}

请先判断合理的章节数量，再生成章节标题和章节梗概。每个章节应该：
1. 有清晰的主题
2. 逻辑上符合写作项目的推进顺序
3. 体现项目背景和目标
4. 标题具体可读，禁止使用“第3章”“章节4”这类空泛标题
5. 梗概说明本章要完成的核心任务，1-2句即可

请用 JSON 数组输出，不要其他内容。每一项格式：
{
  "title": "章节标题",
  "target": "本章梗概"
}
示例：
[
  {"title":"项目背景与问题定义","target":"交代背景、现状与核心问题，明确写作范围。"},
  {"title":"关键矛盾与需求拆解","target":"拆解目标与约束，形成可执行的需求结构。"}
]`;

    const result = await this.llmPort!.generate({
      context: {
        projectContext: contextParts.join('\n'),
        relatedChapters: [],
        glossary: '',
        outline: '',
      },
      chapter: {
        id: 'outline-generation',
        title: '大纲生成',
        content: prompt,
        target: '',
      },
      intent: 'polish' as any,
    });

    // 解析AI返回的章节列表（支持对象数组和字符串数组，兼容旧模型输出）
    const jsonMatch = result.content.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        if (!Array.isArray(parsed) || parsed.length === 0) {
          throw new Error('AI 返回空章节列表');
        }

        if (parsed.length > 30) {
          throw new Error('AI 返回章节数量异常，请重试');
        }

        const plans = this.normalizeOutlinePlans(parsed);
        if (plans.length === 0) {
          throw new Error('AI 返回空章节列表');
        }

        const genericCount = plans.filter((item) => /^(第?\d+章|章节\s*\d+)$/i.test(item.title)).length;
        if (genericCount > 0) {
          throw new Error('AI 返回了过于泛化的章节标题，请完善项目设定后重试');
        }

        return plans;
      } catch (e) {
        throw new Error(`AI 大纲解析失败: ${(e as Error).message}`);
      }
    }

    throw new Error('AI 未返回可解析的大纲 JSON');
  }

  // 获取模板章节
  private getTemplateChapters(template?: OutlineTemplate, chapterCount?: number): string[] {
    const templateKey = (template && TEMPLATES[template]) ? template : OutlineTemplate.STANDARD;
    let chapters = [...(TEMPLATES[templateKey] || TEMPLATES[OutlineTemplate.STANDARD])];
    const requestedCount = chapterCount && chapterCount > 0 ? chapterCount : chapters.length;

    if (requestedCount < chapters.length) {
      return chapters.slice(0, requestedCount);
    }

    return chapters;
  }

  // 将模型返回结果统一为「标题 + 梗概」结构
  private normalizeOutlinePlans(rawItems: unknown[]): OutlinePlanItem[] {
    const plans: OutlinePlanItem[] = [];

    for (const item of rawItems) {
      if (typeof item === 'string') {
        const title = this.normalizeText(item);
        if (!title) continue;
        plans.push({
          title,
          target: this.buildDefaultTarget(title),
        });
        continue;
      }

      if (!item || typeof item !== 'object') continue;
      const rawTitle = (item as { title?: unknown }).title;
      const rawTarget = (item as { target?: unknown; summary?: unknown; synopsis?: unknown }).target
        ?? (item as { summary?: unknown }).summary
        ?? (item as { synopsis?: unknown }).synopsis;

      const title = this.normalizeText(rawTitle);
      if (!title) continue;
      const target = this.normalizeText(rawTarget) || this.buildDefaultTarget(title);

      plans.push({
        title,
        target,
      });
    }

    return plans;
  }

  private normalizeText(value: unknown): string {
    return typeof value === 'string' ? value.trim() : '';
  }

  // 默认章节梗概兜底，避免出现“仅有标题无本节目标”的空洞结构
  private buildDefaultTarget(title: string): string {
    return `围绕「${title}」展开本章核心内容，确保与全局目标一致并承接上下文。`;
  }
}

// 更新大纲用例
export class UpdateOutlineUseCase {
  constructor(private readonly outlineRepo: OutlineRepoPort) {}

  async execute(projectId: string, params: UpdateOutlineParams): Promise<Outline> {
    return this.outlineRepo.update(projectId, params);
  }

  async confirm(projectId: string): Promise<Outline> {
    return this.outlineRepo.confirm(projectId);
  }

  async getOutline(projectId: string): Promise<Outline | null> {
    return this.outlineRepo.findByProjectId(projectId);
  }
}

// 章节管理用例
export class ManageChapterUseCase {
  constructor(private readonly outlineRepo: OutlineRepoPort) {}

  async addChapter(
    projectId: string,
    title: string,
    target?: string
  ): Promise<Outline> {
    const outline = await this.outlineRepo.findByProjectId(projectId);
    if (!outline) {
      throw new OutlineNotFoundError(projectId);
    }

    // 使用现有最大编号 +1，避免删除中间章节后编号冲突
    const number = String(
      outline.chapters.reduce((max, ch) => {
        const n = parseInt(ch.number, 10);
        return Number.isFinite(n) && n > max ? n : max;
      }, 0) + 1
    ).padStart(2, '0');
    const chapter: OutlineChapter = {
      id: number,
      number,
      title,
      target,
      status: 'pending',
    };

    return this.outlineRepo.addChapter(projectId, chapter);
  }

  async updateChapter(
    projectId: string,
    chapterId: string,
    updates: Partial<OutlineChapter>
  ): Promise<Outline> {
    return this.outlineRepo.updateChapter(projectId, chapterId, updates);
  }

  async deleteChapter(projectId: string, chapterId: string): Promise<Outline> {
    return this.outlineRepo.deleteChapter(projectId, chapterId);
  }

  async reorderChapters(projectId: string, chapterIds: string[]): Promise<Outline> {
    return this.outlineRepo.reorderChapters(projectId, chapterIds);
  }
}

// 大纲版本管理用例
export class OutlineVersionUseCase {
  constructor(private readonly outlineRepo: OutlineRepoPort) {}

  // 确认大纲（创建版本快照）
  async confirm(projectId: string): Promise<Outline> {
    const outline = await this.outlineRepo.findByProjectId(projectId);
    if (!outline) {
      throw new OutlineNotFoundError(projectId);
    }

    // 创建版本快照
    const confirmedOutline = await this.outlineRepo.confirm(projectId);

    // 记录变更
    await this.recordChange(projectId, {
      type: 'confirm',
      details: `大纲确认，共 ${outline.chapters.length} 章`,
    });

    return confirmedOutline;
  }

  // 回滚到指定版本
  async rollback(projectId: string, targetVersion: number): Promise<Outline> {
    return this.outlineRepo.rollback(projectId, targetVersion);
  }

  // 获取指定版本
  async getVersion(projectId: string, version: number): Promise<Outline | null> {
    return this.outlineRepo.getVersion(projectId, version);
  }

  // 列出所有版本
  async listVersions(projectId: string): Promise<{ version: number; createdAt: string }[]> {
    return this.outlineRepo.listVersions(projectId);
  }

  // 获取变更历史
  async getHistory(projectId: string, limit: number = 10): Promise<OutlineChange[]> {
    return this.outlineRepo.getChangeHistory(projectId, limit);
  }

  private async recordChange(
    projectId: string,
    change: { type: string; details: string }
  ): Promise<void> {
    const outline = await this.outlineRepo.findByProjectId(projectId);
    if (!outline) return;

    const outlineChange: OutlineChange = {
      id: `oc-${Date.now()}`,
      outlineId: outline.projectId,
      version: outline.version,
      changes: [
        {
          type: change.type as 'add' | 'update' | 'delete' | 'reorder' | 'confirm',
          details: change.details,
        },
      ],
      createdAt: new Date().toISOString(),
    };

    // 保存变更记录（通过 repo 暂存，后续实现存储层）
    console.log('[OutlineVersion] Recorded change:', outlineChange);
  }
}
