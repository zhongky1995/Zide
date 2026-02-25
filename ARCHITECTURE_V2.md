# Zide 系统架构设计 v2.0

版本：v2.0
日期：2026-02-25
状态：Draft
文档类型：架构设计文档

---

## 1. 设计目标与背景

### 1.1 基于PRD v2.0的设计演进

本文档基于PRD v2.0的产品需求，对现有v1.x架构进行扩展设计，重点解决以下问题：

1. **全局设定管理**：项目底座表单（背景、目标、限制、术语、风格约束）的结构化存储与访问
2. **大纲管理增强**：大纲版本控制、变更历史、章节目标追踪
3. **记忆压缩机制**：支持10万字级别项目的上下文管理，避免LLM上下文溢出
4. **章节生成流程优化**：更灵活的生成策略、可配置的工作流
5. **AI策略层**：多模型支持、意图策略配置、生成参数管理

### 1.2 设计原则

1. **向后兼容**：不破坏现有MVP功能
2. **渐进增强**：新模块独立演进，逐步集成
3. **性能优先**：10万字项目不阻塞UI，任务可中断
4. **可配置性**：关键策略可由用户配置

---

## 2. 模块架构总览

### 2.1 扩展后的分层架构

```
┌─────────────────────────────────────────────────────────────────────┐
│                      Electron Main Process                            │
│               (IPC 处理器、窗口管理、菜单、系统集成)                  │
├─────────────────────────────────────────────────────────────────────┤
│                        Preload Bridge                                 │
│                     (安全 API 白名单暴露)                             │
├─────────────────────────────────────────────────────────────────────┤
│                        React UI Layer                                 │
│            (项目管理、章节工作台、检查中心、设置中心)                 │
├─────────────────────────────────────────────────────────────────────┤
│                      Application Layer                                │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐  │
│  │ 项目管理用例  │ │ 大纲管理用例 │ │ 生成用例    │ │ 上下文用例  │  │
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘  │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐  │
│  │ 检查用例     │ │ 导出用例     │ │ 快照用例    │ │ 设定管理用例 │  │
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘  │
├─────────────────────────────────────────────────────────────────────┤
│                        Domain Layer                                   │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐  │
│  │ Project     │ │ Outline     │ │ Chapter    │ │ AIOperation│  │
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘  │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐  │
│  │ Snapshot    │ │ Glossary    │ │ CheckIssue │ │ ExportJob   │  │
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘  │
├─────────────────────────────────────────────────────────────────────┤
│                    Infrastructure Layer                               │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐  │
│  │ FileProject │ │ FileOutline │ │ SimpleIndex │ │ RealLLM     │  │
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘  │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐  │
│  │ ContextComp │ │ StrategyMgr │ │ RuleEngine  │ │ FileExport  │  │
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

### 2.2 新增模块清单

| 模块 | 层级 | 职责 |
|------|------|------|
| GlobalSettingsManager | Application | 全局设定管理 |
| OutlineVersionManager | Domain/Infrastructure | 大纲版本控制 |
| ContextCompressor | Infrastructure | 记忆压缩 |
| AIStrategyManager | Infrastructure | AI策略管理 |
| ChapterTemplateEngine | Infrastructure | 章节模板 |

---

## 3. 全局设定管理模块

### 3.1 需求背景

PRD v2.0明确项目底座表单包含：
- 背景（ProjectMeta.background）
- 目标（ProjectMeta.objectives）
- 限制（ProjectMeta.constraints）
- 术语表（Glossary）
- 风格约束（ProjectMeta.styleGuide）

### 3.2 设计方案

#### 3.2.1 Domain层扩展

```typescript
// packages/domain/src/entities/Project.ts 扩展

// 项目元信息（运行时存储）
export interface ProjectMeta {
  background?: string;      // 项目背景
  objectives?: string;     // 项目目标
  constraints?: string;   // 限制条件
  styleGuide?: string;    // 风格指南
  writingGuide?: string;  // 写作指南（P1扩展）
}

// 项目设定（全局设定集合）
export interface ProjectSettings {
  projectId: string;
  meta: ProjectMeta;
  glossary: Glossary;
  writingTone?: 'professional' | 'casual' | 'academic' | 'creative'; // P1
  targetAudience?: string; // P1 目标读者
  createdAt: string;
  updatedAt: string;
}
```

#### 3.2.2 端口接口

```typescript
// packages/application/src/ports/SettingsPort.ts (新增)

export interface ProjectSettingsPort {
  // 获取项目设定
  getSettings(projectId: string): Promise<ProjectSettings>;

  // 更新项目元信息
  updateMeta(projectId: string, meta: Partial<ProjectMeta>): Promise<ProjectSettings>;

  // 更新术语表
  updateGlossary(projectId: string, glossary: Glossary): Promise<ProjectSettings>;

