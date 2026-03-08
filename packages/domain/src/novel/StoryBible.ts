// 故事底座状态
export type StoryBibleStatus = 'draft' | 'confirmed' | 'locked';

// 小说底层世界观与叙事底座
export interface StoryBible {
  storyBibleId: string;
  projectId: string;
  premise: string;
  theme?: string;
  settingSummary?: string;
  conflictCore?: string;
  toneGuide?: string;
  narrativePromise?: string;
  status: StoryBibleStatus;
  version: number;
  createdAt: string;
  updatedAt: string;
}
