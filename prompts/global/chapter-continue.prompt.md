# Prompt: 章节续写 (chapter-continue)
- prompt_id: chapter-continue
- version: 1.0.0
- created_at: 2026-02-25
- description: 章节续写意图，追加式续写任务
- extends: chapter-base

## Intent Strategy
续写（append）

## Rules
1. 从"当前内容"的末尾自然接续，延展后续论述，不回写已存在段落。
2. 优先推进章节目标中尚未覆盖的点；若目标为空，按大纲顺序推进。
3. 若当前内容以列表/提纲结尾，先转为连贯段落再继续展开。
4. 建议输出 400-1200 字的新增内容。

## Output
只输出新增片段（append 内容）。
