import React, { useState, useEffect, useCallback } from 'react';
import { HashRouter, Routes, Route, Link, useNavigate, useParams } from 'react-router-dom';
import { projectApi, outlineApi, chapterApi, aiApi, snapshotApi, metricsApi } from './services/api';
import type { Project, ChapterSummary, Chapter, Outline, ProjectMetrics } from './types/api';

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

// ============ 项目列表页面 ============

function ProjectList() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({ name: '', type: 'standard', description: '', readers: '', scale: '' });
  const navigate = useNavigate();

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
    if (!formData.name.trim()) return;
    try {
      const project = await projectApi.create({
        name: formData.name,
        type: formData.type,
        description: formData.description,
        readers: formData.readers,
        scale: formData.scale,
      });
      if (project) {
        setShowModal(false);
        setFormData({ name: '', type: 'standard', description: '', readers: '', scale: '' });
        navigate(`/project/${project.id}`);
      }
    } catch (error) {
      console.error('创建项目失败:', error);
      alert('创建项目失败，请重试');
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
        alert('删除项目失败，请重试');
      }
    }
  };

  if (loading) return <Loading />;

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">我的项目</h1>
        <button className="btn-primary" onClick={() => setShowModal(true)}>+ 新建项目</button>
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
            <button className="btn-primary" onClick={handleCreate} disabled={!formData.name.trim()}>创建</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ============ 项目工作台页面 ============

function ProjectWorkspace() {
  const { projectId } = useParams<{ projectId: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [chapters, setChapters] = useState<ChapterSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'outline' | 'chapters' | 'metrics'>('outline');
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

  const handleGenerateOutline = async () => {
    if (!projectId) return;
    const result = await outlineApi.generate(projectId);
    if (result) {
      setOutline(result);
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
      </div>

      {activeTab === 'outline' && (
        <div className="card">
          <div className="flex justify-between items-center mb-4">
            <h3>大纲</h3>
            <div className="flex gap-2">
              <button className="btn-primary" onClick={handleGenerateOutline} disabled={!!outline}>
                {outline ? '已生成大纲' : '生成大纲'}
              </button>
              {outline && outline.status === 'draft' && (
                <button className="btn-success" onClick={handleConfirmOutline}>确认大纲</button>
              )}
              <button className="btn-secondary" onClick={handleCreateChapter}>添加章节</button>
            </div>
          </div>

          {outline ? (
            <div className="chapter-list">
              {outline.chapters.map((ch, idx) => (
                <div key={ch.id} className="chapter-item">
                  <div className="chapter-info">
                    <div className="chapter-number">{ch.number}</div>
                    <div className="chapter-title">{ch.title}</div>
                    {ch.target && <div className="text-gray text-sm">{ch.target}</div>}
                  </div>
                  <span className={`chapter-status status-${ch.status === 'completed' ? 'completed' : ch.status === 'in_progress' ? 'in-progress' : 'todo'}`}>
                    {ch.status === 'completed' ? '已完成' : ch.status === 'in_progress' ? '进行中' : '待开始'}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <p>还没有大纲，点击"生成大纲"开始创建</p>
            </div>
          )}
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
    </div>
  );
}

// ============ 章节编辑器页面 ============

function ChapterEditor() {
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
      }
    } catch (error) {
      console.error('AI 生成失败:', error);
      alert('AI 生成失败，请重试');
    } finally {
      setAiLoading(false);
    }
  };

  const handleCreateSnapshot = async () => {
    if (!projectId || !chapterId) return;
    await snapshotApi.createChapter(projectId, chapterId);
    alert('快照创建成功');
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

// ============ 主应用组件 ============

function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<ProjectList />} />
        <Route path="/project/:projectId" element={<ProjectWorkspace />} />
        <Route path="/project/:projectId/chapter/:chapterId" element={<ChapterEditor />} />
      </Routes>
    </HashRouter>
  );
}

export default App;
