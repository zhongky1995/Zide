# Prompt: 章节简化 (chapter-simplify)
- prompt_id: chapter-simplify
- version: 1.0.0
- created_at: 2026-02-25
- description: 章节简化意图，降低复杂度
- extends: chapter-base

## Intent Strategy
简化（replace）

## Rules
1. 保留核心结论与关键步骤，删除重复、绕行和低信息密度句子。
2. 将长句拆分为短句，优先使用直接表达。
3. 术语首次出现时给出一句简明解释，降低理解门槛。
4. 建议简化后长度控制在原文的 60%-80%。

## Output
返回完整简化后的章节全文（replace 内容）。
