import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isDev = !app.isPackaged;

const DB_FILENAME = 'clinic-data.db';

function getDbPath() {
  return path.join(app.getPath('userData'), DB_FILENAME);
}

function getDocumentsDir() {
  const dir = path.join(app.getPath('userData'), 'documents');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: 'Dental Clinic Manager',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (isDev) {
    win.loadURL('http://localhost:5173');
  } else {
    win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }
}

app.whenReady().then(() => {
  ipcMain.handle('db:read', async () => {
    const p = getDbPath();
    if (!fs.existsSync(p)) return null;
    const buf = fs.readFileSync(p);
    return new Uint8Array(buf);
  });

  ipcMain.handle('db:write', async (_evt, data) => {
    const p = getDbPath();
    fs.writeFileSync(p, Buffer.from(data));
    return true;
  });

  ipcMain.handle('doc:save', async (_evt, { filename, data }) => {
    const dir = getDocumentsDir();
    const p = path.join(dir, filename);
    fs.writeFileSync(p, Buffer.from(data));
    return p;
  });

  ipcMain.handle('doc:read', async (_evt, filename) => {
    const dir = getDocumentsDir();
    const p = path.join(dir, filename);
    if (!fs.existsSync(p)) return null;
    return new Uint8Array(fs.readFileSync(p));
  });

  ipcMain.handle('doc:export', async (_evt, { filename, data }) => {
    const result = await dialog.showSaveDialog({
      defaultPath: filename,
      filters: [{ name: 'PDF', extensions: ['pdf'] }],
    });
    if (result.canceled || !result.filePath) return null;
    fs.writeFileSync(result.filePath, Buffer.from(data));
    return result.filePath;
  });

  ipcMain.handle('app:info', () => ({
    userDataPath: app.getPath('userData'),
    documentsPath: getDocumentsDir(),
    version: app.getVersion(),
  }));

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