  // 导出设定（用于AI上下文）
  exportForContext(projectId: string): Promise<{
    background: string;
    objectives: string;
    constraints: string;
    styleGuide: string;
    glossary: string;
  }>;
}
```

#### 3.2.3 用例设计

```typescript
// packages/application/src/usecases/SettingsUseCases.ts (新增)

export class ProjectSettingsUseCase {
  constructor(
    private readonly projectRepo: ProjectRepoPort,
    private readonly glossaryRepo: GlossaryRepoPort
  ) {}

  // 获取完整项目设定
  async getSettings(projectId: string): Promise<ProjectSettings> {
    const project = await this.projectRepo.findById(projectId);
    const glossary = await this.glossaryRepo.findByProjectId(projectId);

    return {
      projectId,
      meta: project.meta,
      glossary,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
    };
  }

  // 导出为AI可用格式
  async exportForContext(projectId: string) {
    const settings = await this.getSettings(projectId);

    return {
      projectContext: [
        settings.meta.background ? `## 项目背景\n${settings.meta.background}` : '',
        settings.meta.objectives ? `## 项目目标\n${settings.meta.objectives}` : '',
        settings.meta.constraints ? `## 限制条件\n${settings.meta.constraints}` : '',
        settings.meta.styleGuide ? `## 风格约束\n${settings.meta.styleGuide}` : '',
      ].filter(Boolean).join('\n\n'),

      glossary: this.formatGlossary(settings.glossary),
    };
  }

  private formatGlossary(glossary: Glossary): string {
    if (!glossary?.terms?.length) return '';

    return '## 术语表\n' + glossary.terms
      .map(t => `- **${t.term}**: ${t.definition}`)
      .join('\n');
  }
}
```

### 3.3 数据流

```
用户编辑设定
    │
    ▼
ProjectSettingsUseCase.updateMeta() / updateGlossary()
    │
    ├─► ProjectRepo.save()
    ├─► GlossaryRepo.save()
    │
    ├─► 通知渲染进程 (settings-updated)
    │
    └─► 持久化到 runtime/projects/{id}/meta/project.json
```

---

## 4. 大纲管理层

### 4.1 需求背景

PRD v2.0要求：
- 大纲生成与编辑：章节增删改、顺序调整、章节目标定义
- 大纲状态管理：draft -> confirmed
- 大纲版本控制（P1）

### 4.2 设计方案

#### 4.2.1 Domain层扩展

```typescript
// packages/domain/src/entities/Outline.ts 扩展

// 大纲章节项
export interface OutlineChapter {
  id: string;
  number: string;
  title: string;
  target?: string;        // 章节目标/要求（新增）
  status: 'pending' | 'draft' | 'completed';
  wordCount?: number;      // 预估字数（P1）
  createdAt?: string;
  updatedAt?: string;
}

// 大纲实体（扩展）
export interface Outline {
  projectId: string;
  chapters: OutlineChapter[];
  status: 'none' | 'draft' | 'confirmed';
  version: number;         // 版本号（新增）
  parentVersion?: number; // 父版本（支持回溯）
  generatedAt?: string;
  updatedAt: string;
  confirmedAt?: string;
}

// 大纲变更记录
export interface OutlineChange {
  id: string;
  outlineId: string;
  version: number;
  changes: {
    type: 'add' | 'update' | 'delete' | 'reorder';
    chapterId?: string;
    field?: string;
    oldValue?: any;
    newValue?: any;
  }[];
  createdAt: string;
}
```

#### 4.2.2 端口接口扩展

```typescript
// packages/application/src/ports/OutlineRepoPort.ts 扩展

export interface OutlineRepoPort {
  // 现有方法...

  // 新增：版本管理
  getVersion(projectId: string, version: number): Promise<Outline | null>;
  listVersions(projectId: string): Promise<{ version: number; createdAt: string }[]>;
  rollback(projectId: string, targetVersion: number): Promise<Outline>;

  // 新增：变更历史
  getChangeHistory(projectId: string, limit?: number): Promise<OutlineChange[]>;
}
```

#### 4.2.3 用例扩展

```typescript
// packages/application/src/usecases/OutlineUseCases.ts 扩展

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

  // 获取变更历史
  async getHistory(projectId: string, limit: number = 10): Promise<OutlineChange[]> {
    return this.outlineRepo.getChangeHistory(projectId, limit);
  }

  private async recordChange(
    projectId: string,
    change: { type: string; details: string }
  ): Promise<void> {
    // 记录到变更历史
  }
}
```

### 4.3 大纲生成流程增强

```typescript
// AI辅助大纲生成（基于项目设定）

export class GenerateOutlineUseCase {
  constructor(
    private readonly outlineRepo: OutlineRepoPort,
    private readonly projectRepo: ProjectRepoPort,
    private readonly llmPort: LLMPort
  ) {}

