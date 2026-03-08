import { NovelReference } from './NovelRef';

// 世界规则影响范围
export type WorldRuleScope =
  | 'world'
  | 'magic'
  | 'technology'
  | 'social_order'
  | 'character_behavior'
  | 'timeline';

// 世界规则
export interface WorldRule {
  ruleId: string;
  projectId: string;
  title: string;
  scope: WorldRuleScope;
  description: string;
  hardConstraint: boolean;
  examples?: string[];
  sourceRefs?: NovelReference[];
  createdAt: string;
  updatedAt: string;
}
