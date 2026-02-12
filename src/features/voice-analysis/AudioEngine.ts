type AudioEventType = 'data' | 'state-change';
type AudioEventCallback = (data: any) => void;

export class AudioEngine {
  private audioContext: AudioContext | null = null;
  private analyserNode: AnalyserNode | null = null;
  private sourceNode: MediaStreamAudioSourceNode | AudioBufferSourceNode | null = null;
  private workletNode: AudioWorkletNode | null = null;
  private stream: MediaStream | null = null;
  private animationFrame: number | null = null;
  private listeners = new Map<AudioEventType, Set<AudioEventCallback>>();
  private _isCapturing = false;
  private _isFileLoaded = false;

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

  async startCapture(deviceId?: string): Promise<void> {
    await this.stop();

    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        deviceId: deviceId ? { exact: deviceId } : undefined,
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      },
    });

    this.audioContext = new AudioContext({ sampleRate: 44100 });
    this.analyserNode = this.audioContext.createAnalyser();
    this.analyserNode.fftSize = this.fftSize;
    this.analyserNode.smoothingTimeConstant = 0.3;

    this.sourceNode = this.audioContext.createMediaStreamSource(this.stream);
    this.sourceNode.connect(this.analyserNode);

    await this.setupWorklet();

    this._isCapturing = true;
    this._isFileLoaded = false;
    this.emit('state-change', { isCapturing: true, isFileLoaded: false });
    this.startDataLoop();
  }

  async loadFile(file: File): Promise<void> {
    await this.stop();

    const arrayBuffer = await file.arrayBuffer();
    this.audioContext = new AudioContext();
    const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);

    this.analyserNode = this.audioContext.createAnalyser();
    this.analyserNode.fftSize = this.fftSize;
    this.analyserNode.smoothingTimeConstant = 0.3;

    const bufferSource = this.audioContext.createBufferSource();
    bufferSource.buffer = audioBuffer;
    bufferSource.connect(this.analyserNode);
    this.analyserNode.connect(this.audioContext.destination);

    this.sourceNode = bufferSource;

    await this.setupWorklet();

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

  private async setupWorklet(): Promise<void> {
    if (!this.audioContext || !this.sourceNode) return;

    try {
      const workletCode = `
        const BUFFER_SIZE = 4096;
        class StressAudioProcessor extends AudioWorkletProcessor {
          constructor() { super(); this.buffer = new Float32Array(BUFFER_SIZE); this.bufferIndex = 0; }
          process(inputs) {
            const input = inputs[0];
            if (!input || !input[0]) return true;
            const channelData = input[0];
            for (let i = 0; i < channelData.length; i++) {
              this.buffer[this.bufferIndex++] = channelData[i];
              if (this.bufferIndex >= BUFFER_SIZE) {
                this.port.postMessage({ type: 'pcm-data', samples: this.buffer.slice(), sampleRate });
                this.bufferIndex = 0;
              }
            }
            return true;
          }
        }
        registerProcessor('stress-audio-processor', StressAudioProcessor);
      `;
      const blob = new Blob([workletCode], { type: 'application/javascript' });
      const url = URL.createObjectURL(blob);
      await this.audioContext.audioWorklet.addModule(url);
      URL.revokeObjectURL(url);

      this.workletNode = new AudioWorkletNode(this.audioContext, 'stress-audio-processor');
      this.sourceNode.connect(this.workletNode);

      this.workletNode.port.onmessage = (event) => {
        if (event.data.type === 'pcm-data') {
          this.emit('data', {
            type: 'pcm',
            samples: event.data.samples as Float32Array,
            sampleRate: event.data.sampleRate as number,
          });
        }
      };
    } catch {
      // AudioWorklet not supported — fall back to AnalyserNode only
    }
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
    const loop = () => {
      if (!this.analyserNode) return;
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

    if (this.workletNode) {
      this.workletNode.disconnect();
      this.workletNode = null;
    }

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

  destroy() {
    this.stop();
    this.listeners.clear();
  }
}
