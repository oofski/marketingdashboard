const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  readDb: () => ipcRenderer.invoke('db:read'),
  writeDb: (data) => ipcRenderer.invoke('db:write', data),
  dbStat: () => ipcRenderer.invoke('db:stat'),
  dbInfo: () => ipcRenderer.invoke('db:info'),
  chooseDataFolder: () => ipcRenderer.invoke('db:chooseFolder'),
  useDefaultFolder: () => ipcRenderer.invoke('db:useDefault'),
  exportDoc: (filename, data) => ipcRenderer.invoke('doc:export', { filename, data }),
  appInfo: () => ipcRenderer.invoke('app:info'),
  isElectron: true,
});
