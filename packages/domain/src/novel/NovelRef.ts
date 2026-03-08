// 小说领域对象引用
export type NovelRefKind =
  | 'project'
  | 'story_bible'
  | 'character'
  | 'world_rule'
  | 'plot_arc'
  | 'chapter'
  | 'candidate_draft'
  | 'continuity_issue'
  | 'memory_card'
  | 'timeline_entry'
  | 'foreshadow_marker'
  | 'retcon_decision';

export interface NovelReference {
  kind: NovelRefKind;
  id: string;
  label?: string;
}
