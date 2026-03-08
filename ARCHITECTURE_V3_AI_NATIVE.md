# ARCHITECTURE｜Zide V3 小说作者优先 AI Native 架构

版本：v3.0  
日期：2026-03-08  
状态：Draft  
文档类型：架构设计文档  
关联文档：`PRD_V3_AI_NATIVE.md`、`TODO_V3_AI_NATIVE.md`、`docs/AI_NATIVE_REDESIGN.md`

---

## 1. 架构目标与范围

### 1.1 目标一句话

在保留现有 Electron + React + Monorepo 骨架的前提下，把 Zide 从“通用长文 AI 工具”重构为“围绕世界观记忆、剧情推进、连续性审查和完稿收口构建的 AI Native 小说创作系统”。

### 1.2 本次架构重构的边界

保留：

1. Electron 主进程 / preload / renderer 结构
2. `domain / application / infrastructure / shared` 分层
3. 本地文件存储、快照、导出、日志
4. 现有 LLM 接入能力和 IPC 错误码收口方式

重构：

1. 产品模块命名与页面壳
2. AI 任务入口与运行时链路
3. 小说领域对象
4. 候选稿与连续性门禁
5. 长期记忆与 retcon 流程

暂不做：

1. 大规模拆包或引入新框架
2. 多人协作架构
3. 云端同步

### 1.3 架构原则

1. 产品模块先行，技术模块为产品模块服务。
2. 旧链路阶段性保留，采用兼容迁移而不是一次性推倒。
3. 先建立新状态机，再替换旧 UI 和旧用例。
4. AI 结果默认进入候选态，连续性通过后再进入正式正文。
5. 长期记忆只记录作者确认过的稳定信息。

---

## 2. 目标系统总览

### 2.1 分层架构

```text
┌──────────────────────────────────────────────────────────────┐
│ Electron Main / Preload / Renderer                          │
│ 页面壳、IPC、任务入口、运行轨迹、快照与导出                     │
└──────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌──────────────────────────────────────────────────────────────┐
│ Application Layer                                            │
│ StoryBible / PlotBoard / SceneSprint / ContinuityReview /    │
│ LoreMemory / ManuscriptCenter / TaskPipeline / Retcon        │
└──────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌──────────────────────────────────────────────────────────────┐
│ Domain Layer                                                 │
│ NovelProject / StoryBible / CharacterCard / PlotArc /        │
│ CandidateDraft / ContinuityReport / TaskRun / MemoryCard     │
└──────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌──────────────────────────────────────────────────────────────┐
│ Infrastructure Layer                                         │
│ File Repos / LLM Gateway / Prompt Registry / Continuity Gate │
│ Memory Store / Run Trace / Export / Snapshot                 │
└──────────────────────────────────────────────────────────────┘
```

### 2.2 产品模块到技术模块映射

| 产品模块 | Application 主用例 | Domain 主对象 | Infrastructure 主能力 |
|---|---|---|---|
| Story Bible Studio | `StoryBibleUseCases` | `StoryBible`, `CharacterCard`, `WorldRule` | `FileStoryBibleRepo`, `MemorySummarizer` |
| Plot Board | `PlotBoardUseCases` | `PlotArc`, `ChapterGoal`, `ForeshadowMarker` | `FilePlotRepo` |
| Scene Sprint | `SceneSprintUseCases`, `TaskPipelineUseCase` | `CandidateDraft`, `SceneTask` | `LLMGateway`, `PromptRegistry` |
| Continuity Review | `ContinuityReviewUseCases` | `ContinuityReport`, `ContinuityIssue` | `ContinuityGate`, `RuleEngine` |
| Lore Memory Center | `LoreMemoryUseCases` | `MemoryCard`, `TimelineEntry`, `RelationEdge` | `LongTermMemoryRepo` |
| Manuscript Center | `ManuscriptUseCases` | `ManuscriptReadiness`, `Snapshot` | `FileExportAdapter`, `FileSnapshotRepo` |
| Run Console | `TaskRunUseCases` | `TaskRun`, `RunStepTrace` | `RunTraceRepo`, `LLMCallLogger` |

---

## 3. 模块划分

## 模块划分

