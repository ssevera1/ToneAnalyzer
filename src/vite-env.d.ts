/// <reference types="vite/client" />

interface ElectronAPI {
  openFile: (options?: any) => Promise<string | null>;
  saveFile: (options?: any) => Promise<string | null>;
  platform: string;
}

interface Window {
  electronAPI?: ElectronAPI;
}
