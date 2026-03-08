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
  loreMemoryApi,
  manuscriptApi,
  plotBoardApi,
  projectApi,
  retconApi,
  snapshotApi,
  storyBibleApi,
  type ApiErrorDetail,
} from './services/api';
import type {
  AIOperation,
  CandidateDraft,
  ChapterGoal,
  Chapter,
  ChapterSummary,
  ContinuityReport,
  MemoryCard,
  ManuscriptReadiness,
  NovelTaskExecutionResult,
  NovelTaskType,
  Outline,
  OutlineChapter,
  PlotBoardSnapshot,
  Project,
  ProjectMetrics,
  RetconDecision,
  StoryBible,
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
type NovelModuleTab =
  | 'overview'
  | 'story_bible'
  | 'plot_board'
  | 'scene_sprint'
  | 'continuity_review'
  | 'retcon_flow'
  | 'lore_memory'
  | 'manuscript_center'
  | 'run_console';

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
          <h1>Zide Novel OS</h1>
          <p>长篇小说 AI 创作系统 · V3 过渡骨架</p>
        </div>
      </div>
      <nav className="nav-pills" aria-label="主导航">
        <Link to="/" className={active === 'projects' ? 'active' : ''}>项目</Link>
        <Link to="/novel" className={active === 'workspace' ? 'active' : ''}>小说工作台</Link>
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
    type: 'novel',
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
    setFormData({ name: '', type: 'novel', idea: '', description: '', readers: '', scale: '' });
    void loadProjects();
    navigate(getProjectWorkspacePath(created));
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
            <p>小说项目将优先进入 V3 小说工作台，旧长文项目仍保留兼容工作台。</p>
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
                    onClick={() => navigate(getProjectWorkspacePath(project))}
                  >
                    {project.type === 'novel' ? '进入小说工作台' : '进入旧工作台'}
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
          <li>1. 新建小说项目后，先沉淀故事种子，再进入 Story Bible 和 Plot Board。</li>
          <li>2. Scene Sprint 现在已经接入统一任务入口，可直接用任务而不是旧按钮写作。</li>
          <li>3. Continuity Review、Lore Memory 和 Manuscript Center 目前已提供页面壳，后续逐步接真数据。</li>
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
                placeholder="例如：烬海王朝"
              />
            </div>
            <div className="field">
              <label htmlFor="project-type">项目类型</label>
              <select
                id="project-type"
                value={formData.type}
                onChange={(event) => setFormData((prev) => ({ ...prev, type: event.target.value }))}
              >
                <option value="novel">小说</option>
                <option value="proposal">方案</option>
                <option value="report">报告</option>
                <option value="research">研究报告</option>
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
                placeholder="描述故事种子、主角、冲突、世界观，或你脑海中的关键场景"
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

function NovelWorkspacePage({ addToast }: PageProps): JSX.Element {
  const { projectId } = useParams<{ projectId: string }>();

  const [loading, setLoading] = useState(true);
  const [project, setProject] = useState<Project | null>(null);
  const [outline, setOutline] = useState<Outline | null>(null);
  const [storyBible, setStoryBible] = useState<StoryBible | null>(null);
  const [plotBoard, setPlotBoard] = useState<PlotBoardSnapshot | null>(null);
  const [memoryCards, setMemoryCards] = useState<MemoryCard[]>([]);
  const [retconDecisions, setRetconDecisions] = useState<RetconDecision[]>([]);
  const [manuscriptReadiness, setManuscriptReadiness] = useState<ManuscriptReadiness | null>(null);
  const [chapters, setChapters] = useState<ChapterSummary[]>([]);
  const [metrics, setMetrics] = useState<ProjectMetrics | null>(null);
  const [activeModule, setActiveModule] = useState<NovelModuleTab>('overview');
  const [selectedChapterId, setSelectedChapterId] = useState<string | null>(null);
  const [selectedChapter, setSelectedChapter] = useState<Chapter | null>(null);
  const [candidateDrafts, setCandidateDrafts] = useState<CandidateDraft[]>([]);
  const [continuityReports, setContinuityReports] = useState<ContinuityReport[]>([]);
  const [selectedDraftId, setSelectedDraftId] = useState<string | null>(null);
  const [storyBibleDraft, setStoryBibleDraft] = useState({
    premise: '',
    theme: '',
    settingSummary: '',
    conflictCore: '',
    toneGuide: '',
    narrativePromise: '',
  });
  const [chapterGoalDrafts, setChapterGoalDrafts] = useState<Record<string, ChapterGoal>>({});
  const [retconDraft, setRetconDraft] = useState({
    summary: '',
    reason: '',
    affectedChapterIds: [] as string[],
    affectedCharacters: '',
  });
  const [taskPrompt, setTaskPrompt] = useState('');
  const [taskLoading, setTaskLoading] = useState(false);
  const [storyBibleSaving, setStoryBibleSaving] = useState(false);
  const [storyBibleGenerating, setStoryBibleGenerating] = useState(false);
  const [chapterGoalSavingId, setChapterGoalSavingId] = useState<string | null>(null);
  const [retconSaving, setRetconSaving] = useState(false);
  const [retconActionId, setRetconActionId] = useState<string | null>(null);
  const [lastTaskResult, setLastTaskResult] = useState<NovelTaskExecutionResult | null>(null);
  const [taskHistory, setTaskHistory] = useState<NovelTaskExecutionResult[]>([]);

  const loadNovelWorkspace = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    const [projectData, outlineData, chapterList, metricsData, storyBibleData, plotBoardData, memoryCardData, retconData, readinessData] = await Promise.all([
      projectApi.get(projectId),
      outlineApi.get(projectId),
      chapterApi.summaryList(projectId),
      metricsApi.getProject(projectId),
      storyBibleApi.get(projectId),
      plotBoardApi.get(projectId),
      loreMemoryApi.get(projectId),
      retconApi.list(projectId),
      manuscriptApi.getReadiness(projectId),
    ]);

    setProject(projectData);
    setOutline(plotBoardData?.outline || outlineData);
    setStoryBible(storyBibleData);
    setPlotBoard(plotBoardData);
    setMemoryCards(memoryCardData);
    setRetconDecisions(retconData);
    setManuscriptReadiness(readinessData);
    setChapters(chapterList);
    setMetrics(metricsData);
    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    void loadNovelWorkspace();
  }, [loadNovelWorkspace]);

  useEffect(() => {
    if (chapters.length === 0) {
      setSelectedChapterId(null);
      return;
    }

    if (selectedChapterId && chapters.some((chapter) => chapter.id === selectedChapterId)) {
      return;
    }

    setSelectedChapterId(chapters[0].id);
  }, [chapters, selectedChapterId]);

  useEffect(() => {
    const loadSelectedChapter = async () => {
      if (!projectId || !selectedChapterId) {
        setSelectedChapter(null);
        setCandidateDrafts([]);
        setContinuityReports([]);
        setSelectedDraftId(null);
        return;
      }

      const [chapter, draftList, reportList] = await Promise.all([
        chapterApi.get(projectId, selectedChapterId),
        aiApi.listCandidateDrafts(projectId, selectedChapterId),
        aiApi.listContinuityReports(projectId, selectedChapterId),
      ]);
      setSelectedChapter(chapter);
      setCandidateDrafts(draftList);
      setContinuityReports(reportList);
    };

    void loadSelectedChapter();
  }, [projectId, selectedChapterId]);

  useEffect(() => {
    if (candidateDrafts.length === 0) {
      setSelectedDraftId(null);
      return;
    }

    if (selectedDraftId && candidateDrafts.some((draft) => draft.draftId === selectedDraftId)) {
      return;
    }

    setSelectedDraftId(candidateDrafts[0].draftId);
  }, [candidateDrafts, selectedDraftId]);

  useEffect(() => {
    if (!storyBible) return;
    setStoryBibleDraft({
      premise: storyBible.premise || '',
      theme: storyBible.theme || '',
      settingSummary: storyBible.settingSummary || '',
      conflictCore: storyBible.conflictCore || '',
      toneGuide: storyBible.toneGuide || '',
      narrativePromise: storyBible.narrativePromise || '',
    });
  }, [storyBible]);

  useEffect(() => {
    if (!plotBoard?.chapterGoals) {
      setChapterGoalDrafts({});
      return;
    }

    const nextDrafts: Record<string, ChapterGoal> = {};
    for (const goal of plotBoard.chapterGoals) {
      nextDrafts[goal.chapterId] = goal;
    }
    setChapterGoalDrafts(nextDrafts);
  }, [plotBoard]);

  useEffect(() => {
    if (!selectedChapterId) return;
    setRetconDraft((prev) => (
      prev.affectedChapterIds.length > 0
        ? prev
        : { ...prev, affectedChapterIds: [selectedChapterId] }
    ));
  }, [selectedChapterId]);

  const handleRunTask = async (taskType: NovelTaskType) => {
    if (!projectId || !selectedChapterId) return;

    setTaskLoading(true);
    try {
      const result = await aiApi.runTask({
        projectId,
        chapterId: selectedChapterId,
        taskType,
        prompt: taskPrompt.trim() || undefined,
        complexity: taskType === 'rewrite_scene'
          ? 'deep'
          : taskType === 'advance_scene'
            ? 'standard'
            : 'quick',
      });

      if (!result) return;

      const attemptDrafts = result.attempts.map((attempt) => attempt.candidateDraft);
      const attemptReports = result.attempts.map((attempt) => attempt.continuityReport);

      setLastTaskResult(result);
      setTaskHistory((prev) => [result, ...prev.filter((item) => item.taskRun.runId !== result.taskRun.runId)].slice(0, 8));
      setSelectedChapter(result.chapter);
      setCandidateDrafts((prev) => mergeCandidateDrafts([...attemptDrafts, ...prev]));
      setContinuityReports((prev) => mergeContinuityReports([...attemptReports, ...prev]));
      setSelectedDraftId(result.candidateDraft.draftId);
      setTaskPrompt('');
      setActiveModule('scene_sprint');
      addToast?.(`${taskTypeLabel(taskType)}已生成候选稿`, 'success');

      const [chapterList, metricsData] = await Promise.all([
        chapterApi.summaryList(projectId),
        metricsApi.getProject(projectId),
      ]);
      setChapters(chapterList);
      setMetrics(metricsData);
      setMemoryCards(await loreMemoryApi.get(projectId));
      setManuscriptReadiness(await manuscriptApi.getReadiness(projectId));
    } finally {
      setTaskLoading(false);
    }
  };

  const handleAdoptCandidateDraft = async (draftId: string, force = false) => {
    if (!projectId || !selectedChapterId) return;

    const result = await aiApi.adoptCandidateDraft(projectId, selectedChapterId, draftId, force);
    if (!result) return;

    setSelectedChapter(result.chapter);
    setCandidateDrafts((prev) => prev.map((draft) => (
      draft.draftId === draftId
        ? result.candidateDraft
        : draft.status === 'pending_review'
          ? { ...draft, status: 'superseded' }
          : draft
    )));
    if (lastTaskResult?.candidateDraft?.draftId === draftId) {
      setLastTaskResult({
        ...lastTaskResult,
        chapter: result.chapter,
        candidateDraft: result.candidateDraft,
        continuityReport: result.continuityReport,
        attempts: lastTaskResult.attempts.map((attempt) => (
          attempt.candidateDraft.draftId === draftId
            ? {
              ...attempt,
              candidateDraft: result.candidateDraft,
              continuityReport: result.continuityReport,
            }
            : attempt
        )),
      });
    }
    setContinuityReports((prev) => prev.map((report) => report.draftId === draftId ? result.continuityReport : report));

    const [chapterList, metricsData] = await Promise.all([
      chapterApi.summaryList(projectId),
      metricsApi.getProject(projectId),
    ]);
    setChapters(chapterList);
    setMetrics(metricsData);
    setMemoryCards(await loreMemoryApi.get(projectId));
    setManuscriptReadiness(await manuscriptApi.getReadiness(projectId));
    addToast?.(
      force
        ? `候选稿已强制采纳，并自动创建快照${result.snapshotId ? `（${result.snapshotId}）` : ''}`
        : '候选稿已采纳并写入正式正文',
      force ? 'info' : 'success'
    );
  };

  const handleRejectCandidateDraft = async (draftId: string) => {
    if (!projectId || !selectedChapterId) return;

    const result = await aiApi.rejectCandidateDraft(projectId, selectedChapterId, draftId);
    if (!result) return;

    setCandidateDrafts((prev) => prev.map((draft) => draft.draftId === draftId ? result : draft));
    if (lastTaskResult?.candidateDraft?.draftId === draftId) {
      setLastTaskResult({
        ...lastTaskResult,
        candidateDraft: result,
        attempts: lastTaskResult.attempts.map((attempt) => (
          attempt.candidateDraft.draftId === draftId
            ? {
              ...attempt,
              candidateDraft: result,
            }
            : attempt
        )),
      });
    }
    addToast?.('候选稿已放弃', 'info');
  };

  const handleRegenerateContinuityReport = async (draftId: string) => {
    if (!projectId || !selectedChapterId) return;

    const result = await aiApi.regenerateContinuityReport(projectId, selectedChapterId, draftId);
    if (!result) return;

    setContinuityReports((prev) => [result, ...prev.filter((report) => report.draftId !== result.draftId)]);
    if (lastTaskResult?.candidateDraft?.draftId === draftId) {
      setLastTaskResult({
        ...lastTaskResult,
        continuityReport: result,
        attempts: lastTaskResult.attempts.map((attempt) => (
          attempt.candidateDraft.draftId === draftId
            ? {
              ...attempt,
              continuityReport: result,
            }
            : attempt
        )),
      });
    }
    addToast?.('连续性报告已重新生成', 'success');
  };

  const toggleRetconChapter = (chapterId: string) => {
    setRetconDraft((prev) => ({
      ...prev,
      affectedChapterIds: prev.affectedChapterIds.includes(chapterId)
        ? prev.affectedChapterIds.filter((item) => item !== chapterId)
        : [...prev.affectedChapterIds, chapterId],
    }));
  };

  const handleProposeRetcon = async () => {
    if (!projectId) return;

    setRetconSaving(true);
    try {
      const result = await retconApi.propose(projectId, {
        summary: retconDraft.summary,
        reason: retconDraft.reason,
        affectedChapterIds: retconDraft.affectedChapterIds,
        affectedCharacters: retconDraft.affectedCharacters
          .split(/[，,]/)
          .map((item) => item.trim())
          .filter(Boolean),
      });

      if (!result) return;

      setRetconDecisions((prev) => [result, ...prev.filter((item) => item.retconId !== result.retconId)]);
      setRetconDraft({
        summary: '',
        reason: '',
        affectedChapterIds: selectedChapterId ? [selectedChapterId] : [],
        affectedCharacters: '',
      });
      addToast?.('Retcon 提案已创建', 'success');
    } finally {
      setRetconSaving(false);
    }
  };

  const handleApproveRetcon = async (retconId: string) => {
    if (!projectId) return;

    setRetconActionId(retconId);
    try {
      const result = await retconApi.approve(projectId, retconId);
      if (!result) return;

      setRetconDecisions((prev) => prev.map((item) => item.retconId === retconId ? result.decision : item));
      setMemoryCards(await loreMemoryApi.get(projectId));
      addToast?.(`Retcon 已批准，并生成 ${result.snapshotIds.length} 个快照`, 'info');
    } finally {
      setRetconActionId(null);
    }
  };

  const handleRollbackRetcon = async (retconId: string) => {
    if (!projectId) return;

    setRetconActionId(retconId);
    try {
      const result = await retconApi.rollback(projectId, retconId);
      if (!result) return;

      setRetconDecisions((prev) => prev.map((item) => item.retconId === retconId ? result : item));
      setMemoryCards(await loreMemoryApi.get(projectId));
      addToast?.('Retcon 已回滚', 'info');
    } finally {
      setRetconActionId(null);
    }
  };

  const handleReviewRetcon = (decision: RetconDecision) => {
    const chapterRef = decision.affectedRefs.find((ref) => ref.kind === 'chapter');
    if (chapterRef) {
      setSelectedChapterId(chapterRef.id);
    }
    setActiveModule('continuity_review');
  };

  const handleGenerateStoryBible = async () => {
    if (!projectId) return;

    setStoryBibleGenerating(true);
    try {
      const result = await storyBibleApi.generate(projectId, project?.description || project?.name);
      if (!result) return;
      setStoryBible(result);
      addToast?.('Story Bible 已重新生成', 'success');
    } finally {
      setStoryBibleGenerating(false);
    }
  };

  const handleSaveStoryBible = async () => {
    if (!projectId) return;

    setStoryBibleSaving(true);
    try {
      const result = await storyBibleApi.update(projectId, storyBibleDraft);
      if (!result) return;
      setStoryBible(result);
      addToast?.('Story Bible 已保存', 'success');
    } finally {
      setStoryBibleSaving(false);
    }
  };

  const handleConfirmStoryBible = async () => {
    if (!projectId) return;

    setStoryBibleSaving(true);
    try {
      const result = await storyBibleApi.confirm(projectId);
      if (!result) return;
      setStoryBible(result);
      setMemoryCards(await loreMemoryApi.get(projectId));
      setManuscriptReadiness(await manuscriptApi.getReadiness(projectId));
      addToast?.('Story Bible 已确认', 'success');
    } finally {
      setStoryBibleSaving(false);
    }
  };

  const handleChapterGoalDraftChange = (
    chapterId: string,
    field: keyof Pick<ChapterGoal, 'title' | 'objective' | 'conflict' | 'emotionalShift' | 'payoff'>,
    value: string
  ) => {
    setChapterGoalDrafts((prev) => {
      const current = prev[chapterId];
      if (!current) return prev;
      return {
        ...prev,
        [chapterId]: {
          ...current,
          [field]: value,
        },
      };
    });
  };

  const handleSaveChapterGoal = async (chapterId: string) => {
    if (!projectId) return;
    const goal = chapterGoalDrafts[chapterId];
    if (!goal) return;

    setChapterGoalSavingId(chapterId);
    try {
      const result = await plotBoardApi.updateChapterGoal(projectId, chapterId, goal);
      if (!result) return;
      setPlotBoard(result);
      setOutline(result.outline);
      addToast?.('Plot Board 章节目标已保存', 'success');
    } finally {
      setChapterGoalSavingId(null);
    }
  };

  const handleSyncLoreMemory = async () => {
    if (!projectId) return;
    const cards = await loreMemoryApi.sync(projectId);
    setMemoryCards(cards);
    addToast?.('Lore Memory 已同步', 'success');
  };

  const handleRefreshManuscriptReadiness = async () => {
    if (!projectId) return;
    const readiness = await manuscriptApi.getReadiness(projectId);
    setManuscriptReadiness(readiness);
    addToast?.('Manuscript Readiness 已刷新', 'success');
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
          <p className="muted-text">请先返回项目页创建小说项目。</p>
          <div className="inline-actions mt-12">
            <Link to="/" className="btn btn-primary">返回项目页</Link>
          </div>
        </section>
      </div>
    );
  }

  if (project.type !== 'novel') {
    return (
      <div className="page-shell">
        <AppTopbar active="workspace" />
        <section className="card section-card">
          <h2>{project.name}</h2>
          <p className="muted-text">该项目不是小说类型，继续使用旧版长文工作台更稳妥。</p>
          <div className="inline-actions mt-12">
            <Link to={getProjectWorkspacePath(project)} className="btn btn-primary">进入旧工作台</Link>
            <Link to="/" className="btn btn-ghost">返回项目页</Link>
          </div>
        </section>
      </div>
    );
  }

  const completedCount = chapters.filter((chapter) => chapter.status === 'completed').length;
  const completionRate = chapters.length > 0 ? Math.round((completedCount / chapters.length) * 100) : 0;
  const activeDraft = candidateDrafts.find((draft) => draft.draftId === selectedDraftId) || null;
  const activeContinuityReport = continuityReports.find((report) => report.draftId === selectedDraftId) || null;
  const moduleCards = [
    {
      key: 'story_bible' as const,
      title: 'Story Bible',
      desc: '确认故事前提、主冲突、叙事承诺和语气。',
    },
    {
      key: 'plot_board' as const,
      title: 'Plot Board',
      desc: '以章节目标和节拍来管理剧情推进。',
    },
    {
      key: 'scene_sprint' as const,
      title: 'Scene Sprint',
      desc: '从统一任务入口发起推进场景、润色和深改。',
    },
    {
      key: 'continuity_review' as const,
      title: 'Continuity Review',
      desc: '后续在这里收口设定冲突、人物偏移和时间线问题。',
    },
    {
      key: 'retcon_flow' as const,
      title: 'Retcon Flow',
      desc: '声明一次设定改写，并把影响章节和角色纳入复查链路。',
    },
    {
      key: 'lore_memory' as const,
      title: 'Lore Memory',
      desc: '世界观、角色和剧情决议的长期记忆中心。',
    },
    {
      key: 'manuscript_center' as const,
      title: 'Manuscript Center',
      desc: '从成稿准备度视角查看整体完成情况。',
    },
    {
      key: 'run_console' as const,
      title: 'Run Console',
      desc: '查看 route、PEER 步骤轨迹和桥接执行信息。',
    },
  ];

  return (
    <div className="page-shell">
      <AppTopbar active="workspace" />

      <section className="card page-head">
        <div className="page-head-row">
          <div>
            <h2>{project.name}</h2>
            <p>{project.description || '当前还没有补充小说简介，可先在 Story Bible 里补全。'}</p>
          </div>
          <div className="inline-actions wrap">
            <Link to={`/project/${projectId}`} className="btn btn-ghost">进入旧工作台</Link>
            <button type="button" className="btn btn-primary" onClick={() => setActiveModule('scene_sprint')}>
              进入 Scene Sprint
            </button>
          </div>
        </div>
        <div className="kpi-grid">
          <article className="kpi-card"><small>章节总数</small><strong>{chapters.length}</strong></article>
          <article className="kpi-card"><small>已完成</small><strong>{completedCount}</strong></article>
          <article className="kpi-card"><small>完成率</small><strong>{completionRate}%</strong></article>
          <article className="kpi-card"><small>最近任务</small><strong>{lastTaskResult ? taskTypeLabel(lastTaskResult.envelope.taskType) : '暂无'}</strong></article>
        </div>
      </section>

      <section className="card section-card">
        <div className="tab-list" role="tablist" aria-label="小说工作台模块">
          {[
            ['overview', 'Overview'],
            ['story_bible', 'Story Bible'],
            ['plot_board', 'Plot Board'],
            ['scene_sprint', 'Scene Sprint'],
            ['continuity_review', 'Continuity Review'],
            ['retcon_flow', 'Retcon Flow'],
            ['lore_memory', 'Lore Memory'],
            ['manuscript_center', 'Manuscript Center'],
            ['run_console', 'Run Console'],
          ].map(([key, label]) => (
            <button
              key={key}
              type="button"
              className={`tab-btn ${activeModule === key ? 'active' : ''}`}
              onClick={() => setActiveModule(key as NovelModuleTab)}
            >
              {label}
            </button>
          ))}
        </div>

        {activeModule === 'overview' && (
          <div className="tab-panel">
            <div className="section-head">
              <h3>Overview</h3>
              <span className="tag">V3 页面壳已接通</span>
            </div>
            <div className="project-grid">
              {moduleCards.map((module) => (
                <article key={module.key} className="project-card">
                  <div className="project-card-head">
                    <strong>{module.title}</strong>
                    <span className="tag">
                      {module.key === 'scene_sprint'
                        ? '已接任务入口'
                        : module.key === 'story_bible' || module.key === 'plot_board'
                          ? '已接真实读写'
                          : module.key === 'continuity_review' || module.key === 'lore_memory' || module.key === 'manuscript_center'
                            ? '已接真实计算'
                            : '占位态'}
                    </span>
                  </div>
                  <p>{module.desc}</p>
                  <div className="project-actions">
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() => setActiveModule(module.key)}
                    >
                      打开模块
                    </button>
                  </div>
                </article>
              ))}
            </div>
            <div className="banner muted">
              当前版本说明：Story Bible、Plot Board、Scene Sprint、Continuity Review、Lore Memory、Manuscript Center 都已接通基础能力；下一阶段重点转向 Router、PEER 和四层上下文。
            </div>
          </div>
        )}

        {activeModule === 'story_bible' && (
          <div className="tab-panel">
            <div className="section-head">
              <h3>Story Bible</h3>
              <span className="tag">{storyBible?.status === 'confirmed' ? '已确认' : '草案'}</span>
            </div>
            <section className="panel">
              <div className="panel-head">
                <div>
                  <h3>故事底座摘要</h3>
                  <p>现在这里已经有真实 Story Bible 仓储，可生成、编辑、保存和确认。</p>
                </div>
                <div className="inline-actions wrap">
                  <button type="button" className="btn btn-ghost" onClick={() => void handleGenerateStoryBible()} disabled={storyBibleGenerating}>
                    {storyBibleGenerating ? '生成中...' : 'AI 重新生成'}
                  </button>
                  <button type="button" className="btn btn-ghost" onClick={() => void handleConfirmStoryBible()} disabled={storyBibleSaving}>
                    确认 Story Bible
                  </button>
                  <button type="button" className="btn btn-primary" onClick={() => void handleSaveStoryBible()} disabled={storyBibleSaving}>
                    {storyBibleSaving ? '保存中...' : '保存'}
                  </button>
                </div>
              </div>
              <div className="form-grid mt-12">
                <div className="field field-full">
                  <label htmlFor="story-bible-premise">故事前提</label>
                  <textarea
                    id="story-bible-premise"
                    rows={3}
                    value={storyBibleDraft.premise}
                    onChange={(event) => setStoryBibleDraft((prev) => ({ ...prev, premise: event.target.value }))}
                  />
                </div>
                <div className="field">
                  <label htmlFor="story-bible-theme">主题</label>
                  <input
                    id="story-bible-theme"
                    value={storyBibleDraft.theme}
                    onChange={(event) => setStoryBibleDraft((prev) => ({ ...prev, theme: event.target.value }))}
                  />
                </div>
                <div className="field">
                  <label htmlFor="story-bible-conflict">主冲突</label>
                  <input
                    id="story-bible-conflict"
                    value={storyBibleDraft.conflictCore}
                    onChange={(event) => setStoryBibleDraft((prev) => ({ ...prev, conflictCore: event.target.value }))}
                  />
                </div>
                <div className="field field-full">
                  <label htmlFor="story-bible-setting">世界观摘要</label>
                  <textarea
                    id="story-bible-setting"
                    rows={4}
                    value={storyBibleDraft.settingSummary}
                    onChange={(event) => setStoryBibleDraft((prev) => ({ ...prev, settingSummary: event.target.value }))}
                  />
                </div>
                <div className="field field-full">
                  <label htmlFor="story-bible-tone">叙事语气</label>
                  <textarea
                    id="story-bible-tone"
                    rows={3}
                    value={storyBibleDraft.toneGuide}
                    onChange={(event) => setStoryBibleDraft((prev) => ({ ...prev, toneGuide: event.target.value }))}
                  />
                </div>
                <div className="field field-full">
                  <label htmlFor="story-bible-promise">叙事承诺</label>
                  <textarea
                    id="story-bible-promise"
                    rows={3}
                    value={storyBibleDraft.narrativePromise}
                    onChange={(event) => setStoryBibleDraft((prev) => ({ ...prev, narrativePromise: event.target.value }))}
                  />
                </div>
              </div>
            </section>
          </div>
        )}

        {activeModule === 'plot_board' && (
          <div className="tab-panel">
            <div className="section-head">
              <h3>Plot Board</h3>
              <span className="tag">{plotBoard?.chapterGoals.length || 0} 章节目标</span>
            </div>
            {!plotBoard?.outline || plotBoard.chapterGoals.length === 0 ? (
              <div className="empty-block">
                <h4>暂无章节结构</h4>
                <p>请先生成大纲，Plot Board 会自动同步成章节目标板。</p>
              </div>
            ) : (
              <div className="outline-list">
                {plotBoard.chapterGoals.map((goal) => (
                  <article key={goal.chapterId} className="panel">
                    <div className="panel-head">
                      <div>
                        <h3>{goal.title}</h3>
                        <p>{goal.chapterId} · {formatChapterGoalStatus(goal.status)}</p>
                      </div>
                      <div className="inline-actions wrap">
                        <button
                          type="button"
                          className="btn btn-ghost"
                          onClick={() => {
                            setSelectedChapterId(goal.chapterId);
                            setActiveModule('scene_sprint');
                          }}
                        >
                          去写这一章
                        </button>
                        <button
                          type="button"
                          className="btn btn-primary"
                          onClick={() => void handleSaveChapterGoal(goal.chapterId)}
                          disabled={chapterGoalSavingId === goal.chapterId}
                        >
                          {chapterGoalSavingId === goal.chapterId ? '保存中...' : '保存目标'}
                        </button>
                      </div>
                    </div>
                    <div className="form-grid mt-12">
                      <div className="field">
                        <label htmlFor={`goal-title-${goal.chapterId}`}>章节标题</label>
                        <input
                          id={`goal-title-${goal.chapterId}`}
                          value={chapterGoalDrafts[goal.chapterId]?.title || ''}
                          onChange={(event) => handleChapterGoalDraftChange(goal.chapterId, 'title', event.target.value)}
                        />
                      </div>
                      <div className="field">
                        <label htmlFor={`goal-objective-${goal.chapterId}`}>章节目标</label>
                        <input
                          id={`goal-objective-${goal.chapterId}`}
                          value={chapterGoalDrafts[goal.chapterId]?.objective || ''}
                          onChange={(event) => handleChapterGoalDraftChange(goal.chapterId, 'objective', event.target.value)}
                        />
                      </div>
                      <div className="field">
                        <label htmlFor={`goal-conflict-${goal.chapterId}`}>关键冲突</label>
                        <input
                          id={`goal-conflict-${goal.chapterId}`}
                          value={chapterGoalDrafts[goal.chapterId]?.conflict || ''}
                          onChange={(event) => handleChapterGoalDraftChange(goal.chapterId, 'conflict', event.target.value)}
                        />
                      </div>
                      <div className="field">
                        <label htmlFor={`goal-shift-${goal.chapterId}`}>情绪变化</label>
                        <input
                          id={`goal-shift-${goal.chapterId}`}
                          value={chapterGoalDrafts[goal.chapterId]?.emotionalShift || ''}
                          onChange={(event) => handleChapterGoalDraftChange(goal.chapterId, 'emotionalShift', event.target.value)}
                        />
                      </div>
                      <div className="field field-full">
                        <label htmlFor={`goal-payoff-${goal.chapterId}`}>本章回报</label>
                        <textarea
                          id={`goal-payoff-${goal.chapterId}`}
                          rows={2}
                          value={chapterGoalDrafts[goal.chapterId]?.payoff || ''}
                          onChange={(event) => handleChapterGoalDraftChange(goal.chapterId, 'payoff', event.target.value)}
                        />
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        )}

        {activeModule === 'scene_sprint' && (
          <div className="tab-panel">
            <div className="section-head">
              <h3>Scene Sprint</h3>
              <span className="tag">统一任务入口已接通</span>
            </div>
            <div className="banner muted">
              当前阶段：任务会先走 `ai:task` 统一入口，结果先落为候选稿。只有采纳后才会写入正式正文。
            </div>
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
                        <span>{chapter.number} · {formatStatus(chapter.status)} · {chapter.wordCount.toLocaleString()} 字</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </aside>

              <section className="panel">
                <div className="panel-head">
                  <div>
                    <h3>{selectedChapter?.title || '请选择章节'}</h3>
                    <p>{selectedChapter ? `${selectedChapter.number} · 完成度 ${selectedChapter.completion}%` : '请选择章节后发起任务'}</p>
                  </div>
                  {selectedChapterId && (
                    <Link to={`/project/${projectId}?chapterId=${encodeURIComponent(selectedChapterId)}`} className="btn btn-ghost">
                      打开旧编辑器
                    </Link>
                  )}
                </div>

                <div className="field field-full">
                  <label htmlFor="scene-task-prompt">任务补充说明</label>
                  <textarea
                    id="scene-task-prompt"
                    rows={3}
                    value={taskPrompt}
                    onChange={(event) => setTaskPrompt(event.target.value)}
                    placeholder="补充场景目标、人物情绪、冲突方向、文风要求。可留空。"
                  />
                </div>

                <div className="editor-toolbar">
                  <div className="intent-list">
                    {[
                      ['polish_scene', '快速润色'],
                      ['advance_scene', '推进场景'],
                      ['rewrite_scene', '深改剧情'],
                    ].map(([taskType, label]) => (
                      <button
                        key={taskType}
                        type="button"
                        className={`intent-btn ${taskType === 'advance_scene' ? 'primary' : ''}`}
                        onClick={() => void handleRunTask(taskType as NovelTaskType)}
                        disabled={!selectedChapterId || taskLoading}
                      >
                        {taskLoading ? '执行中...' : label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="editor-layout">
                  <article className="editor-pane">
                    <pre className="preview-text">{selectedChapter?.content || '当前章节暂无正文内容。'}</pre>
                  </article>
                  <aside className="side-pane">
                    <h4>候选稿</h4>
                    {candidateDrafts.length === 0 ? (
                      <p className="muted-text">还没有候选稿。</p>
                    ) : (
                      <>
                        <ul className="timeline-list">
                          {candidateDrafts.slice(0, 5).map((draft) => (
                            <li key={draft.draftId}>
                              <button
                                type="button"
                                className="chapter-item-btn"
                                onClick={() => setSelectedDraftId(draft.draftId)}
                              >
                                <strong>{formatDateTime(draft.createdAt)}</strong>
                                <span>{intentLabel(draft.sourceIntent)} · {formatCandidateDraftStatus(draft.status)}</span>
                              </button>
                            </li>
                          ))}
                        </ul>
                        {activeDraft && (
                          <>
                            <div className={`banner ${activeContinuityReport?.passed ? '' : 'muted'}`}>
                              连续性检查：
                              {activeContinuityReport
                                ? `${activeContinuityReport.passed ? '通过' : '未通过'} · ${activeContinuityReport.score} 分`
                                : '尚未生成'}
                            </div>
                            <pre className="preview-text">{activeDraft.content}</pre>
                            <div className="inline-actions mt-12 wrap">
                              {activeContinuityReport?.passed ? (
                                <button
                                  type="button"
                                  className="btn btn-primary"
                                  onClick={() => void handleAdoptCandidateDraft(activeDraft.draftId)}
                                  disabled={activeDraft.status === 'adopted'}
                                >
                                  {activeDraft.status === 'adopted' ? '已采纳' : '采纳到正文'}
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  className="btn btn-primary"
                                  onClick={() => setActiveModule('continuity_review')}
                                >
                                  前往 Continuity Review
                                </button>
                              )}
                              <button
                                type="button"
                                className="btn btn-ghost"
                                onClick={() => void handleRejectCandidateDraft(activeDraft.draftId)}
                                disabled={activeDraft.status === 'rejected' || activeDraft.status === 'adopted'}
                              >
                                放弃候选稿
                              </button>
                            </div>
                          </>
                        )}
                      </>
                    )}
                  </aside>
                </div>
              </section>
            </div>
          </div>
        )}

        {activeModule === 'continuity_review' && (
          <div className="tab-panel">
            <div className="section-head">
              <h3>Continuity Review</h3>
              <span className="tag">{continuityReports.length} 份报告</span>
            </div>
            {candidateDrafts.length === 0 ? (
              <div className="empty-block">
                <h4>暂无候选稿</h4>
                <p>请先在 Scene Sprint 发起写作任务，再进入连续性审查。</p>
              </div>
            ) : (
              <div className="workspace-layout">
                <aside className="panel">
                  <div className="panel-head">
                    <h3>待审候选稿</h3>
                    <span className="tag">{candidateDrafts.length} 份</span>
                  </div>
                  <ul className="chapter-list">
                    {candidateDrafts.map((draft) => {
                      const report = continuityReports.find((item) => item.draftId === draft.draftId);
                      return (
                        <li key={draft.draftId} className={`chapter-item ${draft.draftId === selectedDraftId ? 'active' : ''}`}>
                          <button
                            type="button"
                            className="chapter-item-btn"
                            onClick={() => setSelectedDraftId(draft.draftId)}
                          >
                            <h4>{formatDateTime(draft.createdAt)}</h4>
                            <span>
                              {intentLabel(draft.sourceIntent)} ·
                              {report ? ` ${report.passed ? '通过' : '未通过'} ${report.score}分` : ' 未评估'}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </aside>
                <section className="panel">
                  <div className="panel-head">
                    <div>
                      <h3>{activeDraft ? `候选稿 ${formatDateTime(activeDraft.createdAt)}` : '请选择候选稿'}</h3>
                      <p>
                        {activeContinuityReport
                          ? `${activeContinuityReport.passed ? '通过' : '未通过'} · ${activeContinuityReport.score} 分`
                          : '当前还没有连续性报告'}
                      </p>
                    </div>
                    {activeDraft && (
                      <div className="inline-actions wrap">
                        <button
                          type="button"
                          className="btn btn-ghost"
                          onClick={() => void handleRegenerateContinuityReport(activeDraft.draftId)}
                        >
                          重新评估
                        </button>
                        {activeContinuityReport?.passed ? (
                          <button
                            type="button"
                            className="btn btn-primary"
                            onClick={() => void handleAdoptCandidateDraft(activeDraft.draftId)}
                          >
                            采纳到正文
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="btn btn-primary"
                            onClick={() => void handleAdoptCandidateDraft(activeDraft.draftId, true)}
                          >
                            强制采纳
                          </button>
                        )}
                        <button
                          type="button"
                          className="btn btn-ghost"
                          onClick={() => void handleRejectCandidateDraft(activeDraft.draftId)}
                        >
                          放弃候选稿
                        </button>
                      </div>
                    )}
                  </div>

                  {!activeDraft ? (
                    <div className="empty-block compact">
                      <p>请选择候选稿查看问题列表。</p>
                    </div>
                  ) : (
                    <>
                      <div className={`banner ${activeContinuityReport?.passed ? '' : 'muted'}`}>
                        {activeContinuityReport?.revisionAdvice || '当前还没有修订建议。'}
                      </div>
                      <div className="editor-layout">
                        <article className="editor-pane">
                          <pre className="preview-text">{activeDraft.content}</pre>
                        </article>
                        <aside className="side-pane">
                          <h4>问题列表</h4>
                          {!activeContinuityReport || activeContinuityReport.issues.length === 0 ? (
                            <p className="muted-text">未发现明显连续性问题。</p>
                          ) : (
                            <ul className="timeline-list">
                              {activeContinuityReport.issues.map((issue) => (
                                <li key={issue.issueId}>
                                  <strong>{formatContinuityIssueType(issue.type)} · {formatContinuitySeverity(issue.severity)}</strong>
                                  <span>{issue.message}</span>
                                  {issue.suggestion && <span>{issue.suggestion}</span>}
                                </li>
                              ))}
                            </ul>
                          )}
                        </aside>
                      </div>
                    </>
                  )}
                </section>
              </div>
            )}
          </div>
        )}

        {activeModule === 'lore_memory' && (
          <div className="tab-panel">
            <div className="section-head">
              <h3>Lore Memory</h3>
              <span className="tag">{memoryCards.length} 张记忆卡</span>
            </div>
            <section className="panel">
              <div className="panel-head">
                <div>
                  <h3>记忆中心</h3>
                  <p>这里只展示已经被系统视为稳定的信息，不展示临时失败稿。</p>
                </div>
                <button type="button" className="btn btn-primary" onClick={() => void handleSyncLoreMemory()}>
                  同步记忆
                </button>
              </div>
              {!storyBible || storyBible.status !== 'confirmed' ? (
                <div className="empty-block compact">
                  <p>请先确认 Story Bible，长期记忆才会开始沉淀。</p>
                </div>
              ) : memoryCards.length === 0 ? (
                <div className="empty-block compact">
                  <p>当前还没有可沉淀的长期记忆，可先同步一次或完成更多章节。</p>
                </div>
              ) : (
                <div className="project-grid">
                  {memoryCards.map((card) => (
                    <article key={card.memoryId} className="project-card">
                      <div className="project-card-head">
                        <strong>{card.title}</strong>
                        <span className="tag">{formatMemoryCardKind(card.kind)}</span>
                      </div>
                      <p>{card.summary}</p>
                      <div className="project-meta">
                        <span>{Math.round(card.confidence * 100)}% 置信度</span>
                        <span>{card.confirmed ? '已确认' : '待确认'}</span>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}

        {activeModule === 'retcon_flow' && (
          <div className="tab-panel">
            <div className="section-head">
              <h3>Retcon Flow</h3>
              <span className="tag">{retconDecisions.length} 条决策</span>
            </div>
            <div className="workspace-layout">
              <section className="panel">
                <div className="panel-head">
                  <div>
                    <h3>声明一次设定改写</h3>
                    <p>先写清楚改什么、为什么改，再决定是否批准进入长期记忆与复查链路。</p>
                  </div>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => void handleProposeRetcon()}
                    disabled={retconSaving || !retconDraft.summary.trim()}
                  >
                    {retconSaving ? '提交中...' : '创建提案'}
                  </button>
                </div>
                <div className="form-grid mt-12">
                  <div className="field field-full">
                    <label htmlFor="retcon-summary">Retcon 摘要</label>
                    <textarea
                      id="retcon-summary"
                      rows={3}
                      value={retconDraft.summary}
                      onChange={(event) => setRetconDraft((prev) => ({ ...prev, summary: event.target.value }))}
                      placeholder="例如：第 12 章之后，主角并非失忆，而是在故意伪装失忆。"
                    />
                  </div>
                  <div className="field field-full">
                    <label htmlFor="retcon-reason">改动原因</label>
                    <textarea
                      id="retcon-reason"
                      rows={3}
                      value={retconDraft.reason}
                      onChange={(event) => setRetconDraft((prev) => ({ ...prev, reason: event.target.value }))}
                      placeholder="说明它要解决什么连载问题，或要释放哪条新剧情线。"
                    />
                  </div>
                  <div className="field field-full">
                    <label htmlFor="retcon-characters">受影响角色（用逗号分隔）</label>
                    <input
                      id="retcon-characters"
                      value={retconDraft.affectedCharacters}
                      onChange={(event) => setRetconDraft((prev) => ({ ...prev, affectedCharacters: event.target.value }))}
                      placeholder="例如：林澈，闻雪，监察官"
                    />
                  </div>
                  <div className="field field-full">
                    <label>受影响章节</label>
                    <div className="inline-actions wrap">
                      {chapters.map((chapter) => {
                        const selected = retconDraft.affectedChapterIds.includes(chapter.id);
                        return (
                          <button
                            key={chapter.id}
                            type="button"
                            className={selected ? 'btn btn-primary' : 'btn btn-ghost'}
                            onClick={() => toggleRetconChapter(chapter.id)}
                          >
                            {chapter.number} {chapter.title}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </section>

              <aside className="panel">
                <div className="panel-head">
                  <div>
                    <h3>Retcon 决策流</h3>
                    <p>批准后自动创建快照，并把决策写入长期记忆。</p>
                  </div>
                </div>
                {retconDecisions.length === 0 ? (
                  <div className="empty-block compact">
                    <p>当前还没有 retcon 决策。</p>
                  </div>
                ) : (
                  <ul className="timeline-list">
                    {retconDecisions.map((decision) => {
                      const hasChapterRef = decision.affectedRefs.some((ref) => ref.kind === 'chapter');
                      return (
                        <li key={decision.retconId}>
                          <strong>{formatRetconStatus(decision.status)} · {formatDateTime(decision.createdAt)}</strong>
                          <span>{decision.summary}</span>
                          {decision.reason && <span>{decision.reason}</span>}
                          <span>
                            影响范围：
                            {decision.affectedRefs.length > 0
                              ? decision.affectedRefs.map((ref) => `${formatTaskReferenceKind(ref.kind)}:${ref.label || ref.id}`).join('；')
                              : '未指定'}
                          </span>
                          <div className="inline-actions wrap mt-12">
                            {decision.status === 'proposed' && (
                              <button
                                type="button"
                                className="btn btn-primary"
                                onClick={() => void handleApproveRetcon(decision.retconId)}
                                disabled={retconActionId === decision.retconId}
                              >
                                {retconActionId === decision.retconId ? '处理中...' : '批准并写入记忆'}
                              </button>
                            )}
                            {decision.status === 'approved' && (
                              <>
                                <button
                                  type="button"
                                  className="btn btn-ghost"
                                  onClick={() => handleReviewRetcon(decision)}
                                  disabled={!hasChapterRef}
                                >
                                  去复查
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-ghost"
                                  onClick={() => void handleRollbackRetcon(decision.retconId)}
                                  disabled={retconActionId === decision.retconId}
                                >
                                  {retconActionId === decision.retconId ? '处理中...' : '回滚'}
                                </button>
                              </>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </aside>
            </div>
          </div>
        )}

        {activeModule === 'manuscript_center' && (
          <div className="tab-panel">
            <div className="section-head">
              <h3>Manuscript Center</h3>
              <div className="inline-actions wrap">
                <button type="button" className="btn btn-primary" onClick={() => void handleRefreshManuscriptReadiness()}>
                  刷新准备度
                </button>
                <Link to={`/project/${projectId}`} className="btn btn-ghost">打开旧导出与检查页</Link>
              </div>
            </div>
            {!metrics || !manuscriptReadiness ? (
              <div className="empty-block">
                <h4>暂无统计数据</h4>
                <p>请先执行写作任务或保存章节。</p>
              </div>
            ) : (
              <>
                <div className="kpi-grid kpi-grid-wide">
                  <article className="kpi-card"><small>Readiness</small><strong>{manuscriptReadiness.readinessScore}</strong></article>
                  <article className="kpi-card"><small>总章节</small><strong>{metrics.totalChapters}</strong></article>
                  <article className="kpi-card"><small>完成章节</small><strong>{metrics.completedChapters}</strong></article>
                  <article className="kpi-card"><small>阻塞项</small><strong>{manuscriptReadiness.blockingIssueCount}</strong></article>
                  <article className="kpi-card"><small>总字数</small><strong>{metrics.totalWords.toLocaleString()}</strong></article>
                  <article className="kpi-card"><small>AI 操作</small><strong>{metrics.aiOperations}</strong></article>
                  <article className="kpi-card"><small>快照数</small><strong>{metrics.snapshotsCreated}</strong></article>
                  <article className="kpi-card"><small>最近活跃</small><strong>{formatDateTime(metrics.lastActivityAt)}</strong></article>
                </div>
                <section className="panel preview-panel">
                  <div className="panel-head">
                    <div>
                      <h3>阻塞项</h3>
                      <p>只要这里还有阻塞项，就说明当前稿件还不适合进入最终收口或稳定连载。</p>
                    </div>
                  </div>
                  {manuscriptReadiness.blockers.length === 0 ? (
                    <div className="empty-block compact">
                      <p>当前没有明显阻塞项，可以进入导出或总修阶段。</p>
                    </div>
                  ) : (
                    <ul className="timeline-list">
                      {manuscriptReadiness.blockers.map((blocker) => (
                        <li key={blocker.blockerId}>
                          <strong>{blocker.chapterId ? `章节 ${blocker.chapterId}` : '全局阻塞项'}</strong>
                          <span>{blocker.message}</span>
                          {blocker.relatedIssue && (
                            <span>{formatContinuityIssueType(blocker.relatedIssue.type)} · {formatContinuitySeverity(blocker.relatedIssue.severity)}</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              </>
            )}
          </div>
        )}

        {activeModule === 'run_console' && (
          <div className="tab-panel">
            <div className="section-head">
              <h3>Run Console</h3>
              <span className="tag">已展示 Router 与 PEER 轨迹</span>
            </div>
            {!lastTaskResult ? (
              <div className="empty-block">
                <h4>暂无任务记录</h4>
                <p>请先到 Scene Sprint 发起一个写作任务。</p>
              </div>
            ) : (
              <div className="workspace-layout">
                <section className="panel">
                  <div className="panel-head">
                    <div>
                      <h3>{taskTypeLabel(lastTaskResult.envelope.taskType)}</h3>
                      <p>{routeLabel(lastTaskResult.routeDecision.route)} · {complexityLabel(lastTaskResult.routeDecision.complexity)}</p>
                    </div>
                    <span className="tag">{lastTaskResult.routeDecision.executionMode}</span>
                  </div>
                  <ul className="timeline-list">
                    {lastTaskResult.taskRun.steps.map((step) => (
                      <li key={step.stepId}>
                        <strong>{step.label}</strong>
                        <span>{step.status} · {step.note || '暂无备注'}</span>
                      </li>
                    ))}
                    {lastTaskResult.routeDecision.routeSignals.length > 0 && (
                      <li>
                        <strong>Router Signals</strong>
                        <span>{lastTaskResult.routeDecision.routeSignals.join('；')}</span>
                      </li>
                    )}
                  </ul>
                  <div className="panel-section">
                    <h4>Attempt Trace</h4>
                    <ul className="timeline-list">
                      {lastTaskResult.attempts.map((attempt) => (
                        <li key={attempt.candidateDraft.draftId}>
                          <strong>Round {attempt.round + 1}</strong>
                          <span>
                            {attempt.candidateDraft.draftId} · {attempt.continuityReport.passed ? '通过' : '未通过'} · {attempt.continuityReport.score} 分
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="panel-section">
                    <h4>Recent Runs</h4>
                    {taskHistory.length === 0 ? (
                      <div className="empty-block compact">
                        <p>当前还没有历史任务。</p>
                      </div>
                    ) : (
                      <ul className="timeline-list">
                        {taskHistory.map((item) => (
                          <li key={item.taskRun.runId}>
                            <button
                              type="button"
                              className="chapter-item-btn"
                              onClick={() => setLastTaskResult(item)}
                            >
                              <strong>{taskTypeLabel(item.envelope.taskType)} · {routeLabel(item.routeDecision.route)}</strong>
                              <span>
                                {item.taskRun.status} · {item.continuityReport.passed ? '通过' : '未通过'} · {formatDateTime(item.taskRun.finishedAt || item.taskRun.startedAt)}
                              </span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </section>
                <aside className="panel">
                  <div className="panel-head">
                    <div>
                      <h3>结果摘要</h3>
                      <p>当前任务已经返回独立候选稿，只有采纳后才会进入正文。</p>
                    </div>
                  </div>
                  <ul className="timeline-list">
                    <li>
                      <strong>Run ID</strong>
                      <span>{lastTaskResult.taskRun.runId}</span>
                    </li>
                    <li>
                      <strong>Attempt / Revise</strong>
                      <span>{lastTaskResult.attempts.length} 轮生成 · {lastTaskResult.taskRun.revisionCount} 轮修订</span>
                    </li>
                    <li>
                      <strong>Operation ID</strong>
                      <span>{lastTaskResult.operation.id}</span>
                    </li>
                    <li>
                      <strong>Candidate Draft</strong>
                      <span>{lastTaskResult.candidateDraft.draftId}</span>
                    </li>
                    <li>
                      <strong>Continuity</strong>
                      <span>{lastTaskResult.continuityReport.passed ? '通过' : '未通过'} · {lastTaskResult.continuityReport.score} 分</span>
                    </li>
                    <li>
                      <strong>模型</strong>
                      <span>{lastTaskResult.operation.output.model || '-'}</span>
                    </li>
                    <li>
                      <strong>Token</strong>
                      <span>{lastTaskResult.operation.output.tokens}</span>
                    </li>
                  </ul>
                  <div className="panel-section">
                    <h4>四层上下文</h4>
                    <ul className="timeline-list">
                      <li>
                        <strong>System Context</strong>
                        <span>{lastTaskResult.envelope.context.systemContext.join('；') || '无'}</span>
                      </li>
                      <li>
                        <strong>Task Context</strong>
                        <span>{lastTaskResult.envelope.context.taskContext.join('；') || '无'}</span>
                      </li>
                      <li>
                        <strong>Working Memory</strong>
                        <span>
                          {lastTaskResult.envelope.context.workingMemory.length > 0
                            ? lastTaskResult.envelope.context.workingMemory
                              .map((ref) => `${formatTaskReferenceKind(ref.kind)}:${ref.label || ref.id}`)
                              .join('；')
                            : '无'}
                        </span>
                      </li>
                      <li>
                        <strong>Long-term Memory</strong>
                        <span>
                          {lastTaskResult.envelope.context.longTermMemory.length > 0
                            ? lastTaskResult.envelope.context.longTermMemory
                              .map((ref) => `${formatTaskReferenceKind(ref.kind)}:${ref.label || ref.id}`)
                              .join('；')
                            : '无'}
                        </span>
                      </li>
                    </ul>
                  </div>
                </aside>
              </div>
            )}
          </div>
        )}
      </section>
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
        setTargetPath(getProjectWorkspacePath(list[0]));
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

function NovelRedirect(): JSX.Element {
  const [targetPath, setTargetPath] = useState<string | null>(null);

  useEffect(() => {
    const resolveTarget = async () => {
      const list = await projectApi.list();
      const novelProject = list.find((project) => project.type === 'novel');
      if (novelProject) {
        setTargetPath(`/novel/${novelProject.id}`);
        return;
      }

      if (list.length > 0) {
        setTargetPath(getProjectWorkspacePath(list[0]));
        return;
      }

      setTargetPath('/');
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
          <Route path="/novel" element={<NovelRedirect />} />
          <Route path="/novel/:projectId" element={<NovelWorkspacePage addToast={addToast} />} />
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

function getProjectWorkspacePath(project: Pick<Project, 'id' | 'type'>): string {
  return project.type === 'novel' ? `/novel/${project.id}` : `/project/${project.id}`;
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

function taskTypeLabel(taskType: NovelTaskType): string {
  const map: Record<NovelTaskType, string> = {
    advance_scene: '推进场景',
    expand_scene: '扩写场景',
    rewrite_scene: '深改剧情',
    polish_scene: '快速润色',
    polish: '快速润色',
    rewrite_plot: '深改剧情',
  };
  return map[taskType] || taskType;
}

function routeLabel(route: string): string {
  const map: Record<string, string> = {
    'fast-path': 'Fast Path',
    'standard-path': 'Standard Path',
    'deep-path': 'Deep Path',
  };
  return map[route] || route;
}

function complexityLabel(value: string): string {
  const map: Record<string, string> = {
    quick: 'Quick',
    standard: 'Standard',
    deep: 'Deep',
  };
  return map[value] || value;
}

function formatTaskReferenceKind(kind: string): string {
  const map: Record<string, string> = {
    project: '项目',
    chapter: '章节',
    character: '角色',
    timeline_entry: '章节目标',
    continuity_issue: '连续性问题',
    story_bible: 'Story Bible',
    memory_card: '记忆卡',
    retcon_decision: 'Retcon',
  };
  return map[kind] || kind;
}

function formatRetconStatus(status: string): string {
  const map: Record<string, string> = {
    proposed: '待批准',
    approved: '已批准',
    rolled_back: '已回滚',
  };
  return map[status] || status;
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

function formatCandidateDraftStatus(status: string): string {
  const map: Record<string, string> = {
    pending_review: '待审阅',
    needs_revision: '待修订',
    approved: '已通过',
    rejected: '已放弃',
    adopted: '已采纳',
    superseded: '已过期',
  };
  return map[status] || status;
}

function formatChapterGoalStatus(status: string): string {
  const map: Record<string, string> = {
    planned: '已规划',
    drafting: '写作中',
    revising: '修订中',
    completed: '已完成',
  };
  return map[status] || status;
}

function formatContinuityIssueType(type: string): string {
  const map: Record<string, string> = {
    world_rule_conflict: '世界规则冲突',
    character_ooc: '人物失真',
    timeline_conflict: '时间线冲突',
    relationship_conflict: '关系冲突',
    foreshadow_gap: '伏笔/回报缺失',
    plot_gap: '剧情偏离',
    tone_drift: '语气漂移',
  };
  return map[type] || type;
}

function formatContinuitySeverity(severity: string): string {
  const map: Record<string, string> = {
    info: '提示',
    warning: '警告',
    error: '阻塞',
  };
  return map[severity] || severity;
}

function formatMemoryCardKind(kind: string): string {
  const map: Record<string, string> = {
    character: '角色',
    world_rule: '世界规则',
    relationship: '关系',
    timeline: '时间线',
    plot_decision: '剧情决议',
    tone: '语气',
  };
  return map[kind] || kind;
}

function mergeCandidateDrafts(drafts: CandidateDraft[]): CandidateDraft[] {
  const draftMap = new Map<string, CandidateDraft>();
  for (const draft of drafts) {
    if (!draftMap.has(draft.draftId)) {
      draftMap.set(draft.draftId, draft);
    }
  }
  return Array.from(draftMap.values());
}

function mergeContinuityReports(reports: ContinuityReport[]): ContinuityReport[] {
  const reportMap = new Map<string, ContinuityReport>();
  for (const report of reports) {
    if (!reportMap.has(report.reportId)) {
      reportMap.set(report.reportId, report);
    }
  }
  return Array.from(reportMap.values());
}

export default App;
