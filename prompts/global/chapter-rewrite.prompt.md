# Prompt: 章节重写 (chapter-rewrite)
- prompt_id: chapter-rewrite
- version: 1.1.0
- created_at: 2026-02-25T18:26:14Z
- description: 替换式重写，优化结构与表达
- extends: chapter-base

## Intent Strategy
重写（replace）

## Execution Rules
1. 在不改变核心观点前提下重组段落和表达。
2. 合并重复论述，补足过渡句，确保逻辑链连续。
3. 保留关键结论、关键术语与必要前提条件。
4. 建议输出长度为原文 80%-120%。

## Output Contract
- 返回完整章节全文，用于替换原文。
- 禁止只返回局部片段。

## Forbidden
- 禁止改变原文结论立场。
- 禁止删掉关键论证步骤导致信息断裂。
