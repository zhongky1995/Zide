# ARCHITECTURE｜长文 AI 生产系统（MVP 架构方案）

版本：v1.0（评审版）  
日期：2026-02-24  
状态：Proposed（待确认后冻结）

---

## 1. 目标复述（Planner）

在严格遵守 `PRD.md` 的前提下，建设一个单用户、本地优先的长文 AI 生产系统 MVP，打通「创建 -> 章节推进 -> 整体检查 -> 导出」闭环，并确保全过程可追溯、可回滚、可测试。

### 1.1 本次范围（MVP / P0）

1. 项目创建向导与项目底座配置。
2. 大纲生成与编辑。
3. 章节工作台（编辑、状态、AI 意图操作）。
4. 上下文引擎（索引、检索、打包）。
5. 章节摘要与完成度更新。
6. 整体检查（缺章、术语冲突、重复、逻辑冲突）。
7. 快照与回滚（章节/全局）。
8. 导出中心（PDF / Markdown / HTML）。

### 1.2 非目标范围（本期不做）

1. 多人实时协同。
2. 复杂审批流与评论系统。
3. 插件市场与开放生态。
4. 专业出版级排版引擎。

### 1.3 架构硬约束

1. 单机本地优先，运行期数据落盘可读。
2. 任意 AI 写入可追溯到章节与轮次。
3. 任意 AI 写入可在 3 步内回滚。
4. 支撑 >= 10 万字项目的分段生成与管理。
5. 禁止跨层直连，必须走契约（port/interface）。

---

## 2. 需求评审结论

### 2.1 已确认且可直接落地的需求

1. 业务主链路明确，且流程边界清晰（创建 -> 生成 -> 检查 -> 导出）。
2. 核心对象稳定（Project / Chapter / Snapshot / Glossary / CheckIssue / ExportJob）。
3. 可观测性要求明确（生成、检查、导出均需日志与进度反馈）。
4. 风险优先级明确（先稳定性、回滚、检查能力，再扩展协同/插件）。

### 2.2 不确定点与选型对比

#### 不确定点 A：客户端技术形态

| 方案 | 收益 | 成本 | 风险 | 适用性 |
| --- | --- | --- | --- | --- |
| Electron + React + TypeScript | 生态成熟，Node 能力齐全，导出/文件访问方案多 | 包体较大 | 主进程安全边界需要严格控制 | **MVP 推荐** |
| Tauri + React + TypeScript | 体积小、资源占用低 | 需要 Rust 侧能力，团队门槛更高 | 跨栈调试成本高 | 适合后续性能优化阶段 |
| 浏览器前端 + 本地服务 | 前后端边界清晰 | 部署与进程管理复杂 | 本地权限、安装体验差 | 不适合当前单机 MVP |

#### 不确定点 B：内容存储策略

| 方案 | 收益 | 成本 | 风险 | 适用性 |
| --- | --- | --- | --- | --- |
| 纯 Markdown 文件存储 | 可读性高、便于手工修复 | 检索/统计性能有限 | 一致性检查实现复杂 | 仅适合极小规模 |
| Markdown 为主 + SQLite 索引与任务元数据 | 兼顾可读性与查询性能 | 需要双写一致性设计 | 索引失步需修复机制 | **MVP 推荐** |
| 纯数据库存储 | 查询性能好 | 可读性差，迁移成本高 | 用户无法直接恢复原文 | 不符合“项目化可交付”定位 |

#### 不确定点 C：一致性检查策略

| 方案 | 收益 | 成本 | 风险 | 适用性 |
| --- | --- | --- | --- | --- |
| 全规则引擎 | 结果可解释、稳定 | 覆盖复杂语义能力有限 | 漏检语义冲突 | 适合底线兜底 |
| 全 LLM 判断 | 语义能力强 | 成本高、波动大 | 误报/漏报不可控 | 不适合作为门槛条件 |
| 规则优先 + LLM 辅助复核 | 可解释且兼顾语义 | 实现复杂度中等 | 需要明确冲突仲裁策略 | **MVP 推荐** |

### 2.3 推荐方案（结论）

1. 客户端：Electron + React + TypeScript。
2. 存储：Markdown 为事实源（source of truth），SQLite 承载索引与任务元数据。
3. 检查：规则优先，LLM 仅作补充检测与建议，不直接覆盖硬性门禁结果。
4. 架构方法：分层 + 端口适配（Hexagonal-lite），先保边界清晰，再做性能优化。

---

## 3. 技术方案（目录边界与结构）

### 3.1 源码目录结构树（建议）

