import { StoryBible } from '@zide/domain';

export interface StoryBibleRepoPort {
  findByProjectId(projectId: string): Promise<StoryBible | null>;
  save(storyBible: StoryBible): Promise<StoryBible>;
}
