# Zide 系统架构文档

版本：v1.3
日期：2026-02-26
状态：Active

---

## 1. 系统概述

### 1.0 体检结论（2026-02-26）

本次项目级检查发现，历史文档状态与真实运行状态存在偏差，主要问题集中在“前后端契约未对齐”而非单点算法能力：

1. 大纲生成后未落地章节文件，导致章节工作台为空，AI 按钮无可操作对象。
2. 导出格式值前后端不一致（`markdown` vs `md`），导出历史返回结构与前端预期不一致。
3. 快照按 `snapshotId` 回查逻辑错误，导致回滚链路失效。
4. 根构建脚本未包含 `@zide/infrastructure`，容易出现“源码已改但运行仍旧代码”的假象。
5. 测试脚本存在自调用死循环，导致集成测试不可用。

已完成修复：

1. 大纲保存时自动确保章节桩文件存在，章节工作台可立即编辑并可触发 AI。
2. 导出格式与历史返回完成契约归一，导出链路可用。
3. 快照查找/章节回滚链路修复。
4. 根构建脚本纳入 `@zide/infrastructure`。
5. 集成测试脚本改为安全占位，避免递归进程风暴。

### 1.1 项目定位

**Zide** 是一个长文 AI 生产系统，目标是把"长文写作"变成"可回滚、可检查、可交付的项目化生产流程"。

### 1.2 核心价值

- **可回滚**：任意 AI 生成操作可在 3 步内回滚
- **可检查**：整体检查确保内容一致性（缺章、术语冲突、重复检测）
- **可交付**：支持 MD/HTML/PDF 多格式导出
- **可追溯**：所有 AI 生成操作记录操作历史，采纳率可统计
- **可配置**：灵活的 AI 提供商和参数配置
- **可备份**：项目数据自动/手动备份，支持恢复

### 1.3 技术栈

| 层级 | 技术选型 |
|------|----------|
| 桌面框架 | Electron |
| 前端框架 | React + TypeScript |
| 构建工具 | Monorepo (npm workspaces) |
| 存储策略 | Markdown 文件存储 + JSON 索引 |
| AI 接入 | OpenAI / Anthropic Claude / MiniMax / Kimi |

### 1.4 运行路径约定

运行时数据默认落盘到 Electron `userData` 目录下的 `projects/`（而不是仓库内 `runtime/projects/`）。

说明：
1. 这是当前代码真实行为，文档与实现已对齐到该约定。
2. `runtime/` 目录可继续作为样例/开发参考目录，但不作为主运行目录来源。

---

## 2. 整体架构

### 2.1 分层架构

