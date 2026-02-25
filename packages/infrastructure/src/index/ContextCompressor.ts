import { ChapterSummary } from '@zide/domain';

// 压缩配置
export interface CompressionConfig {
  maxProjectContextChars: number;  // 项目背景最大字符
  maxRelatedChapters: number;      // 相关章节最大数量
  maxGlossaryChars: number;        // 术语表最大字符
  maxChapterChars: number;         // 单章节最大字符
  compressionStrategy: 'slice' | 'summary' | 'core';
  tokenBudget: number;             // token 预算（用于自动选择压缩级别）
}

// 压缩上下文输入
export interface CompressionInput {
  projectContext: string;
  relatedChapters: {
    id: string;
    chapterId: string;
    chapterTitle: string;
    content: string;
    summary?: ChapterSummary;
    wordCount?: number;
  }[];
  glossary: string;
  outline: string;
}

// 压缩结果
export interface CompressionResult {
  projectContext: string;
  relatedChapters: {
    id: string;
    chapterId: string;
    chapterTitle: string;
    content: string;
    originalWordCount: number;
    compressedWordCount: number;
    compressionRatio: number;
  }[];
  glossary: string;
  outline: string;
  strategy: 'slice' | 'summary' | 'core';
  totalChars: number;
  estimatedTokens: number;
  compressionRatio: number;  // 平均压缩比
}

// 记忆压缩器
export class ContextCompressor {
  private config: CompressionConfig = {
    maxProjectContextChars: 3000,
    maxRelatedChapters: 5,
    maxGlossaryChars: 2000,
    maxChapterChars: 4000,
    compressionStrategy: 'slice',
    tokenBudget: 8000,
  };

  // 估算 token 数量（中文约 1 token = 1.5 字符，英文约 1 token = 4 字符）
  private readonly CHARS_PER_TOKEN = 2;

  constructor(config?: Partial<CompressionConfig>) {
    if (config) {
      this.config = { ...this.config, ...config };
    }
  }

  // 设置配置
  setConfig(config: Partial<CompressionConfig>): void {
    this.config = { ...this.config, ...config };
  }

  // 获取当前配置
  getConfig(): CompressionConfig {
    return { ...this.config };
  }

  // 根据 token 预算自动选择压缩策略
  compressForTokenBudget(input: CompressionInput): CompressionResult {
    // 计算当前 token 数量
    const estimatedTokens = this.estimateTokens(input);
    const budget = this.config.tokenBudget;

    // 如果在预算内，直接返回原始内容
    if (estimatedTokens <= budget) {
      return {
        projectContext: this.compressProjectContext(input.projectContext),
        relatedChapters: input.relatedChapters.slice(0, this.config.maxRelatedChapters).map(ch => ({
          ...ch,
          originalWordCount: ch.wordCount || ch.content.length,
          compressedWordCount: ch.content.length,
          compressionRatio: 1,
        })),
        glossary: this.compressGlossary(input.glossary),
        outline: this.compressOutline(input.outline),
        strategy: 'slice',
        totalChars: this.calculateTotalChars(input),
        estimatedTokens,
        compressionRatio: 1,
      };
    }

    // 尝试不同策略
    let result: CompressionResult;

    // Tier 1: 智能切片
    result = this.compressWithSlice(input);
    if (this.estimateTokensFromResult(result) <= budget) {
      return result;
    }

    // Tier 2: 摘要压缩
    result = this.compressWithSummary(input);
    if (this.estimateTokensFromResult(result) <= budget) {
      return result;
    }

    // Tier 3: 核心提取
    return this.compressWithCore(input);
  }

  // Tier 1: 智能切片压缩
  compressWithSlice(input: CompressionInput): CompressionResult {
    const compressedChapters = input.relatedChapters
      .slice(0, this.config.maxRelatedChapters)
      .map(ch => {
        const compressed = this.sliceContent(ch.content, this.config.maxChapterChars);
        return {
          ...ch,
          content: compressed,
          originalWordCount: ch.wordCount || ch.content.length,
          compressedWordCount: compressed.length,
          compressionRatio: compressed.length / (ch.content.length || 1),
        };
      });

    const projectContext = this.compressProjectContext(input.projectContext);
    const glossary = this.compressGlossary(input.glossary);
    const outline = this.compressOutline(input.outline);
    const totalChars = projectContext.length + compressedChapters.reduce((sum, ch) => sum + ch.content.length, 0) + glossary.length + outline.length;
    const estimatedTokens = Math.ceil(totalChars / this.CHARS_PER_TOKEN);
    const originalChars = input.projectContext.length + input.relatedChapters.slice(0, this.config.maxRelatedChapters).reduce((sum, ch) => sum + ch.content.length, 0) + input.glossary.length + input.outline.length;
    const compressionRatio = originalChars > 0 ? totalChars / originalChars : 1;

    return {
      projectContext,
      relatedChapters: compressedChapters,
      glossary,
      outline,
      strategy: 'slice',
      totalChars,
      estimatedTokens,
      compressionRatio,
    };
  }

