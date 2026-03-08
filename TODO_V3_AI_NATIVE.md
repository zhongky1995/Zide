# TODO｜Zide V3 小说作者优先重构执行清单

版本：v3.0  
日期：2026-03-08  
状态：Draft  
关联文档：`PRD_V3_AI_NATIVE.md`、`ARCHITECTURE_V3_AI_NATIVE.md`、`docs/AI_NATIVE_REDESIGN.md`

---

## 执行原则

1. 先做小说创作主链路，再做 AI 深能力。
2. 先建立新入口和新状态，再替换旧生成链路。
3. 所有 AI 结果先进入候选态，不允许直接污染正式正文。
4. 一次只推进一个可验证闭环。
5. 每一步都必须有回滚点。

---

## Phase 0｜产品冻结

- [ ] Step P1：冻结 V3.0 小说作者优先产品定义
  - 目标：确认主用户、主场景、MVP 范围、页面结构和核心业务规则
  - 前置依赖：`PRD_V3_AI_NATIVE.md`
  - 变更范围：产品文档
  - 验收标准：
    1. 确认 `Story Bible / Plot Board / Scene Sprint / Continuity Review / Lore Memory / Manuscript Center / Run Console` 7 个产品模块；
    2. 确认任务型入口替代按钮型入口；
    3. 确认候选稿、Continuity Review、Manuscript Readiness 为 P0
  - 回滚点：保留旧 `PRD.md` 作为兼容口径

---

## Phase 1｜架构收口

- [x] Step A1：定义 V3 核心对象与状态机
  - 目标：补齐 `StoryBible / CharacterCard / WorldRule / PlotArc / CandidateDraft / ContinuityReport / ManuscriptReadiness / RetconDecision / MemoryCard`
  - 前置依赖：Step P1
  - 变更范围：`packages/domain`、架构文档
  - 验收标准：
    1. 每个对象有唯一主责；
    2. 候选稿与正式正文状态分离；
    3. retcon 生命周期清晰；
    4. 长期记忆只记录已确认稳定信息
  - 完成日期：2026-03-08
  - 完成说明：
    1. 已新增 `packages/domain/src/novel/*` 领域对象与状态类型；
    2. 已建立候选稿、连续性报告、retcon、长期记忆、成稿准备度等真相源；
    3. 已更新 `@zide/domain` 根导出并通过 `npm run build -w @zide/domain`
  - 回滚点：不删除旧对象，只新增 V3 对象

- [x] Step A2：收口统一任务入口
  - 目标：用 `TaskEnvelope` 替代分散的 AI 按钮调用参数
  - 前置依赖：Step A1
  - 变更范围：`apps/desktop/src/main/ipc`、`packages/application`
  - 验收标准：
    1. AI 请求都有统一任务模型；
    2. 可以标识 scene/chapter/arc 等 targetRef；
    3. 旧入口可兼容映射到新入口
  - 完成日期：2026-03-08
  - 完成说明：
    1. 已新增 `TaskEnvelope / TaskRouteDecision / TaskExecutionBridgeResult` 领域类型；
    2. 已新增 `apps/desktop/src/main/ipc/aiTask.ts`，统一收口 `ai:task` 并保留旧 `ai:*` 入口兼容；
    3. 已打通 `preload -> renderer api`，小说任务可从新入口进入主进程；
    4. 已通过整仓 `npm run build`
  - 回滚点：旧 IPC 保留兼容层

- [x] Step A3：定义 V3 页面壳与导航
  - 目标：将页面结构收口为 `Overview / Story Bible / Plot Board / Scene Sprint / Continuity Review / Lore Memory / Manuscript Center / Run Console`
  - 前置依赖：Step P1
  - 变更范围：`apps/desktop/src/renderer`
  - 验收标准：
    1. 新导航结构可进入；
    2. 每个页面有明确占位态；
    3. 旧页面不被硬删除
  - 完成日期：2026-03-08
  - 完成说明：
    1. 已新增 `/novel` 与 `/novel/:projectId` 路由，并将小说项目优先导向新页面壳；
    2. 已落地 `Overview / Story Bible / Plot Board / Scene Sprint / Continuity Review / Lore Memory / Manuscript Center / Run Console` 八个入口态；
    3. 旧 `/project/*` 工作台仍保留，未被硬删除；
    4. 已通过整仓 `npm run build`
  - 回滚点：通过 feature flag 切回旧导航

---

## Phase 2｜产品主链路

