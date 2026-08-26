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

class RetryableError extends Error {
  constructor(
    message: string,
    readonly attempt: number,
    readonly totalAttempts: number,
    readonly error: string
  ) {
    super(message);
    this.name = 'RetryableError';
  }
}

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
  private retryAttempt = 0;
  private lastStartError: string | null = null;

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

  private async retryWithBackoff<T>(
    fn: () => Promise<T> | T,
    operationName: string
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.retryConfig.maxRetries; attempt++) {
      try {
        this.log('info', `${operationName} attempt ${attempt + 1}/${this.retryConfig.maxRetries + 1}`);
        const result = await Promise.resolve(fn());
        if (attempt > 0) {
          this.log('info', `${operationName} succeeded after ${attempt} retries`);
        }
        this.retryAttempt = 0;
        return result;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        const isLastAttempt = attempt === this.retryConfig.maxRetries;

        if (isLastAttempt) {
          this.log('error', `${operationName} failed after ${this.retryConfig.maxRetries} retries`, {
            error: lastError.message,
            stack: lastError.stack,
          });
          throw new RetryableError(
            `${operationName} failed after ${this.retryConfig.maxRetries} retries`,
            attempt + 1,
            this.retryConfig.maxRetries + 1,
            lastError.message
          );
        }

        const backoffDelay = this.calculateBackoffDelay(attempt);
        this.log('warn', `${operationName} attempt ${attempt + 1} failed, retrying in ${backoffDelay.toFixed(0)}ms`, {
          error: lastError.message,
          attempt: attempt + 1,
          backoffMs: Math.round(backoffDelay),
        });

        await new Promise((resolve) => setTimeout(resolve, backoffDelay));
      }
    }

    throw lastError || new Error(`${operationName} failed`);
  }

  start() {
    if (!this.isSupported || this.running) return;

    const SpeechRecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognitionCtor) return;

    this.retryWithBackoff(
      () => {
        const recognition = new SpeechRecognitionCtor();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        this.segmentStartTime = Date.now();

        recognition.onstart = () => {
          this.running = true;
          this.lastStartError = null;
          this.log('info', 'Speech recognition started');
          this.emit({ type: 'state-change', state: 'listening' });
        };

        recognition.onresult = (event: SpeechRecognitionEvent) => {
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
          this.log('error', 'Speech recognition error', { error: event.error });
          if (event.error !== 'no-speech' && event.error !== 'aborted') {
            this.lastStartError = event.error;
            this.emit({ type: 'error', error: event.error });
          }
        };

        recognition.onend = () => {
          if (this.shouldRestart) {
            this.log('info', 'Speech recognition ended, restarting');
            this.segmentStartTime = Date.now();
            try {
              recognition.start();
              return;
            } catch (error) {
              this.log('error', 'Failed to restart speech recognition', {
                error: error instanceof Error ? error.message : String(error),
              });
            }
          }
          this.running = false;
          this.log('info', 'Speech recognition stopped');
          this.emit({ type: 'state-change', state: 'stopped' });
        };

        this.recognition = recognition;
        this.shouldRestart = true;

        recognition.start();
      },
      'start_speech_recognition'
    ).catch((error) => {
      this.lastStartError = error instanceof Error ? error.message : String(error);
      this.log('error', 'Failed to start speech recognition after retries', {
        error: this.lastStartError,
      });
      this.emit({ type: 'error', error: this.lastStartError });
    });
  }

  stop() {
    this.shouldRestart = false;
    this.running = false;
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
  }

  destroy() {
    this.stop();
    this.listeners = [];
    this.log('info', 'TranscriptionService destroyed');
  }
}
