import type { TranscriptSegment } from './audio';

export type Emotion =
  | 'neutral'
  | 'happy'
  | 'sad'
  | 'angry'
  | 'fearful'
  | 'disgusted'
  | 'surprised';

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface EmotionReading {
  timestamp: number;
  faceId: string;
  emotions: Record<Emotion, number>;
  boundingBox: BoundingBox;
  dominantEmotion: Emotion;
  confidence: number;
}

export interface EmotionSession {
  id?: number;
  name: string;
  startTime: number;
  endTime?: number;
  readings: EmotionReading[];
  sourceCount: number;
  transcript?: TranscriptSegment[];
}
