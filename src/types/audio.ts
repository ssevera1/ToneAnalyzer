export interface StressReading {
  timestamp: number;
  stressLevel: number;
  deceitLevel: number;
  frequency: number;
  microtremorAmplitude: number;
  jitter: number;
  shimmer: number;
  hnr: number;
}

export interface TranscriptSegment {
  id: string;
  text: string;
  startTime: number;
  endTime: number;
  isFinal: boolean;
  averageStress: number;
  averageDeceit: number;
  peakStress: number;
  peakDeceit: number;
}

export interface VoiceSession {
  id?: number;
  name: string;
  startTime: number;
  endTime?: number;
  readings: StressReading[];
  transcript: TranscriptSegment[];
  audioBlob?: Blob;
  averageStress?: number;
  averageDeceit?: number;
}

export interface AudioEngineState {
  isCapturing: boolean;
  isFileLoaded: boolean;
  sampleRate: number;
  fftSize: number;
}

export interface StressMetrics {
  microtremorAmplitude: number;
  f0: number;
  f0Variance: number;
  jitter: number;
  shimmer: number;
  hnr: number;
  stressScore: number;
  deceitScore: number;
  hesitationRatio: number;
}
