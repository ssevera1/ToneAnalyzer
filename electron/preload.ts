import { contextBridge, ipcRenderer } from 'electron';

interface FileFilter {
  name: string;
  extensions: string[];
}

interface DialogOptions {
  filters?: FileFilter[];
}

contextBridge.exposeInMainWorld('electronAPI', {
  openFile: (options?: DialogOptions) => ipcRenderer.invoke('dialog:openFile', options),
  saveFile: (options?: DialogOptions) => ipcRenderer.invoke('dialog:saveFile', options),
  platform: process.platform,
});