  // AI生成大纲
  async generateWithAI(projectId: string, params: GenerateOutlineParams): Promise<Outline> {
    // 1. 获取项目设定
    const project = await this.projectRepo.findById(projectId);
    const settings = await this.projectSettingsUseCase.exportForContext(projectId);

    // 2. 构建生成提示
    const prompt = this.buildOutlinePrompt(settings, params);

    // 3. 调用LLM
    const result = await this.llmPort.generate({
      context: {
        projectContext: settings.projectContext,
        relatedChapters: [],
        glossary: settings.glossary,
        outline: '',
      },
      chapter: {
        id: 'outline-generation',
        title: '大纲生成',
        content: '',
        target: prompt,
      },
      intent: ChapterIntent.CONTINUE,
    });

    // 4. 解析结果生成大纲
    const chapters = this.parseOutlineResponse(result.content);

    // 5. 保存
    const outline: Outline = {
      projectId,
      chapters,
      status: 'draft',
      version: 1,
      generatedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    return this.outlineRepo.save(outline);
  }

  private buildOutlinePrompt(settings: any, params: GenerateOutlineParams): string {
    return `请为以下项目生成大纲：

${settings.projectContext}

项目类型：${params.template || '标准'}
要求章节数：${params.chapterCount || '5-8章'}

请按以下格式输出：
## 大纲结构
1. 第一章：标题 - 目标
2. 第二章：标题 - 目标
...`;
  }
}
```

---

## 5. 记忆压缩机制

### 5.1 需求背景

PRD明确MVP需支持10万字量级。当项目内容增长时，LLM上下文窗口可能不足以容纳所有历史内容，需要记忆压缩机制。

核心挑战：
1. 切片检索的准确性
2. 压缩后信息不丢失
3. 保持上下文连贯性

### 5.2 设计方案

#### 5.2.1 压缩策略分层

```
┌─────────────────────────────────────────┐
│           ContextPack (原始)             │
│  - projectContext (无限制)               │
│  - relatedChapters (切片后)              │
│  - glossary (全部)                       │
│  - outline (全部)                        │
└────────────────┬────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────┐
│         ContextCompressor               │
│  ┌───────────────────────────────────┐  │
│  │ Tier 1: 智能切片 (已实现)           │  │
│  │ - chunkSize: 2000                 │  │
│  │ - 相关性排序取 top 5              │  │
│  └───────────────────────────────────┘  │
│  ┌───────────────────────────────────┐  │
│  │ Tier 2: 摘要压缩 (新增)             │  │
│  │ - 章节摘要代替全文                 │  │
│  │ - 保留关键信息点                   │  │
│  └───────────────────────────────────┘  │
│  ┌───────────────────────────────────┐  │
│  │ Tier 3: 核心提取 (新增)             │  │
│  │ - 仅保留核心论点                   │  │
│  │ - 使用大纲目标约束                 │  │
│  └───────────────────────────────────┘  │
└────────────────┬────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────┐
│      LLM Input (压缩后)                  │
│  控制在 token 限制内                      │
└─────────────────────────────────────────┘
```

#### 5.2.2 ContextCompressor 实现

```typescript
// packages/infrastructure/src/index/ContextCompressor.ts (新增)

import { Chapter, ChapterSummary } from '@zide/domain';

export interface CompressionConfig {
  maxProjectContextChars: number;  // 项目背景最大字符
  maxRelatedChapters: number;      // 相关章节最大数量
  maxGlossaryChars: number;        // 术语表最大字符
  compressionStrategy: 'slice' | 'summary' | 'core';
}

export class ContextCompressor {
  private config: CompressionConfig = {
    maxProjectContextChars: 3000,
    maxRelatedChapters: 5,
    maxGlossaryChars: 2000,
    compressionStrategy: 'slice',
  };

  constructor(config?: Partial<CompressionConfig>) {
    if (config) {
      this.config = { ...this.config, ...config };
    }
  }

  // 压缩项目背景
  compressProjectContext(context: string): string {
    if (context.length <= this.config.maxProjectContextChars) {
      return context;
    }

    // 提取关键段落（前言、目标、限制）
    const lines = context.split('\n');
    const keySections = lines.filter(line =>
      line.startsWith('##') ||
      line.includes('目标') ||
      line.includes('背景') ||
      line.includes('限制')
    );

    if (keySections.length > 0) {
      return keySections.join('\n').slice(0, this.config.maxProjectContextChars);
    }

    return context.slice(0, this.config.maxProjectContextChars) + '\n...[已压缩]';
  }