  // Tier 2: 摘要压缩
  compressWithSummary(input: CompressionInput): CompressionResult {
    const compressedChapters = input.relatedChapters
      .slice(0, this.config.maxRelatedChapters)
      .map(ch => {
        // 如果有摘要，使用摘要
        if (ch.summary && (ch.summary.mainPoint || ch.summary.keyPoints)) {
          const summaryText = this.buildSummaryText(ch.summary);
          return {
            ...ch,
            content: summaryText,
            originalWordCount: ch.wordCount || ch.content.length,
            compressedWordCount: summaryText.length,
            compressionRatio: summaryText.length / (ch.content.length || 1),
          };
        }

        // 否则生成简单摘要
        const summary = this.generateSimpleSummary(ch.content);
        return {
          ...ch,
          content: summary,
          originalWordCount: ch.wordCount || ch.content.length,
          compressedWordCount: summary.length,
          compressionRatio: summary.length / (ch.content.length || 1),
        };
      });

    const projectContext = this.compressProjectContext(input.projectContext);
    const glossary = this.compressGlossary(input.glossary);
    const outline = this.compressOutline(input.outline);
    const totalChars = projectContext.length + compressedChapters.reduce((sum, ch) => sum + ch.content.length, 0) + glossary.length + outline.length;
    const estimatedTokens = Math.ceil(totalChars / this.CHARS_PER_TOKEN);
    const originalChars = input.projectContext.length + input.relatedChapters.slice(0, this.config.maxRelatedChapters).reduce((sum, ch) => sum + ch.content.length, 0) + input.glossary.length + input.outline.length;
    const compressionRatio = originalChars > 0 ? totalChars / originalChars : 1;

    return {
      projectContext,
      relatedChapters: compressedChapters,
      glossary,
      outline,
      strategy: 'summary',
      totalChars,
      estimatedTokens,
      compressionRatio,
    };
  }

  // Tier 3: 核心提取
  compressWithCore(input: CompressionInput): CompressionResult {
    const compressedChapters = input.relatedChapters
      .slice(0, Math.min(3, this.config.maxRelatedChapters)) // 进一步减少章节数
      .map(ch => {
        // 优先使用摘要中的核心论点
        if (ch.summary && ch.summary.mainPoint) {
          const coreText = ch.summary.mainPoint;
          return {
            ...ch,
            content: coreText,
            originalWordCount: ch.wordCount || ch.content.length,
            compressedWordCount: coreText.length,
            compressionRatio: coreText.length / (ch.content.length || 1),
          };
        }

        // 否则提取核心内容
        const core = this.extractCoreContent(ch.content);
        return {
          ...ch,
          content: core,
          originalWordCount: ch.wordCount || ch.content.length,
          compressedWordCount: core.length,
          compressionRatio: core.length / (ch.content.length || 1),
        };
      });

    const projectContext = this.compressProjectContext(input.projectContext);
    const glossary = this.compressGlossary(input.glossary);
    const outline = this.compressOutline(input.outline);
    const totalChars = projectContext.length + compressedChapters.reduce((sum, ch) => sum + ch.content.length, 0) + glossary.length + outline.length;
    const estimatedTokens = Math.ceil(totalChars / this.CHARS_PER_TOKEN);
    const originalChars = input.projectContext.length + input.relatedChapters.slice(0, this.config.maxRelatedChapters).reduce((sum, ch) => sum + ch.content.length, 0) + input.glossary.length + input.outline.length;
    const compressionRatio = originalChars > 0 ? totalChars / originalChars : 1;

    return {
      projectContext,
      relatedChapters: compressedChapters,
      glossary,
      outline,
      strategy: 'core',
      totalChars,
      estimatedTokens,
      compressionRatio,
    };
  }

