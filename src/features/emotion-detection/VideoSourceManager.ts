import type { VideoSource, VideoSourceType } from '../../types/video';
import { supportsRTSP, supportsScreenCapture } from '../../services/platformUtils';

let nextId = 1;

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
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          deviceId: deviceId ? { exact: deviceId } : undefined,
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
      });

      source.stream = stream;
      source.status = 'active';
      this.notifyChange();
    } catch (error) {
      source.status = 'error';
      this.notifyChange();
      console.error('Failed to access webcam:', error);
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
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 } },
      });

      stream.getVideoTracks()[0].onended = () => {
        source.status = 'disconnected';
        source.stream = undefined;
        this.notifyChange();
      };

      source.stream = stream;
      source.status = 'active';
      this.notifyChange();
    } catch (error) {
      source.status = 'error';
      this.notifyChange();
    }

    return source;
  }

  pauseSource(id: string) {
    const source = this.sources.get(id);
    if (source && source.status === 'active') {
      source.status = 'paused';
      source.stream?.getTracks().forEach((t) => (t.enabled = false));
      this.notifyChange();
    }
  }

  resumeSource(id: string) {
    const source = this.sources.get(id);
    if (source && source.status === 'paused') {
      source.status = 'active';
      source.stream?.getTracks().forEach((t) => (t.enabled = true));
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
    for (const id of this.sources.keys()) {
      this.removeSource(id);
    }
  }

  static async getAvailableDevices(): Promise<MediaDeviceInfo[]> {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices.filter((d) => d.kind === 'videoinput');
  }
}
