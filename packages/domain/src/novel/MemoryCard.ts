import { NovelReference } from './NovelRef';

// 长期记忆类型
export type MemoryCardKind =
  | 'character'
  | 'world_rule'
  | 'relationship'
  | 'timeline'
  | 'plot_decision'
  | 'tone';

// 长期记忆卡
export interface MemoryCard {
  memoryId: string;
  projectId: string;
  kind: MemoryCardKind;
  title: string;
  summary: string;
  confidence: number;
  confirmed: boolean;
  sourceRefs: NovelReference[];
  createdAt: string;
  updatedAt: string;
}