| 模块 | 职责边界 | 上游输入 | 下游输出 | 允许依赖 | 禁止依赖 |
|---|---|---|---|---|---|
| Story Bible Module | 管理故事种子、世界观、角色、规则、文风 | 项目创建输入、作者修订 | StoryBible、CharacterCard、WorldRule | Domain、Memory、LLM | 直接修改剧情正文 |
| Plot Board Module | 管理卷/幕/章骨架、节拍、伏笔 | StoryBible、作者规划 | PlotArc、ChapterGoal、ForeshadowMarker | StoryBible、LLM | 直接写候选稿 |
| Scene Sprint Module | 发起当前场景/章节写作任务 | 作者动作、章节目标、当前正文 | CandidateDraft、TaskRun | Router、Context、LLM | 直接写正式正文 |
| Continuity Review Module | 审查设定冲突、人物偏移、时间线问题 | CandidateDraft、StoryBible、LoreMemory | ContinuityReport、RevisionAdvice | RuleEngine、Memory、LLM | 直接修改 StoryBible |
| Lore Memory Module | 沉淀稳定记忆：角色、规则、关系、时间线、剧情决议 | 作者确认结果、Continuity 通过结果 | MemoryCard[] | Storage、Summarizer | 存储临时失败稿 |
| Manuscript Module | 计算成稿准备度，管理导出和快照 | 正式正文、Continuity 状态、快照 | ManuscriptReadiness、ExportRecord | Snapshot、Export | 直接调度 LLM |
| Task Router Module | 识别任务复杂度和执行路径 | TaskEnvelope、章节状态、历史失败信号 | RouteDecision | Domain、Trace | 直接写仓储 |
| Task Pipeline Module | 驱动 `Plan -> Execute -> Evaluate -> Revise` | RouteDecision、ContextSnapshot | CandidateDraft、RunTrace | Router、Context、Continuity | 直接操作 UI |
| Retcon Module | 记录设定变更及受影响范围 | 作者确认的 retcon | RetconDecision、AffectedRefs | StoryBible、PlotBoard、Continuity | 自动静默重写旧章节 |
| Run Trace Module | 记录 route、plan、critique、revision 过程 | Pipeline events、LLM calls | TaskRun、RunStepTrace | All AI runtime modules | 修改业务内容 |

---

## 4. 数据流

### 4.1 场景写作主流程

```text
作者在 Scene Sprint 发起任务
  -> 生成 TaskEnvelope
  -> Task Router 判断路径
  -> Context Builder 装配四层上下文
  -> Pipeline 生成 ExecutionPlan
  -> LLM Gateway 逐步生成 CandidateDraft
  -> Continuity Gate 生成 ContinuityReport
  -> 若通过：允许采纳到正式正文
  -> 若不通过：保留候选稿并给出 RevisionAdvice
  -> 作者可修正 / 采纳 / 放弃 / 声明 retcon
  -> 采纳后更新 Lore Memory、Run Trace、Manuscript Readiness
```

### 4.2 四层上下文在小说场景中的具体定义

| 层 | 内容 |
|---|---|
| system context | 产品规则、安全边界、输出 Schema、当前 agent 角色 |
| task context | 当前场景目标、章节目标、作者指令、当前任务路径 |
| working memory | 本次运行中已完成的子步骤、最近 critique 问题、revision 指令 |
| long-term memory | StoryBible、角色卡、世界规则、时间线、关系、已确认剧情决议 |

### 4.3 retcon 流

```text
作者确认某次冲突不是错误，而是要改设定
  -> 创建 RetconDecision
  -> 标记受影响角色/章节/时间线项
  -> 更新 StoryBible 或角色卡
  -> 将受影响章节加入复查队列
  -> 在 Continuity Review 中重新审查
```

---

## 5. 目录结构

## 目录结构