- [ ] Step B1：落地 Story Bible Studio
  - 目标：把项目启动从“创建长文项目”升级为“生成可确认的故事底座”
  - 前置依赖：Step A1、Step A3
  - 变更范围：项目创建流程、`renderer`、`application`
  - 验收标准：
    1. 作者输入故事种子后可得到 Story Bible 草案；
    2. 可生成角色卡、世界规则和叙事语气建议；
    3. 可进入 Plot Board
  - 当前进展（2026-03-08）：
    1. 小说项目创建后已自动落 Story Bible 草案；
    2. `/novel/:projectId` 已支持 Story Bible 的读取、AI 重新生成、编辑、保存和确认；
    3. 与完整 B1 的差距在于角色卡和世界规则还未拆成独立对象与页面
  - 回滚点：旧项目创建表单仍可用

- [ ] Step B2：落地 Plot Board V3
  - 目标：让剧情结构带有卷/幕/章节目标、节拍和伏笔标记
  - 前置依赖：Step B1
  - 变更范围：大纲模块、`renderer`、`application`
  - 验收标准：
    1. 卷/幕/章节结构可编辑；
    2. 章节目标和关键冲突可编辑；
    3. 可记录伏笔与回收标记；
    4. 确认后可进入 Scene Sprint
  - 当前进展（2026-03-08）：
    1. 已新增 `chapter-goals` 真仓储，Plot Board 会从 Outline 自动同步章节目标；
    2. 已支持章节标题、目标、关键冲突、情绪变化、本章回报的编辑与保存；
    3. 与完整 B2 的差距在于还未支持卷/幕分层和伏笔回收标记
  - 回滚点：保留旧大纲编辑器

- [ ] Step B3：落地 Scene Sprint 基础版
  - 目标：用任务型入口替代六个分散 AI 按钮
  - 前置依赖：Step A2、Step A3、Step B2
  - 变更范围：章节编辑器 UI、任务入口、AI 请求组装
  - 验收标准：
    1. 页面仅暴露 `快速润色 / 推进场景 / 深改剧情` 三类入口；
    2. 作者可对当前场景或章节提交任务；
    3. 正式正文与候选稿区分展示
  - 当前进展（2026-03-08）：
    1. 已在 `/novel/:projectId` 的 Scene Sprint 模块收口为三类入口；
    2. 已通过统一 `ai:task` 为当前章节发起任务；
    3. 与完整 B3 的差距在于还未接入真正的 Plot Board V3 场景目标结构
  - 回滚点：旧按钮作为隐藏兼容入口保留

- [ ] Step B4：落地候选稿机制
  - 目标：AI 结果先进入候选态，而不是直接写正式正文
  - 前置依赖：Step B3
  - 变更范围：`packages/domain`、`application`、`chapter repo`、`renderer`
  - 验收标准：
    1. AI 结果默认不覆盖正式正文；
    2. 候选稿可查看、比较、采纳、放弃；
    3. 采纳前可进入 Continuity Review
  - 当前进展（2026-03-08）：
    1. 新 `ai:task` 已默认生成候选稿，不再直接覆盖正文；
    2. 已新增候选稿文件仓储、列表、采纳、放弃链路；
    3. 普通采纳已开始受 Continuity Review 门禁约束；
    4. 与完整 B4 的差距在于候选稿还未支持正文差异对比视图
  - 回滚点：保留旧“直接写入”开关但默认关闭

- [ ] Step B5：落地 Continuity Review
  - 目标：把设定冲突、人物偏移和时间线问题收口到一个主页面
  - 前置依赖：Step B4
  - 变更范围：检查页、生成页、问题状态模型
  - 验收标准：
    1. 候选稿可显示连续性评分和问题清单；
    2. 作者可从问题跳回场景或章节；
    3. 作者可执行修正、采纳或声明 retcon
  - 当前进展（2026-03-08）：
    1. 候选稿生成后已自动产出 continuity report；
    2. `/novel/:projectId` 已支持 Continuity Review 页面、问题列表、重评估、普通采纳与强制采纳；
    3. 强制采纳前会自动创建章节快照；
    4. 与完整 B5 的差距在于还未接入 retcon 决策流
  - 回滚点：旧检查页保留只读模式

- [ ] Step B6：落地 Lore Memory Center
  - 目标：把世界观、角色和时间线记忆可视化
  - 前置依赖：Step A1、Step B5
  - 变更范围：`renderer`、`memory`
  - 验收标准：
    1. 可展示角色卡、规则卡、时间线卡；
    2. 每条记忆有来源和更新时间；
    3. 作者可纠正错误记忆
  - 当前进展（2026-03-08）：
    1. 已新增 `memory-cards` 真仓储与 Lore Memory IPC；
    2. 已支持从已确认 Story Bible 和已完成章节目标同步长期记忆卡；
    3. `/novel/:projectId` 已支持查看与手动同步 Lore Memory；
    4. 与完整 B6 的差距在于角色、关系、时间线还未拆成独立卡系
  - 回滚点：先只读展示，不直接改写下游逻辑