```
┌─────────────────────────────────────────────────────────────┐
│                    Electron Main Process                     │
│              (IPC 处理器、窗口管理、菜单、系统集成)           │
├─────────────────────────────────────────────────────────────┤
│                       Preload Bridge                         │
│                    (安全 API 白名单暴露)                      │
├─────────────────────────────────────────────────────────────┤
│                       React UI Layer                         │
│              (项目管理、章节工作台、检查中心)                 │
├─────────────────────────────────────────────────────────────┤
│                     Application Layer                         │
│          (用例：CreateProject, Outline, ChapterWorkbench,    │
│           GenerateContent, Context, Check, Export, Metrics) │
├─────────────────────────────────────────────────────────────┤
│                       Domain Layer                           │
│    (实体：Project, Chapter, Outline, Snapshot, Glossary,    │
│     CheckIssue, ExportJob, OperationLog + 领域服务)         │
├─────────────────────────────────────────────────────────────┤
│                     Infrastructure Layer                     │
│  (FileProjectRepo, FileChapterRepo, SimpleIndex,            │
│   RealLLMAdapter, SimpleRuleEngine, FileExportAdapter)     │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 模块依赖规则

1. **单向依赖**：renderer -> application -> domain + ports -> infrastructure
2. **禁止跨层**：domain 层不允许 import infrastructure 层实现类
3. **端口隔离**：application 层通过 port 接口依赖 infrastructure
4. **文件隔离**：renderer 不允许直接读写 runtime/projects 文件

### 2.3 关键契约（新增）

为避免“按钮可见但不可用”的回归，以下契约作为必须遵守项：

1. **大纲-章节契约**：`outline:generate` 成功后，必须保证章节文件已创建（至少桩文件）。
2. **导出格式契约**：导出格式统一使用 `md | html | pdf`，UI 展示文案与传输值分离。
3. **导出历史契约**：IPC 返回数组列表（或由 API 层兼容对象结构并归一为数组）。
4. **快照回滚契约**：`snapshotId` 不能推断 `projectId`，必须按目录扫描定位。
5. **构建契约**：根 `build` 必须包含 `@zide/infrastructure`，否则桌面端运行时与源码可能不一致。

### 2.4 部分重构落地（2026-02-26）

本轮部分重构（可持续维护向）已落地以下基础设施：

1. **主进程路径收口**：新增 `main/runtimePaths.ts`，统一 runtime 根路径获取，IPC 模块不再各自维护路径逻辑。
2. **IPC 响应与错误码收口**：新增 `ipc/response.ts`，全部主 IPC 模块统一通过 `runIpc` 返回 `success/error/code/details`。
3. **主进程可观测性补齐**：新增 `main/logger.ts`，并在主进程注册未捕获异常日志与 IPC 失败结构化落盘。
4. **前端错误链路收口**：renderer API 层改为统一错误事件（`zide:api-error`），UI 按“配置/数据/系统”分类 toast 呈现，移除阻塞式 `alert`。
5. **最小集成回归**：新增 `scripts/test-integration-core-flow.js`，覆盖“项目创建 -> 大纲 -> AI -> 导出 -> 快照回滚”闭环。

---

## 3. 目录结构

### 3.1 源码目录

```
Zide/
├── apps/desktop/               # Electron 主应用
│   ├── src/main/              # 主进程（IPC 处理器）
│   ├── src/preload/           # 安全桥接层
│   └── src/renderer/          # React UI
├── packages/
│   ├── domain/                # 领域实体与服务
│   │   └── src/
│   │       ├── entities/     # Project, Chapter, Outline, Snapshot, Settings, Backup
│   │       ├── services/    # ProjectService
│   │       ├── errors/       # DomainError
│   │       └── ports/        # MetricsPort
│   ├── application/           # 用例与端口
│   │   └── src/
│   │       ├── usecases/     # 11 大用例
│   │       └── ports/        # LLMPort, IndexPort, ExportPort, SettingsPort, BackupPort
│   ├── infrastructure/        # 适配器实现
│   │   └── src/
│   │       ├── storage/      # FileProjectRepo, FileChapterRepo, FileSettingsRepo, FileBackupRepo
│   │       ├── llm/          # MockLLMAdapter, RealLLMAdapter
│   │       ├── index/        # SimpleIndex
│   │       ├── check/        # SimpleRuleEngine
│   │       ├── export/       # FileExportAdapter
│   │       ├── metrics/      # FileMetricsAdapter
│   │       ├── cache/        # MemoryCache, DiskCache
│   │       └── backup/       # ZipBackupAdapter
│   └── shared/                # 跨层类型/工具
├── runtime/                    # 用户项目数据
│   ├── projects/             # 项目数据
│   ├── backups/              # 备份文件
│   └── config/               # 应用配置
└── tests/                     # 测试目录
```

### 3.2 运行期项目结构

```
runtime/
├── projects/{project_id}/
│   ├── meta/
│   │   ├── project.json           # 项目元数据
│   │   └── glossary.json          # 术语表
│   ├── outline/
│   │   └── outline.json           # 大纲数据
│   ├── chapters/
│   │   ├── {chapter_id}.md       # 章节内容
│   │   └── ...
│   ├── snapshots/
│   │   ├── chapter/              # 章节快照
│   │   └── global/               # 全局快照
│   ├── output/
│   │   ├── final.md
│   │   ├── final.html
│   │   └── final.pdf
│   ├── .index.json               # 章节索引
│   └── metrics.json              # 操作统计
├── backups/                       # 备份存储
│   ├── {project_id}/
│   │   ├── {timestamp}.zip       # 备份归档
│   │   └── manifest.json         # 备份清单
│   └── ...
├── config/
│   ├── settings.json              # 应用设置
│   ├── llm-providers.json        # LLM 提供商配置
│   └── window-state.json         # 窗口状态
└── logs/                         # 日志文件
    └── app.log