  // 压缩相关章节
  compressRelatedChapters(
    chapters: Chapter[],
    strategy: 'slice' | 'summary' | 'core' = 'slice'
  ): { content: string; sources: string[] } {
    if (chapters.length === 0) {
      return { content: '', sources: [] };
    }

    const limited = chapters.slice(0, this.config.maxRelatedChapters);
    const sources: string[] = [];

    switch (strategy) {
      case 'summary':
        // 使用章节摘要
        return {
          content: limited
            .map(ch => this.chapterToSummary(ch))
            .join('\n\n'),
          sources: limited.map(ch => ch.id),
        };

      case 'core':
        // 仅提取核心论点
        return {
          content: limited
            .map(ch => this.extractCorePoints(ch))
            .join('\n\n'),
          sources: limited.map(ch => ch.id),
        };

      case 'slice':
      default:
        // 切片（现有逻辑）
        return {
          content: limited
            .map((ch, i) => `### 相关章节 ${i + 1}: ${ch.title}\n${ch.content.slice(0, 1500)}`)
            .join('\n\n'),
          sources: limited.map(ch => ch.id),
        };
    }
  }

  // 章节转摘要
  private chapterToSummary(chapter: Chapter): string {
    const summary = chapter.summary;
    if (summary) {
      const parts = [
        `## ${chapter.title}`,
        summary.mainPoint ? `核心观点: ${summary.mainPoint}` : '',
        summary.keyPoints?.length ? `关键要点:\n${summary.keyPoints.map(p => `- ${p}`).join('\n')}` : '',
        summary.conclusion ? `小结: ${summary.conclusion}` : '',
      ].filter(Boolean);
      return parts.join('\n');
    }
    return `## ${chapter.title}\n${chapter.content.slice(0, 500)}`;
  }

  // 提取核心论点
  private extractCorePoints(chapter: Chapter): string {
    const summary = chapter.summary;
    if (!summary?.mainPoint) {
      return `## ${chapter.title}\n${chapter.content.slice(0, 300)}`;
    }

    return `## ${chapter.title}
核心观点: ${summary.mainPoint}
${summary.keyPoints?.map(p => `- ${p}`).join('\n') || ''}`;
  }

  // 自适应压缩（根据token预算）
  compressForTokenBudget(
    context: {
      projectContext: string;
      relatedChapters: Chapter[];
      glossary: string;
      outline: string;
    },
    tokenBudget: number
  ): {
    projectContext: string;
    relatedChapters: string;
    glossary: string;
    outline: string;
  } {
    // 估算：1 token ≈ 2 字符
    const charBudget = tokenBudget * 2;

    // 按优先级分配预算
    const glossaryBudget = Math.min(2000, charBudget * 0.1);
    const outlineBudget = Math.min(3000, charBudget * 0.15);
    const contextBudget = Math.min(4000, charBudget * 0.25);
    const chaptersBudget = charBudget - glossaryBudget - outlineBudget - contextBudget;

    // 递归压缩直到满足预算
    let strategy: 'slice' | 'summary' | 'core' = 'slice';
    let relatedContent = '';
    let sources: string[] = [];

    while (true) {
      const compressed = this.compressRelatedChapters(context.relatedChapters, strategy);
      const content = [
        this.compressProjectContext(context.projectContext).slice(0, contextBudget),
        context.glossary.slice(0, glossaryBudget),
        context.outline.slice(0, outlineBudget),
        compressed.content,
      ].join('\n\n');

      if (content.length <= charBudget || strategy === 'core') {
        relatedContent = compressed.content;
        sources = compressed.sources;
        break;
      }

      // 升级压缩策略
      if (strategy === 'slice') {
        strategy = 'summary';
      } else {
        strategy = 'core';
      }
    }

    return {
      projectContext: this.compressProjectContext(context.projectContext).slice(0, contextBudget),
      relatedChapters: relatedContent,
      glossary: context.glossary.slice(0, glossaryBudget),
      outline: context.outline.slice(0, outlineBudget),
    };
  }
}
```

#### 5.2.3 与SimpleIndex集成

```typescript
// packages/infrastructure/src/index/SimpleIndexAdapter.ts 扩展

import { ContextCompressor } from './ContextCompressor';

export class SimpleIndexAdapter implements IndexPort {
  private compressor: ContextCompressor;

  constructor(
    private readonly index: SimpleIndex,
    config?: CompressionConfig
  ) {
    this.compressor = new ContextCompressor(config);
  }

  async packContext(projectId: string, chapterId: string): Promise<ContextPack> {
    // ... 现有逻辑 ...

    // 添加压缩版本支持
    const relatedChapters = allRelated.map(ch => ({
      ...ch,
      compressed: this.compressor.compressForTokenBudget(
        { projectContext, relatedChapters: [ch], glossary, outline },
        8000 // 假设token预算
      ),
    }));

    return {
      projectContext,
      relatedChapters,
      glossary,
      outline,
      sources,
    };
  }
}
```

---

## 6. AI策略层

### 6.1 需求背景

PRD P1要求：
- 多模型策略（不同任务选择不同模型）
- AI设置配置界面：模型选择、温度参数、最大token
- 生成策略预设：续写模式、创意模式、严谨模式

### 6.2 设计方案

#### 6.2.1 AI策略模型

```typescript
// packages/domain/src/entities/AIStrategy.ts (新增)

export enum GenerationMode {
  CONTINUE = 'continue',   // 续写模式
  EXPAND = 'expand',      // 扩写模式
  REWRITE = 'rewrite',    // 重写模式
  CREATIVE = 'creative',  // 创意模式
  RIGOROUS = 'rigorous',  // 严谨模式
}

// AI生成策略
export interface AIStrategy {
  id: string;
  name: string;
  mode: GenerationMode;
  provider: 'openai' | 'anthropic' | 'minimax' | 'kimi';
  model: string;
  temperature: number;     // 0-2
  maxTokens: number;
  topP?: number;

