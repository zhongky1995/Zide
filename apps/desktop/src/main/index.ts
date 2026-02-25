import { app, BrowserWindow } from 'electron';
import * as path from 'path';
import { registerProjectHandlers } from './ipc/project';
import { registerOutlineHandlers } from './ipc/outline';
import { registerChapterHandlers } from './ipc/chapter';
import { registerContextHandlers } from './ipc/context';
import { registerAIHandlers, initializeAIHandlers } from './ipc/ai';
import { registerSnapshotHandlers } from './ipc/snapshot';
import { registerCheckHandlers } from './ipc/check';
import { registerExportHandlers } from './ipc/export';
import { registerMetricsHandlers } from './ipc/metrics';
import { logMainError } from './logger';

// 开发环境 Vite 端口（默认3000，可能变化）
const VITE_DEV_PORT = process.env.VITE_DEV_PORT || '3006';

process.on('uncaughtException', (error) => {
  void logMainError('Main process uncaughtException', error, { scope: 'main-process' });
});

process.on('unhandledRejection', (reason) => {
  void logMainError('Main process unhandledRejection', reason, { scope: 'main-process' });
});

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // 开发环境加载 Vite dev server
  if (process.env.NODE_ENV === 'development') {
    win.loadURL(`http://localhost:${VITE_DEV_PORT}`);
    win.webContents.openDevTools();
  } else {
    win.loadFile(path.join(__dirname, '../renderer/index.html'));
  }
}

app.whenReady().then(async () => {
  // 初始化 AI 处理器（加载保存的配置）
  await initializeAIHandlers();

  // 注册 IPC 处理器
  registerProjectHandlers();
  registerOutlineHandlers();
  registerChapterHandlers();
  registerContextHandlers();
  registerAIHandlers();
  registerSnapshotHandlers();
  registerCheckHandlers();
  registerExportHandlers();
  registerMetricsHandlers();

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
