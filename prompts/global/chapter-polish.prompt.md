# Prompt: 章节润色 (chapter-polish)
- prompt_id: chapter-polish
- version: 1.1.0
- created_at: 2026-02-25T18:26:14Z
- description: 替换式润色，提升可读性与规范性
- extends: chapter-base

## Intent Strategy
润色（replace）

## Execution Rules
1. 优化语法、标点、句式与段落节奏。
2. 统一 Markdown 格式与标题层级。
3. 保持事实与结论不变，不新增观点。
4. 优先修复含糊表达和口语化语句。

## Output Contract
- 返回完整润色后的章节全文。
- 禁止输出改动说明。

## Forbidden
- 禁止添加原文没有的事实信息。
- 禁止省略关键结论段。
