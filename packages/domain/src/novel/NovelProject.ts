import { ProjectStatus } from '../entities/Project';

// 小说项目阶段
export type NovelProjectPhase =
  | 'ideation'
  | 'worldbuilding'
  | 'plotting'
  | 'drafting'
  | 'revision'
  | 'ready'
  | 'archived';

// 叙事视角
export type NarrativePerspective =
  | 'first_person'
  | 'third_person_limited'
  | 'third_person_omniscient'
  | 'multiple_pov';

// 小说项目
export interface NovelProject {
  projectId: string;
  title: string;
  premise: string;
  genre?: string;
  subgenre?: string;
  status: ProjectStatus;
  phase: NovelProjectPhase;
  narrativePerspective?: NarrativePerspective;
  targetLength?: string;
  activeArcId?: string;
  activeChapterId?: string;
  createdAt: string;
  updatedAt: string;
}
