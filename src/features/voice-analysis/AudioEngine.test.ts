import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AudioEngine } from './AudioEngine';

const GET_USER_MEDIA_TIMEOUT = 10_000;

function fakeTrack() {
  return { stop: vi.fn() };
}

function fakeStream(tracks: Array<{ stop: () => void }>) {
  return { getTracks: () => tracks };
}

class FakeAnalyserNode {
  fftSize = 0;
  smoothingTimeConstant = 0;
  frequencyBinCount = 0;
  connect = vi.fn();
  disconnect = vi.fn();
  getFloatFrequencyData = vi.fn();
  getFloatTimeDomainData = vi.fn();
  getByteFrequencyData = vi.fn();
}

class FakeAudioContext {
  static instances: FakeAudioContext[] = [];
  static resumeBehavior: 'resolve' | 'reject' | 'pending' = 'resolve';

  closeCalls = 0;
  destination = {};

  constructor() {
    FakeAudioContext.instances.push(this);
  }

  resume() {
    if (FakeAudioContext.resumeBehavior === 'reject') {
      return Promise.reject(new Error('resume failed'));
    }
    if (FakeAudioContext.resumeBehavior === 'pending') {
      return new Promise(() => {});
    }
    return Promise.resolve();
  }

  close() {
    this.closeCalls++;
    return Promise.resolve();
  }

  createAnalyser() {
    return new FakeAnalyserNode();
  }

  createMediaStreamSource() {
    return { connect: vi.fn(), disconnect: vi.fn() };
  }

  createBufferSource() {
    return { connect: vi.fn(), disconnect: vi.fn(), start: vi.fn(), stop: vi.fn(), buffer: null, onended: null };
  }

  decodeAudioData() {
    return Promise.resolve({});
  }
}

function fakeFile(): File {
  return { size: 100, arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)) } as unknown as File;
}

describe('AudioEngine', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    FakeAudioContext.instances = [];
    FakeAudioContext.resumeBehavior = 'resolve';
    vi.stubGlobal('AudioContext', FakeAudioContext);
    vi.stubGlobal('requestAnimationFrame', vi.fn(() => 0));
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('stops a mic stream that grants access after the getUserMedia timeout fires', async () => {
    let resolveGetUserMedia!: (stream: unknown) => void;
    const pending = new Promise((resolve) => {
      resolveGetUserMedia = resolve;
    });
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: vi.fn(() => pending) } });

    const engine = new AudioEngine();
    const capture = engine.startCapture();
    const rejection = expect(capture).rejects.toThrow('timed out');
    await vi.advanceTimersByTimeAsync(GET_USER_MEDIA_TIMEOUT);
    await rejection;

    // User answers the permission prompt after our timeout already gave up.
    const track = fakeTrack();
    resolveGetUserMedia(fakeStream([track]));
    await vi.advanceTimersByTimeAsync(0);

    expect(track.stop).toHaveBeenCalledTimes(1);
  });

  it('leaves no pending timer once a wrapped operation settles', async () => {
    vi.stubGlobal('navigator', {
      mediaDevices: { getUserMedia: vi.fn(() => Promise.resolve(fakeStream([fakeTrack()]))) },
    });

    const engine = new AudioEngine();
    await engine.startCapture();

    expect(vi.getTimerCount()).toBe(0);
  });

  it('closes the AudioContext when resume() fails during startCapture', async () => {
    vi.stubGlobal('navigator', {
      mediaDevices: { getUserMedia: vi.fn(() => Promise.resolve(fakeStream([fakeTrack()]))) },
    });
    FakeAudioContext.resumeBehavior = 'reject';

    const engine = new AudioEngine();
    await expect(engine.startCapture()).rejects.toThrow('Failed to initialize audio context');

    expect(FakeAudioContext.instances).toHaveLength(1);
    expect(FakeAudioContext.instances[0].closeCalls).toBe(1);
  });

  it('closes the AudioContext when resume() fails during loadFile', async () => {
    FakeAudioContext.resumeBehavior = 'reject';

    const engine = new AudioEngine();
    await expect(engine.loadFile(fakeFile())).rejects.toThrow('Failed to initialize audio context');

    expect(FakeAudioContext.instances).toHaveLength(1);
    expect(FakeAudioContext.instances[0].closeCalls).toBe(1);
  });
});
