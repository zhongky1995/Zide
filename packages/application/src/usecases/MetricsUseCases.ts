import {
  ProjectMetrics,
  OperationType,
} from '@zide/domain';
import * as fs from 'fs/promises';
import * as path from 'path';

// 统计用例
export class MetricsUseCases {
  constructor(private readonly runtimeBasePath: string) {}

  // 获取项目统计
  async getProjectMetrics(projectId: string): Promise<ProjectMetrics> {
    const projectDir = path.join(this.runtimeBasePath, projectId);

    const [
      chapters,
      snapshots,
      operations,
    ] = await Promise.all([
      this.getChapterStats(projectDir),
      this.getSnapshotStats(projectDir),
      this.getOperationStats(projectDir),
    ]);

    const totalWords = chapters.reduce((sum, ch) => sum + ch.wordCount, 0);
    const completedChapters = chapters.filter(ch => ch.completion >= 100).length;

    // 计算 AI 操作采纳率
    const aiOps = operations.filter(op => op.operationType.startsWith('ai_'));
    const adoptedOps = aiOps.filter(op => (op.metadata as any)?.adopted === true);

    return {
      projectId,
      projectName: projectId,
      totalProjects: 1,
      totalChapters: chapters.length,
      completedChapters,
      totalWords,
      aiOperations: aiOps.length,
      adoptedOperations: adoptedOps.length,
      snapshotsCreated: snapshots.length,
      rollbacksPerformed: operations.filter(op => op.operationType === 'snapshot_rollback').length,
      exportsCompleted: operations.filter(op => op.operationType === 'export_run' && op.status === 'success').length,
      checksRun: operations.filter(op => op.operationType === 'check_run').length,
      averageGenerationTime: this.calculateAverageGenerationTime(aiOps),
      createdAt: new Date().toISOString(),
      lastActivityAt: new Date().toISOString(),
    };
  }

  // 获取全局统计
  async getGlobalMetrics(): Promise<ProjectMetrics[]> {
    const projects: ProjectMetrics[] = [];

    try {
      const entries = await fs.readdir(this.runtimeBasePath, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.isDirectory()) {
          try {
            const metrics = await this.getProjectMetrics(entry.name);
            projects.push(metrics);
          } catch {
            // 忽略无效项目
          }
        }
      }
    } catch {
      // 目录不存在
    }

    return projects;
  }

  // 记录操作日志
  async logOperation(
    projectId: string,
    operationType: OperationType,
    status: 'success' | 'failed' | 'pending',
    duration: number,
    metadata?: Record<string, unknown>,
    chapterId?: string,
    errorCode?: string,
    errorMessage?: string
  ): Promise<void> {
    const logsDir = path.join(this.runtimeBasePath, '.logs');
    await fs.mkdir(logsDir, { recursive: true });

    const logFile = path.join(logsDir, `${new Date().toISOString().slice(0, 10)}.jsonl`);

    const log = {
      id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      projectId,
      chapterId,
      operationType,
      status,
      duration,
      errorCode,
      errorMessage,
      metadata,
      createdAt: new Date().toISOString(),
    };

    await fs.appendFile(logFile, JSON.stringify(log) + '\n');
  }

  private async getChapterStats(projectDir: string): Promise<{ wordCount: number; completion: number }[]> {
    const chaptersDir = path.join(projectDir, 'chapters');

    try {
      const files = await fs.readdir(chaptersDir);
      const chapters: { wordCount: number; completion: number }[] = [];

      for (const file of files) {
        if (!file.endsWith('.md')) continue;

        const content = await fs.readFile(path.join(chaptersDir, file), 'utf-8');

        // 提取字数
        const wordMatch = content.match(/wordCount:\s*(\d+)/);
        const wordCount = wordMatch ? parseInt(wordMatch[1]) : 0;

        // 提取完成度
        const completionMatch = content.match(/completion:\s*(\d+)/);
        const completion = completionMatch ? parseInt(completionMatch[1]) : 0;

        chapters.push({ wordCount, completion });
      }

      return chapters;
    } catch {
      return [];
    }
  }

  private async getSnapshotStats(projectDir: string): Promise<{ createdAt: string }[]> {
    const snapshotsDir = path.join(projectDir, 'snapshots', 'chapter');

    try {
      const files = await fs.readdir(snapshotsDir);
      return files
        .filter(f => f.endsWith('.json'))
        .map(f => ({ createdAt: f.replace('.json', '') }));
    } catch {
      return [];
    }
  }

  private async getOperationStats(projectDir: string): Promise<any[]> {
    const logsDir = path.join(this.runtimeBasePath, '.logs');

    try {
      const files = await fs.readdir(logsDir);
      const operations: any[] = [];

      for (const file of files) {
        if (!file.endsWith('.jsonl')) continue;

        const content = await fs.readFile(path.join(logsDir, file), 'utf-8');
        const lines = content.split('\n').filter(Boolean);

        for (const line of lines) {
          try {
            const log = JSON.parse(line);
            if (log.projectId === path.basename(projectDir)) {
              operations.push(log);
            }
          } catch {
            // 忽略无效行
          }
        }
      }

      return operations;
    } catch {
      return [];
    }
  }

  private calculateAverageGenerationTime(operations: any[]): number {
    const genOps = operations.filter(op => op.operationType === 'ai_generate');
    if (genOps.length === 0) return 0;

    const totalTime = genOps.reduce((sum, op) => sum + (op.duration || 0), 0);
    return Math.round(totalTime / genOps.length);
  }
}