```text
Zide/
  apps/
    desktop/                               # 保留：桌面应用壳
      src/
        main/
          ipc/                             # 保留：IPC 层
            aiTask.ts                      # 新增：统一任务入口
            storyBible.ts                  # 新增：Story Bible IPC
            plotBoard.ts                   # 新增：Plot Board IPC
            sceneSprint.ts                 # 新增：Scene Sprint IPC
            continuity.ts                  # 新增：Continuity Review IPC
            loreMemory.ts                  # 新增：Lore Memory IPC
            manuscript.ts                  # 新增：Manuscript Center IPC
            runConsole.ts                  # 新增：Task Run IPC
          ai-runtime/                      # 新增：AI 运行时装配
            createTaskRunner.ts            # 组装 Router + Pipeline + Gate
            createContextBuilder.ts        # 组装四层上下文
            createPromptRegistry.ts        # 注册运行时 prompt
        renderer/
          features/                        # 新增：按产品模块组织页面
            overview/                      # Overview 页面
            story-bible/                   # Story Bible Studio
            plot-board/                    # Plot Board
            scene-sprint/                  # Scene Sprint
            continuity-review/             # Continuity Review
            lore-memory/                   # Lore Memory Center
            manuscript-center/             # Manuscript Center
            run-console/                   # Run Console
  packages/
    domain/
      src/
        novel/                             # 新增：小说领域对象
          NovelProject.ts
          StoryBible.ts
          CharacterCard.ts
          WorldRule.ts
          PlotArc.ts
          ChapterGoal.ts
          ForeshadowMarker.ts
          CandidateDraft.ts
          ContinuityReport.ts
          ContinuityIssue.ts
          RetconDecision.ts
          MemoryCard.ts
          ManuscriptReadiness.ts
          TaskRun.ts
    application/
      src/
        novel/                             # 新增：产品主用例
          storyBible/
          plotBoard/
          sceneSprint/
          continuity/
          loreMemory/
          manuscript/
          retcon/
        ai-native/                         # 新增：AI 核心工作流
          router/
          pipeline/
          context/
          prompts/
    infrastructure/
      src/
        storage/
          FileStoryBibleRepo.ts            # 新增
          FilePlotRepo.ts                  # 新增
          FileCandidateDraftRepo.ts        # 新增
          FileContinuityRepo.ts            # 新增
          FileMemoryRepo.ts                # 新增
          FileTaskRunRepo.ts               # 新增
        evaluation/
          ContinuityGate.ts                # 新增：连续性门禁
          CharacterConsistencyChecker.ts   # 新增
          TimelineChecker.ts               # 新增
        memory/
          LongTermMemoryRepo.ts            # 新增
          MemorySummarizer.ts              # 新增
        llm/
          LLMGateway.ts                    # 新增：统一调用与日志
          PromptRegistry.ts                # 新增：运行时 prompt 注册
          SchemaValidator.ts               # 新增：输出结构校验
        tracing/
          RunTraceRepo.ts                  # 新增：任务轨迹
          LLMCallLogger.ts                 # 新增：调用日志
  prompts/
    runtime/                              # 新增：运行时 prompt 主入口
      router/
      planner/
      generator/
      critic/
      reviser/
  runtime/
    projects/{projectId}/                 # 运行期项目目录
      story-bible/                        # 新增：世界观/角色/规则
      plot/                               # 新增：剧情骨架和伏笔
      chapters/                           # 保留：正式正文
      candidates/                         # 新增：候选稿
      continuity/                         # 新增：连续性报告
      memory/                             # 新增：长期记忆
      runs/                               # 新增：TaskRun 与步骤轨迹
      snapshots/                          # 保留：快照
      output/                             # 保留：导出
```

要求：

1. `apps/desktop/src/renderer/features/*` 必须按产品模块组织，不再按旧 Tab 功能混放。
2. `packages/domain/src/novel/*` 是小说领域的唯一真相源。
3. `prompts/runtime/*` 成为运行时主入口，旧 `prompts/global/*` 和 `prompts/agents/*` 先保留兼容。
4. `runtime/projects/{id}/candidates/` 与 `chapters/` 必须物理隔离。

---

## 6. 运行期项目结构

```text
runtime/projects/{projectId}/
├── meta/
│   └── project.json                    # 项目基础信息，保留
├── story-bible/
│   ├── story-bible.json               # 世界观与总体设定
│   ├── characters.json                # 角色卡
│   ├── world-rules.json               # 世界规则
│   ├── tone-guide.md                  # 文风与叙事语气
│   └── relations.json                 # 角色关系
├── plot/
│   ├── arcs.json                      # 卷/幕/剧情弧
│   ├── chapter-goals.json             # 章节目标
│   ├── beats.json                     # 剧情节拍
│   └── foreshadowing.json             # 伏笔与回收计划
├── chapters/
│   ├── 01.md                          # 正式正文
│   └── ...
├── candidates/
│   ├── 01/
│   │   ├── draft-001.md              # 候选稿
│   │   └── report-001.json           # 对应连续性报告摘要
│   └── ...
├── continuity/
│   ├── reports.jsonl                  # 连续性报告流
│   └── retcons.jsonl                  # retcon 决策流
├── memory/
│   ├── lore-cards.json                # 长期记忆卡
│   ├── timeline.json                  # 时间线
│   └── summaries.json                 # 章节/剧情摘要
├── runs/
│   ├── task-runs.jsonl                # 任务运行轨迹
│   └── llm-calls.jsonl                # LLM 调用摘要
├── snapshots/
│   ├── chapter/
│   └── global/
└── output/
    ├── manuscript.md
    ├── manuscript.html
    └── manuscript.pdf
```

---

## 7. 文件职责

## 文件职责

