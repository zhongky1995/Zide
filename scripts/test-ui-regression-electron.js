#!/usr/bin/env node

const assert = require('assert');
const fs = require('fs/promises');
const http = require('http');
const path = require('path');
const os = require('os');
const { _electron: electron } = require('playwright');
const electronBinary = require('electron');

function json(res, payload, statusCode = 200) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf-8');
}

async function startMockLLMServer() {
  const requests = [];

  const server = http.createServer(async (req, res) => {
    const requestUrl = new URL(req.url || '/', 'http://127.0.0.1');

    if (req.method === 'GET' && requestUrl.pathname === '/v1/models') {
      return json(res, {
        object: 'list',
        data: [{ id: 'mock-ui-model', object: 'model' }],
      });
    }

    if (req.method === 'POST' && requestUrl.pathname === '/v1/chat/completions') {
      let payload = {};
      try {
        payload = JSON.parse(await readBody(req) || '{}');
      } catch {
        return json(res, { error: { message: 'invalid json' } }, 400);
      }

      const messages = Array.isArray(payload.messages) ? payload.messages : [];
      const userMessage = messages.find((item) => item?.role === 'user');
      const userContent = typeof userMessage?.content === 'string' ? userMessage.content : '';

      let responseType = 'generic';
      let content = '默认响应。';

      if (userContent.trim() === 'ping') {
        responseType = 'ping';
        content = 'pong';
      } else if (userContent.includes('请生成以下全局设定') || userContent.includes('"background"')) {
        responseType = 'settings';
        content = JSON.stringify({
          background: '基于用户输入形成的全局背景',
          objectives: '围绕核心目标拆解章节并逐章落地',
          constraints: '术语统一、逻辑连贯、避免空泛结论',
          style: '专业、结构化、可执行',
          targetAudience: '业务决策者',
          writingTone: 'professional',
        });
      } else if (userContent.includes('标题: 大纲生成')) {
        responseType = 'outline';
        content = JSON.stringify([
          {
            title: '项目背景与目标澄清',
            target: '明确背景、目标与问题边界，为后续章节提供统一上下文。',
          },
          {
            title: '关键矛盾与路径设计',
            target: '结合前文结论提出可执行路径，并形成本章主论点。',
          },
          {
            title: '实施计划与风险控制',
            target: '给出实施里程碑、资源安排与关键风险应对方案。',
          },
        ]);
      } else if (userContent.includes('标题: 项目背景与目标澄清')) {
        responseType = 'chapter-01';
        content = '第一章自动生成内容：先定义背景边界与目标，再明确问题范围。';
      } else if (userContent.includes('标题: 关键矛盾与路径设计')) {
        responseType = 'chapter-02';
        content = '第二章自动生成内容：基于全局 + 前文记忆 + 本节梗概进行路径设计。';
      } else {
        responseType = 'chapter-other';
        content = '章节自动生成内容：默认补全文本。';
      }

      requests.push({
        time: new Date().toISOString(),
        type: responseType,
        userContent,
      });

      return json(res, {
        id: `chatcmpl-${Date.now()}`,
        object: 'chat.completion',
        model: payload.model || 'mock-ui-model',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content,
            },
            finish_reason: 'stop',
          },
        ],
        usage: {
          total_tokens: 128,
        },
      });
    }

    return json(res, { error: { message: 'not found' } }, 404);
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;

  return {
    server,
    requests,
    baseUrl: `http://127.0.0.1:${port}/v1`,
    async close() {
      await new Promise((resolve) => server.close(resolve));
    },
  };
}

async function waitForTextareaValue(page, expectedSubstring, timeoutMs = 30000) {
  await page.waitForFunction(
    (needle) => {
      const el = document.querySelector('.editor-textarea');
      if (!el) return false;
      return typeof el.value === 'string' && el.value.includes(needle);
    },
    expectedSubstring,
    { timeout: timeoutMs }
  );
}

function isPlaceholderText(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return true;

  const compact = normalized.replace(/\s+/g, '');
  if (/^(\.{2,}|…+|。{2,}|、{2,}|-+|_+)$/u.test(compact)) return true;
  if (/^(todo|tbd|na|n\/a|null|none|unknown)$/i.test(compact)) return true;
  if (/^(待补充|待完善|待定|未填写|未提供|暂无|无|略)$/u.test(compact)) return true;

  const contentOnly = compact.replace(/[\p{P}\p{S}]/gu, '');
  return contentOnly.length === 0;
}

