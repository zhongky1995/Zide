import React, { useState, useEffect, useCallback, useRef } from 'react';
import { HashRouter, Routes, Route, Link, useNavigate, useParams } from 'react-router-dom';
import {
  projectApi,
  outlineApi,
  chapterApi,
  aiApi,
  snapshotApi,
  metricsApi,
  checkApi,
  exportApi,
  API_ERROR_EVENT,
  type ApiErrorDetail,
} from './services/api';
import type { Project, ChapterSummary, Chapter, Outline, ProjectMetrics } from './types/api';

// ============ LLM配置类型 ============
interface LLMConfig {
  provider: string;
  model: string;
  apiKey: string;
  baseUrl: string;
  temperature: number;
  maxTokens: number;
}

// ============ 通用组件 ============

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">{title}</h3>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Loading() {
  return (
    <div className="loading">
      <div className="spinner"></div>
    </div>
  );
}

// ============ Toast 通知组件 ============
interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info';
}

function ToastContainer({ toasts, onRemove }: { toasts: Toast[]; onRemove: (id: number) => void }) {
  return (
    <div className="toast-container">
      {toasts.map(toast => (
        <div key={toast.id} className={`toast ${toast.type}`} onClick={() => onRemove(toast.id)}>
          {toast.message}
        </div>
      ))}
    </div>
  );
}

function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((message: string, type: Toast['type'] = 'info') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3000);
  }, []);

  const removeToast = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return { toasts, addToast, removeToast };
}

// ============ 项目列表页面 ============

interface PageProps {
  addToast?: (message: string, type: 'success' | 'error' | 'info') => void;
}