| 文件路径 | 所属模块 | 文件职责 | 输入 | 输出 | 维护边界 | 回归检查点 |
|---|---|---|---|---|---|---|
| `apps/desktop/src/main/ipc/aiTask.ts` | 任务入口 | 接收统一 TaskEnvelope 并转给 TaskPipeline | IPC 调用 | TaskRun / CandidateDraft | 不直接写仓储 | 旧入口可兼容映射 |
| `apps/desktop/src/renderer/features/story-bible/StoryBiblePage.tsx` | Story Bible Studio | 展示和编辑世界观、角色、规则 | StoryBible | 更新请求 | 不处理生成管线 | 保存后可回读 |
| `apps/desktop/src/renderer/features/scene-sprint/SceneSprintPage.tsx` | Scene Sprint | 展示正式正文、候选稿和任务入口 | Chapter、CandidateDraft | 作者任务 | 不直接运行 LLM | 候选稿与正文隔离展示 |
| `packages/application/src/novel/storyBible/StoryBibleUseCases.ts` | Story Bible | 管理 StoryBible 与角色卡 | Story seed、作者修订 | StoryBible | 不处理正文 | 角色卡和规则完整 |
| `packages/application/src/novel/plotBoard/PlotBoardUseCases.ts` | Plot Board | 管理剧情骨架和章节目标 | StoryBible | PlotArc、ChapterGoal | 不处理导出 | 卷/幕/章结构稳定 |
| `packages/application/src/novel/sceneSprint/SceneSprintUseCases.ts` | Scene Sprint | 驱动场景写作任务提交 | TaskEnvelope | CandidateDraft | 不直接采纳正文 | 候选稿总是先产出 |
| `packages/application/src/novel/continuity/ContinuityReviewUseCases.ts` | Continuity Review | 生成问题清单和修复建议 | CandidateDraft、StoryBible | ContinuityReport | 不直接改正文 | 至少产出问题类型和严重度 |
| `packages/application/src/novel/retcon/RetconUseCases.ts` | Retcon | 记录设定变更和受影响范围 | 作者确认 | RetconDecision | 不自动改历史正文 | 影响范围可回读 |
| `packages/application/src/ai-native/pipeline/TaskPipelineUseCase.ts` | AI Runtime | 驱动 PEER 闭环 | TaskEnvelope、ContextSnapshot | CandidateDraft、RunTrace | 不直接操作 UI | revise 上限有效 |
| `packages/infrastructure/src/evaluation/ContinuityGate.ts` | Evaluation | 整合规则和 LLM 生成连续性报告 | CandidateDraft、Memory | GateResult | 不直接采纳正文 | 连续性问题分类正确 |
| `packages/infrastructure/src/storage/FileCandidateDraftRepo.ts` | Storage | 存取候选稿和对应报告 | CandidateDraft | 持久化文件 | 不处理正式正文 | 物理目录隔离 |
| `packages/infrastructure/src/tracing/RunTraceRepo.ts` | Observability | 落盘任务运行轨迹 | RunStepTrace | jsonl log | 不改变业务状态 | 关键步骤留痕完整 |

---

## 8. 核心对象草案

## 核心对象草案

| 对象名 | 类型(Entity/ValueObject/Event/Config) | 所属模块 | 关键字段 | 生命周期/状态流转 | 关系约束 | 真相源 |
|---|---|---|---|---|---|---|
| NovelProject | Entity | Domain | projectId, title, status, activeArcId | 创建 -> 写作中 -> 收束中 -> 完稿 | 一个项目只对应一部作品 | Project repo |
| StoryBible | Entity | Story Bible | premise, theme, settingSummary, toneGuide | 创建后长期维护 | 依赖作者确认 | StoryBible repo |
| CharacterCard | Entity | Story Bible | characterId, traits, motives, voice, arcState | 可持续更新 | 角色卡变更需留痕 | StoryBible repo |
| WorldRule | Entity | Story Bible | ruleId, description, hardConstraint | 稳定规则，少量更新 | 影响 continuity 判断 | StoryBible repo |
| PlotArc | Entity | Plot Board | arcId, title, goal, beats, status | 草案 -> 确认 -> 推进中 -> 已完成 | 依赖 StoryBible | Plot repo |
| ChapterGoal | Entity | Plot Board | chapterId, objective, conflict, payoff | 随剧情推进更新 | 与章节正文一一对应 | Plot repo |
| CandidateDraft | Entity | Scene Sprint | draftId, chapterId, taskRunId, content, status | 生成 -> 待审 -> 可采纳/拒绝 | 不得直接替代正文 | CandidateDraft repo |
| ContinuityIssue | ValueObject | Continuity | type, severity, message, sourceRefs | 评审时生成 | 至少关联一个 source ref | ContinuityReport |
| ContinuityReport | Entity | Continuity | reportId, draftId, score, issues[] | 每次候选稿生成一份 | 与 CandidateDraft 一一对应 | Continuity repo |
| MemoryCard | Entity | Lore Memory | memoryId, kind, summary, sourceRefs, confidence | 仅在确认后写入 | 禁止记录临时失败稿 | Memory repo |
| RetconDecision | Entity | Retcon | retconId, changeSummary, affectedRefs, approvedAt | 作者确认后生效 | 必须记录影响范围 | Continuity repo |
| ManuscriptReadiness | Entity | Manuscript | readinessScore, blockers, completedChapters | 持续刷新 | 依赖正文和 continuity 状态 | Manuscript service |
| TaskRun | Entity | Run Console | runId, route, planSteps, finalStatus | 发起 -> 执行中 -> 已完成/失败 | 一个 run 绑定一个主任务 | RunTrace repo |

