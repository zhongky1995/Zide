import { SimpleIndexAdapter, FileChapterRepo, FileProjectRepo, FileOutlineRepo, FileSnapshotRepo, PromptLoader } from '@zide/infrastructure';
import { getRuntimeBasePath } from './runtimePaths';

/**
 * 服务容器 - 管理所有基础设施层单例
 * 避免每次IPC调用时重复创建实例
 */
class ServiceContainer {
  private static instance: ServiceContainer;

  private _runtimeBasePath: string | null = null;
  private _projectRepo: FileProjectRepo | null = null;
  private _outlineRepo: FileOutlineRepo | null = null;
  private _chapterRepo: FileChapterRepo | null = null;
  private _snapshotRepo: FileSnapshotRepo | null = null;
  private _indexAdapter: SimpleIndexAdapter | null = null;
  private _promptLoader: PromptLoader | null = null;

  private constructor() {}

  static getInstance(): ServiceContainer {
    if (!ServiceContainer.instance) {
      ServiceContainer.instance = new ServiceContainer();
    }
    return ServiceContainer.instance;
  }

  // 获取运行时基础路径
  get runtimeBasePath(): string {
    if (!this._runtimeBasePath) {
      this._runtimeBasePath = getRuntimeBasePath();
    }
    return this._runtimeBasePath;
  }

  // 项目仓库单例
  get projectRepo(): FileProjectRepo {
    if (!this._projectRepo) {
      this._projectRepo = new FileProjectRepo(this.runtimeBasePath);
    }
    return this._projectRepo;
  }

  // 大纲仓库单例
  get outlineRepo(): FileOutlineRepo {
    if (!this._outlineRepo) {
      this._outlineRepo = new FileOutlineRepo(this.runtimeBasePath);
    }
    return this._outlineRepo;
  }

  // 章节仓库单例
  get chapterRepo(): FileChapterRepo {
    if (!this._chapterRepo) {
      this._chapterRepo = new FileChapterRepo(this.runtimeBasePath);
    }
    return this._chapterRepo;
  }

  // 快照仓库单例
  get snapshotRepo(): FileSnapshotRepo {
    if (!this._snapshotRepo) {
      this._snapshotRepo = new FileSnapshotRepo(this.runtimeBasePath);
    }
    return this._snapshotRepo;
  }

  // 索引适配器单例
  get indexAdapter(): SimpleIndexAdapter {
    if (!this._indexAdapter) {
      this._indexAdapter = new SimpleIndexAdapter(this.runtimeBasePath, {
        maxProjectContextChars: 5000,
        maxRelatedChapters: 5,
        compressionStrategy: 'slice',
        tokenBudget: 8000,
      });
    }
    return this._indexAdapter;
  }

  // Prompt加载器单例
  get promptLoader(): PromptLoader {
    if (!this._promptLoader) {
      this._promptLoader = new PromptLoader();
    }
    return this._promptLoader;
  }

  // 重置所有单例（用于测试）
  reset(): void {
    this._projectRepo = null;
    this._outlineRepo = null;
    this._chapterRepo = null;
    this._snapshotRepo = null;
    this._indexAdapter = null;
    this._promptLoader = null;
    this._runtimeBasePath = null;
  }
}

// 导出单例
export const serviceContainer = ServiceContainer.getInstance();
