import { ExportPort } from '@zide/application';
import { ExportFormat, ExportStatus, ExportConfig, ExportResult } from '@zide/domain';
import * as fs from 'fs/promises';
import * as path from 'path';

export class FileExportAdapter implements ExportPort {
  constructor(private readonly runtimeBasePath: string) {}

  async export(
    projectId: string,
    format: ExportFormat,
    config?: Partial<ExportConfig>
  ): Promise<ExportResult> {
    const outputDir = path.join(this.runtimeBasePath, projectId, 'output');
    await fs.mkdir(outputDir, { recursive: true });

    const configObj: ExportConfig = {
      format,
      includeToc: true,
      includeGlossary: false,
      includeMetadata: false,
      ...config,
    };

    // 收集所有章节
    const chapters = await this.collectChapters(projectId);

    // 生成内容
    let content = '';

    if (format === ExportFormat.MARKDOWN) {
      content = await this.generateMarkdown(projectId, chapters, configObj);
    } else if (format === ExportFormat.HTML) {
      content = await this.generateHtml(projectId, chapters, configObj);
    } else if (format === ExportFormat.PDF) {
      // PDF 生成需要特殊处理，这里生成 HTML 后由系统打印
      content = await this.generateHtml(projectId, chapters, configObj);
    }

    // 写入文件
    const fileName = `final.${format}`;
    const filePath = path.join(outputDir, fileName);
    await fs.writeFile(filePath, content, 'utf-8');

    // 统计
    const wordCount = chapters.reduce((sum, ch) => sum + ch.wordCount, 0);

    return {
      jobId: `export-${Date.now()}`,
      format,
      filePath,
      fileSize: content.length,
      chapterCount: chapters.length,
      wordCount,
      createdAt: new Date().toISOString(),
    };
  }

  async exportChapters(
    projectId: string,
    chapterIds: string[],
    format: ExportFormat,
    config?: Partial<ExportConfig>
  ): Promise<ExportResult> {
    const outputDir = path.join(this.runtimeBasePath, projectId, 'output');
    await fs.mkdir(outputDir, { recursive: true });

    const configObj: ExportConfig = {
      format,
      includeToc: true,
      ...config,
    };

    const chapters = await this.collectChapters(projectId);
    const filteredChapters = chapters.filter(ch => chapterIds.includes(ch.id));

    let content = '';

    if (format === ExportFormat.MARKDOWN) {
      content = await this.generateMarkdown(projectId, filteredChapters, configObj);
    } else {
      content = await this.generateHtml(projectId, filteredChapters, configObj);
    }

    const fileName = `partial.${format}`;
    const filePath = path.join(outputDir, fileName);
    await fs.writeFile(filePath, content, 'utf-8');

    const wordCount = filteredChapters.reduce((sum, ch) => sum + ch.wordCount, 0);

    return {
      jobId: `export-${Date.now()}`,
      format,
      filePath,
      fileSize: content.length,
      chapterCount: filteredChapters.length,
      wordCount,
      createdAt: new Date().toISOString(),
    };
  }

  async preview(projectId: string, format: ExportFormat): Promise<string> {
    const chapters = await this.collectChapters(projectId);
    const config: ExportConfig = { format };

    if (format === ExportFormat.MARKDOWN) {
      return this.generateMarkdown(projectId, chapters, config);
    } else {
      return this.generateHtml(projectId, chapters, config);
    }
  }

  async getExportHistory(projectId: string): Promise<{ recent: ExportResult[]; total: number }> {
    const outputDir = path.join(this.runtimeBasePath, projectId, 'output');

    try {
      const files = await fs.readdir(outputDir);
      const exportFiles = files.filter(f => f.startsWith('final.'));

      const recent: ExportResult[] = [];

      for (const file of exportFiles) {
        const filePath = path.join(outputDir, file);
        const stats = await fs.stat(filePath);

        const format = file.endsWith('.md') ? ExportFormat.MARKDOWN :
                       file.endsWith('.html') ? ExportFormat.HTML : ExportFormat.PDF;

        recent.push({
          jobId: file,
          format,
          filePath,
          fileSize: stats.size,
          chapterCount: 0,
          wordCount: 0,
          createdAt: stats.mtime.toISOString(),
        });
      }

      return { recent: recent.slice(0, 10), total: recent.length };
    } catch {
      return { recent: [], total: 0 };
    }
  }

  async deleteExport(filePath: string): Promise<void> {
    await fs.unlink(filePath).catch(() => {});
  }

  async openExportDir(): Promise<void> {
    // 简化实现
  }