```

---

## 4. 核心模块

### 4.1 项目管理

**功能**：创建、编辑、删除项目，元数据管理

**核心实体**：
- `Project` - 项目基本信息（id, name, type, status, meta）
- `ProjectType` - 项目类型（proposal, report, research, novel, other）
- `ProjectStatus` - 项目状态（draft, in_progress, review, completed, archived）

**用例**：`CreateProjectUseCase`

### 4.2 大纲管理

**功能**：生成、编辑章节大纲

**核心实体**：
- `Outline` - 大纲结构（projectId, chapters, status）
- `OutlineChapter` - 章节大纲（id, title, target, status）

**用例**：`OutlineUseCases`

**流程**：
1. 收集项目背景、目标、术语
2. 调用 LLM 生成大纲
3. 用户确认/编辑大纲
4. 更新大纲状态

### 4.3 章节工作台

**功能**：Markdown 编辑，状态流转

**核心实体**：
- `Chapter` - 章节（id, title, content, status, summary, target）
- `ChapterStatus` - 状态（todo, in_progress, review, completed）
- `AIOperation` - AI 操作记录（id, intent, input, output, adopted）

**用例**：`ChapterWorkbenchUseCase`

**状态流转**：
```
TODO -> IN_PROGRESS -> REVIEW -> COMPLETED
  ^         |            |
  └─────────┴────────────┘ (可回退)
```

### 4.4 AI 内容生成

**功能**：6 种 AI 意图，支持上下文感知的续写/扩写

**核心实体**：
- `ChapterIntent` - 意图类型
  - `CONTINUE` - 续写
  - `EXPAND` - 扩写
  - `REWRITE` - 重写
  - `ADD_ARGUMENT` - 补论证
  - `POLISH` - 润色
  - `SIMPLIFY` - 简化

**用例**：`GenerateContentUseCase`

**核心流程**：
```typescript
// 1. 获取章节信息
const chapter = await chapterRepo.findByChapterId(projectId, chapterId);

// 2. 打包上下文
const contextPack = await indexPort.packContext(projectId, chapterId);

// 3. 调用 LLM 生成
const result = await llmPort.generate({
  context: { projectContext, relatedChapters, glossary, outline },
  chapter: { id, title, content, target },
  intent,
  customPrompt
});

// 4. 保存操作记录
await chapterRepo.saveOperation(projectId, chapterId, operation);

// 5. 更新章节内容
await chapterRepo.updateContent(projectId, chapterId, newContent);

