# Prompt: 章节重写 (chapter-rewrite)
- prompt_id: chapter-rewrite
- version: 1.0.0
- created_at: 2026-02-25
- description: 章节重写意图，全文重写
- extends: chapter-base

## Intent Strategy
重写（replace）

## Rules
1. 在不改变核心观点的前提下，重组段落顺序和表达，提升逻辑清晰度。
2. 合并重复论述，补齐过渡句，让段落之间形成完整叙事链。
3. 保留关键信息和术语，不删除必要结论。
4. 建议重写后长度保持在原文的 80%-120%。

## Output
返回完整重写后的章节全文（replace 内容）。