  // 策略特定配置
  intentOverrides?: Partial<Record<ChapterIntent, IntentConfig>>;
  contextConfig?: {
    maxProjectContextChars: number;
    maxRelatedChapters: number;
    compressionStrategy: 'slice' | 'summary' | 'core';
  };
}

// 意图配置覆盖
export interface IntentConfig {
  systemPrompt?: string;
  outputMode: 'append' | 'replace';
  minTokens?: number;
  maxTokens?: number;
}

// 内置策略
export const BUILT_IN_STRATEGIES: AIStrategy[] = [
  {
    id: 'default-continue',
    name: '默认续写',
    mode: GenerationMode.CONTINUE,
    provider: 'openai',
    model: 'gpt-4',
    temperature: 0.7,
    maxTokens: 4000,
  },
  {
    id: 'creative',
    name: '创意模式',
    mode: GenerationMode.CREATIVE,
    provider: 'openai',
    model: 'gpt-4',
    temperature: 1.2,
    maxTokens: 6000,
  },
  {
    id: 'rigorous',
    name: '严谨模式',
    mode: GenerationMode.RIGOROUS,
    provider: 'anthropic',
    model: 'claude-3-opus',
    temperature: 0.3,
    maxTokens: 4000,
  },
  {
    id: 'quick-expand',
    name: '快速扩写',
    mode: GenerationMode.EXPAND,
    provider: 'openai',
    model: 'gpt-4o',
    temperature: 0.8,
    maxTokens: 2000,
  },
];
```

#### 6.2.2 策略管理器

```typescript
// packages/infrastructure/src/llm/StrategyManager.ts (新增)

import { AIStrategy, BUILT_IN_STRATEGIES, ChapterIntent } from '@zide/domain';

export class AIStrategyManager {
  private strategies: Map<string, AIStrategy> = new Map();
  private activeStrategyId: string = 'default-continue';

  constructor() {
    // 加载内置策略
    BUILT_IN_STRATEGIES.forEach(s => this.strategies.set(s.id, s));
  }

  // 获取当前策略
  getActiveStrategy(): AIStrategy {
    return this.strategies.get(this.activeStrategyId) || BUILT_IN_STRATEGIES[0];
  }

  // 切换策略
  setActiveStrategy(strategyId: string): void {
    if (this.strategies.has(strategyId)) {
      this.activeStrategyId = strategyId;
    }
  }

  // 获取所有策略
  listStrategies(): AIStrategy[] {
    return Array.from(this.strategies.values());
  }

  // 添加自定义策略
  addStrategy(strategy: AIStrategy): void {
    this.strategies.set(strategy.id, strategy);
  }

  // 删除自定义策略
  deleteStrategy(strategyId: string): boolean {
    const strategy = this.strategies.get(strategyId);
    if (strategy && !BUILT_IN_STRATEGIES.find(s => s.id === strategyId)) {
      return this.strategies.delete(strategyId);
    }
    return false;
  }

  // 获取意图配置
  getIntentConfig(intent: ChapterIntent): IntentConfig {
    const strategy = this.getActiveStrategy();
    return strategy.intentOverrides?.[intent] || this.getDefaultIntentConfig(intent);
  }

  private getDefaultIntentConfig(intent: ChapterIntent): IntentConfig {
    const configs: Record<ChapterIntent, IntentConfig> = {
      [ChapterIntent.CONTINUE]: { outputMode: 'append', minTokens: 400, maxTokens: 1200 },
      [ChapterIntent.EXPAND]: { outputMode: 'append', minTokens: 500, maxTokens: 1500 },
      [ChapterIntent.REWRITE]: { outputMode: 'replace', minTokens: 1000, maxTokens: 4000 },
      [ChapterIntent.ADD_ARGUMENT]: { outputMode: 'append', minTokens: 300, maxTokens: 1000 },
      [ChapterIntent.POLISH]: { outputMode: 'replace', minTokens: 500, maxTokens: 4000 },
      [ChapterIntent.SIMPLIFY]: { outputMode: 'replace', minTokens: 300, maxTokens: 3000 },
    };
    return configs[intent];
  }
}
```

#### 6.2.3 策略感知的LLM适配器

```typescript
// packages/infrastructure/src/llm/StrategyAwareLLMAdapter.ts (新增)

import { LLMPort, LLMGenerateParams } from '@zide/application';
import { AIStrategy, ChapterIntent } from '@zide/domain';
import { RealLLMAdapter } from './RealLLMAdapter';
import { StrategyManager } from './StrategyManager';

export class StrategyAwareLLMAdapter implements LLMPort {
  constructor(
    private readonly baseAdapter: RealLLMAdapter,
    private readonly strategyManager: StrategyManager
  ) {}

