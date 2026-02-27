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

export class TranscriptionService {
  readonly isSupported: boolean;
  private recognition: SpeechRecognition | null = null;
  private listeners: TranscriptionListener[] = [];
  private running = false;
  private shouldRestart = false;
  private segmentStartTime = 0;

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

  start() {
    if (!this.isSupported || this.running) return;

    const SpeechRecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognitionCtor) return;

    const recognition = new SpeechRecognitionCtor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    this.segmentStartTime = Date.now();

    recognition.onstart = () => {
      this.running = true;
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
      if (event.error !== 'no-speech' && event.error !== 'aborted') {
        this.emit({ type: 'error', error: event.error });
      }
    };

    recognition.onend = () => {
      this.running = false;
      // Auto-restart: Chrome stops after ~60s of silence
      if (this.shouldRestart) {
        try {
          recognition.start();
        } catch {
          this.emit({ type: 'state-change', state: 'stopped' });
        }
      } else {
        this.emit({ type: 'state-change', state: 'stopped' });
      }
    };

    this.recognition = recognition;
    this.shouldRestart = true;

    try {
      recognition.start();
    } catch {
      this.emit({ type: 'error', error: 'Failed to start speech recognition' });
    }
  }

  stop() {
    this.shouldRestart = false;
    this.running = false;
    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch {
        // already stopped
      }
      this.recognition = null;
    }
  }

  destroy() {
    this.stop();
    this.listeners = [];
  }
}
