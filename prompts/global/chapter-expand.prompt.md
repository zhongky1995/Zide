# Prompt: 章节扩写 (chapter-expand)
- prompt_id: chapter-expand
- version: 1.0.0
- created_at: 2026-02-25
- description: 章节扩写意图，扩展现有内容
- extends: chapter-base

## Intent Strategy
扩写（append）

## Rules
1. 识别当前内容中信息稀薄的 2-3 个点，分别补充细节、案例或机制解释。
2. 新增内容必须与现有段落逻辑一致，不能重复改写原句。
3. 可使用 1-2 个小标题提升可读性，但不要重建整章结构。
4. 建议输出 500-1500 字的新增内容。

## Output
只输出新增扩展片段（append 内容），不要返回整章全文。
