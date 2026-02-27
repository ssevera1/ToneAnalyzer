import type { EmotionReading, Emotion, BoundingBox } from '../../types/emotion';
import type { ModelGroup } from '../../types/facescope';

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
let initPromise: Promise<void> | null = null;

export class EmotionEngine {
  private detectionInterval: number | null = null;
  private activeFeeds = new Map<string, HTMLVideoElement>();
  private feedQueue: string[] = [];
  private currentFeedIndex = 0;
  private onDetection: ((sourceId: string, readings: EmotionReading[]) => void) | null = null;
  private targetFps = 10;
  private loadedModels = new Set<ModelGroup>();
  private modelLoadPromises = new Map<ModelGroup, Promise<void>>();

  async initialize(): Promise<void> {
    if (isInitialized) return;
    if (initPromise) return initPromise;

    initPromise = this._doInitialize();
    try {
      await initPromise;
    } finally {
      initPromise = null;
    }
  }

  private async _doInitialize(): Promise<void> {
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
    const oldIndex = this.feedQueue.indexOf(sourceId);
    this.activeFeeds.delete(sourceId);
    this.feedQueue = Array.from(this.activeFeeds.keys());
    if (this.feedQueue.length === 0) {
      this.currentFeedIndex = 0;
    } else if (oldIndex >= 0 && oldIndex < this.currentFeedIndex) {
      this.currentFeedIndex = Math.max(0, this.currentFeedIndex - 1);
    } else if (this.currentFeedIndex >= this.feedQueue.length) {
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
      } catch (error) {
        // DOMException is expected when video is transitioning states
        if (!(error instanceof DOMException)) {
          console.error(`Emotion detection error for source ${sourceId}:`, error);
        }
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

    const now = Date.now();
    const results: EmotionReading[] = [];

    for (let index = 0; index < detections.length; index++) {
      const det = detections[index];
      const box = det.detection.box;
      const emotions = det.expressions as Record<Emotion, number>;
      const entries = Object.entries(emotions) as [Emotion, number][];

      // Guard: skip detections with no expression data
      if (entries.length === 0) continue;

      const sorted = entries.sort((a, b) => b[1] - a[1]);

      results.push({
        timestamp: now,
        faceId: `${sourceId}-face-${index}`,
        emotions,
        boundingBox: { x: box.x, y: box.y, width: box.width, height: box.height },
        dominantEmotion: sorted[0][0],
        confidence: sorted[0][1],
      });
    }

    return results;
  }

  /**
   * Lazily load additional model groups beyond the base tinyFaceDetector + faceExpressionNet.
   * Only loads models not yet loaded. Safe to call multiple times.
   */
  async loadModels(groups: ModelGroup[]): Promise<void> {
    if (!faceapi) {
      // Ensure base init has happened so faceapi module is available
      await this.initialize();
    }

    const modelPath = '/models';
    const toLoad = groups.filter((g) => !this.loadedModels.has(g));
    if (toLoad.length === 0) return;

    const promises = toLoad.map((group) => {
      // Deduplicate concurrent loads of the same model
      if (this.modelLoadPromises.has(group)) {
        return this.modelLoadPromises.get(group)!;
      }

      const p = (async () => {
        switch (group) {
          case 'ssdMobilenetv1':
            await faceapi.nets.ssdMobilenetv1.loadFromUri(modelPath);
            break;
          case 'faceLandmark68':
            await faceapi.nets.faceLandmark68Net.loadFromUri(modelPath);
            break;
          case 'faceRecognition':
            await faceapi.nets.faceRecognitionNet.loadFromUri(modelPath);
            break;
          case 'faceExpression':
            await faceapi.nets.faceExpressionNet.loadFromUri(modelPath);
            break;
          case 'ageGender':
            await faceapi.nets.ageGenderNet.loadFromUri(modelPath);
            break;
        }
        this.loadedModels.add(group);
      })();

      this.modelLoadPromises.set(group, p);
      p.finally(() => this.modelLoadPromises.delete(group));
      return p;
    });

    await Promise.all(promises);
  }

  /** Returns the face-api module for direct access (e.g. faceapi.draw.*, faceapi.euclideanDistance) */
  getFaceApi(): any {
    return faceapi;
  }

  destroy() {
    this.stopDetectionLoop();
    this.activeFeeds.clear();
    this.feedQueue = [];
    this.onDetection = null;
  }
}