function ProjectList({ addToast }: PageProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({ name: '', type: 'proposal', description: '', readers: '', scale: '', idea: '' });
  const navigate = useNavigate();

  // 改进：添加设置入口
  const handleOpenSettings = () => {
    navigate('/settings');
  };

  const loadProjects = useCallback(async () => {
    setLoading(true);
    const data = await projectApi.list();
    setProjects(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  const handleCreate = async () => {
    if (!formData.name.trim() || !formData.idea.trim()) return;
    try {
      const project = await projectApi.create({
        name: formData.name,
        type: formData.type,
        description: formData.description,
        readers: formData.readers,
        scale: formData.scale,
        idea: formData.idea,
      });
      if (project) {
        setShowModal(false);
        setFormData({ name: '', type: 'proposal', description: '', readers: '', scale: '', idea: '' });
        navigate(`/project/${project.id}`);
      } else {
        addToast?.('创建失败：AI 设定生成未成功，请检查模型配置后重试。', 'error');
      }
    } catch (error) {
      console.error('创建项目失败:', error);
      addToast?.('创建项目失败，请重试', 'error');
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirm('确定要删除这个项目吗？')) {
      try {
        await projectApi.delete(id);
        loadProjects();
      } catch (error) {
        console.error('删除项目失败:', error);
        addToast?.('删除项目失败，请重试', 'error');
      }
    }
  };

  if (loading) return <Loading />;

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">我的项目</h1>
        <div className="flex gap-2">
          <button className="btn-secondary" onClick={handleOpenSettings}>设置</button>
          <button className="btn-primary" onClick={() => setShowModal(true)}>+ 新建项目</button>
        </div>
      </div>

      {projects.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📁</div>
          <h3 className="empty-state-title">暂无项目</h3>
          <p>创建一个新项目开始你的长文写作之旅</p>
          <button className="btn-primary mt-4" onClick={() => setShowModal(true)}>创建项目</button>
        </div>
      ) : (
        <div className="project-grid">
          {projects.map(project => (
            <div key={project.id} className="project-card" onClick={() => navigate(`/project/${project.id}`)}>
              <div className="project-card-header">
                <span className="project-name">{project.name}</span>
                <span className="project-type">{project.type}</span>
              </div>
              <p className="project-description">{project.description || '暂无描述'}</p>
              <div className="project-meta">
                <span>📝 {project.chapterIds.length} 章节</span>
                <span>📅 {new Date(project.updatedAt).toLocaleDateString()}</span>
                <button className="btn-danger btn-sm" onClick={(e) => handleDelete(e, project.id)}>删除</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <Modal title="创建新项目" onClose={() => setShowModal(false)}>
          <div className="form-group">
            <label className="form-label">项目名称 *</label>
            <input
              type="text"
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              placeholder="输入项目名称"
            />
          </div>
          <div className="form-group">
            <label className="form-label">项目类型</label>
            <select value={formData.type} onChange={e => setFormData({ ...formData, type: e.target.value })}>
              <option value="proposal">方案</option>
              <option value="report">报告</option>
              <option value="research">研究报告</option>
              <option value="novel">小说</option>
              <option value="other">其他</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">目标读者</label>
            <input
              type="text"
              value={formData.readers}
              onChange={e => setFormData({ ...formData, readers: e.target.value })}
              placeholder="例如：技术爱好者、创业者"
            />
          </div>
          <div className="form-group">
            <label className="form-label">目标规模</label>
            <input
              type="text"
              value={formData.scale}
              onChange={e => setFormData({ ...formData, scale: e.target.value })}
              placeholder="例如：10万字"
            />
          </div>
          <div className="form-group">
            <label className="form-label">你的想法 *</label>
            <textarea
              value={formData.idea}
              onChange={e => setFormData({ ...formData, idea: e.target.value })}
              placeholder="描述你想要写的内容、核心观点、写作目标等，AI会根据这些生成全局设定"
              rows={4}
            />
          </div>
          <div className="form-group">
            <label className="form-label">项目描述</label>
            <textarea
              value={formData.description}
              onChange={e => setFormData({ ...formData, description: e.target.value })}
              placeholder="简要描述项目内容"
              rows={3}
            />
          </div>
          <div className="modal-footer">
            <button className="btn-secondary" onClick={() => setShowModal(false)}>取消</button>
            <button className="btn-primary" onClick={handleCreate} disabled={!formData.name.trim() || !formData.idea.trim()}>创建</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ============ 项目工作台页面 ============

function ProjectWorkspace({ addToast }: PageProps) {
  const { projectId } = useParams<{ projectId: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [chapters, setChapters] = useState<ChapterSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'outline' | 'chapters' | 'metrics' | 'check' | 'export'>('outline');
  const [outline, setOutline] = useState<Outline | null>(null);
  const [metrics, setMetrics] = useState<ProjectMetrics | null>(null);
  const navigate = useNavigate();

  const loadData = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    const [projectData, chaptersData, outlineData] = await Promise.all([
      projectApi.get(projectId),
      chapterApi.summaryList(projectId),
      outlineApi.get(projectId),
    ]);
    setProject(projectData);
    setChapters(chaptersData);
    setOutline(outlineData);
    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // 加载AI策略列表
  useEffect(() => {
    const loadStrategies = async () => {
      const strategyList = await aiApi.listStrategies();
      setStrategies(strategyList || []);
      const current = await aiApi.getStrategy();
      if (current) {
        setActiveStrategy(current.id);
      }
    };
    loadStrategies();
  }, []);

  // 大纲相关状态
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [generating, setGenerating] = useState(false);

  // 项目设定相关状态
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [projectSettings, setProjectSettings] = useState({
    background: '',
    goals: '',
    constraints: '',
    style: '',
  });

  // AI策略相关状态
  const [strategies, setStrategies] = useState<{ id: string; name: string; description: string }[]>([]);
  const [activeStrategy, setActiveStrategy] = useState<string>('');

  // 生成大纲 - 由 AI 自主判断章节结构与数量
  const handleGenerateOutline = async () => {
    if (!projectId) return;
    setGenerating(true);
    try {
      const generatedOutline = await outlineApi.generate(projectId);
      if (generatedOutline) {
        const outline = generatedOutline;
        setOutline(outline);
        // 大纲生成会创建章节桩文件，刷新一次可让章节工作台立即可用
        await loadData();
        setShowTemplateModal(false);
        addToast?.('大纲生成成功，共' + (outline.chapters?.length || 0) + '章', 'success');
      } else {
        addToast?.('AI 大纲生成失败，请检查模型配置与网络后重试。', 'error');
      }
    } catch (error) {
      addToast?.('生成大纲失败: ' + (error as Error).message, 'error');
    } finally {
      setGenerating(false);
    }
  };

  const handleDeleteChapter = async (chapterId: string) => {
    if (!projectId) return;
    const confirmed = confirm('确定要删除这个章节吗？');
    if (!confirmed) return;

    // 直接使用 ipc 调用删除章节
    const result = await window.zide.deleteChapter(projectId, chapterId);
    if (result?.success) {
      loadData();
    }
  };

  const handleConfirmOutline = async () => {
    if (!projectId) return;
    const result = await outlineApi.confirm(projectId);
    if (result) {
      setOutline(result);
      loadData();
    }
  };

  const handleCreateChapter = async () => {
    if (!projectId) return;
    const number = await chapterApi.getNextNumber(projectId);
    const result = await outlineApi.addChapter(projectId, `第${number}章`);
    if (result) {
      setOutline(result);
      loadData();
    }
  };

  const handleLoadMetrics = async () => {
    if (!projectId) return;
    const data = await metricsApi.getProject(projectId);
    setMetrics(data);
  };

  if (loading || !project) return <Loading />;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">{project.name}</h1>
          <p className="text-gray text-sm mt-2">{project.description}</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary" onClick={() => {
            // 加载项目设定（从 meta 字段读取）
            setProjectSettings({
              background: project.meta?.background || '',
              goals: project.meta?.objectives || '',
              constraints: project.meta?.constraints || '',
              style: project.meta?.styleGuide || '',
            });
            setShowSettingsModal(true);
          }}>全局设定</button>
          <select
            value={activeStrategy}
            onChange={async (e) => {
              const strategyId = e.target.value;
              setActiveStrategy(strategyId);
              await aiApi.setStrategy(strategyId);
              addToast?.('AI策略已切换', 'success');
            }}
            style={{ padding: '6px 12px', borderRadius: '4px', border: '1px solid var(--gray-300)' }}
          >
            {strategies.map(strategy => (
              <option key={strategy.id} value={strategy.id}>{strategy.name}</option>
            ))}
          </select>
          <button className="btn-secondary" onClick={() => navigate('/')}>返回列表</button>
        </div>
      </div>

      <div className="flex gap-4 mb-4">
        <button
          className={`btn ${activeTab === 'outline' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('outline')}
        >
          大纲管理
        </button>
        <button
          className={`btn ${activeTab === 'chapters' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('chapters')}
        >
          章节工作台
        </button>
        <button
          className={`btn ${activeTab === 'metrics' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => { setActiveTab('metrics'); handleLoadMetrics(); }}
        >
          项目统计
        </button>
        <button
          className={`btn ${activeTab === 'check' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('check')}
        >
          整体检查
        </button>
        <button
          className={`btn ${activeTab === 'export' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('export')}
        >
          导出中心
        </button>
      </div>

      {activeTab === 'outline' && (
        <div className="card">
          <div className="flex justify-between items-center mb-4">
            <h3>大纲管理</h3>
            <div className="flex gap-2">
              <button className="btn-primary" onClick={() => setShowTemplateModal(true)}>
                {outline?.chapters?.length ? '重新生成' : '生成大纲'}
              </button>
              {outline && outline.status === 'draft' && (
                <button className="btn-success" onClick={handleConfirmOutline}>确认大纲</button>
              )}
              <button className="btn-secondary" onClick={handleCreateChapter}>添加章节</button>
            </div>
          </div>

          {/* 大纲状态提示 */}
          {outline && (
            <div className="flex items-center gap-2 mb-4 p-3 rounded" style={{ background: outline.status === 'confirmed' ? 'var(--success-light, #d1fae5)' : 'var(--gray-100, #f3f4f6)' }}>
              <span className={`status-badge ${outline.status === 'confirmed' ? 'bg-green' : 'bg-yellow'}`}>
                {outline.status === 'confirmed' ? '已确认' : '草稿'}
              </span>
              <span className="text-sm">共 {outline.chapters.length} 章</span>
              <span className="text-sm text-gray">
                {outline.chapters.filter(c => c.status === 'completed').length} 已完成
              </span>
            </div>
          )}

          {outline ? (
            <div className="chapter-list">
              {outline.chapters.map((ch, idx) => (
                <div key={ch.id} className="chapter-item">
                  <div className="chapter-info">
                    <div className="chapter-number">{ch.number}</div>
                    <div className="chapter-title">{ch.title}</div>
                    {ch.target && <div className="text-gray text-sm">{ch.target}</div>}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`chapter-status status-${ch.status === 'completed' ? 'completed' : ch.status === 'in_progress' ? 'in-progress' : 'todo'}`}>
                      {ch.status === 'completed' ? '已完成' : ch.status === 'in_progress' ? '进行中' : '待开始'}
                    </span>
                    <button
                      className="btn-icon"
                      onClick={() => handleDeleteChapter(ch.id)}
                      title="删除章节"
                    >
                      ×
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <p>还没有大纲，点击"生成大纲"开始创建</p>
              <p className="text-gray text-sm mt-2">AI 会根据全局设定自动规划章节结构</p>
            </div>
          )}
        </div>
      )}

      {/* 模板选择弹窗 */}
      {showTemplateModal && (
        <div className="modal-overlay" onClick={() => setShowTemplateModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>AI 生成大纲</h3>
              <button className="btn-close" onClick={() => setShowTemplateModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <p className="mb-4">AI 将根据项目全局设定自动生成适合的大纲结构。</p>
              <p className="text-gray text-sm">
                不需要手动指定章节数量，AI 会按你的设定自行判断结构与篇幅。
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowTemplateModal(false)}>取消</button>
              <button
                className="btn-primary"
                onClick={handleGenerateOutline}
                disabled={generating}
              >
                {generating ? 'AI 生成中...' : 'AI 生成大纲'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 项目全局设定弹窗 */}
      {showSettingsModal && (
        <div className="modal-overlay" onClick={() => setShowSettingsModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>项目全局设定</h3>
              <button className="btn-close" onClick={() => setShowSettingsModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">背景设定</label>
                <textarea
                  value={projectSettings.background}
                  onChange={e => setProjectSettings({ ...projectSettings, background: e.target.value })}
                  placeholder="输入项目背景、背景故事、设定说明等"
                  rows={3}
                />
              </div>
              <div className="form-group">
                <label className="form-label">目标</label>
                <textarea
                  value={projectSettings.goals}
                  onChange={e => setProjectSettings({ ...projectSettings, goals: e.target.value })}
                  placeholder="输入项目目标、核心论点、情节走向等"
                  rows={3}
                />
              </div>
              <div className="form-group">
                <label className="form-label">约束条件</label>
                <textarea
                  value={projectSettings.constraints}
                  onChange={e => setProjectSettings({ ...projectSettings, constraints: e.target.value })}
                  placeholder="输入约束条件、限制因素、注意事项等"
                  rows={3}
                />
              </div>
              <div className="form-group">
                <label className="form-label">风格</label>
                <textarea
                  value={projectSettings.style}
                  onChange={e => setProjectSettings({ ...projectSettings, style: e.target.value })}
                  placeholder="输入文风要求、语言风格、表达方式等"
                  rows={3}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowSettingsModal(false)}>取消</button>
              <button className="btn-primary" onClick={async () => {
                if (project) {
                  // 转换为 meta 格式
                  const meta = {
                    background: projectSettings.background,
                    objectives: projectSettings.goals,
                    constraints: projectSettings.constraints,
                    styleGuide: projectSettings.style,
                  };
                  await projectApi.update(project.id, { meta });
                  setProject({ ...project, meta });
                  addToast?.('设定已保存', 'success');
                  setShowSettingsModal(false);
                }
              }}>保存设定</button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'chapters' && (
        <div className="editor-layout">
          <div className="editor-sidebar">
            <div className="p-4" style={{ borderBottom: '1px solid var(--gray-200)' }}>
              <h3>章节列表</h3>
            </div>
            <div className="flex-1 overflow-auto p-4">
              {chapters.length === 0 ? (
                <div className="empty-state">
                  <p>暂无章节</p>
                  <p className="text-sm text-gray mt-2">请先在"大纲管理"中创建章节</p>
                </div>
              ) : (
                <div className="chapter-list">
                  {chapters.map(ch => (
                    <div
                      key={ch.id}
                      className="chapter-item"
                      onClick={() => navigate(`/project/${projectId}/chapter/${ch.id}`)}
                    >
                      <div className="chapter-info">
                        <div className="chapter-title">{ch.title}</div>
                        <div className="text-sm text-gray">{ch.number} · {ch.wordCount}字</div>
                      </div>
                      <div className="chapter-progress">
                        <div className="chapter-progress-bar" style={{ width: `${ch.completion}%` }}></div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="editor-main">
            <div className="flex items-center justify-center h-full">
              <div className="empty-state">
                <p>选择一个章节开始编辑</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'metrics' && (
        <div className="card">
          <h3 className="mb-4">项目统计</h3>
          {metrics ? (
            <div className="flex gap-4 flex-wrap">
              <div className="card" style={{ minWidth: '150px' }}>
                <div className="text-gray text-sm">总章节</div>
                <div className="text-2xl" style={{ fontSize: '32px', fontWeight: 'bold' }}>{metrics.totalChapters}</div>
              </div>
              <div className="card" style={{ minWidth: '150px' }}>
                <div className="text-gray text-sm">已完成</div>
                <div className="text-2xl text-success" style={{ fontSize: '32px', fontWeight: 'bold' }}>{metrics.completedChapters}</div>
              </div>
              <div className="card" style={{ minWidth: '150px' }}>
                <div className="text-gray text-sm">总字数</div>
                <div className="text-2xl" style={{ fontSize: '32px', fontWeight: 'bold' }}>{metrics.totalWords.toLocaleString()}</div>
              </div>
              <div className="card" style={{ minWidth: '150px' }}>
                <div className="text-gray text-sm">AI操作</div>
                <div className="text-2xl" style={{ fontSize: '32px', fontWeight: 'bold' }}>{metrics.aiOperations}</div>
              </div>
              <div className="card" style={{ minWidth: '150px' }}>
                <div className="text-gray text-sm">采纳率</div>
                <div className="text-2xl text-warning" style={{ fontSize: '32px', fontWeight: 'bold' }}>
                  {metrics.aiOperations > 0 ? Math.round(metrics.adoptedOperations / metrics.aiOperations * 100) : 0}%
                </div>
              </div>
            </div>
          ) : (
            <div className="empty-state">
              <p>点击"项目统计"按钮加载统计数据</p>
            </div>
          )}
        </div>
      )}

      {activeTab === 'check' && (
        <CheckPage projectId={projectId || ''} addToast={addToast} />
      )}

      {activeTab === 'export' && (
        <ExportPage projectId={projectId || ''} addToast={addToast} />
      )}
    </div>
  );
}

// ============ 章节编辑器页面 ============

function ChapterEditor({ addToast }: PageProps) {
  const { projectId, chapterId } = useParams<{ projectId: string; chapterId: string }>();
  const [chapter, setChapter] = useState<Chapter | null>(null);
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [chapters, setChapters] = useState<ChapterSummary[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const navigate = useNavigate();

  const loadChapter = useCallback(async () => {
    if (!projectId || !chapterId) return;
    setLoading(true);
    const [chapterData, chaptersData] = await Promise.all([
      chapterApi.get(projectId, chapterId),
      chapterApi.summaryList(projectId),
    ]);
    if (chapterData) {
      setChapter(chapterData);
      setContent(chapterData.content);
    }
    setChapters(chaptersData);
    setLoading(false);
  }, [projectId, chapterId]);

  useEffect(() => {
    loadChapter();
  }, [loadChapter]);

  const handleSave = async () => {
    if (!projectId || !chapterId) return;
    setSaving(true);
    await chapterApi.save(projectId, chapterId, content);
    setSaving(false);
  };

  const handleAI = async (intent: string) => {
    if (!projectId || !chapterId) return;
    setAiLoading(true);
    try {
      const result = await aiApi.generate(projectId, chapterId, intent);
      if (result) {
        setContent(result.chapter.content);
        setChapter(result.chapter);
      } else {
        addToast?.('AI 调用失败，请先检查模型配置与网络连接。', 'error');
      }
    } catch (error) {
      console.error('AI 生成失败:', error);
      addToast?.('AI 生成失败，请重试', 'error');
    } finally {
      setAiLoading(false);
    }
  };

  const handleCreateSnapshot = async () => {
    if (!projectId || !chapterId) return;
    await snapshotApi.createChapter(projectId, chapterId);
    addToast?.('快照创建成功', 'success');
  };

  if (loading || !chapter) return <Loading />;

  return (
    <div>
      <div className="page-header">
        <div>
          <button className="btn-secondary btn-sm" onClick={() => navigate(`/project/${projectId}`)}>
            ← 返回项目
          </button>
          <h1 className="page-title mt-2">{chapter.title}</h1>
          <p className="text-gray text-sm">章节 {chapter.number} · {chapter.wordCount} 字 · 完成度 {chapter.completion}%</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary" onClick={handleCreateSnapshot}>📷 创建快照</button>
          <button className="btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? '保存中...' : '保存'}
          </button>
        </div>
      </div>

      <div className="editor-layout">
        <div className="editor-sidebar">
          <div className="p-4" style={{ borderBottom: '1px solid var(--gray-200)' }}>
            <h3>章节列表</h3>
          </div>
          <div className="flex-1 overflow-auto p-4">
            <div className="chapter-list">
              {chapters.map(ch => (
                <div
                  key={ch.id}
                  className={`chapter-item ${ch.id === chapterId ? 'active' : ''}`}
                  onClick={() => navigate(`/project/${projectId}/chapter/${ch.id}`)}
                >
                  <div className="chapter-info">
                    <div className="chapter-title">{ch.title}</div>
                    <div className="text-sm text-gray">{ch.number} · {ch.wordCount}字</div>
                  </div>
                  <div className="chapter-progress">
                    <div className="chapter-progress-bar" style={{ width: `${ch.completion}%` }}></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="editor-main">
          <div className="editor-toolbar">
            <button className="btn-primary btn-sm" onClick={() => handleAI('continue')} disabled={aiLoading}>
              续写
            </button>
            <button className="btn-primary btn-sm" onClick={() => handleAI('expand')} disabled={aiLoading}>
              扩写
            </button>
            <button className="btn-secondary btn-sm" onClick={() => handleAI('rewrite')} disabled={aiLoading}>
              重写
            </button>
            <button className="btn-secondary btn-sm" onClick={() => handleAI('add_argument')} disabled={aiLoading}>
              补论证
            </button>
            <button className="btn-secondary btn-sm" onClick={() => handleAI('polish')} disabled={aiLoading}>
              润色
            </button>
            <button className="btn-secondary btn-sm" onClick={() => handleAI('simplify')} disabled={aiLoading}>
              简化
            </button>
            {aiLoading && <span className="text-gray">AI生成中...</span>}
          </div>
          <div className="editor-content">
            <textarea
              className="editor-textarea"
              value={content}
              onChange={e => setContent(e.target.value)}
              placeholder="开始写作..."
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ============ 设置页面 ============

function SettingsPage({ addToast }: PageProps) {
  const [config, setConfig] = useState<LLMConfig>({
    provider: 'openai',
    model: 'gpt-4o',
    apiKey: '',
    baseUrl: 'https://api.openai.com/v1',
    temperature: 0.7,
    maxTokens: 4000,
  });
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const navigate = useNavigate();

  // AI策略相关状态
  const [strategies, setStrategies] = useState<{ id: string; name: string; description: string }[]>([]);
  const [activeStrategy, setActiveStrategy] = useState<string>('');

  const loadConfig = useCallback(async () => {
    if (window.zide?.aiGetConfig) {
      const result = await window.zide.aiGetConfig();
      if (result?.success && result.data) {
        setConfig(prev => ({ ...prev, ...result.data }));
      }
    }
  }, []);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  // 加载AI策略列表
  useEffect(() => {
    const loadStrategies = async () => {
      const strategyList = await aiApi.listStrategies();
      setStrategies(strategyList || []);
      const current = await aiApi.getStrategy();
      if (current) {
        setActiveStrategy(current.id);
      }
    };
    loadStrategies();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      if (window.zide?.aiUpdateConfig) {
        await window.zide.aiUpdateConfig(config);
        addToast?.('设置已保存', 'success');
      }
    } catch (error) {
      console.error('保存设置失败:', error);
      addToast?.('保存设置失败，请重试', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      if (window.zide?.aiPing) {
        const result = await window.zide.aiPing();
        setTestResult({
          success: result?.success || false,
          message: result?.success ? '连接成功' : (result?.error || '连接失败'),
        });
      } else {
        setTestResult({ success: true, message: '配置可用（模拟）' });
      }
    } catch (error) {
      setTestResult({ success: false, message: '连接失败' });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="settings-page">
      <div className="page-header">
        <h1 className="page-title">设置</h1>
        <button className="btn-secondary" onClick={() => navigate('/')}>返回首页</button>
      </div>

      <div className="card">
        <h3 className="mb-4">LLM 配置</h3>

        <div className="form-group">
          <label className="form-label">模型提供商</label>
          <select
            value={config.provider}
            onChange={e => {
              const provider = e.target.value;
              let baseUrl = config.baseUrl;
              if (provider === 'openai') baseUrl = 'https://api.openai.com/v1';
              else if (provider === 'anthropic') baseUrl = 'https://api.anthropic.com';
              else if (provider === 'minimax') baseUrl = 'https://api.minimax.chat/v1';
              else if (provider === 'kimi') baseUrl = 'https://api.moonshot.cn/v1';
              setConfig({ ...config, provider, baseUrl });
            }}
          >
            <option value="openai">OpenAI</option>
            <option value="anthropic">Anthropic (Claude)</option>
            <option value="minimax">MiniMax (海螺AI)</option>
            <option value="kimi">Kimi (月之暗面)</option>
            <option value="azure">Azure OpenAI</option>
            <option value="custom">自定义</option>
          </select>
        </div>

        <div className="form-group">
          <label className="form-label">模型名称</label>
          <input
            type="text"
            value={config.model}
            onChange={e => setConfig({ ...config, model: e.target.value })}
            placeholder="例如：gpt-4o, claude-3-opus"
          />
        </div>

        <div className="form-group">
          <label className="form-label">API Key</label>
          <input
            type="password"
            value={config.apiKey}
            onChange={e => setConfig({ ...config, apiKey: e.target.value })}
            placeholder="输入 API Key"
          />
        </div>

        <div className="form-group">
          <label className="form-label">API 地址</label>
          <input
            type="text"
            value={config.baseUrl}
            onChange={e => setConfig({ ...config, baseUrl: e.target.value })}
            placeholder="例如：https://api.openai.com/v1"
          />
          <p className="form-help">自定义模型或代理时需要修改</p>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Temperature</label>
            <input
              type="number"
              step="0.1"
              min="0"
              max="2"
              value={config.temperature}
              onChange={e => setConfig({ ...config, temperature: parseFloat(e.target.value) })}
            />
            <p className="form-help">控制随机性 (0-2)</p>
          </div>

          <div className="form-group">
            <label className="form-label">最大 Token 数</label>
            <input
              type="number"
              step="100"
              min="100"
              max="128000"
              value={config.maxTokens}
              onChange={e => setConfig({ ...config, maxTokens: parseInt(e.target.value) })}
            />
          </div>
        </div>

        {testResult && (
          <div className={`test-result ${testResult.success ? 'success' : 'error'}`}>
            {testResult.message}
          </div>
        )}

        <div className="flex gap-2 mt-4">
          <button className="btn-secondary" onClick={handleTest} disabled={testing}>
            {testing ? '测试中...' : '测试连接'}
          </button>
          <button className="btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? '保存中...' : '保存设置'}
          </button>
        </div>
      </div>

      <div className="card mt-4">
        <h3 className="mb-4">AI 策略管理</h3>
        <p className="text-gray text-sm mb-4">选择不同的 AI 策略以优化内容生成效果</p>

        <div className="form-group">
          <label className="form-label">当前策略</label>
          <select
            value={activeStrategy}
            onChange={async (e) => {
              const strategyId = e.target.value;
              setActiveStrategy(strategyId);
              await aiApi.setStrategy(strategyId);
              addToast?.('AI策略已切换', 'success');
            }}
          >
            {strategies.map(strategy => (
              <option key={strategy.id} value={strategy.id}>{strategy.name}</option>
            ))}
          </select>
        </div>

        <div className="mt-4">
          <h4 className="text-sm font-medium mb-2">可用策略</h4>
          <div className="strategy-list">
            {strategies.map(strategy => (
              <div
                key={strategy.id}
                className={`strategy-item ${strategy.id === activeStrategy ? 'active' : ''}`}
                style={{
                  padding: '12px',
                  border: '1px solid var(--gray-200)',
                  borderRadius: '4px',
                  marginBottom: '8px',
                  background: strategy.id === activeStrategy ? 'var(--primary-light, #e0f2fe)' : 'transparent',
                }}
              >
                <div className="font-medium">{strategy.name}</div>
                <div className="text-gray text-sm">{strategy.description}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card mt-4">
        <h3 className="mb-4">关于</h3>
        <p className="text-gray">Zide - AI 驱动的内容创作平台</p>
        <p className="text-gray text-sm mt-2">版本 1.0.0</p>
      </div>
    </div>
  );
}

// ============ 检查页面 ============

function CheckPage({ projectId, addToast }: { projectId?: string; addToast?: (message: string, type: 'success' | 'error' | 'info') => void }) {
  const { projectId: routeProjectId } = useParams<{ projectId: string }>();
  const pid = projectId || routeProjectId;
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [checkType, setCheckType] = useState<string>('all');
  const navigate = useNavigate();

  const runCheck = async () => {
    if (!pid) return;
    setLoading(true);
    try {
      const data = await checkApi.run(pid);
      setResults(data?.issues || []);
    } catch (error) {
      console.error('检查失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleResolve = async (issue: any) => {
    if (!pid) return;
    await checkApi.resolveIssue(pid, issue);
    runCheck();
  };

  const handleIgnore = async (issue: any) => {
    if (!pid) return;
    await checkApi.ignoreIssue(pid, issue);
    runCheck();
  };

  const getIssueTypeLabel = (type: string) => {
    const map: Record<string, string> = {
      missing_chapter: '缺章',
      term_conflict: '术语冲突',
      duplicate_content: '重复内容',
      low_completion: '完成度低',
      completion_low: '完成度低',
      outline_drift: '大纲偏离',
    };
    return map[type] || type;
  };

  return (
    <div>
      <div className="card">
        <div className="flex justify-between items-center mb-4">
          <h3>检查结果</h3>
          <button className="btn-primary" onClick={runCheck} disabled={loading}>
            {loading ? '检查中...' : '运行检查'}
          </button>
        </div>
        {results.length === 0 ? (
          <div className="empty-state">
            <p>点击"运行检查"开始全面检查</p>
          </div>
        ) : (
          <div className="issue-list">
            {results.map((issue, idx) => (
              <div key={idx} className="issue-item">
                <div className="issue-info">
                  <span className={`issue-type type-${issue.type}`}>
                    {getIssueTypeLabel(issue.type)}
                  </span>
                  <span className="issue-message">{issue.message}</span>
                  {issue.chapterId && (
                    <span className="text-gray text-sm ml-2">章节: {issue.chapterTitle || issue.chapterId}</span>
                  )}
                </div>
                <div className="issue-actions">
                  {issue.suggestion && (
                    <button className="btn-primary btn-sm" onClick={() => handleResolve(issue)}>
                      修复
                    </button>
                  )}
                  <button className="btn-secondary btn-sm" onClick={() => handleIgnore(issue)}>
                    忽略
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ============ 导出页面 ============

function ExportPage({ projectId, addToast }: { projectId?: string; addToast?: (message: string, type: 'success' | 'error' | 'info') => void }) {
  const { projectId: routeProjectId } = useParams<{ projectId: string }>();
  const pid = projectId || routeProjectId;
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const [preview, setPreview] = useState('');
  const [format, setFormat] = useState<'md' | 'html' | 'pdf'>('md');

  const loadHistory = async () => {
    if (!pid) return;
    const data = await exportApi.history(pid);
    setHistory(data);
  };

  useEffect(() => {
    loadHistory();
  }, [pid]);

  const handleExport = async () => {
    if (!pid) return;
    setExporting(true);
    try {
      const result = await exportApi.export(pid, format);
      if (result) {
        addToast?.(`导出成功！文件保存于: ${result.filePath}`, 'success');
        loadHistory();
      }
    } catch (error) {
      console.error('导出失败:', error);
      addToast?.('导出失败，请重试', 'error');
    } finally {
      setExporting(false);
    }
  };

  const handlePreview = async () => {
    if (!pid) return;
    setLoading(true);
    try {
      const content = await exportApi.preview(pid, format);
      setPreview(content);
    } catch (error) {
      console.error('预览失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDir = async () => {
    await exportApi.openDir(pid);
  };

  return (
    <div>
      <div className="grid-2">
        <div className="card">
          <h3 className="mb-4">导出项目</h3>
          <div className="form-group">
            <label className="form-label">导出格式</label>
            <select value={format} onChange={e => setFormat(e.target.value as any)}>
              <option value="md">Markdown (.md)</option>
              <option value="html">HTML (.html)</option>
              <option value="pdf">PDF (.pdf)</option>
            </select>
          </div>
          <div className="flex gap-2 mt-4">
            <button className="btn-primary" onClick={handleExport} disabled={exporting}>
              {exporting ? '导出中...' : '导出项目'}
            </button>
            <button className="btn-secondary" onClick={handlePreview} disabled={loading}>
              {loading ? '加载中...' : '预览'}
            </button>
            <button className="btn-secondary" onClick={handleOpenDir}>打开目录</button>
          </div>
        </div>

        <div className="card">
          <h3 className="mb-4">导出历史</h3>
          {history.length === 0 ? (
            <div className="empty-state">
              <p>暂无导出记录</p>
            </div>
          ) : (
            <div className="history-list">
              {history.map((item, idx) => (
                <div key={idx} className="history-item">
                  <div>
                    <span className="font-medium">{item.format?.toUpperCase()}</span>
                    <span className="text-gray text-sm ml-2">
                      {new Date(item.createdAt).toLocaleString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {preview && (
        <div className="card mt-4">
          <h3 className="mb-4">预览</h3>
          <div className="preview-content" style={{ maxHeight: '400px', overflow: 'auto' }}>
            <pre style={{ whiteSpace: 'pre-wrap', fontSize: '12px' }}>{preview.slice(0, 2000)}</pre>
            {preview.length > 2000 && <p className="text-gray">... (更多内容)</p>}
          </div>
        </div>
      )}
    </div>
  );
}

// ============ 主应用组件 ============

function App() {
  const { toasts, addToast, removeToast } = useToast();
  const lastErrorRef = useRef<{ message: string; ts: number }>({ message: '', ts: 0 });

  useEffect(() => {
    const onApiError = (event: Event) => {
      const detail = (event as CustomEvent<ApiErrorDetail>).detail;
      if (!detail) return;

      const now = Date.now();
      // 同一错误在极短时间内只提示一次，避免并发请求导致刷屏
      if (
        lastErrorRef.current.message === detail.message
        && now - lastErrorRef.current.ts < 1500
      ) {
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
    <div className="app">
      <HashRouter>
        <Routes>
          <Route path="/" element={<ProjectList addToast={addToast} />} />
          <Route path="/settings" element={<SettingsPage addToast={addToast} />} />
          <Route path="/project/:projectId" element={<ProjectWorkspace addToast={addToast} />} />
          <Route path="/project/:projectId/chapter/:chapterId" element={<ChapterEditor addToast={addToast} />} />
          <Route path="/project/:projectId/check" element={<CheckPage addToast={addToast} />} />
          <Route path="/project/:projectId/export" element={<ExportPage addToast={addToast} />} />
        </Routes>
      </HashRouter>
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}

export default App;
