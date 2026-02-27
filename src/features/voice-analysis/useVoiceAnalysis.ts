import { useEffect, useRef, useCallback } from 'react';
import { useVoiceStore } from '../../stores/voiceStore';
import { AudioEngine } from './AudioEngine';
import { StressAnalyzer } from './StressAnalyzer';
import type { StressReading } from '../../types/audio';

export function useVoiceAnalysis() {
  const store = useVoiceStore();
  const engineRef = useRef<AudioEngine | null>(null);
  const analyzerRef = useRef<StressAnalyzer | null>(null);

  useEffect(() => {
    engineRef.current = new AudioEngine();
    analyzerRef.current = new StressAnalyzer();

    const engine = engineRef.current;
    const analyzer = analyzerRef.current;

    engine.on('data', (data) => {
      if (data.type === 'analysis') {
        const metrics = analyzer.analyze(data.frequencyData, data.timeDomainData);
        // Use getState() to avoid stale closure — the store object captured at
        // mount time holds the *initial* state values, so store.currentSession
        // is always null. getState() reads the live Zustand state.
        const state = useVoiceStore.getState();
        state.updateMetrics(metrics);
        state.updateFrequencyData(data.frequencyData);
        state.updateTimeDomainData(data.timeDomainData);

        if (state.currentSession) {
          const reading: StressReading = {
            timestamp: Date.now(),
            stressLevel: metrics.stressScore,
            deceitLevel: metrics.deceitScore,
            frequency: metrics.f0,
            microtremorAmplitude: metrics.microtremorAmplitude,
            jitter: metrics.jitter,
            shimmer: metrics.shimmer,
            hnr: metrics.hnr,
          };
          state.addReading(reading);
        }
      }
    });

    return () => {
      engine.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startMic = useCallback(async (deviceId?: string) => {
    if (!engineRef.current) return;
    await engineRef.current.startCapture(deviceId);
    analyzerRef.current?.setSampleRate(engineRef.current.sampleRate);
    store.startSession();
  }, [store]);

  const loadFile = useCallback(async (file: File) => {
    if (!engineRef.current) return;
    await engineRef.current.loadFile(file);
    analyzerRef.current?.setSampleRate(engineRef.current.sampleRate);
    store.startSession(file.name);
  }, [store]);

  const stop = useCallback(async () => {
    if (!engineRef.current) return;
    await engineRef.current.stop();
    store.stopSession();
    analyzerRef.current?.reset();
  }, [store]);

  return {
    startMic,
    loadFile,
    stop,
    isAnalyzing: store.isAnalyzing,
    currentMetrics: store.currentMetrics,
    currentSession: store.currentSession,
    sessions: store.sessions,
    frequencyData: store.frequencyData,
    timeDomainData: store.timeDomainData,
  };
}
