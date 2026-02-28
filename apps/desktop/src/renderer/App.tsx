import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  HashRouter,
  Link,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useParams,
} from 'react-router-dom';
import {
  API_ERROR_EVENT,
  aiApi,
  chapterApi,
  checkApi,
  exportApi,
  metricsApi,
  outlineApi,
  projectApi,
  snapshotApi,
  type ApiErrorDetail,
} from './services/api';
import type {
  AIOperation,
  Chapter,
  ChapterSummary,
  Outline,
  OutlineChapter,
  Project,
  ProjectMetrics,
} from './types/api';

interface LLMConfig {
  provider: string;
  model: string;
  apiKey: string;
  baseUrl: string;
  temperature: number;
  maxTokens: number;
}

interface StrategyOption {
  id: string;
  name: string;
  description: string;
}

interface CheckIssueItem {
  id?: string;
  type: string;
  message: string;
  chapterId?: string;
  chapterTitle?: string;
  suggestion?: string;
}

interface ExportHistoryItem {
  format?: string;
  filePath?: string;
  createdAt?: string;
}

interface PageProps {
  addToast?: (message: string, type?: Toast['type']) => void;
}

interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info';
}

type AppNav = 'projects' | 'workspace' | 'settings';
type WorkspaceTab = 'outline' | 'chapters' | 'metrics' | 'check' | 'export';

function Loading(): JSX.Element {
  return (
    <div className="loading-state card-lite">
      <div className="spinner" />
      <p>加载中...</p>
    </div>
  );
}

function AppTopbar({ active }: { active: AppNav }): JSX.Element {
  return (
    <header className="topbar card">
      <div className="brand">
        <span className="logo" />
        <div>
          <h1>Zide Workbench</h1>
          <p>长文生产系统 · 交互版前端</p>
        </div>
      </div>
      <nav className="nav-pills" aria-label="主导航">
        <Link to="/" className={active === 'projects' ? 'active' : ''}>项目</Link>
        <Link to="/project" className={active === 'workspace' ? 'active' : ''}>工作台</Link>
        <Link to="/settings" className={active === 'settings' ? 'active' : ''}>AI设置</Link>
      </nav>
    </header>
  );
}

function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}): JSX.Element {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal card" onClick={(event) => event.stopPropagation()}>
        <div className="modal-head">
          <h3>{title}</h3>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="关闭弹窗">x</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function ToastContainer({
  toasts,
  onRemove,
}: {
  toasts: Toast[];
  onRemove: (id: number) => void;
}): JSX.Element {
  return (
    <div className="toast-container" aria-live="polite">
      {toasts.map((toast) => (
        <button
          key={toast.id}
          type="button"
          className={`toast ${toast.type}`}
          onClick={() => onRemove(toast.id)}
        >
          {toast.message}
        </button>
      ))}
    </div>
  );
}

function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((message: string, type: Toast['type'] = 'info') => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setToasts((prev) => [...prev, { id, message, type }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((item) => item.id !== id));
    }, 2800);
  }, []);

  const removeToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((item) => item.id !== id));
  }, []);

  return { toasts, addToast, removeToast };
}

