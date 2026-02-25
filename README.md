# Zide - 长文 AI 生产系统

> 把"长文写作"变成"项目推进"的 AI 生产系统

## 产品概述

Zide 是一个 AI 驱动的长文生产工作台，让用户以章节化、流程化方式稳定产出可交付长文并一键导出。

## 核心功能

- **项目创建**：快速创建长文项目，配置底座信息
- **大纲生成**：AI 生成或模板生成章节大纲，支持自定义调整
- **章节工作台**：Markdown 编辑，状态流转，AI 意图操作
- **上下文引擎**：智能索引、检索、上下文打包
- **AI 续写**：6 种意图（续写/扩写/重写/补论证/润色/简化）
- **快照回滚**：自动快照，3 步内回滚
- **整体检查**：缺章检测、术语冲突、重复内容检测
- **一键导出**：Markdown / HTML / PDF 三格式导出
- **统计观测**：操作日志、采纳率、生成耗时统计
- **统一Prompt管理**：14 个专业化 AI Agent，支持可扩展的 Prompt 框架
- **规范化错误处理**：统一的错误码体系与异常处理机制

## 技术架构

```
Zide/
├── apps/desktop/          # Electron 主应用
│   ├── src/main/         # 主进程
│   ├── src/preload/      # 预加载（IPC 桥接）
│   └── src/renderer/     # React UI
├── packages/
│   ├── domain/           # 领域实体与服务
│   ├── application/      # 用例与端口
│   ├── infrastructure/   # 存储/索引/LLM 适配
│   └── shared/          # 跨层类型/工具
├── runtime/              # 用户项目数据
└── tests/               # 测试目录
```

## 技术栈

- **前端**：React + TypeScript + Vite
- **桌面**：Electron
- **存储**：文件系统 + 简单索引
- **AI**：可扩展的 LLM 适配器

## 快速开始

### 安装依赖

```bash
npm install
```

### 开发模式

```bash
npm run dev:desktop
```

### 构建

```bash
npm run build
```

### 运行

```bash
cd apps/desktop
npm start
```

## 项目结构

用户项目目录结构：

```
runtime/projects/{project_id}/
├── meta/
│   ├── project.md        # 项目信息
│   ├── constraints.md    # 约束配置
│   └── glossary.md       # 术语表
├── outline/
│   └── outline.md       # 大纲
├── chapters/
│   ├── 01.md           # 章节文件
│   └── ...
├── snapshots/
│   ├── chapter/         # 章节快照
│   └── global/          # 全局快照
├── output/
│   └── final.md/html/pdf # 导出文件
└── logs/                # 操作日志
```

## IPC API

| 模块 | 接口 | 说明 |
|------|------|------|
| 项目 | project:create | 创建项目 |
| 大纲 | outline:generate | 生成大纲 |
| 章节 | chapter:save | 保存内容 |
| AI | ai:continue | 续写 |
| 快照 | snapshot:createChapter | 创建快照 |
| 检查 | check:run | 运行检查 |
| 导出 | export:project | 导出项目 |
| 统计 | metrics:project | 获取统计 |

## AI Agent 体系

项目内置 14 个专业化 AI Agent，通过统一的 Prompt 框架管理：

| Agent | 功能 |
|-------|------|
| ai-strategy-agent | AI 策略规划 |
| chapter-workbench-agent | 章节工作台 |
| content-orchestrator-agent | 内容编排 |
| context-engine-agent | 上下文引擎 |
| export-delivery-agent | 导出交付 |
| metrics-observability-agent | 指标观测 |
| outline-generation-agent | 大纲生成 |
| outline-management-agent | 大纲管理 |
| project-creation-agent | 项目创建 |
| project-settings-agent | 项目设置 |
| quality-check-agent | 质量检查 |
| settings-generation-agent | 设置生成 |
| snapshot-rollback-agent | 快照回滚 |
| chapter-*-agent | 章节操作（续写/扩写/重写/补论证/润色/简化） |

## 许可证

MIT