- [ ] Step B7：落地 Manuscript Center V3
  - 目标：将导出中心升级为成稿收口中心
  - 前置依赖：Step B5
  - 变更范围：导出页、项目状态统计
  - 验收标准：
    1. 页面显示 Manuscript Readiness；
    2. 阻塞问题可跳转修复；
    3. 导出记录与快照共存展示
  - 当前进展（2026-03-08）：
    1. 已新增 `manuscript:getReadiness` 计算成稿准备度；
    2. `/novel/:projectId` 已展示 readiness 分数与阻塞项；
    3. 旧导出页仍保留为兼容入口；
    4. 与完整 B7 的差距在于还未合并导出记录与快照时间线
  - 回滚点：旧导出逻辑不变，只增强前端

---

## Phase 3｜AI Native 内核

- [ ] Step C1：接入 Task Router
  - 目标：让系统决定任务走哪条执行路径
  - 前置依赖：Step A2、Step B3
  - 变更范围：`packages/application/src/ai-native/router`、Prompt Registry
  - 验收标准：
    1. 每次任务都有 route 决策；
    2. 至少区分 low / medium / high 三类复杂度；
    3. 路由结果可在 Run Console 中展示
  - 当前进展（2026-03-08）：
    1. 已将 `aiTask.ts` 中的临时路由逻辑抽到 `TaskRouterUseCase`；
    2. Router 已开始综合任务类型、补充说明、章节长度、Plot Board、Story Bible 状态来决定路径；
    3. Run Console 已展示 route signals；
    4. 与完整 C1 的差距在于还未接 Prompt Registry 和更细粒度的复杂度分类
  - 回滚点：路由失败时退回默认标准路径

- [x] Step C2：接入 PEER 推理闭环
  - 目标：建立 `Plan -> Execute -> Evaluate -> Revise`
  - 前置依赖：Step C1
  - 变更范围：`packages/application/src/ai-native/pipeline`
  - 验收标准：
    1. 每个任务有 plan；
    2. 生成结果有 evaluate；
    3. evaluate 不通过时可 revise；
    4. 超过上限会停止并提示作者人工介入
  - 当前进展（2026-03-08）：
    1. 已新增 `TaskPipelineUseCase`，统一承接 `Plan -> Execute -> Evaluate -> Revise`；
    2. `ai:task` 不再直接单轮生成，而是按 route 执行 0-2 轮自动修订；
    3. 最终连续性未通过时会停止自动处理，并在 Run Console 明确提示作者人工介入；
    4. 多轮 attempt 已回传到前端，作者可以看到每一轮候选稿和连续性得分
  - 回滚点：退回单轮生成 + Continuity Review 手动处理

- [x] Step C3：落地 Continuity Gate
  - 目标：把连续性门禁嵌入生成主链路
  - 前置依赖：Step C2、Step B5
  - 变更范围：`evaluation`、`check`、候选稿流转
  - 验收标准：
    1. 生成后自动产生 continuity report；
    2. 至少覆盖设定冲突、人物偏移、时间线问题；
    3. 未通过结果不得直接进入正式正文
  - 当前进展（2026-03-08）：
    1. 候选稿生成后已自动产出 continuity report，并在采纳前做门禁校验；
    2. 已覆盖世界规则冲突、Plot Board 目标偏离、人物情绪弧线缺失、语气漂移、基础时间线异常；
    3. 普通采纳仍受门禁限制，强制采纳会先自动创建章节快照；
    4. 当前版本已满足 C3 验收标准；后续如继续升级，可再接角色卡、关系图谱和更强的时间线模型
  - 回滚点：门禁异常时退回候选稿待人工判断

- [x] Step C4：落地四层记忆系统
  - 目标：建立 `system / task / working / long-term` 四层上下文
  - 前置依赖：Step C2
  - 变更范围：`context`、`memory`、`index`
  - 验收标准：
    1. Run Console 可看到四层上下文摘要；
    2. 长期记忆只存已确认世界观、角色与剧情决议；
    3. Lore Memory Center 可消费这些记忆
  - 当前进展（2026-03-08）：
    1. 已新增 `TaskContextUseCase`，从章节、Plot Board、Story Bible、Lore Memory、Continuity Report 装配四层上下文；
    2. `TaskPipelineUseCase` 会把四层上下文注入实际生成 prompt，而不是只做展示；
    3. Run Console 已展示 `system / task / working / long-term` 四层摘要；
    4. 长期记忆仍只来自已确认 Story Bible 与已完成章节目标，Lore Memory Center 可继续消费同一批 Memory Card
  - 回滚点：旧 `ContextPack` 继续可用

