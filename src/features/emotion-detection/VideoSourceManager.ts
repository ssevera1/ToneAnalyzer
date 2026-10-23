import type { VideoSource, VideoSourceType } from '../../types/video';
import { supportsRTSP, supportsScreenCapture } from '../../services/platformUtils';

let nextId = 1;

// getUserMedia/getDisplayMedia stay pending while the browser's permission
// prompt or screen/window picker is open, so this timeout must not race the
// user — it's a backstop against a stuck driver, not a UX-tuned value.
const STREAM_INIT_TIMEOUT_MS = 60000;
const DEVICE_ENUM_TIMEOUT_MS = 3000;

export class VideoSourceManager {
  private sources = new Map<string, VideoSource>();
  private onChange: ((sources: VideoSource[]) => void) | null = null;

  setOnChange(callback: (sources: VideoSource[]) => void) {
    this.onChange = callback;
  }

  private notifyChange() {
    this.onChange?.(this.getSources());
  }

  getSources(): VideoSource[] {
    return Array.from(this.sources.values());
  }

  getSource(id: string): VideoSource | undefined {
    return this.sources.get(id);
  }

  // Promise.race doesn't cancel the loser: if the timeout wins, stop any
  // stream that is granted later so it doesn't stay live/orphaned.
  private async raceStreamWithTimeout(
    streamPromise: Promise<MediaStream>,
    ms: number,
    message: string
  ): Promise<MediaStream> {
    let timedOut = false;
    streamPromise
      .then((stream) => {
        if (timedOut) stream.getTracks().forEach((t) => t.stop());
      })
      .catch(() => {});

    let timeoutId!: ReturnType<typeof setTimeout>;
    const timeoutPromise = new Promise<MediaStream>((_, reject) => {
      timeoutId = setTimeout(() => {
        timedOut = true;
        reject(new Error(message));
      }, ms);
    });

    try {
      return await Promise.race([streamPromise, timeoutPromise]);
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private static createTimeoutPromise<T>(
    ms: number,
    message: string
  ): { promise: Promise<T>; clear: () => void } {
    let timeoutId!: ReturnType<typeof setTimeout>;
    const promise = new Promise<T>((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error(message)), ms);
    });
    return { promise, clear: () => clearTimeout(timeoutId) };
  }