// 6. 更新索引
await indexPort.indexChapter(projectId, chapterId, newContent);
```

### 4.5 上下文引擎

**功能**：索引、检索、打包上下文

**核心组件**：`SimpleIndex`

**索引配置**：
- `chunkSize` - 切片大小（默认 2000 字符）
- `chunkOverlap` - 切片重叠（默认 200 字符）

**核心方法**：
- `indexChapter()` - 索引章节内容
- `retrieve()` - 检索相关上下文
- `packContext()` - 打包完整上下文包

**上下文包结构**：
```typescript
interface ContextPack {
  projectContext: string;      // 项目背景
  relatedChapters: Chapter[];   // 相关章节
  glossary: string;            // 术语表
  outline: string;            // 大纲
  sources: IndexEntry[];      // 来源记录
}
```

### 4.6 快照与回滚

**功能**：章节/全局快照，版本回滚

**核心实体**：
- `Snapshot` - 快照（id, type, chapterId, content, createdAt）

**用例**：`SnapshotUseCases`

**快照类型**：
- `chapter` - 章节快照
- `global` - 全局快照（整个项目）

### 4.7 整体检查

**功能**：缺章检测、术语冲突、重复检测

**核心实体**：
- `CheckIssue` - 检查问题（id, type, severity, message, chapters）

**用例**：`CheckUseCases`

**检查规则**（`SimpleRuleEngine`）：
- 缺章检测 - 对照大纲检查章节完整性
- 术语冲突 - 检测术语定义不一致
- 内容重复 - 检测章节间重复内容

### 4.8 导出中心

**功能**：MD/HTML/PDF 多格式导出

**核心实体**：
- `ExportJob` - 导出任务（id, format, status, filePath, createdAt）
- `ExportFormat` - 格式（md, html, pdf）
- `ExportConfig` - 导出配置

**用例**：`ExportUseCases`

**导出流程**：
1. 检查项目完整性
2. 合并章节内容
3. 应用模板转换
4. 输出目标格式

### 4.9 统计观测

**功能**：操作日志、采纳率统计

**核心实体**：
- `OperationLog` - 操作日志（id, type, details, timestamp）

**用例**：`MetricsUseCases`

**统计指标**：
- AI 操作次数
- 采纳率（adopted/total）
- 各意图使用分布

### 4.10 设置中心

**功能**：AI 提供商配置、模型参数、应用偏好

**核心实体**：
- `Settings` - 设置（id, category, key, value）
- `LLMProviderConfig` - LLM 配置（provider, model, apiKey, baseUrl, maxTokens, temperature）
- `AppPreferences` - 应用偏好（theme, language, autoSave, autoBackup）

**用例**：`SettingsUseCases`

**配置分类**：
- **LLM 设置**：提供商选择、模型参数、API 密钥管理
- **编辑器设置**：主题、字体大小、自动保存间隔
- **导出设置**：默认格式、模板选择
- **备份设置**：自动备份开关、备份路径、保留策略

**数据流**：
```
User edits settings
    │
    ▼
SettingsUseCase.updateSettings(key, value)
    │
    ├─► SettingsRepo.save()
    │
    ├─► Notify renderer (settings-changed event)
    │
    ├─► If LLM config changed: reinitialize LLM adapter
    │
    └─► Persist to config.json
```

### 4.11 备份中心

**功能**：项目数据备份、恢复、迁移

**核心实体**：
- `Backup` - 备份记录（id, projectId, type, filePath, size, createdAt, checksum）
- `BackupType` - 备份类型（manual, auto, scheduled）
- `BackupConfig` - 备份配置（enabled, interval, retention, path）

**用例**：`BackupUseCases`

**备份策略**：
- **手动备份**：用户主动触发全量备份
- **自动备份**：AI 生成操作后自动创建增量快照
- **定时备份**：按配置的间隔定期备份

**核心流程**：
```
Backup trigger (manual/auto/scheduled)
    │
    ▼
BackupUseCases.createBackup(projectId, type)
    │
    ├─► Collect project files
    │    ├─► meta/
    │    ├─► outline/
    │    ├─► chapters/
    │    └─► snapshots/
    │
    ├─► Create archive (zip)
    ├─► Calculate checksum (SHA256)
    │
    ├─► SettingsRepo.saveBackupRecord()
    │
    └─► Store to backup path

Recovery:
    │
    ▼
BackupUseCases.restoreBackup(backupId)
    │
    ├─► Validate checksum
    ├─► Extract archive
    ├─► Merge/replace project files
    │
    └─► Update project status
```

**保留策略**：
- 自动清理超过保留期的备份
- 保留最近 N 个手动备份
- 支持导出备份到外部存储

---

## 5. LLM 支持

### 5.1 支持的 Provider

| Provider | Model | API Endpoint |
|----------|-------|--------------|
| OpenAI | gpt-4, gpt-4o | https://api.openai.com/v1 |
| Anthropic Claude | claude-3-opus | https://api.anthropic.com/v1 |
| MiniMax | - | https://api.minimax.chat/v1 |
| Kimi | - | https://api.moonshot.cn/v1 |

### 5.2 配置接口

```typescript
interface LLMProviderConfig {
  provider: 'openai' | 'anthropic' | 'minimax' | 'kimi';
  model: string;
  apiKey?: string;
  baseUrl?: string;
  maxTokens: number;
  temperature: number;
}
```

### 5.3 Prompt 策略

每种意图对应不同的系统提示词：

| Intent | System Prompt |
|--------|---------------|
| CONTINUE | 续写内容，保持风格一致性 |
| EXPAND | 扩展内容，增加细节、案例 |
| REWRITE | 重新组织，使内容清晰有力 |
| ADD_ARGUMENT | 补充论证、数据、证据 |
| POLISH | 润色，使内容流畅专业 |
| SIMPLIFY | 简化，去除冗余，保留核心 |

---

## 6. 端口接口定义

### 6.1 Repository Ports

```typescript
interface ProjectRepoPort {
  create(params: CreateProjectParams): Promise<Project>;
  findById(id: string): Promise<Project | null>;
  findAll(): Promise<Project[]>;
  update(id: string, params: UpdateProjectParams): Promise<Project>;
  delete(id: string): Promise<void>;
}

