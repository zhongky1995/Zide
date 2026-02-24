import { app, BrowserWindow } from 'electron';
import * as path from 'path';
import { registerProjectHandlers } from './ipc/project';
import { registerOutlineHandlers } from './ipc/outline';
import { registerChapterHandlers } from './ipc/chapter';
import { registerContextHandlers } from './ipc/context';
import { registerAIHandlers } from './ipc/ai';
import { registerSnapshotHandlers } from './ipc/snapshot';

// 主进程入口
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
    win.loadURL('http://localhost:3000');
    win.webContents.openDevTools();
  } else {
    win.loadFile(path.join(__dirname, '../renderer/index.html'));
  }
}

app.whenReady().then(() => {
  // 注册 IPC 处理器
  registerProjectHandlers();
  registerOutlineHandlers();
  registerChapterHandlers();
  registerContextHandlers();
  registerAIHandlers();
  registerSnapshotHandlers();

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