function ProjectListPage({ addToast }: PageProps): JSX.Element {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [keyword, setKeyword] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    type: 'proposal',
    idea: '',
    description: '',
    readers: '',
    scale: '',
  });

  const loadProjects = useCallback(async () => {
    setLoading(true);
    const result = await projectApi.list();
    setProjects(result);
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadProjects();
  }, [loadProjects]);

  const visibleProjects = useMemo(() => {
    const trimmed = keyword.trim().toLowerCase();
    if (!trimmed) return projects;
    return projects.filter((project) => project.name.toLowerCase().includes(trimmed));
  }, [projects, keyword]);

  const projectKpi = useMemo(() => {
    const totalProjects = projects.length;
    const totalChapters = projects.reduce((sum, project) => sum + project.chapterIds.length, 0);
    const workingProjects = projects.filter((project) => project.status !== 'completed' && project.status !== 'archived').length;
    const latestUpdate = projects
      .map((project) => Date.parse(project.updatedAt))
      .filter((time) => Number.isFinite(time))
      .sort((a, b) => b - a)[0];

    return {
      totalProjects,
      totalChapters,
      workingProjects,
      latestUpdate: latestUpdate ? formatDateTime(new Date(latestUpdate).toISOString()) : '-',
    };
  }, [projects]);

  const handleCreateProject = async () => {
    if (!formData.name.trim() || !formData.idea.trim()) {
      addToast?.('项目名称和核心想法为必填项', 'error');
      return;
    }

    const created = await projectApi.create({
      name: formData.name.trim(),
      type: formData.type,
      idea: formData.idea.trim(),
      description: formData.description.trim(),
      readers: formData.readers.trim(),
      scale: formData.scale.trim(),
    });

    if (!created) {
      addToast?.('创建项目失败，请检查 AI 设置后重试', 'error');
      return;
    }

    addToast?.('项目创建成功，已进入工作台', 'success');
    setShowCreateModal(false);
    setFormData({ name: '', type: 'proposal', idea: '', description: '', readers: '', scale: '' });
    void loadProjects();
    navigate(`/project/${created.id}`);
  };

  const handleDeleteProject = async (project: Project) => {
    const confirmed = window.confirm(`确定删除项目“${project.name}”吗？`);
    if (!confirmed) return;

    const ok = await projectApi.delete(project.id);
    if (ok) {
      addToast?.('项目已删除', 'info');
      void loadProjects();
    }
  };

  return (
    <div className="page-shell">
      <AppTopbar active="projects" />

      <section className="card page-head">
        <div className="page-head-row">
          <div>
            <h2>项目总览</h2>
            <p>先选项目，再进入工作台推进章节，不在这里暴露底层模型参数。</p>
          </div>
          <button type="button" className="btn btn-primary" onClick={() => setShowCreateModal(true)}>+ 新建项目</button>
        </div>
        <div className="kpi-grid">
          <article className="kpi-card"><small>项目总数</small><strong>{projectKpi.totalProjects}</strong></article>
          <article className="kpi-card"><small>总章节数</small><strong>{projectKpi.totalChapters}</strong></article>
          <article className="kpi-card"><small>进行中项目</small><strong>{projectKpi.workingProjects}</strong></article>
          <article className="kpi-card"><small>最近更新</small><strong>{projectKpi.latestUpdate}</strong></article>
        </div>
      </section>

      <section className="card section-card">
        <div className="section-head">
          <h3>我的项目</h3>
          <input
            type="search"
            className="search-input"
            placeholder="搜索项目名称"
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
          />
        </div>

        {loading ? (
          <Loading />
        ) : visibleProjects.length === 0 ? (
          <div className="empty-block">
            <h4>暂无项目</h4>
            <p>点击“新建项目”开始第一篇长文。</p>
          </div>
        ) : (
          <div className="project-grid">
            {visibleProjects.map((project) => (
              <article key={project.id} className="project-card">
                <div className="project-card-head">
                  <strong>{project.name}</strong>
                  <span className="tag">{formatProjectType(project.type)}</span>
                </div>
                <p>{project.description || '暂无描述'}</p>
                <div className="project-meta">
                  <span>{project.chapterIds.length} 章节</span>
                  <span>{formatDate(project.updatedAt)}</span>
                </div>
                <div className="project-actions">
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => navigate(`/project/${project.id}`)}
                  >
                    进入工作台
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => void handleDeleteProject(project)}
                  >
                    删除
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="card section-card">
        <h3>建议流程</h3>
        <ul className="hint-list">
          <li>1. 先创建项目并生成大纲，再进入章节工作台逐章推进。</li>
          <li>2. 关键改动前创建快照，确保回滚成本可控。</li>
          <li>3. 交付前先运行整体检查，再到导出中心输出文件。</li>
        </ul>
      </section>

      {showCreateModal && (
        <Modal title="新建项目" onClose={() => setShowCreateModal(false)}>
          <div className="form-grid">
            <div className="field">
              <label htmlFor="project-name">项目名称 *</label>
              <input
                id="project-name"
                value={formData.name}
                onChange={(event) => setFormData((prev) => ({ ...prev, name: event.target.value }))}
                placeholder="例如：企业知识库改造方案"
              />
            </div>
            <div className="field">
              <label htmlFor="project-type">项目类型</label>
              <select
                id="project-type"
                value={formData.type}
                onChange={(event) => setFormData((prev) => ({ ...prev, type: event.target.value }))}
              >
                <option value="proposal">方案</option>
                <option value="report">报告</option>
                <option value="research">研究报告</option>
                <option value="novel">小说</option>
                <option value="other">其他</option>
              </select>
            </div>
            <div className="field field-full">
              <label htmlFor="project-idea">核心想法 *</label>
              <textarea
                id="project-idea"
                rows={3}
                value={formData.idea}
                onChange={(event) => setFormData((prev) => ({ ...prev, idea: event.target.value }))}
                placeholder="描述目标、核心观点、约束条件"
              />
            </div>
            <div className="field field-full">
              <label htmlFor="project-description">项目描述</label>
              <textarea
                id="project-description"
                rows={2}
                value={formData.description}
                onChange={(event) => setFormData((prev) => ({ ...prev, description: event.target.value }))}
              />
            </div>
            <div className="field">
              <label htmlFor="project-readers">目标读者</label>
              <input
                id="project-readers"
                value={formData.readers}
                onChange={(event) => setFormData((prev) => ({ ...prev, readers: event.target.value }))}
              />
            </div>
            <div className="field">
              <label htmlFor="project-scale">目标规模</label>
              <input
                id="project-scale"
                value={formData.scale}
                onChange={(event) => setFormData((prev) => ({ ...prev, scale: event.target.value }))}
              />
            </div>
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={() => setShowCreateModal(false)}>取消</button>
            <button type="button" className="btn btn-primary" onClick={() => void handleCreateProject()}>创建并进入工作台</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function ProjectWorkspacePage({ addToast }: PageProps): JSX.Element {
  const { projectId } = useParams<{ projectId: string }>();
  const location = useLocation();

  const [loading, setLoading] = useState(true);
  const [project, setProject] = useState<Project | null>(null);
  const [outline, setOutline] = useState<Outline | null>(null);
  const [chapters, setChapters] = useState<ChapterSummary[]>([]);
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('outline');

  const [selectedChapterId, setSelectedChapterId] = useState<string | null>(null);
  const [selectedChapter, setSelectedChapter] = useState<Chapter | null>(null);
  const [editorContent, setEditorContent] = useState('');
  const [operationHistory, setOperationHistory] = useState<AIOperation[]>([]);

  const [generatingOutline, setGeneratingOutline] = useState(false);
  const [savingChapter, setSavingChapter] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);

  const [metrics, setMetrics] = useState<ProjectMetrics | null>(null);
  const [checkIssues, setCheckIssues] = useState<CheckIssueItem[]>([]);
  const [checking, setChecking] = useState(false);

  const [exportFormat, setExportFormat] = useState<'md' | 'html' | 'pdf'>('md');
  const [exportHistory, setExportHistory] = useState<ExportHistoryItem[]>([]);
  const [exportPreview, setExportPreview] = useState('暂未生成预览');
  const [exporting, setExporting] = useState(false);
  const [previewing, setPreviewing] = useState(false);

  const [strategies, setStrategies] = useState<StrategyOption[]>([]);
  const [activeStrategy, setActiveStrategy] = useState('');

  const queryChapterId = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get('chapterId');
  }, [location.search]);

  const loadWorkspaceData = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    const [projectData, outlineData, chapterList] = await Promise.all([
      projectApi.get(projectId),
      outlineApi.get(projectId),
      chapterApi.summaryList(projectId),
    ]);

    setProject(projectData);
    setOutline(outlineData);
    setChapters(chapterList);
    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    void loadWorkspaceData();
  }, [loadWorkspaceData]);

  useEffect(() => {
    const loadStrategies = async () => {
      const strategyList = await aiApi.listStrategies();
      setStrategies(strategyList as StrategyOption[]);
      const current = await aiApi.getStrategy();
      if (current?.id) {
        setActiveStrategy(String(current.id));
      }
    };

    void loadStrategies();
  }, []);

  // 中文注释：允许从 URL 带入 chapterId，保证从旧链接跳转过来仍能定位章节。
  useEffect(() => {
    if (!queryChapterId) return;
    setSelectedChapterId(queryChapterId);
  }, [queryChapterId]);

  useEffect(() => {
    if (chapters.length === 0) {
      setSelectedChapterId(null);
      return;
    }

    if (selectedChapterId && chapters.some((chapter) => chapter.id === selectedChapterId)) {
      return;
    }

    if (queryChapterId && chapters.some((chapter) => chapter.id === queryChapterId)) {
      setSelectedChapterId(queryChapterId);
      return;
    }

    setSelectedChapterId(chapters[0].id);
  }, [chapters, selectedChapterId, queryChapterId]);

  useEffect(() => {
    const loadSelectedChapter = async () => {
      if (!projectId || !selectedChapterId) {
        setSelectedChapter(null);
        setEditorContent('');
        return;
      }

      const chapter = await chapterApi.get(projectId, selectedChapterId);
      setSelectedChapter(chapter);
      setEditorContent(chapter?.content || '');
    };

    void loadSelectedChapter();
  }, [projectId, selectedChapterId]);

  useEffect(() => {
    const loadOperationHistory = async () => {
      if (!projectId || !selectedChapterId) {
        setOperationHistory([]);
        return;
      }
      const history = await aiApi.getOperationHistory(projectId, selectedChapterId);
      setOperationHistory(history || []);
    };

    void loadOperationHistory();
  }, [projectId, selectedChapterId]);

  useEffect(() => {
    if (activeTab !== 'export' || !projectId) return;
    void loadExportHistory(projectId);
  }, [activeTab, projectId]);

  useEffect(() => {
    if (activeTab !== 'metrics' || !projectId) return;
    void loadMetrics(projectId);
  }, [activeTab, projectId]);

  const loadMetrics = async (pid: string) => {
    const result = await metricsApi.getProject(pid);
    setMetrics(result);
  };

  const loadExportHistory = async (pid: string) => {
    const list = await exportApi.history(pid);
    setExportHistory(list as ExportHistoryItem[]);
  };

  const handleGenerateOutline = async () => {
    if (!projectId) return;
    setGeneratingOutline(true);
    try {
      const generated = await outlineApi.generate(projectId);
      if (generated) {
        addToast?.(`大纲已生成，共 ${generated.chapters.length} 章`, 'success');
        await loadWorkspaceData();
      }
    } finally {
      setGeneratingOutline(false);
    }
  };

  const handleAddChapter = async () => {
    if (!projectId) return;
    const nextNumber = await chapterApi.getNextNumber(projectId);
    const nextOutline = await outlineApi.addChapter(projectId, `第${nextNumber}章`);
    if (nextOutline) {
      addToast?.('已添加章节', 'success');
      await loadWorkspaceData();
    }
  };

  const handleConfirmOutline = async () => {
    if (!projectId) return;
    const result = await outlineApi.confirm(projectId);
    if (result) {
      setOutline(result);
      addToast?.('大纲已确认', 'success');
      await loadWorkspaceData();
    }
  };

  const handleDeleteChapter = async (chapter: OutlineChapter) => {
    if (!projectId) return;
    const confirmed = window.confirm(`确定删除章节“${chapter.title}”吗？`);
    if (!confirmed) return;

    const result = await window.zide.deleteChapter(projectId, chapter.id);
    if (result?.success) {
      addToast?.('章节已删除', 'info');
      await loadWorkspaceData();
    }
  };

  const handleRenameChapter = async (chapterId: string, title: string) => {
    if (!projectId) return;
    const trimmed = title.trim();
    if (!trimmed) return;
    await window.zide.updateChapter(projectId, chapterId, { title: trimmed });
    await loadWorkspaceData();
  };

  const handleCycleChapterStatus = async (chapter: OutlineChapter) => {
    if (!projectId) return;
    const nextStatus = chapter.status === 'todo'
      ? 'in_progress'
      : chapter.status === 'in_progress'
        ? 'completed'
        : 'todo';
    await chapterApi.updateStatus(projectId, chapter.id, nextStatus);
    await loadWorkspaceData();
  };

  const handleSaveChapter = async () => {
    if (!projectId || !selectedChapterId) return;
    setSavingChapter(true);
    try {
      const saved = await chapterApi.save(projectId, selectedChapterId, editorContent);
      if (saved) {
        setSelectedChapter(saved);
        addToast?.('章节已保存', 'success');
        const chapterList = await chapterApi.summaryList(projectId);
        setChapters(chapterList);
      }
    } finally {
      setSavingChapter(false);
    }
  };

  const handleAIIntent = async (intent: string) => {
    if (!projectId || !selectedChapterId) return;
    setAiLoading(true);
    try {
      const result = await aiApi.generate(projectId, selectedChapterId, intent) as { chapter?: Chapter } | null;
      if (result?.chapter) {
        setSelectedChapter(result.chapter);
        setEditorContent(result.chapter.content);
        addToast?.(`AI${intentLabel(intent)}完成`, 'success');
        const [chapterList, history] = await Promise.all([
          chapterApi.summaryList(projectId),
          aiApi.getOperationHistory(projectId, selectedChapterId),
        ]);
        setChapters(chapterList);
        setOperationHistory(history || []);
      }
    } finally {
      setAiLoading(false);
    }
  };

  const handleCreateSnapshot = async () => {
    if (!projectId || !selectedChapterId) return;
    const snapshot = await snapshotApi.createChapter(projectId, selectedChapterId);
    if (snapshot) {
      addToast?.('章节快照已创建', 'success');
      if (projectId) {
        const history = await aiApi.getOperationHistory(projectId, selectedChapterId);
        setOperationHistory(history || []);
      }
    }
  };

  const handleRunCheck = async () => {
    if (!projectId) return;
    setChecking(true);
    try {
      const result = await checkApi.run(projectId);
      const issues = Array.isArray(result?.issues) ? result.issues as CheckIssueItem[] : [];
      setCheckIssues(issues);
      addToast?.(issues.length === 0 ? '检查通过，未发现问题' : `检查完成，发现 ${issues.length} 项问题`, issues.length === 0 ? 'success' : 'info');
    } finally {
      setChecking(false);
    }
  };

  const handleResolveIssue = async (issue: CheckIssueItem) => {
    if (!projectId) return;
    await checkApi.resolveIssue(projectId, issue);
    await handleRunCheck();
  };

  const handleIgnoreIssue = async (issue: CheckIssueItem) => {
    if (!projectId) return;
    await checkApi.ignoreIssue(projectId, issue);
    await handleRunCheck();
  };

  const handleExportProject = async () => {
    if (!projectId) return;
    setExporting(true);
    try {
      const result = await exportApi.export(projectId, exportFormat);
      if (result?.filePath) {
        addToast?.(`导出成功：${result.filePath}`, 'success');
      }
      await loadExportHistory(projectId);
    } finally {
      setExporting(false);
    }
  };

  const handlePreviewExport = async () => {
    if (!projectId) return;
    setPreviewing(true);
    try {
      const content = await exportApi.preview(projectId, exportFormat);
      setExportPreview(content || '暂无预览内容');
    } finally {
      setPreviewing(false);
    }
  };

  const handleOpenExportDir = async () => {
    await exportApi.openDir(projectId);
  };

  const handleSwitchStrategy = async (strategyId: string) => {
    setActiveStrategy(strategyId);
    await aiApi.setStrategy(strategyId);
    addToast?.('AI 策略已切换', 'success');
  };

  if (loading) {
    return (
      <div className="page-shell">
        <AppTopbar active="workspace" />
        <Loading />
      </div>
    );
  }

  if (!project || !projectId) {
    return (
      <div className="page-shell">
        <AppTopbar active="workspace" />
        <section className="card section-card">
          <h2>未找到项目</h2>
          <p className="muted-text">请先返回项目页创建项目。</p>
          <div className="inline-actions mt-12">
            <Link to="/" className="btn btn-primary">返回项目页</Link>
          </div>
        </section>
      </div>
    );
  }

  const completedCount = chapters.filter((chapter) => chapter.status === 'completed').length;

  return (
    <div className="page-shell">
      <AppTopbar active="workspace" />

      <section className="card page-head">
        <div className="page-head-row">
          <div>
            <h2>{project.name}</h2>
            <p>{project.description || '暂无项目描述'}</p>
          </div>
        </div>
        <div className="kpi-grid">
          <article className="kpi-card"><small>章节总数</small><strong>{chapters.length}</strong></article>
          <article className="kpi-card"><small>已完成</small><strong>{completedCount}</strong></article>
          <article className="kpi-card"><small>快照数量</small><strong>{metrics?.snapshotsCreated ?? '-'}</strong></article>
          <article className="kpi-card"><small>最近更新</small><strong>{formatDateTime(project.updatedAt)}</strong></article>
        </div>
      </section>

      <section className="card section-card">
        <div className="tab-list" role="tablist" aria-label="工作台标签">
          <button type="button" className={`tab-btn ${activeTab === 'outline' ? 'active' : ''}`} onClick={() => setActiveTab('outline')}>大纲管理</button>
          <button type="button" className={`tab-btn ${activeTab === 'chapters' ? 'active' : ''}`} onClick={() => setActiveTab('chapters')}>章节工作台</button>
          <button type="button" className={`tab-btn ${activeTab === 'metrics' ? 'active' : ''}`} onClick={() => setActiveTab('metrics')}>项目统计</button>
          <button type="button" className={`tab-btn ${activeTab === 'check' ? 'active' : ''}`} onClick={() => setActiveTab('check')}>整体检查</button>
          <button type="button" className={`tab-btn ${activeTab === 'export' ? 'active' : ''}`} onClick={() => setActiveTab('export')}>导出中心</button>
        </div>

        {activeTab === 'outline' && (
          <div className="tab-panel">
            <div className="section-head">
              <h3>大纲管理</h3>
              <div className="inline-actions">
                <button type="button" className="btn btn-ghost" onClick={() => void handleGenerateOutline()} disabled={generatingOutline}>
                  {generatingOutline ? '生成中...' : 'AI 生成大纲'}
                </button>
                {outline?.status === 'draft' && (
                  <button type="button" className="btn btn-ghost" onClick={() => void handleConfirmOutline()}>
                    确认大纲
                  </button>
                )}
                <button type="button" className="btn btn-primary" onClick={() => void handleAddChapter()}>添加章节</button>
              </div>
            </div>

            <div className={`banner ${outline?.status === 'confirmed' ? '' : 'muted'}`}>
              大纲状态：{outline?.status === 'confirmed' ? '已确认' : '草稿'} · 共 {outline?.chapters.length || 0} 章 ·
              {outline?.chapters.filter((chapter) => chapter.status === 'completed').length || 0} 章已完成
            </div>

            {!outline || outline.chapters.length === 0 ? (
              <div className="empty-block">
                <h4>暂无大纲</h4>
                <p>点击“AI 生成大纲”开始初始化章节结构。</p>
              </div>
            ) : (
              <div className="outline-list">
                {outline.chapters.map((chapter) => (
                  <OutlineItem
                    key={chapter.id}
                    chapter={chapter}
                    onRename={(title) => void handleRenameChapter(chapter.id, title)}
                    onCycleStatus={() => void handleCycleChapterStatus(chapter)}
                    onDelete={() => void handleDeleteChapter(chapter)}
                    onOpenEditor={() => {
                      setSelectedChapterId(chapter.id);
                      setActiveTab('chapters');
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'chapters' && (
          <div className="tab-panel">
            <div className="workspace-layout">
              <aside className="panel">
                <div className="panel-head">
                  <h3>章节列表</h3>
                  <span className="tag">{chapters.length} 章</span>
                </div>
                <ul className="chapter-list">
                  {chapters.map((chapter) => (
                    <li key={chapter.id} className={`chapter-item ${chapter.id === selectedChapterId ? 'active' : ''}`}>
                      <button
                        type="button"
                        className="chapter-item-btn"
                        onClick={() => setSelectedChapterId(chapter.id)}
                      >
                        <h4>{chapter.title}</h4>
                        <span>
                          {chapter.number} · {chapter.wordCount.toLocaleString()} 字 · {formatStatus(chapter.status)}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </aside>

              <section className="panel">
                <div className="panel-head">
                  <div>
                    <h3>{selectedChapter?.title || '请选择章节'}</h3>
                    <p>
                      {selectedChapter
                        ? `${selectedChapter.number} · ${selectedChapter.wordCount.toLocaleString()} 字 · 完成度 ${selectedChapter.completion}%`
                        : '请选择章节后再编辑'}
                    </p>
                  </div>
                  <div>
                    <select
                      value={activeStrategy}
                      onChange={(event) => void handleSwitchStrategy(event.target.value)}
                      className="strategy-select"
                    >
                      {strategies.map((strategy) => (
                        <option key={strategy.id} value={strategy.id}>{strategy.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="editor-toolbar">
                  <div className="intent-list">
                    {['continue', 'expand', 'rewrite', 'add_argument', 'polish', 'simplify'].map((intent) => (
                      <button
                        key={intent}
                        type="button"
                        className={`intent-btn ${intent === 'continue' ? 'primary' : ''}`}
                        onClick={() => void handleAIIntent(intent)}
                        disabled={!selectedChapterId || aiLoading}
                      >
                        {intentLabel(intent)}
                      </button>
                    ))}
                  </div>
                  <div className="inline-actions">
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() => void handleSaveChapter()}
                      disabled={!selectedChapterId || savingChapter}
                    >
                      {savingChapter ? '保存中...' : '保存章节'}
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() => void handleCreateSnapshot()}
                      disabled={!selectedChapterId}
                    >
                      创建快照
                    </button>
                  </div>
                </div>

                <div className="editor-layout">
                  <article className="editor-pane">
                    <textarea
                      className="editor-textarea"
                      value={editorContent}
                      onChange={(event) => setEditorContent(event.target.value)}
                      placeholder="选择章节开始写作..."
                      disabled={!selectedChapterId}
                    />
                  </article>
                  <aside className="side-pane">
                    <h4>执行记录</h4>
                    {operationHistory.length === 0 ? (
                      <p className="muted-text">暂无 AI 操作记录。</p>
                    ) : (
                      <ul className="timeline-list">
                        {operationHistory.slice(0, 8).map((item) => (
                          <li key={item.id}>
                            <strong>{formatDateTime(item.createdAt)}</strong>
                            <span>AI {intentLabel(item.intent)} · 模型 {item.output?.model || '-'}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                    <p className="note-text">底层模型参数不在工作台展示，防止误触。</p>
                  </aside>
                </div>
              </section>
            </div>
          </div>
        )}

        {activeTab === 'metrics' && (
          <div className="tab-panel">
            <div className="section-head">
              <h3>项目统计</h3>
              <button type="button" className="btn btn-ghost" onClick={() => void loadMetrics(projectId)}>刷新统计</button>
            </div>

            {!metrics ? (
              <div className="empty-block">
                <h4>暂无统计数据</h4>
                <p>点击“刷新统计”加载最新数据。</p>
              </div>
            ) : (
              <div className="kpi-grid kpi-grid-wide">
                <article className="kpi-card"><small>总章节</small><strong>{metrics.totalChapters}</strong></article>
                <article className="kpi-card"><small>已完成章节</small><strong>{metrics.completedChapters}</strong></article>
                <article className="kpi-card"><small>总字数</small><strong>{metrics.totalWords.toLocaleString()}</strong></article>
                <article className="kpi-card"><small>AI 操作</small><strong>{metrics.aiOperations}</strong></article>
                <article className="kpi-card"><small>采纳率</small><strong>{metrics.aiOperations > 0 ? Math.round(metrics.adoptedOperations / metrics.aiOperations * 100) : 0}%</strong></article>
                <article className="kpi-card"><small>快照数</small><strong>{metrics.snapshotsCreated}</strong></article>
                <article className="kpi-card"><small>导出次数</small><strong>{metrics.exportsCompleted}</strong></article>
                <article className="kpi-card"><small>最近活跃</small><strong>{formatDateTime(metrics.lastActivityAt)}</strong></article>
              </div>
            )}
          </div>
        )}

        {activeTab === 'check' && (
          <div className="tab-panel">
            <div className="section-head">
              <h3>整体检查</h3>
              <button type="button" className="btn btn-primary" onClick={() => void handleRunCheck()} disabled={checking}>
                {checking ? '检查中...' : '运行检查'}
              </button>
            </div>

            {checkIssues.length === 0 ? (
              <div className="empty-block">
                <h4>暂无问题</h4>
                <p>点击“运行检查”进行完整体检。</p>
              </div>
            ) : (
              <div className="issue-list">
                {checkIssues.map((issue, index) => (
                  <article key={issue.id || `${issue.type}-${index}`} className="issue-item">
                    <div>
                      <strong>{formatIssueType(issue.type)}</strong>
                      <p>{issue.message}</p>
                    </div>
                    <div className="inline-actions">
                      <button type="button" className="btn btn-ghost" onClick={() => void handleResolveIssue(issue)}>修复</button>
                      <button type="button" className="btn btn-ghost" onClick={() => void handleIgnoreIssue(issue)}>忽略</button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'export' && (
          <div className="tab-panel">
            <div className="export-grid">
              <section className="panel">
                <div className="panel-head"><h3>导出项目</h3></div>
                <div className="panel-body">
                  <div className="field">
                    <label htmlFor="export-format">导出格式</label>
                    <select
                      id="export-format"
                      value={exportFormat}
                      onChange={(event) => setExportFormat(event.target.value as 'md' | 'html' | 'pdf')}
                    >
                      <option value="md">Markdown (.md)</option>
                      <option value="html">HTML (.html)</option>
                      <option value="pdf">PDF (.pdf)</option>
                    </select>
                  </div>
                  <div className="inline-actions mt-12 wrap">
                    <button type="button" className="btn btn-primary" onClick={() => void handleExportProject()} disabled={exporting}>
                      {exporting ? '导出中...' : '导出项目'}
                    </button>
                    <button type="button" className="btn btn-ghost" onClick={() => void handlePreviewExport()} disabled={previewing}>
                      {previewing ? '预览中...' : '预览'}
                    </button>
                    <button type="button" className="btn btn-ghost" onClick={() => void handleOpenExportDir()}>打开目录</button>
                  </div>
                </div>
              </section>

              <section className="panel">
                <div className="panel-head"><h3>导出历史</h3></div>
                {exportHistory.length === 0 ? (
                  <div className="empty-block compact">
                    <p>暂无导出记录</p>
                  </div>
                ) : (
                  <ul className="history-list">
                    {exportHistory.map((item, index) => (
                      <li key={`${item.filePath || item.createdAt || 'export'}-${index}`} className="history-item">
                        <div>
                          <strong>{(item.format || '').toUpperCase() || '-'}</strong>
                          <p>{item.filePath || '-'}</p>
                        </div>
                        <span>{item.createdAt ? formatDateTime(item.createdAt) : '-'}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>

            <section className="panel preview-panel">
              <div className="panel-head"><h3>预览</h3></div>
              <pre className="preview-text">{exportPreview}</pre>
            </section>
          </div>
        )}
      </section>
    </div>
  );
}

function OutlineItem({
  chapter,
  onRename,
  onCycleStatus,
  onDelete,
  onOpenEditor,
}: {
  chapter: OutlineChapter;
  onRename: (title: string) => void;
  onCycleStatus: () => void;
  onDelete: () => void;
  onOpenEditor: () => void;
}): JSX.Element {
  const [title, setTitle] = useState(chapter.title);

  useEffect(() => {
    setTitle(chapter.title);
  }, [chapter.title]);

  return (
    <article className="outline-item">
      <div className="outline-main">
        <span className="outline-no">{chapter.number}</span>
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          onBlur={() => onRename(title)}
        />
        <small>{chapter.target || '未设置章节目标'}</small>
      </div>
      <div className="outline-actions">
        <button type="button" className="btn btn-ghost" onClick={onCycleStatus}>{formatStatus(chapter.status)}</button>
        <button type="button" className="btn btn-ghost" onClick={onOpenEditor}>编辑</button>
        <button type="button" className="btn btn-ghost" onClick={onDelete}>删除</button>
      </div>
    </article>
  );
}

function SettingsPage({ addToast }: PageProps): JSX.Element {
  const [locked, setLocked] = useState(true);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  const [strategies, setStrategies] = useState<StrategyOption[]>([]);
  const [activeStrategy, setActiveStrategy] = useState('');

  const [config, setConfig] = useState<LLMConfig>({
    provider: 'openai',
    model: 'gpt-4o',
    apiKey: '',
    baseUrl: 'https://api.openai.com/v1',
    temperature: 0.7,
    maxTokens: 4000,
  });

  const loadConfig = useCallback(async () => {
    if (window.zide?.aiGetConfig) {
      const result = await window.zide.aiGetConfig();
      if (result?.success && result.data) {
        setConfig((prev) => ({ ...prev, ...result.data }));
      }
    }

    const strategyList = await aiApi.listStrategies();
    setStrategies(strategyList as StrategyOption[]);
    const current = await aiApi.getStrategy();
    if (current?.id) {
      setActiveStrategy(String(current.id));
    }
  }, []);

  useEffect(() => {
    void loadConfig();
  }, [loadConfig]);

  const handleProviderChange = (provider: string) => {
    let baseUrl = config.baseUrl;
    if (provider === 'openai') baseUrl = 'https://api.openai.com/v1';
    if (provider === 'anthropic') baseUrl = 'https://api.anthropic.com';
    if (provider === 'minimax') baseUrl = 'https://api.minimax.chat/v1';
    if (provider === 'kimi') baseUrl = 'https://api.moonshot.cn/v1';
    setConfig((prev) => ({ ...prev, provider, baseUrl }));
  };

  const handleTestConnection = async () => {
    setTesting(true);
    try {
      const result = await window.zide.aiPing();
      if (result?.success) {
        addToast?.('连接成功', 'success');
      } else {
        addToast?.(result?.error || '连接失败', 'error');
      }
    } finally {
      setTesting(false);
    }
  };

  // 中文注释：保存后主动回到锁定态并收起高级参数，避免误触底层配置。
  const handleSave = async () => {
    setSaving(true);
    try {
      if (window.zide?.aiUpdateConfig) {
        await window.zide.aiUpdateConfig(config);
      }
      if (activeStrategy) {
        await aiApi.setStrategy(activeStrategy);
      }
      setLocked(true);
      setAdvancedOpen(false);
      addToast?.('设置已保存并收起高级参数', 'success');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page-shell">
      <AppTopbar active="settings" />

      <section className="card section-card">
        <h2>AI 参数管理（防误触模式）</h2>
        <p className="muted-text">工作台只保留写作动作，底层参数统一在本页维护。</p>

        <div className={`lock-banner ${locked ? '' : 'warn'}`}>
          {locked ? '当前状态：已锁定，仅可查看。' : '当前状态：已解锁，请谨慎修改底层参数。'}
        </div>

        <div className="inline-actions mt-12 wrap">
          <button type="button" className="btn btn-ghost" onClick={() => setLocked((prev) => !prev)}>
            {locked ? '解锁编辑' : '取消解锁'}
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => void handleTestConnection()} disabled={testing}>
            {testing ? '测试中...' : '测试连接'}
          </button>
        </div>

        <div className="form-grid mt-12">
          <div className="field">
            <label htmlFor="provider">模型提供商</label>
            <select
              id="provider"
              disabled={locked}
              value={config.provider}
              onChange={(event) => handleProviderChange(event.target.value)}
            >
              <option value="openai">OpenAI</option>
              <option value="anthropic">Anthropic</option>
              <option value="minimax">MiniMax</option>
              <option value="kimi">Kimi</option>
              <option value="custom">Custom</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="model">模型名称</label>
            <input
              id="model"
              disabled={locked}
              value={config.model}
              onChange={(event) => setConfig((prev) => ({ ...prev, model: event.target.value }))}
            />
          </div>
          <div className="field field-full">
            <label htmlFor="base-url">API 地址</label>
            <input
              id="base-url"
              disabled={locked}
              value={config.baseUrl}
              onChange={(event) => setConfig((prev) => ({ ...prev, baseUrl: event.target.value }))}
            />
          </div>
          <div className="field field-full">
            <label htmlFor="strategy">AI 策略</label>
            <select
              id="strategy"
              disabled={locked}
              value={activeStrategy}
              onChange={(event) => setActiveStrategy(event.target.value)}
            >
              {strategies.map((strategy) => (
                <option key={strategy.id} value={strategy.id}>{strategy.name}</option>
              ))}
            </select>
          </div>
        </div>

        <details className="advanced-panel" open={advancedOpen}>
          <summary onClick={(event) => {
            event.preventDefault();
            setAdvancedOpen((prev) => !prev);
          }}>
            高级参数（默认收起）
          </summary>
          {advancedOpen && (
            <div className="form-grid mt-12">
              <div className="field">
                <label htmlFor="temperature">Temperature</label>
                <input
                  id="temperature"
                  type="number"
                  step="0.1"
                  min="0"
                  max="2"
                  disabled={locked}
                  value={config.temperature}
                  onChange={(event) => setConfig((prev) => ({ ...prev, temperature: Number(event.target.value) || 0 }))}
                />
              </div>
              <div className="field">
                <label htmlFor="max-tokens">Max Tokens</label>
                <input
                  id="max-tokens"
                  type="number"
                  step="100"
                  min="100"
                  max="128000"
                  disabled={locked}
                  value={config.maxTokens}
                  onChange={(event) => setConfig((prev) => ({ ...prev, maxTokens: Number(event.target.value) || 100 }))}
                />
              </div>
              <div className="field field-full">
                <label htmlFor="api-key">API Key</label>
                <input
                  id="api-key"
                  type="password"
                  disabled={locked}
                  value={config.apiKey}
                  onChange={(event) => setConfig((prev) => ({ ...prev, apiKey: event.target.value }))}
                />
              </div>
            </div>
          )}
        </details>

        <div className="inline-actions mt-16">
          <button type="button" className="btn btn-primary" onClick={() => void handleSave()} disabled={saving || locked}>
            {saving ? '保存中...' : '保存并收起'}
          </button>
        </div>
      </section>
    </div>
  );
}

function ProjectRedirect(): JSX.Element {
  const [targetPath, setTargetPath] = useState<string | null>(null);

  useEffect(() => {
    const resolveTarget = async () => {
      const list = await projectApi.list();
      if (list.length > 0) {
        setTargetPath(`/project/${list[0].id}`);
      } else {
        setTargetPath('/');
      }
    };
    void resolveTarget();
  }, []);

  if (!targetPath) {
    return (
      <div className="page-shell">
        <Loading />
      </div>
    );
  }

  return <Navigate to={targetPath} replace />;
}

function ChapterRedirect(): JSX.Element {
  const { projectId, chapterId } = useParams<{ projectId: string; chapterId: string }>();
  if (!projectId) {
    return <Navigate to="/" replace />;
  }
  const suffix = chapterId ? `?chapterId=${encodeURIComponent(chapterId)}` : '';
  return <Navigate to={`/project/${projectId}${suffix}`} replace />;
}

function App(): JSX.Element {
  const { toasts, addToast, removeToast } = useToast();
  const lastErrorRef = useRef<{ message: string; ts: number }>({ message: '', ts: 0 });

  useEffect(() => {
    const onApiError = (event: Event) => {
      const detail = (event as CustomEvent<ApiErrorDetail>).detail;
      if (!detail) return;

      const now = Date.now();
      // 中文注释：短时间内重复错误去重，防止并发请求导致 toast 刷屏。
      if (detail.message === lastErrorRef.current.message && now - lastErrorRef.current.ts < 1500) {
        return;
      }

      lastErrorRef.current = { message: detail.message, ts: now };

      const categoryLabel = detail.category === 'config'
        ? '配置错误'
        : detail.category === 'data'
          ? '数据错误'
          : '系统错误';

      addToast(`${categoryLabel}：${detail.message}`, 'error');
    };

    window.addEventListener(API_ERROR_EVENT, onApiError as EventListener);
    return () => {
      window.removeEventListener(API_ERROR_EVENT, onApiError as EventListener);
    };
  }, [addToast]);

  return (
    <div className="app-shell">
      <HashRouter>
        <Routes>
          <Route path="/" element={<ProjectListPage addToast={addToast} />} />
          <Route path="/project" element={<ProjectRedirect />} />
          <Route path="/project/:projectId" element={<ProjectWorkspacePage addToast={addToast} />} />
          <Route path="/project/:projectId/chapter/:chapterId" element={<ChapterRedirect />} />
          <Route path="/settings" element={<SettingsPage addToast={addToast} />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </HashRouter>
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString();
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day} ${hour}:${minute}`;
}

function formatProjectType(type: string): string {
  const map: Record<string, string> = {
    proposal: '方案',
    report: '报告',
    research: '研究',
    novel: '小说',
    other: '其他',
  };
  return map[type] || type;
}

function formatStatus(status: string): string {
  const map: Record<string, string> = {
    todo: '待开始',
    in_progress: '进行中',
    completed: '已完成',
    review: '待审阅',
  };
  return map[status] || status;
}

function intentLabel(intent: string): string {
  const map: Record<string, string> = {
    continue: '续写',
    expand: '扩写',
    rewrite: '重写',
    add_argument: '补论证',
    polish: '润色',
    simplify: '简化',
  };
  return map[intent] || intent;
}

function formatIssueType(type: string): string {
  const map: Record<string, string> = {
    missing_chapter: '缺章',
    term_conflict: '术语冲突',
    duplicate_content: '重复内容',
    low_completion: '完成度低',
    completion_low: '完成度低',
    outline_drift: '大纲偏离',
  };
  return map[type] || type;
}

export default App;
