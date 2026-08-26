type TranscriptionEvent =
  | { type: 'segment'; text: string; startTime: number; endTime: number }
  | { type: 'interim'; text: string }
  | { type: 'error'; error: string }
  | { type: 'state-change'; state: 'listening' | 'stopped' };

type TranscriptionListener = (event: TranscriptionEvent) => void;

interface SpeechRecognitionEvent {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  isFinal: boolean;
  length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
}

interface SpeechRecognitionConstructor {
  new(): SpeechRecognition;
}

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

interface RetryConfig {
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
}

// Transient service-side failures worth retrying. 'not-allowed' and
// 'audio-capture' are deliberately excluded: they mean the mic is unavailable
// (permission denied, or another app holds it during a phone call) and
// consumers surface them immediately rather than waiting out a backoff.
const RETRYABLE_ERRORS = new Set(['network', 'service-not-allowed']);

const START_FAILED_MESSAGE = 'Failed to start speech recognition';

export class TranscriptionService {
  readonly isSupported: boolean;
  private recognition: SpeechRecognition | null = null;
  private listeners: TranscriptionListener[] = [];
  private running = false;
  private shouldRestart = false;
  private segmentStartTime = 0;
  private retryConfig: RetryConfig = {
    maxRetries: 3,
    initialDelayMs: 500,
    maxDelayMs: 5000,
    backoffMultiplier: 2,
  };
  // Bumped by stop() so a pending backoff timer, or an event handler bound to an
  // instance we've abandoned, can tell it belongs to a dead session and bail out
  // instead of re-opening the microphone after stop()/destroy().
  private generation = 0;
  // Set from start() until onstart fires or the retry budget runs out. Guards the
  // re-entrancy window that `running` alone can't cover, since `running` is only
  // true once the browser has actually started listening.
  private starting = false;
  private retryAttempt = 0;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingRetryError: string | null = null;

  constructor() {
    this.isSupported = !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  }

  on(listener: TranscriptionListener) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private emit(event: TranscriptionEvent) {
    this.listeners.forEach((l) => l(event));
  }

  private log(level: 'info' | 'warn' | 'error', message: string, context?: Record<string, unknown>) {
    const timestamp = new Date().toISOString();
    const contextStr = context ? ` ${JSON.stringify(context)}` : '';
    const logMessage = `[TranscriptionService] [${timestamp}] [${level.toUpperCase()}] ${message}${contextStr}`;

    if (level === 'error') {
      console.error(logMessage);
    } else if (level === 'warn') {
      console.warn(logMessage);
    } else {
      console.log(logMessage);
    }
  }

  private calculateBackoffDelay(attempt: number): number {
    const exponentialDelay = this.retryConfig.initialDelayMs * Math.pow(
      this.retryConfig.backoffMultiplier,
      attempt
    );
    const cappedDelay = Math.min(exponentialDelay, this.retryConfig.maxDelayMs);
    const jitter = Math.random() * 0.1 * cappedDelay;
    return cappedDelay + jitter;
  }

  start() {
    // `starting` covers the window between start() and onstart, including any
    // backoff gap, during which `running` is still false.
    if (!this.isSupported || this.running || this.starting) return;

    const SpeechRecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognitionCtor) return;

