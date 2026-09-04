import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AudioEngine } from './AudioEngine';

const MICROPHONE_TIMEOUT = 10_000;

describe('AudioEngine', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('stops mic tracks granted after the getUserMedia call has already timed out', async () => {
    let resolveMic: (stream: unknown) => void;
    const micPromise = new Promise((resolve) => {
      resolveMic = resolve;
    });
    vi.stubGlobal('navigator', {
      mediaDevices: { getUserMedia: vi.fn(() => micPromise) },
    });

    const engine = new AudioEngine();
    const capture = engine.startCapture().catch((error: Error) => error);

    await vi.advanceTimersByTimeAsync(MICROPHONE_TIMEOUT);
    const error = await capture;
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toMatch(/timed out/);

    // The user finally answers the permission prompt after the timeout has
    // already failed startCapture. Nothing in AudioEngine holds a reference
    // to this stream, so it must clean up after itself.
    const stopTrack = vi.fn();
    resolveMic!({ getTracks: () => [{ stop: stopTrack }] });
    await vi.advanceTimersByTimeAsync(0);

    expect(stopTrack).toHaveBeenCalledTimes(1);
  });
});
