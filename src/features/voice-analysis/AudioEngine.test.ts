import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AudioEngine } from './AudioEngine';

const MICROPHONE_ACCESS_TIMEOUT = 10_000;

class FakeAnalyserNode {
  fftSize = 0;
  smoothingTimeConstant = 0;
  frequencyBinCount = 1024;
  connect = vi.fn();
  disconnect = vi.fn();
  getFloatFrequencyData = vi.fn();
  getFloatTimeDomainData = vi.fn();
}

class FakeAudioContext {
  sampleRate = 44100;
  createAnalyser() {
    return new FakeAnalyserNode();
  }
  createMediaStreamSource(_stream: unknown) {
    return { connect: vi.fn(), disconnect: vi.fn() };
  }
  close() {
    return Promise.resolve();
  }
}

function fakeStream(track: { stop: () => void }) {
  return { getTracks: () => [track] } as unknown as MediaStream;
}

describe('AudioEngine', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.stubGlobal('AudioContext', FakeAudioContext);
    vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1));
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('stops a stream that is granted after the microphone-access timeout fires', async () => {
    let resolveGetUserMedia!: (stream: MediaStream) => void;
    const getUserMedia = vi.fn(
      () => new Promise<MediaStream>((resolve) => { resolveGetUserMedia = resolve; })
    );
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia } });

    const engine = new AudioEngine();
    const startPromise = engine.startCapture();
    const rejection = expect(startPromise).rejects.toThrow('Microphone access timeout');

    await vi.advanceTimersByTimeAsync(MICROPHONE_ACCESS_TIMEOUT);
    await rejection;

    const track = { stop: vi.fn() };
    resolveGetUserMedia(fakeStream(track));
    // Flush the microtask queue so the late-resolving getUserMedia promise's
    // .then handler (which stops orphaned tracks) has a chance to run.
    for (let i = 0; i < 5; i++) await Promise.resolve();

    expect(track.stop).toHaveBeenCalledTimes(1);
  });

  it('does not leave a pending timer behind once capture starts successfully', async () => {
    const track = { stop: vi.fn() };
    const getUserMedia = vi.fn(() => Promise.resolve(fakeStream(track)));
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia } });

    const engine = new AudioEngine();
    await engine.startCapture();

    expect(engine.isCapturing).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });
});
