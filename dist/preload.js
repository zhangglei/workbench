const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('workbenchApi', {
  getConfig: () => ipcRenderer.invoke('workbench:getConfig'),
  setConfig: (cfg) => ipcRenderer.invoke('workbench:setConfig', cfg),
  loadState: () => ipcRenderer.invoke('workbench:loadState'),
  saveState: (state) => ipcRenderer.invoke('workbench:saveState', state),
  chooseDataPath: () => ipcRenderer.invoke('workbench:chooseDataPath'),
  chooseObsidianVaultPath: () => ipcRenderer.invoke('workbench:chooseObsidianVaultPath'),
  obsidianReadNotes: () => ipcRenderer.invoke('workbench:obsidianReadNotes'),
  obsidianWriteNotes: (notes) => ipcRenderer.invoke('workbench:obsidianWriteNotes', notes),
  onObsidianChanged: (handler) => {
    const listener = (_, payload) => {
      if (typeof handler === 'function') handler(payload);
    };
    ipcRenderer.on('workbench:obsidianChanged', listener);
    return () => ipcRenderer.removeListener('workbench:obsidianChanged', listener);
  },
  getMappedFolderTree: (dirPath) => ipcRenderer.invoke('workbench:getMappedFolderTree', dirPath),
  openPath: (filePath) => ipcRenderer.invoke('workbench:openPath', filePath)
});