  // 压缩项目背景
  compressProjectContext(context: string): string {
    if (!context) return '';
    if (context.length <= this.config.maxProjectContextChars) {
      return context;
    }

    // 提取关键段落（标题、目标、背景、限制）
    const lines = context.split('\n');
    const keySections = lines.filter(line =>
      line.startsWith('##') ||
      line.startsWith('# ') ||
      line.includes('目标') ||
      line.includes('背景') ||
      line.includes('限制') ||
      line.includes('读者')
    );

    if (keySections.length > 0) {
      return keySections.join('\n').slice(0, this.config.maxProjectContextChars);
    }

    // 如果没有关键段落，直接截断
    return context.slice(0, this.config.maxProjectContextChars);
  }

  // 压缩术语表
  compressGlossary(glossary: string): string {
    if (!glossary) return '';
    if (glossary.length <= this.config.maxGlossaryChars) {
      return glossary;
    }

    // 提取术语定义对
    const lines = glossary.split('\n');
    const termLines = lines.filter(line => line.includes(':') || line.includes('：'));

    if (termLines.length > 0) {
      return termLines.join('\n').slice(0, this.config.maxGlossaryChars);
    }

    return glossary.slice(0, this.config.maxGlossaryChars);
  }

  // 压缩大纲
  compressOutline(outline: string): string {
    if (!outline) return '';
    // 大纲通常较短，保留完整内容
    // TODO: 如果大纲过长，可以截取前 N 个章节
    return outline;
  }

  // 切片内容
  private sliceContent(content: string, maxChars: number): string {
    if (content.length <= maxChars) {
      return content;
    }

    // 按段落分割，优先保留完整段落
    const paragraphs = content.split(/\n\n+/);
    const result: string[] = [];
    let currentLength = 0;

    for (const para of paragraphs) {
      if (currentLength + para.length <= maxChars) {
        result.push(para);
        currentLength += para.length;
      } else if (para.length <= maxChars * 0.3) {
        // 小段落可以跳过
        continue;
      } else {
        break;
      }
    }

    const sliced = result.join('\n\n');
    return sliced || content.slice(0, maxChars);
  }

  // 生成简单摘要
  private generateSimpleSummary(content: string): string {
    const paragraphs = content.split(/\n\n+/);

    // 提取每段首句作为摘要
    const firstSentences = paragraphs
      .slice(0, 3) // 最多取3段
      .map(para => {
        const sentences = para.split(/[。！？\n]/);
        return sentences[0]?.trim();
      })
      .filter(Boolean);

    return firstSentences.join('。') + '。';
  }

  // 构建摘要文本
  private buildSummaryText(summary: ChapterSummary): string {
    const parts: string[] = [];

    if (summary.mainPoint) {
      parts.push(`核心观点：${summary.mainPoint}`);
    }

    if (summary.keyPoints && summary.keyPoints.length > 0) {
      parts.push(`关键要点：${summary.keyPoints.join('、')}`);
    }

    if (summary.conclusion) {
      parts.push(`小结：${summary.conclusion}`);
    }

    return parts.join('\n');
  }

  // 提取核心内容
  private extractCoreContent(content: string): string {
    const paragraphs = content.split(/\n\n+/);

    // 提取包含关键信息的段落（开头、包含论点的段落）
    const coreParagraphs: string[] = [];

    // 始终保留第一段
    if (paragraphs[0]) {
      coreParagraphs.push(paragraphs[0]);
    }

    // 提取包含关键词的段落
    const keyTerms = ['因此', '所以', '证明', '结论', '关键', '重要', '核心'];
    for (const para of paragraphs.slice(1)) {
      if (keyTerms.some(term => para.includes(term))) {
        coreParagraphs.push(para);
        if (coreParagraphs.length >= 3) break;
      }
    }

    return coreParagraphs.join('\n\n');
  }

  // 估算 token 数量
  private estimateTokens(input: CompressionInput): number {
    const totalChars = this.calculateTotalChars(input);
    return Math.ceil(totalChars / this.CHARS_PER_TOKEN);
  }

  // 从结果估算 token
  private estimateTokensFromResult(result: CompressionResult): number {
    return Math.ceil(result.totalChars / this.CHARS_PER_TOKEN);
  }

  // 计算总字符数
  private calculateTotalChars(input: CompressionInput): number {
    let total = input.projectContext.length + input.glossary.length + input.outline.length;
    for (const ch of input.relatedChapters.slice(0, this.config.maxRelatedChapters)) {
      total += ch.content.length;
    }
    return total;
  }

  // 从结果计算总字符数
  private calculateTotalCharsFromResult(result: CompressionResult): number {
    let total = result.projectContext.length + result.glossary.length + result.outline.length;
    for (const ch of result.relatedChapters) {
      total += ch.content.length;
    }
    return total;
  }
}
