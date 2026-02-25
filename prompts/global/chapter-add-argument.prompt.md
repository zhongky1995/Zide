# Prompt: 章节补论证 (chapter-add-argument)
- prompt_id: chapter-add-argument
- version: 1.0.0
- created_at: 2026-02-25
- description: 章节补论证意图，为观点补充证据
- extends: chapter-base

## Intent Strategy
补论证（append）

## Rules
1. 找出当前内容中证据不足的观点，补充数据、案例、逻辑推导或反例对比。
2. 论证必须与章节主题直接相关，避免引入无关知识点。
3. 若缺少可验证事实，使用"[待补充数据: 说明用途]"占位，避免编造。
4. 每段新增论证都要明确"论点 -> 证据 -> 结论"关系。

## Output
只输出新增论证片段（append 内容）。
