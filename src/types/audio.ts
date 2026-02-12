export interface StressReading {
  timestamp: number;
  stressLevel: number;
  frequency: number;
  microtremorAmplitude: number;
  jitter: number;
  shimmer: number;
  hnr: number;
}

export interface VoiceSession {
  id?: number;
  name: string;
  startTime: number;
  endTime?: number;
  readings: StressReading[];
  audioBlob?: Blob;
  averageStress?: number;
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
}