  async generate(params: LLMGenerateParams): Promise<LLMGenerateResult> {
    const strategy = this.strategyManager.getActiveStrategy();
    const intentConfig = this.strategyManager.getIntentConfig(params.intent);

    // 应用策略特定的模型配置
    const originalConfig = this.baseAdapter.getConfig();

    // 临时覆盖配置
    this.baseAdapter.updateConfig({
      model: strategy.model,
      temperature: strategy.temperature,
      maxTokens: Math.min(strategy.maxTokens, intentConfig.maxTokens || strategy.maxTokens),
    });

    try {
      // 添加策略特定的system prompt
      const enhancedParams = this.applyStrategyPrompt(params, strategy, params.intent);

      return await this.baseAdapter.generate(enhancedParams);
    } finally {
      // 恢复原始配置
      this.baseAdapter.updateConfig(originalConfig);
    }
  }

  private applyStrategyPrompt(
    params: LLMGenerateParams,
    strategy: AIStrategy,
    intent: ChapterIntent
  ): LLMGenerateParams {
    const intentConfig = strategy.intentOverrides?.[intent];

    return {
      ...params,
      customPrompt: [
        intentConfig?.systemPrompt && `## 策略要求\n${intentConfig.systemPrompt}`,
        params.customPrompt,
      ].filter(Boolean).join('\n\n') || params.customPrompt,
    };
  }

  ping(): Promise<boolean> {
    return this.baseAdapter.ping();
  }

  getConfig(): LLMProviderConfig {
    return this.baseAdapter.getConfig();
  }

  updateConfig(config: Partial<LLMProviderConfig>): void {
    this.baseAdapter.updateConfig(config);
  }
}
```

#### 6.2.4 策略配置存储

```typescript
// packages/infrastructure/src/storage/FileStrategyRepo.ts (新增)

import * as fs from 'fs/promises';
import * as path from 'path';
import { AIStrategy } from '@zide/domain';

export class FileStrategyRepo {
  private configPath: string;

  constructor(private readonly configDir: string) {
    this.configPath = path.join(configDir, 'ai-strategies.json');
  }

  async list(): Promise<AIStrategy[]> {
    try {
      const data = await fs.readFile(this.configPath, 'utf-8');
      return JSON.parse(data);
    } catch {
      return [];
    }
  }

  async save(strategies: AIStrategy[]): Promise<void> {
    await fs.writeFile(this.configPath, JSON.stringify(strategies, null, 2));
  }

  async add(strategy: AIStrategy): Promise<void> {
    const strategies = await this.list();
    strategies.push(strategy);
    await this.save(strategies);
  }

  async delete(strategyId: string): Promise<void> {
    const strategies = await this.list();
    const filtered = strategies.filter(s => s.id !== strategyId);
    await this.save(filtered);
  }
}
```

---

## 7. 章节生成流程

### 7.1 优化后的生成流程

```typescript
// packages/application/src/usecases/GenerateContentUseCase.ts 优化

export class GenerateContentUseCase {
  constructor(
    private readonly llmPort: LLMPort,
    private readonly indexPort: IndexPort,
    private readonly chapterRepo: ChapterRepoPort,
    private readonly contextCompressor: ContextCompressor,  // 新增
    private readonly strategyManager: AIStrategyManager     // 新增
  ) {}

  async generate(
    projectId: string,
    chapterId: string,
    intent: ChapterIntent,
    customPrompt?: string
  ): Promise<{ chapter: Chapter; operation: AIOperation }> {
    // 1. 获取章节信息
    const chapter = await this.chapterRepo.findByChapterId(projectId, chapterId);
    if (!chapter) {
      throw new ChapterNotFoundError(chapterId);
    }

    // 2. 获取上下文（包含压缩）
    const contextPack = await this.indexPort.packContext(projectId, chapterId);

    // 3. 获取当前AI策略
    const strategy = this.strategyManager.getActiveStrategy();
    const intentConfig = this.strategyManager.getIntentConfig(intent);

    // 4. 根据策略压缩上下文
    const compressedContext = this.contextCompressor.compressForTokenBudget(
      {
        projectContext: contextPack.projectContext,
        relatedChapters: contextPack.relatedChapters,
        glossary: contextPack.glossary,
        outline: contextPack.outline,
      },
      strategy.maxTokens * 3 // 估算token预算
    );

    // 5. 构建生成参数（应用策略）
    const generateParams: LLMGenerateParams = {
      context: compressedContext,
      chapter: {
        id: chapter.id,
        title: chapter.title,
        content: chapter.content,
        target: chapter.target || '',
      },
      intent,
      customPrompt: [
        intentConfig.systemPrompt,
        customPrompt,
      ].filter(Boolean).join('\n\n') || undefined,
    };

    // 6. 调用LLM（通过策略感知适配器）
    const result = await this.llmPort.generate(generateParams);

    // 7. 保存操作记录
    const operation = await this.saveOperation(projectId, chapterId, {
      intent,
      contextUsed: contextPack.sources.map(s => s.chapterId),
      prompt: customPrompt,
      output: result,
      strategyId: strategy.id,
    });

    // 8. 更新章节内容
    const newContent = this.applyOutputMode(chapter.content, result.content, intentConfig.outputMode);
    await this.chapterRepo.updateContent(projectId, chapterId, newContent);
    await this.chapterRepo.incrementOperationCount(projectId, chapterId);

    // 9. 更新索引
    await this.indexPort.indexChapter(projectId, chapterId, newContent, chapter.title);

    // 10. 更新状态
    if (chapter.status === ChapterStatus.TODO) {
      await this.chapterRepo.updateStatus(projectId, chapterId, ChapterStatus.IN_PROGRESS);
    }

    // 11. 更新摘要
    await this.updateSummary(projectId, chapterId, newContent);

    return {
      chapter: await this.chapterRepo.findByChapterId(projectId, chapterId),
      operation,
    };
  }

