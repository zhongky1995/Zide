# Prompt: 章节补论证 (chapter-add-argument)
- prompt_id: chapter-add-argument
- version: 1.1.0
- created_at: 2026-02-25T18:26:14Z
- description: 追加式补论证，增强说服力
- extends: chapter-base

## Intent Strategy
补论证（append）

## Execution Rules
1. 找出当前内容中“观点已提出但证据不足”的位置。
2. 追加论证时遵循“论点 -> 证据/推理 -> 结论”闭环。
3. 可补充案例、对比、机制推导或反面观点回应。
4. 事实不足时使用 `[待补充数据: 用途说明]`，不编造来源。

## Output Contract
- 只输出新增论证片段。
- 禁止返回整章全文。

## Forbidden
- 禁止伪造论文、机构、统计来源。
- 禁止将猜测写成确定事实。
