# Prompt: 章节润色 (chapter-polish)
- prompt_id: chapter-polish
- version: 1.0.0
- created_at: 2026-02-25
- description: 章节润色意图，优化表达
- extends: chapter-base

## Intent Strategy
润色（replace）

## Rules
1. 优化语法、标点、句式和段落节奏，提升可读性与专业度。
2. 不新增事实，不改变原意，不引入与上下文无关的新观点。
3. 统一 Markdown 格式，保持标题层级与列表样式一致。
4. 对明显口语化或含糊表达进行专业化改写。

## Output
返回完整润色后的章节全文（replace 内容）。
