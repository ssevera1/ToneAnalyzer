import { app, BrowserWindow, ipcMain, dialog, session } from 'electron';
import path from 'path';

let mainWindow: BrowserWindow | null = null;

interface FileFilter {
  name: string;
  extensions: string[];
}

/**
 * Validate and sanitize file dialog filter options from the renderer.
 * Only allows expected fields to prevent the renderer from injecting
 * unexpected dialog properties.
 */
function sanitizeFilters(input: unknown, defaults: FileFilter[]): FileFilter[] {
  if (!Array.isArray(input)) return defaults;
  const sanitized: FileFilter[] = [];
  for (const item of input) {
    if (
      item &&
      typeof item === 'object' &&
      typeof (item as FileFilter).name === 'string' &&
      Array.isArray((item as FileFilter).extensions) &&
      (item as FileFilter).extensions.every((e: unknown) => typeof e === 'string')
    ) {
      sanitized.push({
        name: (item as FileFilter).name,
        extensions: (item as FileFilter).extensions,
      });
    }
  }
  return sanitized.length > 0 ? sanitized : defaults;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    backgroundColor: '#0a0a0a',
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Set Content Security Policy
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self'; " +
          "script-src 'self'; " +
          "style-src 'self' 'unsafe-inline'; " +
          "connect-src 'self' ws://127.0.0.1:9999; " +
          "media-src 'self' blob: mediastream:; " +
          "worker-src 'self' blob:; " +
          "img-src 'self' data: blob:;"
        ],
      },
    });
  });

  const isDev = process.env.NODE_ENV !== 'production' && process.env.VITE_DEV_SERVER_URL;
  if (isDev) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL!);
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (mainWindow === null) createWindow();
});

const DEFAULT_OPEN_FILTERS: FileFilter[] = [
  { name: 'Audio Files', extensions: ['wav', 'mp3', 'ogg', 'flac', 'm4a'] },
  { name: 'Video Files', extensions: ['mp4', 'webm', 'avi', 'mov'] },
  { name: 'All Files', extensions: ['*'] },
];

const DEFAULT_SAVE_FILTERS: FileFilter[] = [
  { name: 'CSV', extensions: ['csv'] },
  { name: 'PDF', extensions: ['pdf'] },
];

ipcMain.handle('dialog:openFile', async (_event, options: unknown) => {
  if (!mainWindow) return null;
  const opts = (options && typeof options === 'object') ? options as Record<string, unknown> : {};
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: sanitizeFilters(opts.filters, DEFAULT_OPEN_FILTERS),
  });
  return result.canceled ? null : result.filePaths[0];
});

ipcMain.handle('dialog:saveFile', async (_event, options: unknown) => {
  if (!mainWindow) return null;
  const opts = (options && typeof options === 'object') ? options as Record<string, unknown> : {};
  const result = await dialog.showSaveDialog(mainWindow, {
    filters: sanitizeFilters(opts.filters, DEFAULT_SAVE_FILTERS),
  });
  return result.canceled ? null : result.filePath;
});
