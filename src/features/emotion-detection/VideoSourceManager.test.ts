import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { VideoSourceManager } from './VideoSourceManager';

const PERMISSION_TIMEOUT_MS = 10_000;

function fakeStream(track: { stop: () => void }) {
  return { getTracks: () => [track] } as unknown as MediaStream;
}

describe('VideoSourceManager', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('stops a webcam stream that is granted after the permission timeout fires', async () => {
    let resolveGetUserMedia!: (stream: MediaStream) => void;
    const getUserMedia = vi.fn(
      () => new Promise<MediaStream>((resolve) => { resolveGetUserMedia = resolve; })
    );
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia } });

    const manager = new VideoSourceManager();
    const addPromise = manager.addWebcam();
    const rejection = expect(addPromise).rejects.toThrow('Camera permission request timed out');

    await vi.advanceTimersByTimeAsync(PERMISSION_TIMEOUT_MS);
    await rejection;

    const track = { stop: vi.fn() };
    resolveGetUserMedia(fakeStream(track));
    for (let i = 0; i < 5; i++) await Promise.resolve();

    expect(track.stop).toHaveBeenCalledTimes(1);
  });

  it('does not leave a pending timer behind once addWebcam succeeds', async () => {
    const track = { stop: vi.fn() };
    const getUserMedia = vi.fn(() => Promise.resolve(fakeStream(track)));
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia } });

    const manager = new VideoSourceManager();
    const source = await manager.addWebcam();

    expect(source.status).toBe('active');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('stops a screen capture stream that is granted after the permission timeout fires', async () => {
    let resolveGetDisplayMedia!: (stream: MediaStream) => void;
    const getDisplayMedia = vi.fn(
      () => new Promise<MediaStream>((resolve) => { resolveGetDisplayMedia = resolve; })
    );
    vi.stubGlobal('navigator', { mediaDevices: { getDisplayMedia } });

    const manager = new VideoSourceManager();
    const addPromise = manager.addScreenCapture();
    const rejection = expect(addPromise).rejects.toThrow('Screen capture permission request timed out');

    await vi.advanceTimersByTimeAsync(PERMISSION_TIMEOUT_MS);
    await rejection;

    const track = { stop: vi.fn() };
    resolveGetDisplayMedia({ getVideoTracks: () => [track], getTracks: () => [track] } as unknown as MediaStream);
    for (let i = 0; i < 5; i++) await Promise.resolve();

    expect(track.stop).toHaveBeenCalledTimes(1);
  });
});
