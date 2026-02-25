# Prompt: 章节简化 (chapter-simplify)
- prompt_id: chapter-simplify
- version: 1.1.0
- created_at: 2026-02-25T18:26:14Z
- description: 替换式简化，降低阅读门槛
- extends: chapter-base

## Intent Strategy
简化（replace）

## Execution Rules
1. 删除重复和低信息密度表述，保留核心结论与关键步骤。
2. 拆分长句，使用直接表达，减少理解负担。
3. 专业术语首次出现时给出简短解释。
4. 建议输出长度为原文 60%-80%，但不得牺牲关键信息。

## Output Contract
- 返回完整简化后的章节全文。
- 禁止只输出摘要或提纲。

## Forbidden
- 禁止为追求简短而删除关键前提。
- 禁止新增与输入无关的新事实。
