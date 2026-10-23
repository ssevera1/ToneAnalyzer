import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { VideoSourceManager } from './VideoSourceManager';

const STREAM_INIT_TIMEOUT_MS = 60_000;
const DEVICE_ENUM_TIMEOUT_MS = 3_000;

function fakeStream(track: { stop: () => void }) {
  const videoTrack: { stop: () => void; onended?: () => void } = { stop: () => {} };
  return {
    getTracks: () => [track, videoTrack],
    getVideoTracks: () => [videoTrack],
  } as unknown as MediaStream;
}

describe('VideoSourceManager', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('does not time out a webcam request still waiting on the permission prompt', async () => {
    const getUserMedia = vi.fn(() => new Promise<MediaStream>(() => {}));
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia } });

    const manager = new VideoSourceManager();
    const addPromise = manager.addWebcam();

    // Well past the old 5s regression window, but short of the 60s backstop —
    // a real permission prompt or screen picker can easily take this long.
    await vi.advanceTimersByTimeAsync(30_000);

    let settled = false;
    addPromise.then(
      () => (settled = true),
      () => (settled = true)
    );
    await Promise.resolve();
    expect(settled).toBe(false);
  });

  it('stops a webcam stream that is granted after the init timeout fires', async () => {
    let resolveGetUserMedia!: (stream: MediaStream) => void;
    const getUserMedia = vi.fn(
      () => new Promise<MediaStream>((resolve) => { resolveGetUserMedia = resolve; })
    );
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia } });

    const manager = new VideoSourceManager();
    const addPromise = manager.addWebcam();
    const rejection = expect(addPromise).rejects.toThrow('timed out');

    await vi.advanceTimersByTimeAsync(STREAM_INIT_TIMEOUT_MS);
    await rejection;

    const track = { stop: vi.fn() };
    resolveGetUserMedia(fakeStream(track));
    for (let i = 0; i < 5; i++) await Promise.resolve();

    expect(track.stop).toHaveBeenCalledTimes(1);
  });

  it('stops a screen-capture stream that is granted after the init timeout fires', async () => {
    let resolveGetDisplayMedia!: (stream: MediaStream) => void;
    const getDisplayMedia = vi.fn(
      () => new Promise<MediaStream>((resolve) => { resolveGetDisplayMedia = resolve; })
    );
    vi.stubGlobal('navigator', { mediaDevices: { getDisplayMedia } });

    const manager = new VideoSourceManager();
    const addPromise = manager.addScreenCapture();
    const rejection = expect(addPromise).rejects.toThrow('timed out');

    await vi.advanceTimersByTimeAsync(STREAM_INIT_TIMEOUT_MS);
    await rejection;

    const track = { stop: vi.fn() };
    resolveGetDisplayMedia(fakeStream(track));
    for (let i = 0; i < 5; i++) await Promise.resolve();

    expect(track.stop).toHaveBeenCalledTimes(1);
  });

  it('does not leave a pending timer behind once the webcam stream resolves', async () => {
    const track = { stop: vi.fn() };
    const getUserMedia = vi.fn(() => Promise.resolve(fakeStream(track)));
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia } });

    const manager = new VideoSourceManager();
    await manager.addWebcam();

    expect(vi.getTimerCount()).toBe(0);
  });

  it('pauses and resumes a file source that has no MediaStream', () => {
    const manager = new VideoSourceManager();
    vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:fake'), revokeObjectURL: vi.fn() });
    const source = manager.addFile(new File([], 'clip.mp4'));

    manager.pauseSource(source.id);
    expect(manager.getSource(source.id)?.status).toBe('paused');

    manager.resumeSource(source.id);
    expect(manager.getSource(source.id)?.status).toBe('active');
  });

  it('propagates the device enumeration timeout without double-wrapping the message', async () => {
    const enumerateDevices = vi.fn(() => new Promise<MediaDeviceInfo[]>(() => {}));
    vi.stubGlobal('navigator', { mediaDevices: { enumerateDevices } });

    const promise = VideoSourceManager.getAvailableDevices();
    const rejection = expect(promise).rejects.toThrow(
      `Device enumeration timed out after ${DEVICE_ENUM_TIMEOUT_MS}ms`
    );

    await vi.advanceTimersByTimeAsync(DEVICE_ENUM_TIMEOUT_MS);
    await rejection;
  });
});
