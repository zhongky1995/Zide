import { NovelReference } from './NovelRef';

// 角色弧线状态
export type CharacterArcState =
  | 'introduced'
  | 'developing'
  | 'transformed'
  | 'resolved';

// 角色关系引用
export interface CharacterRelationship {
  targetCharacterId: string;
  relation: string;
  summary?: string;
}

// 角色卡
export interface CharacterCard {
  characterId: string;
  projectId: string;
  name: string;
  role: string;
  summary: string;
  traits: string[];
  motivations: string[];
  fears?: string[];
  secrets?: string[];
  voiceGuide?: string;
  arcState: CharacterArcState;
  relationships?: CharacterRelationship[];
  sourceRefs?: NovelReference[];
  createdAt: string;
  updatedAt: string;
}