interface ChapterRepoPort {
  create(projectId: string, params: CreateChapterParams): Promise<Chapter>;
  findByChapterId(projectId: string, chapterId: string): Promise<Chapter | null>;
  findByProjectId(projectId: string): Promise<Chapter[]>;
  updateContent(projectId: string, chapterId: string, content: string): Promise<void>;
  delete(projectId: string, chapterId: string): Promise<void>;
}
```

### 6.2 Service Ports

```typescript
interface LLMPort {
  generate(params: LLMGenerateParams): Promise<LLMGenerateResult>;
  ping(): Promise<boolean>;
  getConfig(): LLMProviderConfig;
}

interface IndexPort {
  indexChapter(projectId: string, chapterId: string, content: string, title: string): Promise<void>;
  retrieve(projectId: string, chapterId: string, query: string, limit?: number): Promise<IndexEntry[]>;
  packContext(projectId: string, chapterId: string): Promise<ContextPack>;
}

interface ExportPort {
  export(projectId: string, format: ExportFormat, config?: ExportConfig): Promise<ExportResult>;
  preview(projectId: string, format: ExportFormat): Promise<string>;
  getExportHistory(projectId: string): Promise<{ recent: ExportResult[]; total: number }>;
}

interface SettingsPort {
  getSettings(): Promise<Settings>;
  updateSettings(key: string, value: any): Promise<void>;
  getLLMConfig(): Promise<LLMProviderConfig>;
  updateLLMConfig(config: LLMProviderConfig): Promise<void>;
  resetToDefaults(): Promise<void>;
}

interface BackupPort {
  createBackup(projectId: string, type: BackupType): Promise<Backup>;
  listBackups(projectId: string): Promise<Backup[]>;
  restoreBackup(backupId: string): Promise<void>;
  deleteBackup(backupId: string): Promise<void>;
  exportBackup(backupId: string, targetPath: string): Promise<void>;
  getBackupConfig(): Promise<BackupConfig>;
  updateBackupConfig(config: BackupConfig): Promise<void>;
}
```

---

## 7. 数据流

### 7.1 AI 生成流程

```
User Action
    │
    ▼
ChapterWorkbenchUseCase.generate(intent)
    │
    ├─► ChapterRepo.findByChapterId()
    │         │
    │         ▼
    │    IndexPort.packContext()
    │         │
    │         ▼
    │    SimpleIndex.retrieve() / SimpleIndexAdapter.packContext()
    │         │
    │         ▼
    │    ContextPack (项目背景 + 相关章节 + 术语 + 大纲)
    │
    ▼
LLMPort.generate(context, chapter, intent)
    │
    ▼
RealLLMAdapter.callXXX() / MockLLMAdapter
    │
    ▼
AIOperation (记录输入输出)
    │
    ├─► ChapterRepo.saveOperation()
    ├─► ChapterRepo.updateContent()
    ├─► IndexPort.indexChapter()
    │
    ▼
Updated Chapter + Operation
```

### 7.2 导出流程

```
User clicks Export
    │
    ▼
ExportUseCases.exportProject(format, config)
    │
    ▼
CheckUseCases.runCheck()  [可选门槛检查]
    │
    ├─► FileProjectRepo.findById()
    ├─► FileChapterRepo.findByProjectId()
    │
    ▼
FileExportAdapter.export()
    │
    ├─► Merge chapters
    ├─► Apply template
    ├─► Write to output/
    │
    ▼