    this.starting = true;
    this.shouldRestart = true;
    this.retryAttempt = 0;
    this.pendingRetryError = null;
    this.launch(SpeechRecognitionCtor);
  }

  private launch(SpeechRecognitionCtor: SpeechRecognitionConstructor) {
    const generation = this.generation;
    const recognition = new SpeechRecognitionCtor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    this.segmentStartTime = Date.now();

    recognition.onstart = () => {
      if (generation !== this.generation) return;
      this.running = true;
      this.starting = false;
      this.retryAttempt = 0;
      this.pendingRetryError = null;
      this.log('info', 'Speech recognition started');
      this.emit({ type: 'state-change', state: 'listening' });
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      if (generation !== this.generation) return;
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const text = result[0].transcript.trim();
        if (!text) continue;

        if (result.isFinal) {
          this.emit({
            type: 'segment',
            text,
            startTime: this.segmentStartTime,
            endTime: Date.now(),
          });
          this.segmentStartTime = Date.now();
        } else {
          this.emit({ type: 'interim', text });
        }
      }
    };

    recognition.onerror = (event: { error: string }) => {
      if (generation !== this.generation) return;

      if (event.error === 'no-speech' || event.error === 'aborted') {
        // Chrome emits these routinely during silence and on stop(); they are
        // part of normal operation, not failures.
        this.log('info', 'Speech recognition idle event', { error: event.error });
        return;
      }

      if (this.shouldRestart && RETRYABLE_ERRORS.has(event.error)) {
        // Handled by onend, which always follows onerror; retrying there keeps
        // the mic closed until the backoff has elapsed.
        this.log('warn', 'Transient speech recognition error', { error: event.error });
        this.pendingRetryError = event.error;
        return;
      }

      this.log('error', 'Speech recognition error', { error: event.error });
      this.emit({ type: 'error', error: event.error });
    };

    recognition.onend = () => {
      if (generation !== this.generation) return;

      if (this.shouldRestart) {
        const retryError = this.pendingRetryError;
        if (retryError) {
          this.scheduleRetry(SpeechRecognitionCtor, retryError, retryError);
          return;
        }

        // Auto-restart: Chrome stops after ~60s of silence.
        // Keep this.running = true during the restart gap so a concurrent start()
        // call doesn't create a second recognition instance before onstart fires.
        this.log('info', 'Speech recognition ended, restarting');
        this.segmentStartTime = Date.now();
        try {
          recognition.start();
          return;
        } catch (error) {
          this.scheduleRetry(
            SpeechRecognitionCtor,
            error instanceof Error ? error.message : String(error),
            START_FAILED_MESSAGE
          );
          return;
        }
      }

      this.running = false;
      this.starting = false;
      this.log('info', 'Speech recognition stopped');
      this.emit({ type: 'state-change', state: 'stopped' });
    };

    this.recognition = recognition;

    try {
      recognition.start();
    } catch (error) {
      // A synchronous throw (InvalidStateError) means no onend will follow, so
      // the retry has to be scheduled from here.
      this.scheduleRetry(
        SpeechRecognitionCtor,
        error instanceof Error ? error.message : String(error),
        START_FAILED_MESSAGE
      );
    }
  }

  /**
   * Re-launch recognition after a backoff. `reason` is for logs; `emitAs` is the
   * error string handed to consumers if the retry budget is exhausted.
   */
  private scheduleRetry(
    SpeechRecognitionCtor: SpeechRecognitionConstructor,
    reason: string,
    emitAs: string
  ) {
    if (!this.shouldRestart) return;

    const attemptsMade = this.retryAttempt + 1;
    if (this.retryAttempt >= this.retryConfig.maxRetries) {
      this.log('error', `Speech recognition failed after ${attemptsMade} attempts`, { error: reason });
      this.shouldRestart = false;
      this.starting = false;
      this.running = false;
      this.pendingRetryError = null;
      this.recognition = null;
      this.emit({ type: 'error', error: emitAs });
      this.emit({ type: 'state-change', state: 'stopped' });
      return;
    }

    const backoffDelay = this.calculateBackoffDelay(this.retryAttempt);
    this.retryAttempt++;
    this.log(
      'warn',
      `Speech recognition attempt ${attemptsMade}/${this.retryConfig.maxRetries + 1} failed, retrying in ${backoffDelay.toFixed(0)}ms`,
      { error: reason, attempt: attemptsMade, backoffMs: Math.round(backoffDelay) }
    );

    // Hold `starting` across the gap so start() can't spawn a second instance,
    // and keep the last emitted state as-is rather than flapping stopped/listening.
    this.starting = true;
    this.running = false;
    this.recognition = null;

    const generation = this.generation;
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      if (generation !== this.generation || !this.shouldRestart) return;
      this.pendingRetryError = null;
      this.launch(SpeechRecognitionCtor);
    }, backoffDelay);
  }

  stop() {
    const wasActive = this.running || this.starting;

    this.shouldRestart = false;
    this.running = false;
    this.starting = false;
    this.retryAttempt = 0;
    this.pendingRetryError = null;

    // Invalidate pending backoff timers and any handler still bound to an
    // instance we're about to drop, so nothing re-opens the mic after this.
    this.generation++;
    if (this.retryTimer !== null) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }

    if (this.recognition) {
      try {
        this.recognition.stop();
        this.log('info', 'Speech recognition stopped by user');
      } catch (error) {
        this.log('warn', 'Error stopping speech recognition', {
          error: error instanceof Error ? error.message : String(error),
        });
      }
      this.recognition = null;
    }

    // The stopped instance's onend is now stale, so emit the transition here.
    if (wasActive) {
      this.emit({ type: 'state-change', state: 'stopped' });
    }
  }

  destroy() {
    this.stop();
    this.listeners = [];
    this.log('info', 'TranscriptionService destroyed');
  }
}
