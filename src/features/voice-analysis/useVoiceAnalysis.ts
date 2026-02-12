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
        store.updateMetrics(metrics);
        store.updateFrequencyData(data.frequencyData);
        store.updateTimeDomainData(data.timeDomainData);

        if (store.currentSession) {
          const reading: StressReading = {
            timestamp: Date.now(),
            stressLevel: metrics.stressScore,
            frequency: metrics.f0,
            microtremorAmplitude: metrics.microtremorAmplitude,
            jitter: metrics.jitter,
            shimmer: metrics.shimmer,
            hnr: metrics.hnr,
          };
          store.addReading(reading);
        }
      } else if (data.type === 'pcm') {
        analyzer.analyzePCM(data.samples, data.sampleRate);
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
    store.startSession();
  }, [store]);

  const loadFile = useCallback(async (file: File) => {
    if (!engineRef.current) return;
    await engineRef.current.loadFile(file);
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
