import type { EmotionReading, Emotion, BoundingBox } from '../../types/emotion';

// face-api types used internally
interface FaceDetection {
  detection: {
    box: { x: number; y: number; width: number; height: number };
    score: number;
  };
  expressions: Record<string, number>;
}

let faceapi: any = null;
let isInitialized = false;
let isLoading = false;

export class EmotionEngine {
  private detectionInterval: number | null = null;
  private activeFeeds = new Map<string, HTMLVideoElement>();
  private feedQueue: string[] = [];
  private currentFeedIndex = 0;
  private onDetection: ((sourceId: string, readings: EmotionReading[]) => void) | null = null;
  private targetFps = 10;

  async initialize(): Promise<void> {
    if (isInitialized) return;
    if (isLoading) {
      // Wait for loading to complete
      while (isLoading) {
        await new Promise((r) => setTimeout(r, 100));
      }
      return;
    }

    isLoading = true;
    try {
      const faceapiModule = await import('@vladmandic/face-api');
      faceapi = faceapiModule;

      const modelPath = '/models';
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(modelPath),
        faceapi.nets.faceExpressionNet.loadFromUri(modelPath),
      ]);

      isInitialized = true;
    } catch (error) {
      console.error('Failed to initialize face-api:', error);
      throw error;
    } finally {
      isLoading = false;
    }
  }

  setOnDetection(callback: (sourceId: string, readings: EmotionReading[]) => void) {
    this.onDetection = callback;
  }

  setTargetFps(fps: number) {
    this.targetFps = fps;
    if (this.detectionInterval !== null) {
      this.stopDetectionLoop();
      this.startDetectionLoop();
    }
  }

  addFeed(sourceId: string, videoElement: HTMLVideoElement) {
    this.activeFeeds.set(sourceId, videoElement);
    this.feedQueue = Array.from(this.activeFeeds.keys());
  }

  removeFeed(sourceId: string) {
    this.activeFeeds.delete(sourceId);
    this.feedQueue = Array.from(this.activeFeeds.keys());
    if (this.currentFeedIndex >= this.feedQueue.length) {
      this.currentFeedIndex = 0;
    }
  }

  startDetectionLoop() {
    if (this.detectionInterval !== null) return;
    const interval = 1000 / this.targetFps;

    this.detectionInterval = window.setInterval(async () => {
      if (this.feedQueue.length === 0) return;

      // Round-robin: process one feed per tick
      const sourceId = this.feedQueue[this.currentFeedIndex];
      this.currentFeedIndex = (this.currentFeedIndex + 1) % this.feedQueue.length;

      const videoElement = this.activeFeeds.get(sourceId);
      if (!videoElement || videoElement.paused || videoElement.ended) return;

      try {
        const readings = await this.detectEmotions(videoElement, sourceId);
        this.onDetection?.(sourceId, readings);
      } catch {
        // Detection can fail if video is transitioning
      }
    }, interval);
  }

  stopDetectionLoop() {
    if (this.detectionInterval !== null) {
      clearInterval(this.detectionInterval);
      this.detectionInterval = null;
    }
  }

  async detectEmotions(videoElement: HTMLVideoElement, sourceId: string = 'default'): Promise<EmotionReading[]> {
    if (!isInitialized || !faceapi) return [];

    const detections: FaceDetection[] = await faceapi
      .detectAllFaces(videoElement, new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.5 }))
      .withFaceExpressions();

    return detections.map((det, index) => {
      const box = det.detection.box;
      const boundingBox: BoundingBox = {
        x: box.x,
        y: box.y,
        width: box.width,
        height: box.height,
      };

      const emotions = det.expressions as Record<Emotion, number>;
      const entries = Object.entries(emotions) as [Emotion, number][];
      const sorted = entries.sort((a, b) => b[1] - a[1]);
      const dominantEmotion = sorted[0][0];
      const confidence = sorted[0][1];

      return {
        timestamp: Date.now(),
        faceId: `${sourceId}-face-${index}`,
        emotions,
        boundingBox,
        dominantEmotion,
        confidence,
      };
    });
  }

  destroy() {
    this.stopDetectionLoop();
    this.activeFeeds.clear();
    this.feedQueue = [];
    this.onDetection = null;
  }
}