---

## 9. 迁移策略

### 9.1 兼容原则

1. 保留旧 `outline/chapter/check/export` IPC 和用例，先作为兼容层。
2. 新页面先通过新路由和 feature flag 暴露。
3. 旧 `GenerateContentUseCase` 在迁移期保留，但只作为 Scene Sprint 的低层生成能力。

### 9.2 迁移顺序

1. 先建新对象与新目录。
2. 再建新页面壳和统一任务入口。
3. 再引入候选稿与连续性门禁。
4. 最后把旧按钮式入口逐步退到兼容层。

### 9.3 不允许的迁移动作

1. 不允许一开始就删掉旧章节编辑器。
2. 不允许在未建立候选稿目录前直接改写正文链路。
3. 不允许在未定义 retcon 对象前把“改设定”写成隐式逻辑。

---

## 10. 下一步开发入口

## 下一步开发入口

- [ ] Step 1: 建立小说领域核心对象
  - 目标：新增 `StoryBible / CharacterCard / PlotArc / CandidateDraft / ContinuityReport / RetconDecision / ManuscriptReadiness`
  - 前置依赖：`PRD_V3_AI_NATIVE.md`
  - 变更范围：`packages/domain/src/novel`
  - 验收标准：对象边界清晰，候选稿与正文分离
  - 回滚点：旧对象保持不删

- [ ] Step 2: 收口统一任务入口与页面壳
  - 目标：建立 `aiTask.ts` 与新页面导航
  - 前置依赖：Step 1
  - 变更范围：`apps/desktop/src/main/ipc`、`apps/desktop/src/renderer/features`
  - 验收标准：新页面可访问，AI 请求形成 `TaskEnvelope`
  - 回滚点：旧导航和旧 IPC 继续保留

- [ ] Step 3: 落地候选稿与连续性门禁
  - 目标：把“生成即写入”改成“生成候选稿 -> Continuity Review -> 采纳”
  - 前置依赖：Step 1、Step 2
  - 变更范围：`application/novel/sceneSprint`、`application/novel/continuity`、`infrastructure/evaluation`
  - 验收标准：候选稿不直接污染正文，能生成连续性报告
  - 回滚点：保留旧直写链路的兼容开关

- [ ] Step 4: 落地 Lore Memory 与 Retcon Flow
  - 目标：把稳定设定与改设定流程产品化
  - 前置依赖：Step 3
  - 变更范围：`application/novel/retcon`、`infrastructure/memory`
  - 验收标准：记忆只写已确认信息，retcon 有影响范围
  - 回滚点：先只记录，不自动影响历史正文

- [ ] Step 5: 落地 Run Console 与 Manuscript Center
  - 目标：让作者看到运行轨迹和作品准备度
  - 前置依赖：Step 3、Step 4
  - 变更范围：`renderer/features/run-console`、`renderer/features/manuscript-center`
  - 验收标准：可查看 route/plan/critique，能看到 readiness 和阻塞项
  - 回滚点：仅展示摘要，不阻塞主写作链路

---

## 11. 当前架构定版

Zide V3 的架构重点不是“再做一个更复杂的生成器”，而是建立：

1. 小说领域对象的真相源。
2. 候选稿与正式正文的物理隔离。
3. 连续性门禁和 retcon 流。
4. 围绕 Story Bible / Plot / Scene / Continuity / Memory / Manuscript 的稳定模块边界。

只有这样，后续的 AI Router、PEER 闭环和长程记忆才会落在正确的产品骨架上。

