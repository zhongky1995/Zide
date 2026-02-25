import { ChapterIntent } from '@zide/domain';
import { RealLLMAdapter } from './RealLLMAdapter';

function createAbortError(): Error {
  const error = new Error('aborted');
  error.name = 'AbortError';
  return error;
}

describe('RealLLMAdapter', () => {
  const originalFetch = global.fetch;
  const originalTimeout = process.env.ZIDE_LLM_TIMEOUT_MS;

  afterEach(() => {
    global.fetch = originalFetch;
    if (originalTimeout === undefined) {
      delete process.env.ZIDE_LLM_TIMEOUT_MS;
    } else {
      process.env.ZIDE_LLM_TIMEOUT_MS = originalTimeout;
    }
  });

  test('generate 在网络阻塞时应返回超时错误而不是长期挂起', async () => {
    process.env.ZIDE_LLM_TIMEOUT_MS = '30';

    global.fetch = jest.fn((_url: string, init?: RequestInit) => {
      return new Promise((_resolve, reject) => {
        const signal = init?.signal as AbortSignal | undefined;
        if (!signal) {
          reject(new Error('missing abort signal'));
          return;
        }
        if (signal.aborted) {
          reject(createAbortError());
          return;
        }
        signal.addEventListener('abort', () => reject(createAbortError()), { once: true });
      });
    }) as typeof fetch;

    const adapter = new RealLLMAdapter();
    adapter.updateConfig({
      provider: 'custom',
      model: 'mock-timeout-model',
      apiKey: 'mock-key',
      baseUrl: 'https://api.example.com/v1',
    });

    await expect(adapter.generate({
      context: {
        projectContext: '全局上下文',
        relatedChapters: [],
        glossary: '',
        outline: '',
      },
      chapter: {
        id: '01',
        title: '测试章节',
        content: '测试内容',
        target: '测试目标',
      },
      intent: ChapterIntent.CONTINUE,
    })).rejects.toThrow('请求超时');
  });
});
