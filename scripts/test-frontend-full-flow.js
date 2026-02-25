#!/usr/bin/env node

const assert = require('assert');
const fs = require('fs/promises');
const os = require('os');
const path = require('path');

const {
  FileProjectRepo,
  FileOutlineRepo,
  FileChapterRepo,
  SimpleIndexAdapter,
} = require('@zide/infrastructure');

const {
  CreateProjectUseCase,
  GenerateSettingsUseCase,
  GenerateOutlineUseCase,
  GenerateContentUseCase,
} = require('@zide/application');

class PlanningLLMAdapter {
  constructor() {
    this.config = { provider: 'custom', model: 'planning-mock' };
  }

  async generate(params) {
    if (params.chapter.id === 'settings-generation') {
      const content = JSON.stringify({
        background: '基于用户输入形成的全局背景',
        objectives: '围绕项目目标构建章节化写作闭环',
        constraints: '术语统一、逻辑连贯、避免空泛章节',
        style: '结构化、专业、可执行',
        targetAudience: '业务决策者',
        writingTone: 'professional',
      });
      return {
        content,
        model: this.config.model,
        tokens: 200,
        finishReason: 'stop',
      };
    }

    if (params.chapter.id === 'outline-generation') {
      const content = JSON.stringify([
        {
          title: '项目背景与目标澄清',
          target: '明确背景、目标与问题边界，为后续章节提供统一上下文。',
        },
        {
          title: '关键矛盾与路径设计',
          target: '结合前文结论提出可执行路径，并形成本章主论点。',
        },
        {
          title: '实施计划与风险控制',
          target: '给出实施里程碑、资源安排与关键风险应对方案。',
        },
      ]);
      return {
        content,
        model: this.config.model,
        tokens: 220,
        finishReason: 'stop',
      };
    }

    return {
      content: 'planning mock output',
      model: this.config.model,
      tokens: 80,
      finishReason: 'stop',
    };
  }

  async ping() {
    return true;
  }

  getConfig() {
    return { ...this.config };
  }

  updateConfig(config) {
    this.config = { ...this.config, ...config };
  }
}

class InspectableWritingLLMAdapter {
  constructor() {
    this.config = { provider: 'custom', model: 'writing-mock' };
    this.lastParams = null;
  }

  async generate(params) {
    this.lastParams = params;
    return {
      content: '这是第二章首轮生成内容（基于全局 + 前文记忆 + 本节梗概）。',
      model: this.config.model,
      tokens: 260,
      finishReason: 'stop',
    };
  }

  async ping() {
    return true;
  }

  getConfig() {
    return { ...this.config };
  }

  updateConfig(config) {
    this.config = { ...this.config, ...config };
  }
}

async function run() {
  const basePath = path.join(os.tmpdir(), `zide-frontend-flow-${Date.now()}`);
  await fs.mkdir(basePath, { recursive: true });

  const projectRepo = new FileProjectRepo(basePath);
  const outlineRepo = new FileOutlineRepo(basePath);
  const chapterRepo = new FileChapterRepo(basePath);
  const planningLLM = new PlanningLLMAdapter();

  // 1) 模拟前端「创建项目 + AI 生成全局设定」
  const createProject = new CreateProjectUseCase(projectRepo);
  const project = await createProject.execute({
    name: 'Frontend Full Flow',
    type: 'report',
    description: 'frontend logic test',
    targetReaders: '管理层',
    targetScale: '2万字',
  });
  assert.ok(project.id, '项目创建失败');

  const generateSettings = new GenerateSettingsUseCase(planningLLM);
  const settings = await generateSettings.generate({
    name: project.name,
    type: project.type,
    idea: '希望先澄清问题，再给出路径和实施计划',
    targetReaders: '管理层',
    targetScale: '2万字',
  });
  await projectRepo.update(project.id, {
    meta: {
      background: settings.background,
      objectives: settings.objectives,
      constraints: settings.constraints,
      styleGuide: settings.style,
    },
    writingTone: settings.writingTone,
    targetAudience: settings.targetAudience,
  });

  // 2) 模拟前端「AI 生成大纲」并验证章节梗概
  const generateOutline = new GenerateOutlineUseCase(outlineRepo, projectRepo, planningLLM);
  const outline = await generateOutline.execute({
    projectId: project.id,
  });
  assert.ok(outline.chapters.length >= 3, '大纲章节数异常');
  assert.ok(outline.chapters.every((ch) => ch.target && ch.target.trim().length > 0), '章节梗概未生成');

  // 3) 构造前文内容与摘要（模拟首章已完成）
  await chapterRepo.updateByProjectId(project.id, '01', {
    content: '第一章正文：明确项目背景、现状问题与目标边界。',
    summary: {
      mainPoint: '第一章核心观点：先定义问题边界，再确定目标。',
      keyPoints: ['背景现状', '关键问题', '目标边界'],
      conclusion: '后续章节应围绕该边界展开。',
    },
  });

  // 4) 模拟前端「章节 AI 首轮生成」并校验上下文装配
  const writingLLM = new InspectableWritingLLMAdapter();
  const indexAdapter = new SimpleIndexAdapter(basePath, { maxRelatedChapters: 5 });
  const generateContent = new GenerateContentUseCase(writingLLM, indexAdapter, chapterRepo);
  const aiResult = await generateContent.generate(project.id, '02', 'continue');
  assert.ok(aiResult.chapter, 'AI 未返回章节结果');
  assert.ok(aiResult.chapter.content.includes('首轮生成内容'), 'AI 首轮内容未写入章节');

  assert.ok(writingLLM.lastParams, '未捕获到 AI 入参');
  const secondChapter = outline.chapters.find((ch) => ch.number === '02');
  assert.ok(secondChapter, '缺少第二章大纲信息');

  assert.ok(
    writingLLM.lastParams.context.projectContext.includes('基于用户输入形成的全局背景'),
    '首轮生成未携带全局设定'
  );
  assert.ok(
    writingLLM.lastParams.context.relatedChapters.some((text) => text.includes('第一章核心观点')),
    '首轮生成未携带前文总结记忆'
  );
  assert.strictEqual(
    writingLLM.lastParams.chapter.target,
    secondChapter.target,
    '首轮生成未携带本节梗概'
  );

  console.log('Frontend full flow passed');
  console.log(`Runtime: ${basePath}`);
}

run().catch((error) => {
  console.error('Frontend full flow failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
