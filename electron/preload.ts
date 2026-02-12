import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  openFile: (options?: any) => ipcRenderer.invoke('dialog:openFile', options),
  saveFile: (options?: any) => ipcRenderer.invoke('dialog:saveFile', options),
  platform: process.platform,
});
