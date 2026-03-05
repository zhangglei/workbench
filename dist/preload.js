const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('workbenchApi', {
  getConfig: () => ipcRenderer.invoke('workbench:getConfig'),
  setConfig: (cfg) => ipcRenderer.invoke('workbench:setConfig', cfg),
  loadState: () => ipcRenderer.invoke('workbench:loadState'),
  saveState: (state) => ipcRenderer.invoke('workbench:saveState', state),
  chooseDataPath: () => ipcRenderer.invoke('workbench:chooseDataPath'),
  getMappedFolderTree: (dirPath) => ipcRenderer.invoke('workbench:getMappedFolderTree', dirPath),
  openPath: (filePath) => ipcRenderer.invoke('workbench:openPath', filePath)
});
