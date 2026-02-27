import { create } from 'zustand';
import type { StressReading, VoiceSession, StressMetrics, TranscriptSegment } from '../types/audio';

interface VoiceState {
  isAnalyzing: boolean;
  currentSession: VoiceSession | null;
  currentMetrics: StressMetrics;
  sessions: VoiceSession[];
  frequencyData: Float32Array;
  timeDomainData: Float32Array;

  startSession: (name?: string) => void;
  stopSession: () => void;
  addReading: (reading: StressReading) => void;
  addTranscriptSegment: (segment: TranscriptSegment) => void;
  updateMetrics: (metrics: StressMetrics) => void;
  updateFrequencyData: (data: Float32Array) => void;
  updateTimeDomainData: (data: Float32Array) => void;
  setIsAnalyzing: (analyzing: boolean) => void;
  addSession: (session: VoiceSession) => void;
}

const emptyMetrics: StressMetrics = {
  microtremorAmplitude: 0,
  f0: 0,
  f0Variance: 0,
  jitter: 0,
  shimmer: 0,
  hnr: 0,
  stressScore: 0,
  deceitScore: 0,
  hesitationRatio: 0,
};

export const useVoiceStore = create<VoiceState>((set) => ({
  isAnalyzing: false,
  currentSession: null,
  currentMetrics: emptyMetrics,
  sessions: [],
  frequencyData: new Float32Array(0),
  timeDomainData: new Float32Array(0),

  startSession: (name?: string) =>
    set({
      currentSession: {
        name: name || `Session ${new Date().toLocaleTimeString()}`,
        startTime: Date.now(),
        readings: [],
        transcript: [],
      },
      isAnalyzing: true,
    }),

  stopSession: () =>
    set((state) => {
      const session = state.currentSession;
      if (session) {
        const completedSession: VoiceSession = {
          ...session,
          endTime: Date.now(),
          averageStress:
            session.readings.length > 0
              ? session.readings.reduce((sum, r) => sum + r.stressLevel, 0) / session.readings.length
              : 0,
          averageDeceit:
            session.readings.length > 0
              ? session.readings.reduce((sum, r) => sum + r.deceitLevel, 0) / session.readings.length
              : 0,
        };
        return {
          currentSession: null,
          isAnalyzing: false,
          currentMetrics: emptyMetrics,
          sessions: [...state.sessions, completedSession],
        };
      }
      return { isAnalyzing: false };
    }),

  addReading: (reading) =>
    set((state) => {
      if (!state.currentSession) return {};
      const readings = state.currentSession.readings;
      if (readings.length >= 18000) readings.shift();
      readings.push(reading);
      return { currentSession: { ...state.currentSession, readings } };
    }),

  addTranscriptSegment: (segment) =>
    set((state) => {
      if (!state.currentSession) return {};
      const transcript = [...state.currentSession.transcript, segment];
      return { currentSession: { ...state.currentSession, transcript } };
    }),

  updateMetrics: (metrics) => set({ currentMetrics: metrics }),
  updateFrequencyData: (data) => set({ frequencyData: data }),
  updateTimeDomainData: (data) => set({ timeDomainData: data }),
  setIsAnalyzing: (analyzing) => set({ isAnalyzing: analyzing }),
  addSession: (session) => set((state) => ({ sessions: [...state.sessions, session] })),
}));