ExportResult (filePath, format, status)
```

### 7.3 备份恢复流程

```
Backup Creation:
────────────────
User/Schedule triggers backup
    │
    ▼
BackupUseCases.createBackup(projectId, type)
    │
    ├─► Collect files: meta, outline, chapters, snapshots
    ├─► Create ZIP archive
    ├─► Generate SHA256 checksum
    │
    ├─► FileBackupRepo.save(backup)
    │
    └─► Return Backup (id, path, checksum)

Backup Restore:
────────────────
User selects backup
    │
    ▼
BackupUseCases.restoreBackup(backupId)
    │
    ├─► Validate checksum
    ├─► Extract to temp directory
    ├─► Backup current project (if exists)
    ├─► Move restored files to project directory
    │
    ├─► Update project metadata
    ├─► Rebuild index
    │
    └─► Notify renderer (project-restored event)
```

### 7.4 设置更新流程

```
User changes settings
    │
    ▼
SettingsUseCases.updateSettings(key, value)
    │
    ├─► FileSettingsRepo.save()
    │
    ├─► Emit settings-changed event
    │    │
    │    ├─► Renderer: update UI
    │    ├─► LLM adapter: reinitialize if needed
    │    └─► Cache: invalidate if needed
    │
    └─► Persist to runtime/config/settings.json
```

---

## 8. 安全边界

### 8.1 Preload 隔离

- 仅暴露白名单 API
- 文件系统访问仅限 `runtime/projects` 目录
- 禁止直接暴露 Node.js API

### 8.2 IPC 通信

- 主进程处理所有文件系统操作
- 渲染进程通过 IPC 发起请求
- 响应结果通过 IPC 返回

---

## 9. 非功能设计

### 9.1 可观测性

所有关键操作记录：
- `operationId` - 操作唯一标识
- 耗时 - operation duration
- 输入摘要 - input summary
- 错误码 - error code

### 9.2 错误恢复

- 导出失败保留中间产物
- 失败章节列表可查
- 支持增量重试

### 9.3 性能基线

- 10 万字项目检查与导出时 UI 不阻塞
- 任务可中断、可继续

### 9.4 缓存策略

**多级缓存架构**：

| 层级 | 缓存内容 | 淘汰策略 | 实现 |
|------|---------|---------|------|
| L1 | 章节内容 | LRU (50章节) | Memory |
| L2 | 索引向量 | LRU (100项目) | Memory |
| L3 | 项目元数据 | LRU (20项目) | Memory |
| 持久 | 大纲/快照 | TTL + 手动 | File |

**缓存失效场景**：
- 章节内容变更 -> 清除 L1 缓存
- 项目删除 -> 清除所有缓存
- 设置变更 -> 清除 LLM 配置缓存

### 9.5 性能优化设计

**热点数据预加载**：
- 打开项目时预加载元数据、大纲、最近章节
- 智能预测下一个可能访问的章节

**异步处理**：
- 大纲生成、内容检查、导出等耗时操作
- 支持进度报告和取消

**流式生成**：
- LLM 输出采用流式响应
- 实时展示生成进度

**批量操作**：
- 多个章节操作合并处理
- 批量索引更新

---

## 10. 附录

### 10.1 核心文件映射

| 功能 | 文件路径 |
|------|----------|
| 项目实体 | `packages/domain/src/entities/Project.ts` |
| 章节实体 | `packages/domain/src/entities/Chapter.ts` |
| AI 生成用例 | `packages/application/src/usecases/GenerateContentUseCase.ts` |
| LLM 适配器 | `packages/infrastructure/src/llm/RealLLMAdapter.ts` |
| 索引实现 | `packages/infrastructure/src/index/SimpleIndex.ts` |
| 导出用例 | `packages/application/src/usecases/ExportUseCases.ts` |
| 端口定义 | `packages/application/src/ports/index.ts` |

### 10.2 版本历史

| 版本 | 日期 | 变更 |
|------|------|------|
| v1.0 | 2026-02-24 | MVP 架构方案（评审版） |
| v1.1 | 2026-02-25 | 完善架构文档，添加实现细节 |
| v1.2 | 2026-02-25 | 新增设置中心、备份中心模块；完善缓存策略与性能优化设计 |