async function run() {
  const repoRoot = path.resolve(__dirname, '..');
  const appDir = path.join(repoRoot, 'apps', 'desktop');
  const outputDir = path.join(repoRoot, 'output', 'playwright');
  await fs.mkdir(outputDir, { recursive: true });

  const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'zide-ui-regression-'));
  const tmpHome = path.join(tmpRoot, 'home');
  const isolatedUserDataDir = path.join(tmpRoot, 'electron-user-data');
  const runtimeBasePath = path.join(tmpRoot, 'projects');
  await fs.mkdir(tmpHome, { recursive: true });
  await fs.mkdir(isolatedUserDataDir, { recursive: true });
  await fs.mkdir(runtimeBasePath, { recursive: true });

  const mockServer = await startMockLLMServer();
  const projectName = `UI回归项目-${Date.now()}`;
  const screenshotPath = path.join(outputDir, `ui-regression-failure-${Date.now()}.png`);
  const requestLogPath = path.join(outputDir, `ui-regression-requests-${Date.now()}.json`);

  let electronApp;
  let page;

  try {
    electronApp = await electron.launch({
      executablePath: electronBinary,
      args: [`--user-data-dir=${isolatedUserDataDir}`, appDir],
      env: {
        ...process.env,
        NODE_ENV: 'production',
        HOME: tmpHome,
        ZIDE_RUNTIME_BASE_PATH: runtimeBasePath,
      },
      timeout: 60000,
    });

    page = await electronApp.firstWindow();
    page.setDefaultTimeout(30000);
    await page.waitForLoadState('domcontentloaded');

    const userDataPath = await electronApp.evaluate(async ({ app }) => app.getPath('userData'));
    console.log(`[ui] userData: ${userDataPath}`);
    assert(
      userDataPath.includes(path.basename(isolatedUserDataDir)),
      'UI 回归未使用隔离 userData 目录，存在污染真实配置风险'
    );

    // 1) 设置页配置本地 Mock LLM（真实 UI 操作）
    await page.locator('button:has-text("设置")').first().click();
    await page.locator('h1.page-title:has-text("设置")').waitFor();

    const llmCard = page.locator('.card').first();
    await llmCard.locator('select').first().selectOption('custom');
    await llmCard.locator('input[placeholder*="gpt-4o"]').fill('mock-ui-model');
    await llmCard.locator('input[placeholder="输入 API Key"]').fill('ui-test-key');
    await llmCard.locator('input[placeholder*="https://api.openai.com/v1"]').fill(mockServer.baseUrl);

    await llmCard.locator('button:has-text("保存设置")').click();
    await llmCard.locator('button:has-text("测试连接")').click();
    await page.locator('.test-result.success:has-text("连接成功")').waitFor();

    await page.locator('button:has-text("返回首页")').click();
    await page.locator('button:has-text("新建项目")').waitFor();

    // 2) 创建项目（触发“全局设定 AI 生成”）
    await page.locator('button:has-text("新建项目")').click();
    await page.locator('.modal-title:has-text("创建新项目")').waitFor();

    await page.locator('input[placeholder="输入项目名称"]').fill(projectName);
    await page.locator('textarea[placeholder*="描述你想要写的内容"]').fill('先明确问题，再形成可执行路径和实施计划。');
    await page.locator('textarea[placeholder="简要描述项目内容"]').fill('用于验证 UI 全流程自动回归。');

    await page.locator('.modal-footer button:has-text("创建")').click();
    await page.locator(`h1.page-title:has-text("${projectName}")`).waitFor({ timeout: 60000 });

    // 3) 校验全局设定已生成
    await page.locator('button:has-text("全局设定")').click();
    await page.locator('.modal-header h3:has-text("项目全局设定")').waitFor();
    const settingValues = await page.locator('.modal-body textarea').evaluateAll((nodes) => nodes.map((n) => n.value.trim()));
    assert(settingValues.length === 4, '全局设定弹窗字段数量异常');
    assert(settingValues.every((value) => value.length > 0), '全局设定未自动填充完整');
    assert(
      settingValues.every((value) => !isPlaceholderText(value)),
      `全局设定存在占位符内容：${settingValues.join(' | ')}`
    );
    await page.locator('.modal-footer button:has-text("取消")').click();

    // 4) 生成大纲并校验“章节梗概”
    await page.locator('button:has-text("生成大纲")').click();
    await page.locator('.modal-header h3:has-text("AI 生成大纲")').waitFor();
    await page.locator('.modal-footer button:has-text("AI 生成大纲")').click();

    // 生成成功后应自动关闭弹窗
    await page.locator('.modal-header h3:has-text("AI 生成大纲")').waitFor({ state: 'hidden' });
    await page.locator('.chapter-item .chapter-title:has-text("项目背景与目标澄清")').waitFor({ timeout: 60000 });
    const outlineTitles = await page.locator('.chapter-list .chapter-item .chapter-title').allTextContents();
    const outlineTargets = await page.locator('.chapter-list .chapter-item .chapter-info .text-gray.text-sm').allTextContents();
    assert(outlineTitles.includes('关键矛盾与路径设计'), '大纲标题缺失：关键矛盾与路径设计');
    assert(outlineTargets.some((target) => target.includes('统一上下文')), '大纲未生成章节梗概');

    // 5) 切到章节工作台，校验同步
    await page.locator('button:has-text("章节工作台")').click();
    await page.locator('.editor-sidebar h3:has-text("章节列表")').waitFor();
    const workbenchTitles = await page.locator('.editor-sidebar .chapter-list .chapter-title').allTextContents();
    assert(workbenchTitles.includes('项目背景与目标澄清'), '章节工作台未同步第一章');
    assert(workbenchTitles.includes('关键矛盾与路径设计'), '章节工作台未同步第二章');

    // 6) 先生成第一章，形成前文记忆
    await page.locator('.editor-sidebar .chapter-item:has-text("项目背景与目标澄清")').first().click();
    await page.locator('h1.page-title:has-text("项目背景与目标澄清")').waitFor();
    await page.locator('button:has-text("续写")').first().click();
    await waitForTextareaValue(page, '第一章自动生成内容');

    // 7) 返回项目，生成第二章，验证首轮输出
    await page.locator('button:has-text("返回项目")').click();
    await page.locator(`h1.page-title:has-text("${projectName}")`).waitFor();
    await page.locator('button:has-text("章节工作台")').click();
    await page.locator('.editor-sidebar .chapter-item:has-text("关键矛盾与路径设计")').first().click();
    await page.locator('h1.page-title:has-text("关键矛盾与路径设计")').waitFor();
    await page.locator('button:has-text("续写")').first().click();
    await waitForTextareaValue(page, '第二章自动生成内容');

    // 8) 对请求日志做产品语义断言
    const secondChapterRequest = mockServer.requests.find((item) => item.type === 'chapter-02');
    assert(secondChapterRequest, '未捕获第二章 AI 请求');
    assert(
      secondChapterRequest.userContent.includes('基于用户输入形成的全局背景'),
      '第二章生成未携带全局设定'
    );
    assert(
      secondChapterRequest.userContent.includes('第一章自动生成内容'),
      '第二章生成未携带前文记忆'
    );
    assert(
      secondChapterRequest.userContent.includes('目标: 结合前文结论提出可执行路径，并形成本章主论点。'),
      '第二章生成未携带本节梗概'
    );

    await fs.writeFile(requestLogPath, JSON.stringify(mockServer.requests, null, 2), 'utf-8');
    console.log('UI regression flow passed');
    console.log(`Mock requests: ${requestLogPath}`);
  } catch (error) {
    if (page) {
      try {
        await page.screenshot({ path: screenshotPath, fullPage: true });
        console.error(`UI regression failed. Screenshot: ${screenshotPath}`);
      } catch {
        // ignore screenshot errors
      }
    }
    await fs.writeFile(requestLogPath, JSON.stringify(mockServer.requests, null, 2), 'utf-8').catch(() => {});
    console.error(`Mock requests: ${requestLogPath}`);
    throw error;
  } finally {
    if (electronApp) {
      await electronApp.close().catch(() => {});
    }
    await mockServer.close().catch(() => {});
  }
}

run().catch((error) => {
  console.error('UI regression flow failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
