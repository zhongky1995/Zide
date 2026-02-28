(function () {
  const STORAGE_KEY = 'zide_ui_preview_state_v2';

  const PROJECT_TYPE_LABEL = {
    proposal: '方案',
    report: '报告',
    research: '研究',
    novel: '小说',
    other: '其他',
  };

  const STATUS_LABEL = {
    todo: '待开始',
    in_progress: '进行中',
    completed: '已完成',
  };

  const STATUS_ORDER = ['todo', 'in_progress', 'completed'];

  const ISSUE_LABEL = {
    missing_chapter: '缺章',
    low_completion: '完成度低',
    empty_content: '内容为空',
    duplicate_title: '标题重复',
  };

  const state = loadState();

  document.addEventListener('DOMContentLoaded', () => {
    const page = document.body.dataset.page;
    if (page === 'projects') initProjectsPage();
    if (page === 'workspace') initWorkspacePage();
    if (page === 'settings') initSettingsPage();
  });

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.projects) && parsed.settings) {
          return parsed;
        }
      }
    } catch (error) {
      console.error('load preview state failed:', error);
    }

    const seeded = createSeedState();
    saveState(seeded);
    return seeded;
  }

  function saveState(nextState) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState));
  }

  function persist() {
    saveState(state);
  }

  function createSeedState() {
    const projectAId = uid('project');
    const projectBId = uid('project');

    return {
      activeProjectId: projectAId,
      projects: [
        {
          id: projectAId,
          name: '企业知识库改造方案',
          type: 'proposal',
          description: '聚焦中型团队，建设可执行的文档检索与流程体系。',
          readers: '技术管理者',
          scale: '8万字',
          idea: '把文档资产从静态沉淀升级为流程驱动的知识系统。',
          outlineStatus: 'draft',
          aiOps: 12,
          adoptedOps: 8,
          check: { lastRunAt: '', issues: [] },
          snapshots: [],
          exportHistory: [],
          chapters: createChapterList([
            '问题界定',
            '现状与瓶颈',
            '目标架构',
            '迁移策略',
          ]),
          createdAt: nowISO(),
          updatedAt: nowISO(),
        },
        {
          id: projectBId,
          name: 'AIGC 行业趋势报告',
          type: 'research',
          description: '跟踪模型落地路径与商业化验证。',
          readers: '战略研究团队',
          scale: '6万字',
          idea: '横向比较主要厂商策略，输出阶段性建议。',
          outlineStatus: 'confirmed',
          aiOps: 24,
          adoptedOps: 16,
          check: { lastRunAt: '', issues: [] },
          snapshots: [],
          exportHistory: [],
          chapters: createChapterList([
            '市场格局',
            '技术路线',
            '商业化进展',
            '风险与监管',
            '未来判断',
          ]),
          createdAt: nowISO(),
          updatedAt: nowISO(),
        },
      ],
      settings: {
        locked: true,
        provider: 'openai',
        model: 'gpt-4.1',
        baseUrl: 'https://api.openai.com/v1',
        strategy: 'balanced',
        temperature: 0.7,
        maxTokens: 4000,
        apiKey: 'sk-live-********',
      },
    };
  }

  function createChapterList(titleParts) {
    return titleParts.map((part, index) => {
      const number = pad(index + 1);
      const content = `# 第 ${number} 章 ${part}\n\n这是“${part}”章节的示例内容。请在工作台继续完善论点与细节。`;
      return {
        id: `ch-${number}`,
        number,
        title: `第 ${number} 章 ${part}`,
        target: `说明${part}相关的关键结论`,
        status: index < 1 ? 'completed' : index < 3 ? 'in_progress' : 'todo',
        content,
        completion: index < 1 ? 100 : index < 3 ? 65 : 18,
        wordCount: countWords(content),
        timeline: [
          {
            id: uid('log'),
            time: prettyTime(new Date()),
            message: '初始化章节内容',
            type: 'info',
          },
        ],
      };
    });
  }

  function initProjectsPage() {
    const projectGrid = byId('projectGrid');
    const projectEmpty = byId('projectEmpty');
    const globalKpi = byId('globalKpi');
    const searchInput = byId('projectSearchInput');
    const createBtn = byId('createProjectBtn');
    const createModal = byId('createModal');
    const closeCreateModalBtn = byId('closeCreateModalBtn');
    const cancelCreateBtn = byId('cancelCreateBtn');
    const createProjectForm = byId('createProjectForm');

    let keyword = '';

    createBtn.addEventListener('click', () => {
      createModal.classList.remove('hidden');
      byId('projectName').focus();
    });

    closeCreateModalBtn.addEventListener('click', closeCreateModal);
    cancelCreateBtn.addEventListener('click', closeCreateModal);

    createModal.addEventListener('click', (event) => {
      if (event.target === createModal) {
        closeCreateModal();
      }
    });

    searchInput.addEventListener('input', (event) => {
      keyword = event.target.value.trim();
      renderProjects();
    });

    createProjectForm.addEventListener('submit', (event) => {
      event.preventDefault();
      const formData = new FormData(createProjectForm);
      const name = String(formData.get('name') || '').trim();
      const idea = String(formData.get('idea') || '').trim();
      if (!name || !idea) {
        pushToast('项目名称和核心想法为必填项', 'error');
        return;
      }

      const type = String(formData.get('type') || 'proposal');
      const description = String(formData.get('description') || '');
      const readers = String(formData.get('readers') || '');
      const scale = String(formData.get('scale') || '');

      const projectId = uid('project');
      const autoTitles = buildAutoOutlineByType(type, idea);
      const nextProject = {
        id: projectId,
        name,
        type,
        description,
        readers,
        scale,
        idea,
        outlineStatus: 'draft',
        aiOps: 0,
        adoptedOps: 0,
        check: { lastRunAt: '', issues: [] },
        snapshots: [],
        exportHistory: [],
        chapters: createChapterList(autoTitles),
        createdAt: nowISO(),
        updatedAt: nowISO(),
      };

      state.projects.unshift(nextProject);
      state.activeProjectId = projectId;
      persist();
      closeCreateModal();
      createProjectForm.reset();
      renderProjects();
      renderGlobalKpi();
      pushToast('项目已创建，正在进入工作台', 'success');
      setTimeout(() => {
        window.location.href = `./workspace.html?projectId=${encodeURIComponent(projectId)}`;
      }, 320);
    });

    projectGrid.addEventListener('click', (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;

      const openButton = target.closest('[data-open-project]');
      if (openButton) {
        const projectId = openButton.getAttribute('data-open-project');
        if (!projectId) return;
        state.activeProjectId = projectId;
        persist();
        window.location.href = `./workspace.html?projectId=${encodeURIComponent(projectId)}`;
        return;
      }

      const deleteButton = target.closest('[data-delete-project]');
      if (deleteButton) {
        const projectId = deleteButton.getAttribute('data-delete-project');
        if (!projectId) return;
        const project = findProject(projectId);
        if (!project) return;
        const confirmed = window.confirm(`确定删除项目“${project.name}”吗？`);
        if (!confirmed) return;

        state.projects = state.projects.filter((item) => item.id !== projectId);
        if (state.activeProjectId === projectId) {
          state.activeProjectId = state.projects[0]?.id || null;
        }
        persist();
        renderProjects();
        renderGlobalKpi();
        pushToast('项目已删除', 'info');
      }
    });

    renderGlobalKpi();
    renderProjects();

    function closeCreateModal() {
      createModal.classList.add('hidden');
    }

    function renderGlobalKpi() {
      const totalProjects = state.projects.length;
      const totalChapters = state.projects.reduce((sum, project) => sum + project.chapters.length, 0);
      const totalWords = state.projects.reduce(
        (sum, project) => sum + project.chapters.reduce((chapterSum, chapter) => chapterSum + chapter.wordCount, 0),
        0
      );
      const totalAiOps = state.projects.reduce((sum, project) => sum + (project.aiOps || 0), 0);

      globalKpi.innerHTML = [
        kpiCard('项目总数', String(totalProjects)),
        kpiCard('总章节数', String(totalChapters)),
        kpiCard('累计字数', totalWords.toLocaleString()),
        kpiCard('AI 操作次数', String(totalAiOps)),
      ].join('');
    }

    function renderProjects() {
      const list = state.projects.filter((project) => {
        if (!keyword) return true;
        return project.name.toLowerCase().includes(keyword.toLowerCase());
      });

      if (list.length === 0) {
        projectGrid.classList.add('hidden');
        projectEmpty.classList.remove('hidden');
        return;
      }

      projectGrid.classList.remove('hidden');
      projectEmpty.classList.add('hidden');

      projectGrid.innerHTML = list
        .map((project) => {
          const totalWords = project.chapters.reduce((sum, chapter) => sum + chapter.wordCount, 0);
          const completed = project.chapters.filter((chapter) => chapter.status === 'completed').length;
          return `
            <article class="project-card">
              <div class="project-head">
                <strong>${escapeHtml(project.name)}</strong>
                <span class="tag">${escapeHtml(PROJECT_TYPE_LABEL[project.type] || project.type)}</span>
              </div>
              <p>${escapeHtml(project.description || '暂无描述')}</p>
              <div class="meta">
                <span>${project.chapters.length} 章节 / ${completed} 完成</span>
                <span>${totalWords.toLocaleString()} 字</span>
              </div>
              <div class="action-row compact left">
                <button class="btn btn-primary" type="button" data-open-project="${project.id}">进入工作台</button>
                <button class="btn btn-ghost" type="button" data-delete-project="${project.id}">删除</button>
              </div>
            </article>
          `;
        })
        .join('');
    }
  }

  function initWorkspacePage() {
    const workspaceHeader = byId('workspaceHeader');
    const tabButtons = Array.from(document.querySelectorAll('.tab-btn'));
    const tabPanels = Array.from(document.querySelectorAll('.tab-panel'));

    const outlineStatus = byId('outlineStatus');
    const outlineList = byId('outlineList');
    const generateOutlineBtn = byId('generateOutlineBtn');
    const addChapterBtn = byId('addChapterBtn');

    const chapterCountTag = byId('chapterCountTag');
    const chapterSidebarList = byId('chapterSidebarList');
    const chapterEditorHeader = byId('chapterEditorHeader');
    const chapterEditor = byId('chapterEditor');
    const chapterTimeline = byId('chapterTimeline');
    const saveChapterBtn = byId('saveChapterBtn');
    const snapshotBtn = byId('snapshotBtn');

    const metricsGrid = byId('metricsGrid');
    const refreshMetricsBtn = byId('refreshMetricsBtn');

    const runCheckBtn = byId('runCheckBtn');
    const checkHint = byId('checkHint');
    const issueList = byId('issueList');

    const exportFormat = byId('exportFormat');
    const exportBtn = byId('exportBtn');
    const previewBtn = byId('previewBtn');
    const openDirBtn = byId('openDirBtn');
    const exportHistory = byId('exportHistory');
    const exportPreview = byId('exportPreview');

    const project = resolveWorkspaceProject();
    if (!project) {
      workspaceHeader.innerHTML = `
        <h2>未找到项目</h2>
        <p>请先在项目页创建项目后再进入工作台。</p>
        <div class="action-row left"><a class="btn btn-primary" href="./index.html">返回项目页</a></div>
      `;
      byId('workspaceHeader').classList.remove('hidden');
      document.querySelector('.tabs').classList.add('hidden');
      return;
    }

    let selectedChapterId = project.chapters[0]?.id || null;
    let currentTab = 'outline';

    renderAll();

    tabButtons.forEach((button) => {
      button.addEventListener('click', () => {
        const nextTab = button.dataset.tab;
        if (!nextTab) return;
        currentTab = nextTab;
        tabButtons.forEach((item) => item.classList.toggle('active', item === button));
        tabPanels.forEach((panel) => {
          panel.classList.toggle('hidden', panel.dataset.panel !== nextTab);
        });
      });
    });

    generateOutlineBtn.addEventListener('click', () => {
      const confirmed = window.confirm('重新生成大纲会覆盖当前章节结构，是否继续？');
      if (!confirmed) return;
      project.chapters = createChapterList(buildAutoOutlineByType(project.type, project.idea));
      project.outlineStatus = 'draft';
      selectedChapterId = project.chapters[0]?.id || null;
      touchProject(project);
      persist();
      renderAll();
      pushToast('大纲已重新生成', 'success');
    });

    addChapterBtn.addEventListener('click', () => {
      const number = pad(project.chapters.length + 1);
      const chapter = {
        id: `ch-${number}`,
        number,
        title: `第 ${number} 章 新章节`,
        target: '补充章节目标',
        status: 'todo',
        content: `# 第 ${number} 章 新章节\n\n请输入章节内容...`,
        completion: 8,
        wordCount: 8,
        timeline: [
          {
            id: uid('log'),
            time: prettyTime(new Date()),
            message: '创建章节',
            type: 'info',
          },
        ],
      };
      project.chapters.push(chapter);
      selectedChapterId = chapter.id;
      project.outlineStatus = 'draft';
      touchProject(project);
      persist();
      renderAll();
      pushToast('已添加新章节', 'success');
    });

    outlineList.addEventListener('click', (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      const chapterId = target.getAttribute('data-chapter-id');
      if (!chapterId) return;
      const chapter = findChapter(project, chapterId);
      if (!chapter) return;

      if (target.matches('[data-action="cycle-status"]')) {
        chapter.status = nextStatus(chapter.status);
        touchProject(project);
        persist();
        renderAll();
        return;
      }

      if (target.matches('[data-action="open-editor"]')) {
        selectedChapterId = chapterId;
        setTab('chapters');
        renderChaptersTab();
        return;
      }

      if (target.matches('[data-action="delete-chapter"]')) {
        if (project.chapters.length <= 1) {
          pushToast('至少保留一个章节', 'error');
          return;
        }
        const confirmed = window.confirm(`确定删除章节“${chapter.title}”吗？`);
        if (!confirmed) return;
        project.chapters = project.chapters.filter((item) => item.id !== chapterId);
        project.chapters.forEach((item, index) => {
          item.number = pad(index + 1);
          if (!item.title.startsWith(`第 ${item.number} 章`)) return;
        });
        if (selectedChapterId === chapterId) {
          selectedChapterId = project.chapters[0]?.id || null;
        }
        touchProject(project);
        persist();
        renderAll();
        pushToast('章节已删除', 'info');
      }
    });

    outlineList.addEventListener('change', (event) => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement)) return;
      const chapterId = target.getAttribute('data-title-input');
      if (!chapterId) return;
      const chapter = findChapter(project, chapterId);
      if (!chapter) return;
      chapter.title = target.value.trim() || chapter.title;
      touchProject(project);
      persist();
      renderChaptersTab();
    });

    chapterSidebarList.addEventListener('click', (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      const button = target.closest('[data-select-chapter]');
      if (!button) return;
      const chapterId = button.getAttribute('data-select-chapter');
      if (!chapterId) return;
      selectedChapterId = chapterId;
      renderChaptersTab();
    });

    saveChapterBtn.addEventListener('click', () => {
      const chapter = getSelectedChapter();
      if (!chapter) return;
      chapter.content = chapterEditor.value;
      updateChapterMetrics(chapter);
      chapter.timeline.unshift({
        id: uid('log'),
        time: prettyTime(new Date()),
        message: '手动保存章节',
        type: 'info',
      });
      touchProject(project);
      persist();
      renderChaptersTab();
      renderMetrics();
      pushToast('章节已保存', 'success');
    });

    snapshotBtn.addEventListener('click', () => {
      const chapter = getSelectedChapter();
      if (!chapter) return;
      const snapshotId = uid('snapshot');
      project.snapshots.unshift({
        id: snapshotId,
        chapterId: chapter.id,
        chapterTitle: chapter.title,
        createdAt: nowISO(),
      });
      chapter.timeline.unshift({
        id: uid('log'),
        time: prettyTime(new Date()),
        message: `创建快照 ${snapshotId}`,
        type: 'snapshot',
      });
      touchProject(project);
      persist();
      renderChaptersTab();
      pushToast('已创建章节快照', 'success');
    });

    chapterEditor.addEventListener('input', () => {
      const chapter = getSelectedChapter();
      if (!chapter) return;
      chapter.content = chapterEditor.value;
      updateChapterMetrics(chapter);
      chapter.status = chapter.completion >= 100 ? 'completed' : 'in_progress';
      touchProject(project);
      persist();
      renderChapterSidebar();
      renderMetrics();
    });

    document.querySelector('.intent-wrap').addEventListener('click', (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      const intent = target.getAttribute('data-intent');
      if (!intent) return;
      const chapter = getSelectedChapter();
      if (!chapter) return;

      const generated = generateIntentText(intent, project, chapter);
      if (intent === 'rewrite') {
        chapter.content = `${generated}\n\n${chapter.content}`;
      } else {
        chapter.content = `${chapter.content}\n\n${generated}`;
      }
      updateChapterMetrics(chapter);
      chapter.status = chapter.completion >= 100 ? 'completed' : 'in_progress';
      chapter.timeline.unshift({
        id: uid('log'),
        time: prettyTime(new Date()),
        message: `AI ${intentLabel(intent)}：新增建议内容`,
        type: 'ai',
      });
      project.aiOps += 1;
      if (intent === 'continue' || intent === 'expand' || intent === 'polish') {
        project.adoptedOps += 1;
      }
      touchProject(project);
      persist();
      renderChaptersTab();
      renderMetrics();
      pushToast(`AI ${intentLabel(intent)} 已生成建议`, 'success');
    });

    refreshMetricsBtn.addEventListener('click', () => {
      renderMetrics();
      pushToast('统计已刷新', 'info');
    });

    runCheckBtn.addEventListener('click', () => {
      project.check.issues = runProjectChecks(project);
      project.check.lastRunAt = nowISO();
      touchProject(project);
      persist();
      renderCheck();
      if (project.check.issues.length === 0) {
        pushToast('检查通过，未发现问题', 'success');
      } else {
        pushToast(`检查完成，发现 ${project.check.issues.length} 项问题`, 'info');
      }
    });

    issueList.addEventListener('click', (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      const issueId = target.getAttribute('data-issue-id');
      if (!issueId) return;

      const issue = project.check.issues.find((item) => item.id === issueId);
      if (!issue) return;

      if (target.matches('[data-action="fix-issue"]')) {
        fixIssue(project, issue);
        project.check.issues = project.check.issues.filter((item) => item.id !== issueId);
        touchProject(project);
        persist();
        renderAll();
        pushToast('问题已修复', 'success');
      }

      if (target.matches('[data-action="ignore-issue"]')) {
        project.check.issues = project.check.issues.filter((item) => item.id !== issueId);
        touchProject(project);
        persist();
        renderCheck();
        pushToast('已忽略该问题', 'info');
      }
    });

    previewBtn.addEventListener('click', () => {
      const format = exportFormat.value;
      exportPreview.textContent = buildPreviewContent(project, format);
      pushToast('预览已生成', 'info');
    });

    exportBtn.addEventListener('click', () => {
      const format = exportFormat.value;
      const ext = format === 'md' ? 'md' : format === 'html' ? 'html' : 'pdf';
      const history = {
        id: uid('export'),
        format,
        filePath: `/output/${project.id}/final.${ext}`,
        createdAt: nowISO(),
      };
      project.exportHistory.unshift(history);
      touchProject(project);
      persist();
      renderExport();
      pushToast(`导出成功：${history.filePath}`, 'success');
    });

    openDirBtn.addEventListener('click', () => {
      pushToast('已打开导出目录（原型模拟）', 'info');
    });

    function resolveWorkspaceProject() {
      const url = new URL(window.location.href);
      const queryProjectId = url.searchParams.get('projectId');
      const projectId = queryProjectId || state.activeProjectId;
      if (!projectId) return null;
      state.activeProjectId = projectId;
      persist();
      return findProject(projectId);
    }

    function setTab(tab) {
      currentTab = tab;
      tabButtons.forEach((button) => {
        button.classList.toggle('active', button.dataset.tab === tab);
      });
      tabPanels.forEach((panel) => {
        panel.classList.toggle('hidden', panel.dataset.panel !== tab);
      });
    }

    function renderAll() {
      renderHeader();
      renderOutline();
      renderChaptersTab();
      renderMetrics();
      renderCheck();
      renderExport();
      setTab(currentTab);
    }

    function renderHeader() {
      const completed = project.chapters.filter((chapter) => chapter.status === 'completed').length;
      workspaceHeader.innerHTML = `
        <div class="header-line">
          <div>
            <h2>${escapeHtml(project.name)}</h2>
            <p>${escapeHtml(project.description || '暂无描述')}</p>
          </div>
        </div>
        <div class="kpi-grid">
          ${kpiCard('章节总数', String(project.chapters.length))}
          ${kpiCard('已完成', String(completed))}
          ${kpiCard('快照数量', String(project.snapshots.length))}
          ${kpiCard('最近更新', prettyDate(project.updatedAt))}
        </div>
      `;
    }

    function renderOutline() {
      const completed = project.chapters.filter((chapter) => chapter.status === 'completed').length;
      outlineStatus.textContent = `大纲状态：${project.outlineStatus === 'confirmed' ? '已确认' : '草稿'} · 共 ${project.chapters.length} 章 · ${completed} 章已完成`;
      outlineStatus.classList.toggle('muted', project.outlineStatus !== 'confirmed');

      outlineList.innerHTML = project.chapters
        .map((chapter) => {
          return `
            <article class="outline-item">
              <div class="outline-main">
                <span class="outline-no">${chapter.number}</span>
                <input data-title-input="${chapter.id}" value="${escapeHtml(chapter.title)}" />
                <small>${escapeHtml(chapter.target || '未设置章节目标')}</small>
              </div>
              <div class="outline-actions">
                <button class="btn btn-ghost" type="button" data-action="cycle-status" data-chapter-id="${chapter.id}">${STATUS_LABEL[chapter.status]}</button>
                <button class="btn btn-ghost" type="button" data-action="open-editor" data-chapter-id="${chapter.id}">编辑</button>
                <button class="btn btn-ghost" type="button" data-action="delete-chapter" data-chapter-id="${chapter.id}">删除</button>
              </div>
            </article>
          `;
        })
        .join('');
    }

    function renderChaptersTab() {
      renderChapterSidebar();

      const selected = getSelectedChapter();
      if (!selected) {
        chapterEditorHeader.innerHTML = '<h3>暂无章节</h3>';
        chapterEditor.value = '';
        chapterTimeline.innerHTML = '';
        return;
      }

      chapterEditorHeader.innerHTML = `
        <div>
          <h3>${escapeHtml(selected.title)}</h3>
          <p>${selected.number} · ${selected.wordCount.toLocaleString()} 字 · 完成度 ${selected.completion}%</p>
        </div>
      `;
      chapterEditor.value = selected.content;

      chapterTimeline.innerHTML = selected.timeline
        .slice(0, 8)
        .map((log) => `<li><strong>${escapeHtml(log.time)}</strong><span>${escapeHtml(log.message)}</span></li>`)
        .join('');
    }

    function renderChapterSidebar() {
      chapterCountTag.textContent = `${project.chapters.length} 章`;
      chapterSidebarList.innerHTML = project.chapters
        .map((chapter) => {
          const selected = chapter.id === selectedChapterId;
          return `
            <li class="chapter-item ${selected ? 'active' : ''}">
              <button type="button" class="chapter-btn" data-select-chapter="${chapter.id}">
                <h4>${escapeHtml(chapter.title)}</h4>
                <span>${chapter.number} · ${chapter.wordCount.toLocaleString()} 字 · ${STATUS_LABEL[chapter.status]}</span>
              </button>
            </li>
          `;
        })
        .join('');
    }

    function renderMetrics() {
      const totalChapters = project.chapters.length;
      const completed = project.chapters.filter((chapter) => chapter.status === 'completed').length;
      const totalWords = project.chapters.reduce((sum, chapter) => sum + chapter.wordCount, 0);
      const avgCompletion = totalChapters ? Math.round(project.chapters.reduce((sum, chapter) => sum + chapter.completion, 0) / totalChapters) : 0;
      const adoptionRate = project.aiOps > 0 ? Math.round((project.adoptedOps / project.aiOps) * 100) : 0;

      metricsGrid.innerHTML = [
        kpiCard('总章节', String(totalChapters)),
        kpiCard('已完成章节', String(completed)),
        kpiCard('总字数', totalWords.toLocaleString()),
        kpiCard('平均完成度', `${avgCompletion}%`),
        kpiCard('AI 操作', String(project.aiOps)),
        kpiCard('AI 采纳率', `${adoptionRate}%`),
        kpiCard('快照数量', String(project.snapshots.length)),
        kpiCard('导出次数', String(project.exportHistory.length)),
      ].join('');
    }

    function renderCheck() {
      const issues = project.check.issues || [];
      if (!project.check.lastRunAt) {
        checkHint.textContent = '点击“运行检查”开始分析当前项目。';
      } else {
        checkHint.textContent = `最近检查：${prettyDate(project.check.lastRunAt)} · 问题 ${issues.length} 项`;
      }

      if (issues.length === 0) {
        issueList.innerHTML = '<div class="empty"><h4>暂无问题</h4><p>可继续编辑或导出。</p></div>';
        return;
      }

      issueList.innerHTML = issues
        .map((issue) => {
          return `
            <article class="issue-item">
              <div>
                <strong>${escapeHtml(ISSUE_LABEL[issue.type] || issue.type)}</strong>
                <p>${escapeHtml(issue.message)}</p>
              </div>
              <div class="action-row compact">
                <button class="btn btn-ghost" type="button" data-action="fix-issue" data-issue-id="${issue.id}">修复</button>
                <button class="btn btn-ghost" type="button" data-action="ignore-issue" data-issue-id="${issue.id}">忽略</button>
              </div>
            </article>
          `;
        })
        .join('');
    }

    function renderExport() {
      const history = project.exportHistory || [];
      if (history.length === 0) {
        exportHistory.innerHTML = '<li class="empty small"><p>暂无导出记录</p></li>';
      } else {
        exportHistory.innerHTML = history
          .slice(0, 10)
          .map((item) => {
            return `
              <li class="history-item">
                <div>
                  <strong>${escapeHtml(item.format.toUpperCase())}</strong>
                  <p>${escapeHtml(item.filePath)}</p>
                </div>
                <span>${prettyDate(item.createdAt)}</span>
              </li>
            `;
          })
          .join('');
      }
    }

    function getSelectedChapter() {
      if (!selectedChapterId) return null;
      return findChapter(project, selectedChapterId);
    }
  }

  function initSettingsPage() {
    const settings = state.settings;

    const lockBanner = byId('lockBanner');
    const unlockBtn = byId('unlockBtn');
    const testConnectionBtn = byId('testConnectionBtn');
    const settingsForm = byId('settingsForm');
    const advancedPanel = byId('advancedPanel');

    const providerInput = byId('providerInput');
    const modelInput = byId('modelInput');
    const baseUrlInput = byId('baseUrlInput');
    const strategyInput = byId('strategyInput');
    const temperatureInput = byId('temperatureInput');
    const maxTokensInput = byId('maxTokensInput');
    const apiKeyInput = byId('apiKeyInput');

    const lockables = Array.from(document.querySelectorAll('[data-lockable]'));

    providerInput.value = settings.provider;
    modelInput.value = settings.model;
    baseUrlInput.value = settings.baseUrl;
    strategyInput.value = settings.strategy;
    temperatureInput.value = String(settings.temperature);
    maxTokensInput.value = String(settings.maxTokens);
    apiKeyInput.value = settings.apiKey;

    setLocked(Boolean(settings.locked));

    unlockBtn.addEventListener('click', () => {
      setLocked(!settings.locked);
    });

    testConnectionBtn.addEventListener('click', () => {
      pushToast('连接成功（原型模拟）', 'success');
    });

    settingsForm.addEventListener('submit', (event) => {
      event.preventDefault();
      settings.provider = providerInput.value;
      settings.model = modelInput.value.trim() || settings.model;
      settings.baseUrl = baseUrlInput.value.trim() || settings.baseUrl;
      settings.strategy = strategyInput.value;
      settings.temperature = Number(temperatureInput.value) || 0.7;
      settings.maxTokens = Number(maxTokensInput.value) || 4000;
      settings.apiKey = apiKeyInput.value.trim() || settings.apiKey;

      setLocked(true);
      advancedPanel.open = false;
      persist();
      pushToast('设置已保存并自动收起高级参数', 'success');
    });

    function setLocked(nextLocked) {
      settings.locked = nextLocked;
      lockables.forEach((element) => {
        element.disabled = nextLocked;
      });

      if (nextLocked) {
        lockBanner.textContent = '当前状态：已锁定，仅可查看。';
        lockBanner.classList.remove('warn');
        unlockBtn.textContent = '解锁编辑';
      } else {
        lockBanner.textContent = '当前状态：已解锁。请谨慎修改底层参数。';
        lockBanner.classList.add('warn');
        unlockBtn.textContent = '取消解锁';
      }
      persist();
    }
  }

  function findProject(projectId) {
    return state.projects.find((project) => project.id === projectId) || null;
  }

  function findChapter(project, chapterId) {
    return project.chapters.find((chapter) => chapter.id === chapterId) || null;
  }

  function touchProject(project) {
    project.updatedAt = nowISO();
  }

  function countWords(content) {
    const text = String(content || '').replace(/\s+/g, ' ').trim();
    if (!text) return 0;
    return text.length;
  }

  function updateChapterMetrics(chapter) {
    chapter.wordCount = countWords(chapter.content);
    const completion = Math.round((chapter.wordCount / 2000) * 100);
    chapter.completion = Math.max(5, Math.min(100, completion));
    if (chapter.completion >= 100) {
      chapter.status = 'completed';
    }
  }

  function nextStatus(status) {
    const index = STATUS_ORDER.indexOf(status);
    if (index < 0) return 'todo';
    return STATUS_ORDER[(index + 1) % STATUS_ORDER.length];
  }

  function runProjectChecks(project) {
    const issues = [];

    if (project.chapters.length < 3) {
      issues.push({
        id: uid('issue'),
        type: 'missing_chapter',
        message: '章节数量偏少，建议至少 3 章以上。',
      });
    }

    const titleCount = {};
    project.chapters.forEach((chapter) => {
      titleCount[chapter.title] = (titleCount[chapter.title] || 0) + 1;
    });

    project.chapters.forEach((chapter) => {
      if (chapter.completion < 40) {
        issues.push({
          id: uid('issue'),
          type: 'low_completion',
          chapterId: chapter.id,
          message: `章节“${chapter.title}”完成度仅 ${chapter.completion}%`,
        });
      }

      if (chapter.wordCount < 60) {
        issues.push({
          id: uid('issue'),
          type: 'empty_content',
          chapterId: chapter.id,
          message: `章节“${chapter.title}”内容偏少，建议补充主体段落。`,
        });
      }

      if (titleCount[chapter.title] > 1) {
        issues.push({
          id: uid('issue'),
          type: 'duplicate_title',
          chapterId: chapter.id,
          message: `章节标题“${chapter.title}”存在重复。`,
        });
      }
    });

    return issues;
  }

  function fixIssue(project, issue) {
    if (issue.type === 'missing_chapter') {
      const number = pad(project.chapters.length + 1);
      project.chapters.push({
        id: `ch-${number}`,
        number,
        title: `第 ${number} 章 补充章节`,
        target: '通过检查自动补充章节',
        status: 'todo',
        content: `# 第 ${number} 章 补充章节\n\n这是根据检查结果自动补充的章节。`,
        completion: 10,
        wordCount: 42,
        timeline: [
          {
            id: uid('log'),
            time: prettyTime(new Date()),
            message: '检查修复自动创建章节',
            type: 'fix',
          },
        ],
      });
      return;
    }

    if (!issue.chapterId) return;
    const chapter = findChapter(project, issue.chapterId);
    if (!chapter) return;

    if (issue.type === 'low_completion') {
      chapter.content += '\n\n[检查修复] 已补充结构化要点与结论段落。';
      updateChapterMetrics(chapter);
      chapter.timeline.unshift({
        id: uid('log'),
        time: prettyTime(new Date()),
        message: '检查修复：补充章节内容',
        type: 'fix',
      });
    }

    if (issue.type === 'empty_content') {
      chapter.content += '\n\n[检查修复] 已自动插入章节主体初稿。';
      updateChapterMetrics(chapter);
      chapter.timeline.unshift({
        id: uid('log'),
        time: prettyTime(new Date()),
        message: '检查修复：填充空白内容',
        type: 'fix',
      });
    }

    if (issue.type === 'duplicate_title') {
      chapter.title = `${chapter.title}（修订）`;
    }
  }

  function buildPreviewContent(project, format) {
    const chapterTexts = project.chapters
      .map((chapter) => `## ${chapter.title}\n\n${chapter.content}`)
      .join('\n\n');

    if (format === 'md') {
      return `# ${project.name}\n\n${chapterTexts}`.slice(0, 4000);
    }

    if (format === 'html') {
      const escaped = escapeHtml(chapterTexts).replace(/\n/g, '<br>');
      return `<h1>${escapeHtml(project.name)}</h1><br><br>${escaped}`.slice(0, 4000);
    }

    return `PDF 预览（文本片段）\n\n${chapterTexts}`.slice(0, 4000);
  }

  function generateIntentText(intent, project, chapter) {
    const now = prettyTime(new Date());
    const map = {
      continue: `【AI续写 ${now}】围绕“${chapter.title}”，补充下一段论证，并与项目目标“${project.idea}”保持一致。`,
      expand: `【AI扩写 ${now}】将当前论点展开为“背景-方案-收益-风险”四段结构。`,
      rewrite: `【AI重写 ${now}】将章节首段改写为更清晰的总分结构，突出行动建议。`,
      add_argument: `【AI补论证 ${now}】补充一组可量化指标，强化结论可信度。`,
      polish: `【AI润色 ${now}】统一术语表达，消除重复语句，增强可读性。`,
      simplify: `【AI简化 ${now}】将复杂句拆解成短句，降低阅读成本。`,
    };
    return map[intent] || `【AI建议 ${now}】补充章节内容。`;
  }

  function intentLabel(intent) {
    const map = {
      continue: '续写',
      expand: '扩写',
      rewrite: '重写',
      add_argument: '补论证',
      polish: '润色',
      simplify: '简化',
    };
    return map[intent] || intent;
  }

  function buildAutoOutlineByType(type, idea) {
    if (type === 'novel') {
      return ['世界观引入', '人物与冲突', '剧情推进', '高潮与反转', '收束与余韵'];
    }
    if (type === 'research') {
      return ['研究背景', '问题定义', '方法设计', '结果分析', '结论与建议'];
    }
    if (type === 'report') {
      return ['背景概览', '现状分析', '关键问题', '改进方案', '执行计划'];
    }
    const hint = String(idea || '').slice(0, 8) || '主题';
    return ['背景与目标', '现状与挑战', '核心方案', '实施路径', `${hint}收束`];
  }

  function kpiCard(label, value) {
    return `<article class="kpi"><small>${escapeHtml(label)}</small><strong>${escapeHtml(value)}</strong></article>`;
  }

  function byId(id) {
    return document.getElementById(id);
  }

  function uid(prefix) {
    return `${prefix}-${Math.random().toString(16).slice(2, 8)}${Date.now().toString(16).slice(-4)}`;
  }

  function nowISO() {
    return new Date().toISOString();
  }

  function prettyDate(input) {
    const date = new Date(input);
    if (Number.isNaN(date.getTime())) return '-';
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  function prettyTime(date) {
    return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  function pad(value) {
    return String(value).padStart(2, '0');
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function pushToast(message, type) {
    const container = byId('toastContainer');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast ${type || 'info'}`;
    toast.textContent = message;
    container.appendChild(toast);

    window.setTimeout(() => {
      toast.classList.add('fade-out');
      window.setTimeout(() => {
        toast.remove();
      }, 220);
    }, 2200);
  }
})();