  async addWebcam(deviceId?: string, name?: string): Promise<VideoSource> {
    const id = `webcam-${nextId++}`;
    const source: VideoSource = {
      id,
      name: name || `Webcam ${nextId - 1}`,
      type: 'webcam',
      deviceId,
      status: 'connecting',
    };

    this.sources.set(id, source);
    this.notifyChange();

    try {
      const streamPromise = navigator.mediaDevices.getUserMedia({
        video: {
          deviceId: deviceId ? { exact: deviceId } : undefined,
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
      });

      const stream = await this.raceStreamWithTimeout(
        streamPromise,
        STREAM_INIT_TIMEOUT_MS,
        `Webcam access timed out after ${STREAM_INIT_TIMEOUT_MS}ms`
      );

      if (!stream.getVideoTracks().length) {
        stream.getTracks().forEach((t) => t.stop());
        throw new Error('No video track available from webcam');
      }

      const videoTrack = stream.getVideoTracks()[0];
      videoTrack.onended = () => {
        source.status = 'disconnected';
        source.stream = undefined;
        this.notifyChange();
      };

      source.stream = stream;
      source.status = 'active';
      this.notifyChange();
    } catch (error) {
      this.sources.delete(id);
      this.notifyChange();
      throw new Error(`Failed to access webcam: ${error instanceof Error ? error.message : String(error)}`);
    }

    return source;
  }

  async addRTSP(url: string, name?: string): Promise<VideoSource> {
    if (!supportsRTSP()) {
      throw new Error('RTSP is only supported in Electron');
    }

    // Validate RTSP URL scheme before forwarding to proxy
    if (!/^rtsps?:\/\//i.test(url)) {
      throw new Error('URL must use rtsp:// or rtsps:// scheme');
    }
    try {
      new URL(url);
    } catch {
      throw new Error('Invalid RTSP URL format');
    }

    const id = `rtsp-${nextId++}`;
    const source: VideoSource = {
      id,
      name: name || `IP Camera ${nextId - 1}`,
      type: 'rtsp',
      url,
      status: 'connecting',
    };

    this.sources.set(id, source);
    this.notifyChange();

    // RTSP connection is handled via the Electron WebSocket proxy
    // The VideoPanel component will connect to ws://127.0.0.1:9999?url=<rtsp_url>
    source.status = 'active';
    this.notifyChange();

    return source;
  }

  addFile(file: File, name?: string): VideoSource {
    const id = `file-${nextId++}`;
    const url = URL.createObjectURL(file);
    const source: VideoSource = {
      id,
      name: name || file.name,
      type: 'file',
      url,
      status: 'active',
    };

    this.sources.set(id, source);
    this.notifyChange();
    return source;
  }

  async addScreenCapture(name?: string): Promise<VideoSource> {
    if (!supportsScreenCapture()) {
      throw new Error('Screen capture is not supported on this platform');
    }

    const id = `screen-${nextId++}`;
    const source: VideoSource = {
      id,
      name: name || `Screen ${nextId - 1}`,
      type: 'screen',
      status: 'connecting',
    };

    this.sources.set(id, source);
    this.notifyChange();

    try {
      const streamPromise = navigator.mediaDevices.getDisplayMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 } },
      });

      const stream = await this.raceStreamWithTimeout(
        streamPromise,
        STREAM_INIT_TIMEOUT_MS,
        `Screen capture timed out after ${STREAM_INIT_TIMEOUT_MS}ms`
      );

      if (!stream.getVideoTracks().length) {
        stream.getTracks().forEach((t) => t.stop());
        throw new Error('No video track available from screen capture');
      }

      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.onended = () => {
          source.status = 'disconnected';
          source.stream = undefined;
          this.notifyChange();
        };
      }

      source.stream = stream;
      source.status = 'active';
      this.notifyChange();
    } catch (error) {
      this.sources.delete(id);
      this.notifyChange();
      throw new Error(`Screen capture failed: ${error instanceof Error ? error.message : String(error)}`);
    }

    return source;
  }

  pauseSource(id: string) {
    const source = this.sources.get(id);
    if (source && source.status === 'active') {
      if (!source.stream) {
        console.warn(`Source ${id} has no active stream to pause`);
        return;
      }
      const tracks = source.stream.getTracks();
      if (!tracks.length) {
        console.warn(`Source ${id} stream has no tracks`);
        return;
      }
      source.status = 'paused';
      tracks.forEach((t) => (t.enabled = false));
      this.notifyChange();
    }
  }

  resumeSource(id: string) {
    const source = this.sources.get(id);
    if (source && source.status === 'paused') {
      if (!source.stream) {
        console.warn(`Source ${id} has no active stream to resume`);
        return;
      }
      const tracks = source.stream.getTracks();
      if (!tracks.length) {
        console.warn(`Source ${id} stream has no tracks`);
        return;
      }
      source.status = 'active';
      tracks.forEach((t) => (t.enabled = true));
      this.notifyChange();
    }
  }

  removeSource(id: string) {
    const source = this.sources.get(id);
    if (source) {
      if (source.stream) {
        source.stream.getTracks().forEach((t) => t.stop());
      }
      if (source.type === 'file' && source.url) {
        URL.revokeObjectURL(source.url);
      }
      this.sources.delete(id);
      this.notifyChange();
    }
  }

  removeAll() {
    const ids = Array.from(this.sources.keys());
    for (const id of ids) {
      this.removeSource(id);
    }
  }

  static async getAvailableDevices(): Promise<MediaDeviceInfo[]> {
    const devicesPromise = navigator.mediaDevices.enumerateDevices();
    const { promise: timeoutPromise, clear } = VideoSourceManager.createTimeoutPromise<MediaDeviceInfo[]>(
      DEVICE_ENUM_TIMEOUT_MS,
      `Device enumeration timed out after ${DEVICE_ENUM_TIMEOUT_MS}ms`
    );

    try {
      const devices = await Promise.race([devicesPromise, timeoutPromise]);
      return devices.filter((d) => d.kind === 'videoinput');
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('Device enumeration timed out')) {
        throw error;
      }
      throw new Error(
        `Failed to enumerate video devices: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    } finally {
      clear();
    }
  }
}
