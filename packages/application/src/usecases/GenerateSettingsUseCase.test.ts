import { GenerateSettingsUseCase } from './GenerateSettingsUseCase';
import { LLMPort } from '../ports/LLMPort';

function createLLMMock(content: string): LLMPort {
  return {
    generate: jest.fn().mockResolvedValue({
      content,
      model: 'mock-model',
      tokens: 120,
      finishReason: 'stop',
    }),
    ping: jest.fn().mockResolvedValue(true),
    getConfig: jest.fn().mockReturnValue({
      provider: 'custom',
      model: 'mock-model',
    }),
    updateConfig: jest.fn(),
  };
}

const baseParams = {
  name: '测试项目',
  type: 'proposal',
  idea: '围绕问题分析和落地方案形成完整章节结构。',
  targetReaders: '业务负责人',
  targetScale: '2万字',
};

describe('GenerateSettingsUseCase', () => {
  test('应解析有效的全局设定 JSON', async () => {
    const llm = createLLMMock(JSON.stringify({
      background: '当前业务流程缺少标准化文档，需要形成统一执行规范。',
      objectives: '沉淀统一方案，输出可执行步骤和验收标准。',
      constraints: '内容要基于已有事实，不允许编造数据。',
      style: '专业、清晰、强调结构化表达。',
      targetAudience: '业务管理层',
      writingTone: 'academic',
    }));

    const useCase = new GenerateSettingsUseCase(llm);
    const result = await useCase.generate(baseParams);

    expect(result.background).toContain('标准化文档');
    expect(result.objectives).toContain('验收标准');
    expect(result.constraints).toContain('不允许编造数据');
    expect(result.style).toContain('结构化');
    expect(result.targetAudience).toBe('业务管理层');
    expect(result.writingTone).toBe('academic');
  });

  test('应拒绝占位符全局设定', async () => {
    const llm = createLLMMock(JSON.stringify({
      background: '...',
      objectives: '…',
      constraints: '待补充',
      style: '暂无',
      targetAudience: '...',
      writingTone: 'professional',
    }));

    const useCase = new GenerateSettingsUseCase(llm);
    await expect(useCase.generate(baseParams)).rejects.toThrow('占位内容');
  });

  test('可回退无效目标读者与写作语气', async () => {
    const llm = createLLMMock(JSON.stringify({
      background: '项目需要面向一线执行团队建立统一流程。',
      objectives: '形成从准备到交付的闭环执行方案。',
      constraints: '避免空泛描述，每章都给出明确动作。',
      style: '短句表达，结构化小标题，结论先行。',
      targetAudience: '...',
      writingTone: 'unknown-tone',
    }));

    const useCase = new GenerateSettingsUseCase(llm);
    const result = await useCase.generate(baseParams);

    expect(result.targetAudience).toBe('通用专业读者');
    expect(result.writingTone).toBe('professional');
  });
});
