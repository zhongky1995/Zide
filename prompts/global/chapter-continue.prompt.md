# Prompt: 章节续写 (chapter-continue)
- prompt_id: chapter-continue
- version: 1.1.0
- created_at: 2026-02-25T18:26:14Z
- description: 追加式续写当前章节
- extends: chapter-base

## Intent Strategy
续写（append）

## Execution Rules
1. 从当前内容末尾自然接续，不回写已存在段落。
2. 优先推进章节目标未覆盖部分；无目标时按大纲顺序推进。
3. 当前内容若以列表结尾，先完成语义过渡再展开正文。
4. 建议新增 400-1200 字，保持信息增量与节奏一致。

## Output Contract
- 只输出新增续写片段。
- 禁止返回整章全文。

## Forbidden
- 禁止复制原文段落充当新增内容。
- 禁止引入与章节主题无关的新主题。