```text
Zide/
  PRD.md
  ARCHITECTURE.md
  TODO.md
  docs/
    adr/                              # 架构决策记录（可追溯）
    contracts/                        # 输入输出契约定义（DTO/Schema）
  apps/
    desktop/
      src/
        main/                         # Electron 主进程（窗口、菜单、任务调度）
        preload/                      # 安全桥接层（白名单 API）
        renderer/                     # UI 与页面状态管理
  packages/
    domain/
      src/entities/                   # 领域实体（Project/Chapter/Snapshot...）
      src/services/                   # 纯业务规则（不含 IO）
      src/errors/                     # 领域错误定义
    application/
      src/usecases/                   # 用例编排（创建/续写/检查/导出）
      src/ports/                      # 对外依赖抽象（LLM/存储/导出/索引）
    infrastructure/
      src/storage/                    # 文件系统 + SQLite 适配
      src/index/                      # 切片与检索实现
      src/llm/                        # 模型调用适配器
      src/export/                     # MD/HTML/PDF 导出适配器
    shared/
      src/types/                      # 跨层类型定义
      src/logger/                     # 结构化日志
      src/utils/                      # 无业务语义工具函数
  tests/
    unit/                             # 纯业务单测
    integration/                      # 端口契约与模块集成测试
    e2e/                              # 关键流程端到端测试
  runtime/
    projects/                         # 用户项目运行数据（非源码）
```

### 3.2 运行期项目目录结构（对用户可见）

```text
runtime/projects/{project_id}/
  meta/
    project.md                        # 项目基础信息
    constraints.md                    # 目标/限制/风格约束
    glossary.md                       # 术语表
  outline/
    outline.md                        # 章节骨架与章节目标
  chapters/
    01-intro.md
    02-problem.md
    ...
  snapshots/
    chapter/                          # 章节快照
    global/                           # 全局快照
  artifacts/
    references/                       # 附件与参考资料
  output/
    final.md
    final.html
    final.pdf
  logs/
    operations.log                    # 操作事件日志（可追溯）
```

---

## 4. 职责定义文档

### 4.1 模块职责与输入输出

| 模块 | 目录 | 输入 | 输出 | 依赖 | 禁止项 |
| --- | --- | --- | --- | --- | --- |
| 项目初始化 | `packages/application/src/usecases/project-init` | 项目类型、读者、规模、底座信息 | 项目目录与初始元数据 | `ProjectRepoPort` | 禁止直接操作 UI 状态 |
| 结构规划 | `.../outline` | 底座信息、模板、人工编辑指令 | `outline.md` 与章节目标 | `LLMPort`、`OutlineRepoPort` | 禁止跨层调用基础设施实现类 |
| 章节工作台 | `.../chapter-workbench` | 章节内容、AI 意图、手工编辑 | 新版章节正文、摘要、完成度 | `ContextPort`、`LLMPort`、`ChapterRepoPort` | 禁止绕过快照流程直接覆盖 |
| 上下文引擎 | `packages/infrastructure/src/index` + `application/usecases/context` | 当前章节、相关章节、术语、限制 | 上下文包（有来源记录） | `IndexPort` | 禁止无来源上下文注入 |
| 质量校验 | `.../quality-check` | 全量章节、术语表、章节目标 | 问题清单 `CheckIssue[]` | `RuleEnginePort`、`LLMReviewPort` | 禁止“仅 LLM 结论即阻断导出” |
| 版本控制 | `.../snapshot` | 章节版本、全局状态 | 快照记录、回滚结果 | `SnapshotRepoPort` | 禁止跨模块修改快照内容 |
| 导出模块 | `.../export` | 章节合并内容、目录、模板参数 | `final.md/html/pdf`、任务日志 | `ExportPort` | 禁止直接读取未通过门槛的数据 |

### 4.2 核心调用关系（硬规则）

1. `renderer -> application(usecases) -> domain + ports -> infrastructure(adapter)` 单向依赖。
2. `domain` 层不允许 import `infrastructure`。
3. `renderer` 不允许直接读写 `runtime/projects` 文件。
4. 任何 AI 生成操作必须先走 `context-pack`，再调用 `LLMPort`。
5. 任何会修改正文的操作必须先建快照，再写入章节文件。

### 4.3 变更影响与回归检查点

| 变更类型 | 影响范围 | 必做回归 |
| --- | --- | --- |
| 章节数据结构变更 | 上下文引擎、检查模块、导出模块 | 10 轮续写稳定性测试 + 导出三格式一致性 |
| 检索排序策略变更 | AI 生成质量与跑题率 | 连续续写跑题率、采纳率、回滚次数对比 |
| 快照格式变更 | 回滚与差异比较 | 任意章节 3 步回滚演练 |
| 导出模板变更 | 交付文件格式和成功率 | PDF/MD/HTML 成功率与样式验收 |
| 模型供应商切换 | 生成质量与成本 | 关键场景回放测试 + 异常重试路径 |

---

## 5. 非功能设计（MVP 最小集）

1. 可观测性：所有生成/检查/导出任务记录 `operationId`、耗时、输入摘要、错误码。
2. 错误恢复：导出失败必须保留中间产物和失败章节列表，支持增量重试。
3. 性能基线：10 万字项目执行检查与导出时，UI 不阻塞，任务可中断/可继续。
4. 安全边界：仅 preload 暴露白名单 API；文件系统访问仅限 `runtime/projects`。

---

## 6. 确认门禁（必须）

当前文档只定义架构与执行边界，不包含业务实现。  
进入编码前需确认两点：

1. 是否接受推荐技术栈（Electron + React + TypeScript + SQLite）。
2. 是否按 `TODO.md` 的 Step 顺序单线程推进（每次只做一个 Step）。

