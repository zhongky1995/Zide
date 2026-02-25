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
import { OutlineRepoPort, ProjectRepoPort } from '../ports';

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
    private readonly projectRepo: ProjectRepoPort
  ) {}

  async execute(params: GenerateOutlineParams): Promise<Outline> {
    const { projectId, template, chapterCount, customChapters } = params;

    // 获取项目信息
    const project = await this.projectRepo.findById(projectId);
    if (!project) {
      throw new ProjectNotFoundError(projectId);
    }

    // 确定章节列表
    let chapterTitles: string[];
    if (customChapters && customChapters.length > 0) {
      chapterTitles = customChapters;
    } else {
      // 确保 template 是有效的枚举值
      const templateKey = (template && TEMPLATES[template]) ? template : OutlineTemplate.STANDARD;
      console.log('[GenerateOutline] templateKey:', templateKey, 'available:', Object.keys(TEMPLATES));
      chapterTitles = TEMPLATES[templateKey];
      if (!chapterTitles) {
        console.error('[GenerateOutline] Invalid template, using STANDARD');
        chapterTitles = TEMPLATES[OutlineTemplate.STANDARD];
      }
      if (chapterCount && chapterCount > chapterTitles.length) {
        // 如果需要更多章节，在中间插入
        const additional = chapterCount - chapterTitles.length;
        const middleIndex = Math.floor(chapterTitles.length / 2);
        for (let i = 0; i < additional; i++) {
          chapterTitles.splice(middleIndex + i, 0, `第${middleIndex + i + 1}章`);
        }
      }
    }

    // 生成大纲章节
    const chapters: OutlineChapter[] = chapterTitles.map((title, index) => ({
      id: `ch-${String(index + 1).padStart(2, '0')}`,
      number: String(index + 1).padStart(2, '0'),
      title,
      status: 'pending',
    }));

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

    const number = String(outline.chapters.length + 1).padStart(2, '0');
    const chapter: OutlineChapter = {
      id: `ch-${number}-${Date.now()}`,
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
