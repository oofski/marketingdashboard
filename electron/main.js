import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import electronUpdater from 'electron-updater';

const { autoUpdater } = electronUpdater;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isDev = !app.isPackaged;

const DB_FILENAME = 'onboarding-data.db';

function getConfigPath() {
  return path.join(app.getPath('userData'), 'config.json');
}

function readConfig() {
  try {
    return JSON.parse(fs.readFileSync(getConfigPath(), 'utf8'));
  } catch {
    return {};
  }
}

function writeConfig(cfg) {
  fs.writeFileSync(getConfigPath(), JSON.stringify(cfg, null, 2));
}

function getDefaultDbPath() {
  return path.join(app.getPath('userData'), DB_FILENAME);
}

// The database location can be pointed at a shared network folder so every
// staff computer reads/writes the same file.
function getDbPath() {
  const cfg = readConfig();
  return cfg.dbPath || getDefaultDbPath();
}

function dbInfo() {
  const cfg = readConfig();
  const dbPath = getDbPath();
  return {
    dbPath,
    folder: path.dirname(dbPath),
    isCustom: !!cfg.dbPath,
    default: getDefaultDbPath(),
    exists: fs.existsSync(dbPath),
  };
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: 'Onboarding Tracker',
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
  return win;
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
    const dir = path.dirname(p);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    // Write to a temp file then rename, so a half-written file on a network
    // share can never corrupt the live database.
    const tmp = p + '.tmp';
    fs.writeFileSync(tmp, Buffer.from(data));
    fs.renameSync(tmp, p);
    return true;
  });

  ipcMain.handle('db:stat', async () => {
    const p = getDbPath();
    if (!fs.existsSync(p)) return null;
    const s = fs.statSync(p);
    return { mtimeMs: s.mtimeMs, size: s.size };
  });

  ipcMain.handle('db:info', async () => dbInfo());

  ipcMain.handle('db:chooseFolder', async () => {
    const result = await dialog.showOpenDialog({
      title: 'Choose shared data folder',
      properties: ['openDirectory', 'createDirectory'],
    });
    if (result.canceled || !result.filePaths?.[0]) return { canceled: true, info: dbInfo() };
    const folder = result.filePaths[0];
    const target = path.join(folder, DB_FILENAME);
    // If the chosen folder has no database yet, seed it with the current one so
    // existing data carries over to the shared location.
    if (!fs.existsSync(target)) {
      const current = getDbPath();
      if (fs.existsSync(current)) {
        fs.copyFileSync(current, target);
      }
    }
    const cfg = readConfig();
    cfg.dbPath = target;
    writeConfig(cfg);
    return { canceled: false, info: dbInfo() };
  });

  ipcMain.handle('db:useDefault', async () => {
    const cfg = readConfig();
    delete cfg.dbPath;
    writeConfig(cfg);
    return dbInfo();
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
    version: app.getVersion(),
  }));

  // --- Auto-update status, surfaced to the UI -----------------------------
  // The renderer pulls the current status on mount (update:get) and then
  // listens for live pushes (update:status) as the download progresses.
  let mainWindow = null;
  let updateStatus = { state: app.isPackaged ? 'idle' : 'dev', version: app.getVersion() };

  function setUpdateStatus(next) {
    updateStatus = { version: app.getVersion(), ...next };
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('update:status', updateStatus);
    }
  }

  ipcMain.handle('update:get', () => updateStatus);
  ipcMain.handle('update:check', () => {
    if (app.isPackaged) {
      autoUpdater
        .checkForUpdates()
        .catch((err) => setUpdateStatus({ state: 'error', message: String(err?.message || err) }));
    }
    return updateStatus;
  });
  ipcMain.handle('update:install', () => {
    if (updateStatus.state === 'downloaded') autoUpdater.quitAndInstall();
  });

  mainWindow = createWindow();

  // In a packaged build, check the GitHub Releases feed for a newer version,
  // download it in the background, and install it the next time the app quits.
  // Every step is pushed to the UI so staff can see "up to date" vs "updating".
  if (app.isPackaged) {
    autoUpdater.autoDownload = true;
    autoUpdater.on('checking-for-update', () => setUpdateStatus({ state: 'checking' }));
    autoUpdater.on('update-available', (info) =>
      setUpdateStatus({ state: 'downloading', percent: 0, newVersion: info?.version })
    );
    autoUpdater.on('update-not-available', () => setUpdateStatus({ state: 'latest' }));
    autoUpdater.on('download-progress', (p) =>
      setUpdateStatus({ state: 'downloading', percent: Math.round(p?.percent || 0) })
    );
    autoUpdater.on('update-downloaded', (info) =>
      setUpdateStatus({ state: 'downloaded', newVersion: info?.version })
    );
    autoUpdater.on('error', (err) =>
      setUpdateStatus({ state: 'error', message: String(err?.message || err) })
    );
    autoUpdater
      .checkForUpdates()
      .catch((err) => setUpdateStatus({ state: 'error', message: String(err?.message || err) }));
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
