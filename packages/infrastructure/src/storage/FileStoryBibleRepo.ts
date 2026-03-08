import { StoryBible } from '@zide/domain';
import { StoryBibleRepoPort } from '@zide/application';
import * as fs from 'fs/promises';
import * as path from 'path';

export class FileStoryBibleRepo implements StoryBibleRepoPort {
  constructor(private readonly runtimeBasePath: string) {}

  private getStoryBiblePath(projectId: string): string {
    return path.join(this.runtimeBasePath, projectId, 'meta', 'story-bible.json');
  }

  async findByProjectId(projectId: string): Promise<StoryBible | null> {
    try {
      const content = await fs.readFile(this.getStoryBiblePath(projectId), 'utf-8');
      return JSON.parse(content) as StoryBible;
    } catch {
      return null;
    }
  }

  async save(storyBible: StoryBible): Promise<StoryBible> {
    const targetPath = this.getStoryBiblePath(storyBible.projectId);
    await fs.mkdir(path.dirname(targetPath), { recursive: true });
    await fs.writeFile(targetPath, JSON.stringify(storyBible, null, 2), 'utf-8');
    return storyBible;
  }
}
