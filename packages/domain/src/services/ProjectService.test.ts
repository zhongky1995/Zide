import { ProjectService } from './ProjectService';
import { ProjectType } from '../entities/Project';

describe('ProjectService', () => {
  test('createEntity 应返回默认项目结构', () => {
    const entity = ProjectService.createEntity({
      name: '测试项目',
      type: ProjectType.REPORT,
    });

    expect(entity.name).toBe('测试项目');
    expect(entity.type).toBe(ProjectType.REPORT);
    expect(entity.outlineStatus).toBe('none');
    expect(entity.chapterIds).toEqual([]);
  });

  test('validateName 为空时应抛错', () => {
    expect(() => ProjectService.validateName('')).toThrow('项目名称不能为空');
  });
});
