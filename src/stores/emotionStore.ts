import { create } from 'zustand';
import type { EmotionReading, EmotionSession } from '../types/emotion';
import type { TranscriptSegment } from '../types/audio';
import type { VideoSource, GridLayout } from '../types/video';

interface EmotionState {
  isMonitoring: boolean;
  sources: VideoSource[];
  currentSession: EmotionSession | null;
  latestReadings: Map<string, EmotionReading[]>;
  sessions: EmotionSession[];
  gridLayout: GridLayout;

  setMonitoring: (monitoring: boolean) => void;
  addSource: (source: VideoSource) => void;
  removeSource: (id: string) => void;
  updateSource: (id: string, updates: Partial<VideoSource>) => void;
  setGridLayout: (layout: GridLayout) => void;
  updateReadings: (sourceId: string, readings: EmotionReading[]) => void;
  addReadings: (readings: EmotionReading[]) => void;
  addTranscriptSegment: (segment: TranscriptSegment) => void;
  startSession: (name?: string) => void;
  stopSession: () => void;
}

export const useEmotionStore = create<EmotionState>((set) => ({
  isMonitoring: false,
  sources: [],
  currentSession: null,
  latestReadings: new Map(),
  sessions: [],
  gridLayout: 4,

  setMonitoring: (monitoring) => set({ isMonitoring: monitoring }),

  addSource: (source) =>
    set((state) => ({ sources: [...state.sources, source] })),

  removeSource: (id) =>
    set((state) => ({
      sources: state.sources.filter((s) => s.id !== id),
    })),

  updateSource: (id, updates) =>
    set((state) => ({
      sources: state.sources.map((s) => (s.id === id ? { ...s, ...updates } : s)),
    })),

  setGridLayout: (layout) => set({ gridLayout: layout }),

  updateReadings: (sourceId, readings) =>
    set((state) => {
      const newMap = new Map(state.latestReadings);
      newMap.set(sourceId, readings);
      return { latestReadings: newMap };
    }),

  addReadings: (readings) =>
    set((state) => {
      if (!state.currentSession) return {};
      const accumulated = state.currentSession.readings;
      // Cap at 18000 readings to prevent unbounded growth
      const combined = accumulated.length + readings.length > 18000
        ? [...accumulated, ...readings].slice(-18000)
        : [...accumulated, ...readings];
      return { currentSession: { ...state.currentSession, readings: combined } };
    }),

  addTranscriptSegment: (segment) =>
    set((state) => {
      if (!state.currentSession) return {};
      return {
        currentSession: {
          ...state.currentSession,
          transcript: [...(state.currentSession.transcript || []), segment],
        },
      };
    }),

  startSession: (name?: string) =>
    set((state) => ({
      currentSession: {
        name: name || `Monitor ${new Date().toLocaleTimeString()}`,
        startTime: Date.now(),
        readings: [],
        transcript: [],
        sourceCount: state.sources.length,
      },
      isMonitoring: true,
    })),

  stopSession: () =>
    set((state) => {
      const session = state.currentSession;
      if (session) {
        return {
          currentSession: null,
          isMonitoring: false,
          sessions: [...state.sessions, { ...session, endTime: Date.now() }],
        };
      }
      return { isMonitoring: false };
    }),
}));