- [x] Step C5：落地 Retcon Flow
  - 目标：把“我决定改设定”变成系统能力
  - 前置依赖：Step B5、Step C4
  - 变更范围：`domain`、`application`、`renderer`
  - 验收标准：
    1. 作者可声明一次 retcon；
    2. 系统记录受影响角色/章节；
    3. retcon 后可触发复查
  - 当前进展（2026-03-08）：
    1. 已新增 `Retcon Flow` 模块，作者可在工作台直接创建 retcon 提案；
    2. 提案会记录受影响章节与角色；
    3. 批准后自动创建快照，并把决策写入长期记忆；
    4. 已批准 retcon 可一键跳转到 `Continuity Review` 做复查
  - 回滚点：先仅记录，不自动改写历史章节

- [x] Step C6：落地 Run Console
  - 目标：让 AI 过程可解释、可追踪
  - 前置依赖：Step C1、Step C2、Step C3
  - 变更范围：`renderer`、`tracing`
  - 验收标准：
    1. 展示 route、plan、critique、revision；
    2. 作者可查看最近任务；
    3. 失败任务可定位原因
  - 当前进展（2026-03-08）：
    1. Run Console 已展示 route、PEER 步骤、attempt trace 与四层上下文；
    2. 已支持查看最近 8 次任务；
    3. 失败任务可通过 step status、evaluate note、revise note 定位原因
  - 回滚点：先展示摘要，详细追踪可延后

---

## Phase 4｜质量验收

- [ ] Step Q1：主流程验收
  - 目标：验证 `Story Bible -> Plot Board -> Scene Sprint -> Continuity Review -> Manuscript Center`
  - 前置依赖：Phase 2 完成
  - 变更范围：E2E 与手工验收脚本
  - 验收标准：
    1. 主流程可跑通；
    2. AI 结果进入候选稿；
    3. 通过采纳后进入正式正文；
    4. Manuscript Center 显示准备度
  - 当前进展（2026-03-08）：
    1. 已交付手工验收脚本 [QA_V3_AI_NATIVE.md](./QA_V3_AI_NATIVE.md)；
    2. 仍待真人按脚本逐步点击验收
  - 回滚点：保留旧项目页可直接进入编辑

- [ ] Step Q2：异常流程验收
  - 目标：验证 3 条关键异常链路
  - 前置依赖：Phase 3 完成
  - 变更范围：QA 用例
  - 验收标准：
    1. 连续性不通过时不污染正文；
    2. 强制采纳时自动创建快照；
    3. retcon 后可定位受影响章节
  - 当前进展（2026-03-08）：
    1. 已交付异常流程验收脚本 [QA_V3_AI_NATIVE.md](./QA_V3_AI_NATIVE.md)；
    2. 仍待真人执行确认
  - 回滚点：异常流程失败时关闭对应增强能力

- [ ] Step Q3：指标埋点验收
  - 目标：确保 v3 指标可观测
  - 前置依赖：Phase 3 完成
  - 变更范围：metrics、run trace
  - 验收标准：
    1. 能记录 scene task completion；
    2. 能记录 continuity pass rate；
    3. 能记录 revision rounds；
    4. 能记录 forced accept 和 retcon
  - 当前进展（2026-03-08）：
    1. `ai:task` 已写入任务完成、连续性结果、revision rounds 与 attempt count；
    2. 候选稿采纳已写入 forced accept 埋点；
    3. retcon approve / rollback 已写入独立埋点；
    4. 剩余工作是跑真实链路并读取日志做验收确认
  - 回滚点：指标失败不阻塞主链路

---

## 当前建议执行位

建议下一步继续进入 Developer 阶段，优先推进：

1. Step Q1：按 [QA_V3_AI_NATIVE.md](./QA_V3_AI_NATIVE.md) 跑主流程验收
2. Step Q2：按 [QA_V3_AI_NATIVE.md](./QA_V3_AI_NATIVE.md) 跑异常流程验收
3. Step Q3：触发一轮真实任务与 retcon，检查 `.logs` 中的指标记录

原因：

当前产品和架构侧的核心闭环已经基本完成，剩下的是验收与观测确认。下一阶段重点不再是继续堆功能，而是验证主流程、异常流程和指标是否都按预期落地。