  private applyOutputMode(
    original: string,
    generated: string,
    mode: 'append' | 'replace'
  ): string {
    if (mode === 'replace') {
      return generated;
    }
    return original + '\n\n' + generated;
  }
}
```

---

## 8. 章节模板机制

### 8.1 需求背景

PRD P1要求：章节模板 - 预定义章节结构模板、快速应用模板

### 8.2 设计方案

```typescript
// packages/domain/src/entities/ChapterTemplate.ts (新增)

export interface ChapterTemplate {
  id: string;
  name: string;
  description: string;
  category: 'proposal' | 'report' | 'research' | 'novel' | 'custom';
  structure: TemplateSection[];
}

export interface TemplateSection {
  type: 'heading' | 'paragraph' | 'list' | 'blockquote' | 'custom';
  content?: string;
  placeholder?: string;
  required: boolean;
}

// 内置模板
export const BUILT_IN_TEMPLATES: ChapterTemplate[] = [
  {
    id: 'proposal-intro',
    name: '方案-引言',
    description: '方案引言模板',
    category: 'proposal',
    structure: [
      { type: 'heading', content: '一、引言', required: true },
      { type: 'paragraph', placeholder: '简要介绍背景和重要性...', required: true },
      { type: 'heading', content: '二、问题陈述', required: true },
      { type: 'paragraph', placeholder: '明确要解决的问题...', required: true },
    ],
  },
  {
    id: 'research-method',
    name: '研究-方法',
    description: '研究方法章节模板',
    category: 'research',
    structure: [
      { type: 'heading', content: '研究方法', required: true },
      { type: 'paragraph', placeholder: '概述采用的研究方法...', required: true },
      { type: 'heading', content: '数据来源', required: true },
      { type: 'paragraph', placeholder: '说明数据来源和样本...', required: true },
      { type: 'heading', content: '分析框架', required: true },
      { type: 'paragraph', placeholder: '介绍分析框架...', required: true },
    ],
  },
  // ... 更多模板
];
```

---

## 9. 数据流总结

### 9.1 完整生成流程

```
用户点击生成按钮
    │
    ▼
选择生成意图（续写/扩写/重写/补论证/润色/简化）
    │
    ▼
选择AI策略（可选，默认/创意/严谨/快速）
    │
    ▼
GenerateContentUseCase.generate()
    │
    ├─► ChapterRepo.findByChapterId()
    │
    ├─► IndexPort.packContext()
    │         │
    │         ▼
    │    SimpleIndexAdapter.packContext()
    │         │
    │         ▼
    │    ContextCompressor.compressForTokenBudget()
    │         │
    │         ▼
    │    ContextPack (压缩后)
    │
    ├─► StrategyManager.getActiveStrategy()
    │
    ├─► LLMPort.generate() [策略感知]
    │         │
    │         ▼
    │    StrategyAwareLLMAdapter
    │         │
    │         ▼
    │    RealLLMAdapter.callXXX()
    │
    ├─► ChapterRepo.saveOperation()
    │
    ├─► ChapterRepo.updateContent() [根据outputMode追加或替换]
    │
    ├─► IndexPort.indexChapter()
    │
    ├─► 更新摘要 (自动提取核心观点)
    │
    └─► 返回更新后的章节
```

### 9.2 模块依赖关系

```
┌─────────────────────────────────────────────────────────────────┐
│                        UI Layer                                 │
│  (React Components -> UseCases -> Ports)                       │
└──────────────────────────┬──────────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────────┐
│                    Application Layer                            │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ UseCases                                                │   │
│  │ - CreateProjectUseCase                                  │   │
│  │ - OutlineUseCases (含VersionUseCase)                   │   │
│  │ - ChapterWorkbenchUseCase                               │   │
│  │ - GenerateContentUseCase (含StrategyManager集成)        │   │
│  │ - ContextUseCases (含Compressor集成)                    │   │
│  │ - ProjectSettingsUseCase (新增)                         │   │
│  │ - CheckUseCases                                         │   │
│  │ - ExportUseCases                                         │   │
│  │ - SnapshotUseCases                                       │   │
│  │ - MetricsUseCases                                        │   │
│  └──────────────────────────────────────────────────────────┘   │
└──────────────────────────┬──────────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────────┐
│                      Domain Layer                                │
│  Entities: Project, Outline, Chapter, AIOperation, etc.       │
│  + AIStrategy (新增)                                            │
│  + ChapterTemplate (新增)                                       │
│  + ProjectSettings (新增)                                       │
└──────────────────────────┬──────────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────────┐
│                   Infrastructure Layer                          │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ Adapters                                                │   │
│  │ - FileProjectRepo, FileChapterRepo, FileOutlineRepo    │   │
│  │ - RealLLMAdapter                                       │   │
│  │ - SimpleIndex + SimpleIndexAdapter                     │   │
│  │ - ContextCompressor (新增)                              │   │
│  │ - StrategyManager (新增)                                │   │
│  │ - StrategyAwareLLMAdapter (新增)                       │   │
│  │ - FileStrategyRepo (新增)                               │   │
│  │ - ChapterTemplateEngine (新增)                          │   │
│  │ - SimpleRuleEngine, FileExportAdapter                   │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 10. 文件变更清单

### 10.1 新增文件

| 文件路径 | 职责 |
|---------|------|
| `packages/domain/src/entities/AIStrategy.ts` | AI策略实体 |
| `packages/domain/src/entities/ChapterTemplate.ts` | 章节模板实体 |
| `packages/application/src/ports/ProjectSettingsPort.ts` | 设定端口接口 |
| `packages/application/src/usecases/ProjectSettingsUseCase.ts` | 设定用例 |
| `packages/infrastructure/src/index/ContextCompressor.ts` | 记忆压缩 |
| `packages/infrastructure/src/llm/StrategyManager.ts` | 策略管理 |
| `packages/infrastructure/src/llm/StrategyAwareLLMAdapter.ts` | 策略感知适配器 |
| `packages/infrastructure/src/storage/FileStrategyRepo.ts` | 策略存储 |

### 10.2 修改文件

| 文件路径 | 变更内容 |
|---------|---------|
| `packages/domain/src/entities/Project.ts` | 扩展ProjectMeta |
| `packages/domain/src/entities/Outline.ts` | 添加版本控制字段 |
| `packages/application/src/ports/OutlineRepoPort.ts` | 添加版本管理方法 |
| `packages/application/src/usecases/OutlineUseCases.ts` | 添加版本用例 |
| `packages/application/src/usecases/GenerateContentUseCase.ts` | 集成策略和压缩 |
| `packages/infrastructure/src/index/SimpleIndexAdapter.ts` | 集成ContextCompressor |
| `packages/infrastructure/src/llm/RealLLMAdapter.ts` | 保持为基础实现 |

---

## 11. 里程碑规划

### Phase 1: 基础架构（1周）

- [ ] 扩展Domain层实体
- [ ] 实现ProjectSettingsPort和用例
- [ ] 实现Outline版本管理

### Phase 2: 记忆压缩（1周）

- [ ] 实现ContextCompressor
- [ ] 集成到SimpleIndexAdapter
- [ ] 性能测试与调优

### Phase 3: AI策略层（1周）

- [ ] 实现AIStrategy实体
- [ ] 实现StrategyManager
- [ ] 实现StrategyAwareLLMAdapter
- [ ] UI配置界面

### Phase 4: 章节模板（0.5周）

- [ ] 实现ChapterTemplate实体
- [ ] 实现TemplateEngine
- [ ] UI集成

### Phase 5: 测试与优化（0.5周）

- [ ] 集成测试
- [ ] 性能测试（10万字场景）
- [ ] 用户验收

---

## 12. 附录

### 12.1 配置示例

```json
// runtime/config/ai-strategies.json
{
  "activeStrategy": "default-continue",
  "strategies": [
    {
      "id": "default-continue",
      "name": "默认续写",
      "mode": "continue",
      "provider": "openai",
      "model": "gpt-4",
      "temperature": 0.7,
      "maxTokens": 4000
    },
    {
      "id": "creative",
      "name": "创意模式",
      "mode": "creative",
      "provider": "openai",
      "model": "gpt-4",
      "temperature": 1.2,
      "maxTokens": 6000
    }
  ]
}
```

### 12.2 版本历史

| 版本 | 日期 | 变更 |
|------|------|------|
| v2.0 | 2026-02-25 | 初始版本，基于PRD v2.0设计 |
