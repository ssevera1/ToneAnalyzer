import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TranscriptionService } from './TranscriptionService';

class FakeRecognition {
  static instances: FakeRecognition[] = [];
  /** Overridden per-test to simulate start() throwing. */
  static onStartCall: (instance: FakeRecognition) => void = () => {};

  continuous = false;
  interimResults = false;
  lang = '';
  startCalls = 0;
  stopCalls = 0;

  onresult: ((event: unknown) => void) | null = null;
  onerror: ((event: { error: string }) => void) | null = null;
  onend: (() => void) | null = null;
  onstart: (() => void) | null = null;

  constructor() {
    FakeRecognition.instances.push(this);
  }

  start() {
    this.startCalls++;
    FakeRecognition.onStartCall(this);
  }

  stop() {
    this.stopCalls++;
  }

  abort() {}

  /** Simulate the browser acknowledging the start. */
  fireStart() {
    this.onstart?.();
  }
}

const MAX_BACKOFF_MS = 60_000;

function latest() {
  return FakeRecognition.instances[FakeRecognition.instances.length - 1];
}

describe('TranscriptionService', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    FakeRecognition.instances = [];
    FakeRecognition.onStartCall = () => {};
    vi.stubGlobal('window', { SpeechRecognition: FakeRecognition });
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('does not re-open recognition when destroy() lands during a retry backoff', async () => {
    FakeRecognition.onStartCall = () => {
      throw new Error('InvalidStateError');
    };

    const service = new TranscriptionService();
    service.start();
    expect(FakeRecognition.instances).toHaveLength(1);

    // Component unmounts while the first retry is still sleeping.
    service.destroy();
    const instancesAtDestroy = FakeRecognition.instances.length;

    await vi.advanceTimersByTimeAsync(MAX_BACKOFF_MS);

    expect(FakeRecognition.instances).toHaveLength(instancesAtDestroy);
    expect(FakeRecognition.instances.every((r) => r.startCalls === 1)).toBe(true);
  });

  it('does not restart from a stale onend after stop()', () => {
    const service = new TranscriptionService();
    service.start();
    const stale = latest();
    stale.fireStart();

    service.stop();
    service.start();
    latest().fireStart();

    // The browser delivers onend for the instance abandoned by stop().
    stale.onend?.();

    expect(stale.startCalls).toBe(1);
    expect(FakeRecognition.instances).toHaveLength(2);
  });

  it('runs a single retry loop when start() is called twice during the backoff gap', async () => {
    FakeRecognition.onStartCall = () => {
      throw new Error('InvalidStateError');
    };

    const service = new TranscriptionService();
    service.start();
    service.start();

    await vi.advanceTimersByTimeAsync(MAX_BACKOFF_MS);

    // maxRetries (3) + the initial attempt, from one loop rather than two.
    expect(FakeRecognition.instances).toHaveLength(4);
  });

  it('retries a transient network error and reports it only once the budget is spent', async () => {
    const events: Array<{ type: string; error?: string }> = [];
    const service = new TranscriptionService();
    service.on((event) => events.push(event));

    service.start();
    latest().fireStart();

    const failWithNetwork = async () => {
      const recognition = latest();
      recognition.onerror?.({ error: 'network' });
      recognition.onend?.();
      await vi.advanceTimersByTimeAsync(MAX_BACKOFF_MS);
    };

    await failWithNetwork();
    expect(FakeRecognition.instances).toHaveLength(2);
    expect(latest().startCalls).toBe(1);
    expect(events.filter((e) => e.type === 'error')).toHaveLength(0);

    await failWithNetwork();
    await failWithNetwork();
    expect(FakeRecognition.instances).toHaveLength(4);

    await failWithNetwork();
    expect(FakeRecognition.instances).toHaveLength(4);
    expect(events.filter((e) => e.type === 'error')).toEqual([{ type: 'error', error: 'network' }]);
  });

  it('surfaces mic-unavailable errors immediately without retrying', () => {
    const events: Array<{ type: string; error?: string }> = [];
    const service = new TranscriptionService();
    service.on((event) => events.push(event));

    service.start();
    latest().onerror?.({ error: 'audio-capture' });

    expect(events).toContainEqual({ type: 'error', error: 'audio-capture' });
  });

  it('ignores no-speech and aborted without logging an error', () => {
    const events: Array<{ type: string }> = [];
    const service = new TranscriptionService();
    service.on((event) => events.push(event));

    service.start();
    latest().onerror?.({ error: 'no-speech' });
    latest().onerror?.({ error: 'aborted' });

    expect(events.filter((e) => e.type === 'error')).toHaveLength(0);
    expect(console.error).not.toHaveBeenCalled();
  });

  it('emits a user-facing message when the start retries are exhausted', async () => {
    FakeRecognition.onStartCall = () => {
      throw new Error('InvalidStateError');
    };

    const events: Array<{ type: string; error?: string }> = [];
    const service = new TranscriptionService();
    service.on((event) => events.push(event));

    service.start();
    await vi.advanceTimersByTimeAsync(MAX_BACKOFF_MS);

    expect(events).toContainEqual({ type: 'error', error: 'Failed to start speech recognition' });
    expect(events.some((e) => (e.error ?? '').includes('start_speech_recognition'))).toBe(false);
  });

  it('allows a fresh start() after stop()', () => {
    const service = new TranscriptionService();
    service.start();
    latest().fireStart();
    service.stop();

    service.start();
    latest().fireStart();

    expect(FakeRecognition.instances).toHaveLength(2);
    expect(latest().startCalls).toBe(1);
  });
});
