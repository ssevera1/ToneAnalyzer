type AudioEventType = 'data' | 'state-change';
type AudioEventCallback = (data: any) => void;

const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500 MB
const AUDIO_CONTEXT_TIMEOUT = 5000; // 5 seconds
const MICROPHONE_TIMEOUT = 10000; // 10 seconds

export class AudioEngine {
  private audioContext: AudioContext | null = null;
  private analyserNode: AnalyserNode | null = null;
  private sourceNode: MediaStreamAudioSourceNode | AudioBufferSourceNode | null = null;
  private stream: MediaStream | null = null;
  private animationFrame: number | null = null;
  private listeners = new Map<AudioEventType, Set<AudioEventCallback>>();
  private _isCapturing = false;
  private _isFileLoaded = false;
  private setupLock: Promise<void> = Promise.resolve();

  readonly fftSize = 8192;

  get isCapturing() { return this._isCapturing; }
  get isFileLoaded() { return this._isFileLoaded; }
  get sampleRate() { return this.audioContext?.sampleRate ?? 0; }

  on(event: AudioEventType, cb: AudioEventCallback) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(cb);
  }

  off(event: AudioEventType, cb: AudioEventCallback) {
    this.listeners.get(event)?.delete(cb);
  }

  private emit(event: AudioEventType, data: any) {
    this.listeners.get(event)?.forEach((cb) => cb(data));
  }

  private async withTimeout<T>(promise: Promise<T>, timeoutMs: number, operationName: string): Promise<T> {
    let timeoutHandle: NodeJS.Timeout;
    const timeoutPromise = new Promise<T>((_, reject) => {
      timeoutHandle = setTimeout(() => {
        const diagnostics = {
          operation: operationName,
          timeoutMs,
          timestamp: new Date().toISOString(),
          userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
          audioContextState: this.audioContext?.state ?? 'not-initialized',
        };
        console.warn('[AudioEngine] Operation timeout', diagnostics);
        reject(new Error(`${operationName} timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    });

    try {
      return await Promise.race([promise, timeoutPromise]);
    } finally {
      clearTimeout(timeoutHandle);
    }
  }

  async startCapture(deviceId?: string): Promise<void> {
    // Serialize to prevent concurrent setup races.
    // Drain any prior rejection before chaining so a failed loadFile/startCapture
    // doesn't permanently poison the lock and silently swallow future operations.
    const next = this.setupLock.catch(() => {}).then(() => this._startCapture(deviceId));
    this.setupLock = next.catch(() => {});
    return next;
  }

  private async _startCapture(deviceId?: string): Promise<void> {
    await this.stop();

    let stream: MediaStream;
    try {
      stream = await this.withTimeout(
        navigator.mediaDevices.getUserMedia({
          audio: {
            deviceId: deviceId ? { exact: deviceId } : undefined,
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false,
          },
        }),
        MICROPHONE_TIMEOUT,
        'getUserMedia'
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const diagnostics = {
        operation: 'startCapture',
        error: errorMessage,
        timestamp: new Date().toISOString(),
        deviceId: deviceId ?? 'default',
        mediaDevicesAvailable: typeof navigator !== 'undefined' && !!navigator.mediaDevices,
      };
      console.error('[AudioEngine] Microphone access failed', diagnostics);
      this.emit('state-change', { isCapturing: false, isFileLoaded: false });
      throw new Error(`Microphone access denied: ${errorMessage}`);
    }

    this.stream = stream;

    let audioContext: AudioContext;
    try {
      audioContext = await this.withTimeout(
        Promise.resolve(new AudioContext({ sampleRate: 44100 })),
        AUDIO_CONTEXT_TIMEOUT,
        'AudioContext creation'
      );
    } catch (error) {
      this.stream?.getTracks().forEach((t) => t.stop());
      this.stream = null;
      const errorMessage = error instanceof Error ? error.message : String(error);
      const diagnostics = {
        operation: 'AudioContext creation',
        error: errorMessage,
        timestamp: new Date().toISOString(),
        audioContextSupported: typeof AudioContext !== 'undefined',
      };
      console.error('[AudioEngine] AudioContext creation failed', diagnostics);
      this.emit('state-change', { isCapturing: false, isFileLoaded: false });
      throw new Error(`Failed to create audio context: ${errorMessage}`);
    }

    this.audioContext = audioContext;
    this.analyserNode = this.audioContext.createAnalyser();
    this.analyserNode.fftSize = this.fftSize;
    this.analyserNode.smoothingTimeConstant = 0.3;

    this.sourceNode = this.audioContext.createMediaStreamSource(this.stream);
    this.sourceNode.connect(this.analyserNode);

    this._isCapturing = true;
    this._isFileLoaded = false;
    this.emit('state-change', { isCapturing: true, isFileLoaded: false });
    this.startDataLoop();
  }

  async loadFile(file: File): Promise<void> {
    const next = this.setupLock.catch(() => {}).then(() => this._loadFile(file));
    this.setupLock = next.catch(() => {});
    return next;
  }

  private async _loadFile(file: File): Promise<void> {
    if (file.size > MAX_FILE_SIZE) {
      throw new Error(
        `File too large (${Math.round(file.size / (1024 * 1024))} MB). Maximum is ${MAX_FILE_SIZE / (1024 * 1024)} MB.`
      );
    }

    await this.stop();

    const arrayBuffer = await file.arrayBuffer();

    let audioContext: AudioContext;
    try {
      audioContext = await this.withTimeout(
        Promise.resolve(new AudioContext()),
        AUDIO_CONTEXT_TIMEOUT,
        'AudioContext creation for file'
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const diagnostics = {
        operation: 'AudioContext creation for file load',
        error: errorMessage,
        timestamp: new Date().toISOString(),
        fileName: file.name,
        audioContextSupported: typeof AudioContext !== 'undefined',
      };
      console.error('[AudioEngine] AudioContext creation failed', diagnostics);
      throw new Error(`Failed to create audio context: ${errorMessage}`);
    }

    this.audioContext = audioContext;

    let audioBuffer: AudioBuffer;
    try {
      audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
    } catch (error) {
      // Clean up the AudioContext we just created before re-throwing
      await this.stop();
      const errorMessage = error instanceof Error ? error.message : String(error);
      const diagnostics = {
        operation: 'decodeAudioData',
        error: errorMessage,
        timestamp: new Date().toISOString(),
        fileName: file.name,
        fileSize: file.size,
      };
      console.error('[AudioEngine] Audio decode failed', diagnostics);
      throw new Error(`Failed to decode audio file: ${errorMessage}`);
    }

    this.analyserNode = this.audioContext.createAnalyser();
    this.analyserNode.fftSize = this.fftSize;
    this.analyserNode.smoothingTimeConstant = 0.3;

    const bufferSource = this.audioContext.createBufferSource();
    bufferSource.buffer = audioBuffer;
    bufferSource.connect(this.analyserNode);
    this.analyserNode.connect(this.audioContext.destination);

    this.sourceNode = bufferSource;

    bufferSource.onended = () => {
      this._isFileLoaded = false;
      this.emit('state-change', { isCapturing: false, isFileLoaded: false });
      this.stopDataLoop();
    };

    bufferSource.start();
    this._isCapturing = false;
    this._isFileLoaded = true;
    this.emit('state-change', { isCapturing: false, isFileLoaded: true });
    this.startDataLoop();
  }

  getFrequencyData(): Float32Array {
    if (!this.analyserNode) return new Float32Array(0);
    const data = new Float32Array(this.analyserNode.frequencyBinCount);
    this.analyserNode.getFloatFrequencyData(data);
    return data;
  }

  getTimeDomainData(): Float32Array {
    if (!this.analyserNode) return new Float32Array(0);
    const data = new Float32Array(this.analyserNode.fftSize);
    this.analyserNode.getFloatTimeDomainData(data);
    return data;
  }

  getByteFrequencyData(): Uint8Array {
    if (!this.analyserNode) return new Uint8Array(0);
    const data = new Uint8Array(this.analyserNode.frequencyBinCount);
    this.analyserNode.getByteFrequencyData(data);
    return data;
  }

  private startDataLoop() {
    if (this.animationFrame !== null) return; // prevent stacking
    const loop = () => {
      if (!this.analyserNode) {
        this.animationFrame = null;
        return;
      }
      const frequencyData = this.getFrequencyData();
      const timeDomainData = this.getTimeDomainData();
      this.emit('data', { type: 'analysis', frequencyData, timeDomainData });
      this.animationFrame = requestAnimationFrame(loop);
    };
    loop();
  }

  private stopDataLoop() {
    if (this.animationFrame !== null) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }
  }

  async stop(): Promise<void> {
    this.stopDataLoop();

    if (this.sourceNode) {
      this.sourceNode.disconnect();
      if ('stop' in this.sourceNode) {
        try { (this.sourceNode as AudioBufferSourceNode).stop(); } catch {}
      }
      this.sourceNode = null;
    }

    if (this.analyserNode) {
      this.analyserNode.disconnect();
      this.analyserNode = null;
    }

    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop());
      this.stream = null;
    }

    if (this.audioContext) {
      await this.audioContext.close();
      this.audioContext = null;
    }

    this._isCapturing = false;
    this._isFileLoaded = false;
    this.emit('state-change', { isCapturing: false, isFileLoaded: false });
  }

  async destroy(): Promise<void> {
    await this.stop();
    this.listeners.clear();
  }
}
