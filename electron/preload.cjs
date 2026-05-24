const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  readDb: () => ipcRenderer.invoke('db:read'),
  writeDb: (data) => ipcRenderer.invoke('db:write', data),
  saveDoc: (filename, data) => ipcRenderer.invoke('doc:save', { filename, data }),
  readDoc: (filename) => ipcRenderer.invoke('doc:read', filename),
  exportDoc: (filename, data) => ipcRenderer.invoke('doc:export', { filename, data }),
  appInfo: () => ipcRenderer.invoke('app:info'),
  isElectron: true,
});
