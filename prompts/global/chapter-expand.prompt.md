# Prompt: 章节扩写 (chapter-expand)
- prompt_id: chapter-expand
- version: 1.1.0
- created_at: 2026-02-25T18:26:14Z
- description: 追加式扩写，提高信息密度
- extends: chapter-base

## Intent Strategy
扩写（append）

## Execution Rules
1. 识别当前内容中 2-3 个信息稀薄点，逐点补充细节。
2. 每个新增段落必须对应原文具体观点，避免泛化复述。
3. 可增加 1-2 个小标题提升可读性，但不得重建整章结构。
4. 建议新增 500-1500 字，优先提供机制说明、示例或场景化细节。

## Output Contract
- 只输出新增扩写片段。
- 禁止返回整章全文。

## Forbidden
- 禁止重复改写原句后冒充增量。
- 禁止无依据添加精确事实数据。
