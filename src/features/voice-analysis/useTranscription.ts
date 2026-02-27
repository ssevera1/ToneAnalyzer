import { useEffect, useRef, useState, useCallback } from 'react';
import { useVoiceStore } from '../../stores/voiceStore';
import { TranscriptionService } from './TranscriptionService';
import type { TranscriptSegment } from '../../types/audio';

let segmentIdCounter = 0;

export function useTranscription() {
  const serviceRef = useRef<TranscriptionService | null>(null);
  const [interimText, setInterimText] = useState('');
  const [isSupported, setIsSupported] = useState(false);

  useEffect(() => {
    const service = new TranscriptionService();
    serviceRef.current = service;
    setIsSupported(service.isSupported);

    const unsub = service.on((event) => {
      switch (event.type) {
        case 'segment': {
          setInterimText('');
          const state = useVoiceStore.getState();
          if (!state.currentSession) break;

          // Correlate stress/deceit readings within the segment's time window
          const readings = state.currentSession.readings.filter(
            (r) => r.timestamp >= event.startTime && r.timestamp <= event.endTime
          );

          let averageStress = 0;
          let averageDeceit = 0;
          let peakStress = 0;
          let peakDeceit = 0;

          if (readings.length > 0) {
            averageStress = readings.reduce((s, r) => s + r.stressLevel, 0) / readings.length;
            averageDeceit = readings.reduce((s, r) => s + r.deceitLevel, 0) / readings.length;
            peakStress = Math.max(...readings.map((r) => r.stressLevel));
            peakDeceit = Math.max(...readings.map((r) => r.deceitLevel));
          }

          const segment: TranscriptSegment = {
            id: `seg-${++segmentIdCounter}`,
            text: event.text,
            startTime: event.startTime,
            endTime: event.endTime,
            isFinal: true,
            averageStress,
            averageDeceit,
            peakStress,
            peakDeceit,
          };

          state.addTranscriptSegment(segment);
          break;
        }
        case 'interim':
          setInterimText(event.text);
          break;
      }
    });

    return () => {
      unsub();
      service.destroy();
    };
  }, []);

  const startTranscription = useCallback(() => {
    serviceRef.current?.start();
  }, []);

  const stopTranscription = useCallback(() => {
    serviceRef.current?.stop();
    setInterimText('');
  }, []);

  return {
    startTranscription,
    stopTranscription,
    interimText,
    isSupported,
  };
}
