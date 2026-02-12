import { useEffect, useRef, useCallback, useState } from 'react';
import { useEmotionStore } from '../../stores/emotionStore';
import { EmotionEngine } from './EmotionEngine';
import { VideoSourceManager } from './VideoSourceManager';
import { ExpressionAnalyzer, type ExpressionLabel, type PrimeEmotion } from './ExpressionAnalyzer';
import type { VideoSourceType } from '../../types/video';

export function useEmotionDetection() {
  const store = useEmotionStore();
  const engineRef = useRef<EmotionEngine | null>(null);
  const managerRef = useRef<VideoSourceManager | null>(null);
  const analyzerRef = useRef<ExpressionAnalyzer | null>(null);
  const [isEngineReady, setIsEngineReady] = useState(false);
  const [engineError, setEngineError] = useState<string | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [expressionLabels, setExpressionLabels] = useState<Map<string, ExpressionLabel[]>>(new Map());
  const [primeEmotions, setPrimeEmotions] = useState<Map<string, PrimeEmotion>>(new Map());

  useEffect(() => {
    const engine = new EmotionEngine();
    const manager = new VideoSourceManager();
    const exprAnalyzer = new ExpressionAnalyzer();

    engineRef.current = engine;
    managerRef.current = manager;
    analyzerRef.current = exprAnalyzer;

    engine.setOnDetection((sourceId, readings) => {
      store.updateReadings(sourceId, readings);

      // Derive expression labels from emotion readings
      const labels = exprAnalyzer.analyze(sourceId, readings);
      setExpressionLabels((prev) => {
        const next = new Map(prev);
        next.set(sourceId, labels);
        return next;
      });

      // Update prime emotion (internally cached, recalculates every 15s)
      const prime = exprAnalyzer.getPrimeEmotion(sourceId);
      if (prime) {
        setPrimeEmotions((prev) => {
          const next = new Map(prev);
          next.set(sourceId, prime);
          return next;
        });
      }
    });

    manager.setOnChange((sources) => {
      // Sync sources to store
      const currentIds = new Set(store.sources.map((s) => s.id));
      const newIds = new Set(sources.map((s) => s.id));

      sources.forEach((s) => {
        if (!currentIds.has(s.id)) store.addSource(s);
        else store.updateSource(s.id, s);
      });

      store.sources.forEach((s) => {
        if (!newIds.has(s.id)) store.removeSource(s.id);
      });
    });

    engine.initialize()
      .then(() => setIsEngineReady(true))
      .catch((err) => {
        setEngineError('Failed to load face detection models. Ensure model files are in /public/models/');
        console.error(err);
      });

    return () => {
      engine.destroy();
      manager.removeAll();
      exprAnalyzer.clearAllHistory();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addSource = useCallback(async (type: VideoSourceType, options?: { deviceId?: string; url?: string; file?: File; name?: string }) => {
    const manager = managerRef.current;
    if (!manager) return;

    try {
      let source;
      switch (type) {
        case 'webcam':
          source = await manager.addWebcam(options?.deviceId, options?.name);
          break;
        case 'rtsp':
          if (!options?.url) throw new Error('URL required for RTSP');
          source = await manager.addRTSP(options.url, options.name);
          break;
        case 'file':
          if (!options?.file) throw new Error('File required');
          source = manager.addFile(options.file, options.name);
          break;
        case 'screen':
          source = await manager.addScreenCapture(options?.name);
          break;
      }
      return source;
    } catch (error) {
      console.error('Failed to add source:', error);
    }
  }, []);

  const removeSource = useCallback((id: string) => {
    managerRef.current?.removeSource(id);
    engineRef.current?.removeFeed(id);
    analyzerRef.current?.clearHistory(id);
    store.removeSource(id);
    setExpressionLabels((prev) => {
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
    setPrimeEmotions((prev) => {
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
  }, [store]);

  const togglePause = useCallback((id: string) => {
    const manager = managerRef.current;
    if (!manager) return;
    const source = manager.getSource(id);
    if (!source) return;

    if (source.status === 'paused') {
      manager.resumeSource(id);
    } else {
      manager.pauseSource(id);
    }
  }, []);

  const registerVideoRef = useCallback((id: string, el: HTMLVideoElement | null) => {
    const engine = engineRef.current;
    if (!engine) return;
    if (el) {
      engine.addFeed(id, el);
    } else {
      engine.removeFeed(id);
    }
  }, []);

  const startMonitoring = useCallback(() => {
    engineRef.current?.startDetectionLoop();
    store.startSession();
  }, [store]);

  const stopMonitoring = useCallback(() => {
    engineRef.current?.stopDetectionLoop();
    analyzerRef.current?.clearAllHistory();
    store.stopSession();
  }, [store]);

  return {
    sources: store.sources,
    readings: store.latestReadings,
    expressionLabels,
    primeEmotions,
    gridLayout: store.gridLayout,
    isMonitoring: store.isMonitoring,
    isEngineReady,
    engineError,
    showAddDialog,
    setShowAddDialog,
    addSource,
    removeSource,
    togglePause,
    registerVideoRef,
    startMonitoring,
    stopMonitoring,
    setGridLayout: store.setGridLayout,
  };
}