  private async collectChapters(projectId: string): Promise<{
    id: string;
    number: string;
    title: string;
    content: string;
    wordCount: number;
  }[]> {
    const chaptersDir = path.join(this.runtimeBasePath, projectId, 'chapters');

    try {
      const files = await fs.readdir(chaptersDir);
      const chapters: {
        id: string;
        number: string;
        title: string;
        content: string;
        wordCount: number;
      }[] = [];

      for (const file of files) {
        if (!file.endsWith('.md')) continue;

        const chapterPath = path.join(chaptersDir, file);
        const content = await fs.readFile(chapterPath, 'utf-8');

        const { title, body, number } = this.parseChapter(content, file.replace('.md', ''));

        chapters.push({
          id: file.replace('.md', ''),
          number,
          title,
          content: body,
          wordCount: this.countWords(body),
        });
      }

      return chapters.sort((a, b) => {
        const numA = parseInt(a.number) || 0;
        const numB = parseInt(b.number) || 0;
        return numA - numB;
      });
    } catch {
      return [];
    }
  }

  private parseChapter(content: string, fallbackId: string): {
    title: string;
    body: string;
    number: string;
  } {
    const lines = content.split('\n');
    let title = fallbackId;
    let number = fallbackId;
    let bodyStart = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (line.startsWith('# ')) {
        title = line.replace('# ', '');
      } else if (line.startsWith('number: ')) {
        number = line.replace('number: ', '').trim();
      } else if (line.trim() === '---') {
        bodyStart = i + 1;
        break;
      }
    }

    return {
      title,
      number,
      body: lines.slice(bodyStart).join('\n').trim(),
    };
  }

  private async generateMarkdown(
    projectId: string,
    chapters: { id: string; number: string; title: string; content: string }[],
    config: ExportConfig
  ): Promise<string> {
    const lines: string[] = [];

    // 读取项目信息
    let projectTitle = projectId;
    try {
      const metaPath = path.join(this.runtimeBasePath, projectId, 'meta', 'project.md');
      const metaContent = await fs.readFile(metaPath, 'utf-8');
      const match = metaContent.match(/^#\s+(.+)$/m);
      if (match) projectTitle = match[1];
    } catch {}

    lines.push(`# ${projectTitle}\n`);
    lines.push('');

    // 目录
    if (config.includeToc) {
      lines.push('## 目录\n');
      chapters.forEach((ch, i) => {
        lines.push(`${i + 1}. [${ch.title}](#${ch.number})`);
      });
      lines.push('');
    }

    // 章节
    chapters.forEach(ch => {
      lines.push(`## ${ch.number} ${ch.title}\n`);
      lines.push('');
      lines.push(ch.content);
      lines.push('');
    });

    return lines.join('\n');
  }

  private async generateHtml(
    projectId: string,
    chapters: { id: string; number: string; title: string; content: string }[],
    config: ExportConfig
  ): Promise<string> {
    const lines: string[] = [];

    // 读取项目信息
    let projectTitle = projectId;
    try {
      const metaPath = path.join(this.runtimeBasePath, projectId, 'meta', 'project.md');
      const metaContent = await fs.readFile(metaPath, 'utf-8');
      const match = metaContent.match(/^#\s+(.+)$/m);
      if (match) projectTitle = match[1];
    } catch {}

    lines.push('<!DOCTYPE html>');
    lines.push('<html><head>');
    lines.push('<meta charset="UTF-8">');
    lines.push(`<title>${projectTitle}</title>`);
    lines.push('<style>');
    lines.push('body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; max-width: 800px; margin: 0 auto; padding: 40px 20px; line-height: 1.8; }');
    lines.push('h1 { border-bottom: 2px solid #333; padding-bottom: 10px; }');
    lines.push('h2 { margin-top: 40px; color: #333; }');
    lines.push('ul { padding-left: 20px; }');
    lines.push('li { margin: 8px 0; }');
    lines.push('</style>');
    lines.push('</head><body>');

    lines.push(`<h1>${projectTitle}</h1>`);

    // 目录
    if (config.includeToc) {
      lines.push('<h2>目录</h2>');
      lines.push('<ul>');
      chapters.forEach((ch, i) => {
        lines.push(`<li><a href="#ch-${ch.number}">${ch.number} ${ch.title}</a></li>`);
      });
      lines.push('</ul>');
    }

    // 章节
    chapters.forEach(ch => {
      lines.push(`<h2 id="ch-${ch.number}">${ch.number} ${ch.title}</h2>`);
      // 简单转换：换行转为 <br>
      const htmlContent = ch.content
        .replace(/\n\n/g, '</p><p>')
        .replace(/\n/g, '<br>');
      lines.push(`<p>${htmlContent}</p>`);
    });

    lines.push('</body></html>');

    return lines.join('\n');
  }

  private countWords(text: string): number {
    if (!text) return 0;
    const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
    const englishWords = text.replace(/[\u4e00-\u9fa5]/g, '').split(/\s+/).filter(w => w.length > 0).length;
    return chineseChars + englishWords;
  }
}
