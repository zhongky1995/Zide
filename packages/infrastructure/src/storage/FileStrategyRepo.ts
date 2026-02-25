import { AIStrategy, BUILT_IN_STRATEGIES } from '@zide/domain';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * 文件存储的策略仓库
 * 用于持久化自定义策略配置
 */
export class FileStrategyRepo {
  private readonly configPath: string;

  constructor(runtimeBasePath: string) {
    this.configPath = path.join(runtimeBasePath, 'config', 'strategies.json');
  }

  // 加载所有策略（内置 + 自定义）
  async load(): Promise<AIStrategy[]> {
    try {
      const data = await fs.readFile(this.configPath, 'utf-8');
      const customStrategies = JSON.parse(data) as AIStrategy[];
      // 合并内置策略和自定义策略
      return [...BUILT_IN_STRATEGIES, ...customStrategies];
    } catch {
      // 文件不存在，返回内置策略
      return BUILT_IN_STRATEGIES;
    }
  }

  // 保存所有自定义策略
  async save(customStrategies: AIStrategy[]): Promise<void> {
    const dir = path.dirname(this.configPath);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(this.configPath, JSON.stringify(customStrategies, null, 2), 'utf-8');
  }

  // 添加自定义策略
  async add(strategy: AIStrategy): Promise<void> {
    const strategies = await this.load();
    const customStrategies = strategies.filter(
      s => !BUILT_IN_STRATEGIES.find(bs => bs.id === s.id)
    );

    // 检查是否已存在
    const existing = customStrategies.find(s => s.id === strategy.id);
    if (existing) {
      // 更新
      const index = customStrategies.indexOf(existing);
      customStrategies[index] = strategy;
    } else {
      // 添加
      customStrategies.push(strategy);
    }

    await this.save(customStrategies);
  }

  // 删除自定义策略
  async delete(strategyId: string): Promise<boolean> {
    // 不能删除内置策略
    if (BUILT_IN_STRATEGIES.find(s => s.id === strategyId)) {
      return false;
    }

    const strategies = await this.load();
    const customStrategies = strategies.filter(
      s => !BUILT_IN_STRATEGIES.find(bs => bs.id === s.id)
    );

    const filtered = customStrategies.filter(s => s.id !== strategyId);
    if (filtered.length === customStrategies.length) {
      return false; // 未找到
    }

    await this.save(filtered);
    return true;
  }

  // 获取激活策略ID
  async getActiveStrategyId(): Promise<string> {
    try {
      const data = await fs.readFile(this.configPath.replace('strategies.json', 'settings.json'), 'utf-8');
      const settings = JSON.parse(data);
      return settings.activeStrategy || 'default-continue';
    } catch {
      return 'default-continue';
    }
  }

  // 保存激活策略ID
  async setActiveStrategyId(strategyId: string): Promise<void> {
    const configPath = path.join(path.dirname(this.configPath), 'settings.json');
    let settings: Record<string, any> = {};

    try {
      const data = await fs.readFile(configPath, 'utf-8');
      settings = JSON.parse(data);
    } catch {
      // 忽略
    }

    settings.activeStrategy = strategyId;

    const dir = path.dirname(configPath);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(configPath, JSON.stringify(settings, null, 2), 'utf-8');
  }
}
