import { useEffect, useRef, useState, useCallback } from 'react';
import { useEmotionStore } from '../../stores/emotionStore';
import { TranscriptionService } from '../voice-analysis/TranscriptionService';
import type { TranscriptSegment } from '../../types/audio';

let segmentIdCounter = 0;

export function useMonitorTranscription(deceitScoresRef: React.RefObject<Map<string, number>>) {
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
          const store = useEmotionStore.getState();
          if (!store.currentSession) break;

          // Take max deceit from all currently tracked faces
          let maxDeceit = 0;
          const scores = deceitScoresRef.current;
          if (scores) {
            scores.forEach((val) => {
              if (val > maxDeceit) maxDeceit = val;
            });
          }

          const segment: TranscriptSegment = {
            id: `emo-seg-${++segmentIdCounter}`,
            text: event.text,
            startTime: event.startTime,
            endTime: event.endTime,
            isFinal: true,
            averageStress: 0,
            averageDeceit: maxDeceit,
            peakStress: 0,
            peakDeceit: maxDeceit,
          };

          store.addTranscriptSegment(segment);
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
  }, [deceitScoresRef]);

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
