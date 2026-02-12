import { create } from 'zustand';
import type { GridLayout } from '../types/video';

interface AppSettings {
  defaultAudioDevice: string;
  stressThreshold: number;
  defaultGridLayout: GridLayout;
  detectionFps: number;
  defaultExportFormat: 'csv' | 'pdf';
}

interface AppState {
  settings: AppSettings;
  updateSettings: (partial: Partial<AppSettings>) => void;
}

export const useAppStore = create<AppState>((set) => ({
  settings: {
    defaultAudioDevice: 'default',
    stressThreshold: 70,
    defaultGridLayout: 4,
    detectionFps: 10,
    defaultExportFormat: 'csv',
  },
  updateSettings: (partial) =>
    set((state) => {
      const ALLOWED_KEYS: (keyof AppSettings)[] = [
        'defaultAudioDevice', 'stressThreshold', 'defaultGridLayout',
        'detectionFps', 'defaultExportFormat',
      ];
      const sanitized: Partial<AppSettings> = {};
      for (const key of ALLOWED_KEYS) {
        if (key in partial) {
          (sanitized as Record<string, unknown>)[key] = partial[key];
        }
      }
      return { settings: { ...state.settings, ...sanitized } };
    }),
}));
