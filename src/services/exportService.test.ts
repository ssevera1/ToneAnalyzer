import { describe, it, expect } from 'vitest';
import {
  exportVoiceCSV,
  exportEmotionCSV,
  exportVoicePDF,
  exportEmotionPDF,
} from './exportService';
import type { StressReading, TranscriptSegment, VoiceSession } from '../types/audio';
import type { EmotionReading, EmotionSession } from '../types/emotion';

function reading(overrides: Partial<StressReading> = {}): StressReading {
  return {
    timestamp: 1_700_000_000_000,
    stressLevel: 42.5,
    deceitLevel: 12.25,
    frequency: 145.5,
    microtremorAmplitude: 0.0004,
    jitter: 1.2,
    shimmer: 3.4,
    hnr: 18.9,
    ...overrides,
  };
}

function segment(overrides: Partial<TranscriptSegment> = {}): TranscriptSegment {
  return {
    id: 'seg-1',
    text: 'hello there',
    startTime: 1_700_000_001_000,
    endTime: 1_700_000_003_000,
    isFinal: true,
    averageStress: 40,
    averageDeceit: 10,
    peakStress: 55,
    peakDeceit: 20,
    ...overrides,
  };
}

function voiceSession(overrides: Partial<VoiceSession> = {}): VoiceSession {
  return {
    name: 'Session 1',
    startTime: 1_700_000_000_000,
    endTime: 1_700_000_010_000,
    readings: [reading()],
    transcript: [],
    ...overrides,
  };
}

function emotionReading(overrides: Partial<EmotionReading> = {}): EmotionReading {
  return {
    timestamp: 1_700_000_000_000,
    faceId: 'face-0',
    emotions: {
      neutral: 0.6,
      happy: 0.2,
      sad: 0.05,
      angry: 0.05,
      fearful: 0.05,
      disgusted: 0.03,
      surprised: 0.02,
    },
    boundingBox: { x: 0, y: 0, width: 10, height: 10 },
    dominantEmotion: 'neutral',
    confidence: 0.9,
    ...overrides,
  };
}

function emotionSession(overrides: Partial<EmotionSession> = {}): EmotionSession {
  return {
    name: 'Monitor 1',
    startTime: 1_700_000_000_000,
    endTime: 1_700_000_010_000,
    readings: [emotionReading()],
    sourceCount: 1,
    transcript: [],
    ...overrides,
  };
}

describe('exportVoiceCSV validation', () => {
  it('exports a well-formed session', () => {
    const csv = exportVoiceCSV(voiceSession({ transcript: [segment()] }));
    expect(csv).toContain('42.5');
    expect(csv).toContain('hello there');
    expect(csv).not.toContain('NaN');
  });

  it('rejects a NaN metric instead of writing "NaN" into the CSV', () => {
    expect(() => exportVoiceCSV(voiceSession({ readings: [reading({ stressLevel: NaN })] })))
      .toThrow(/stressLevel/);
    expect(() => exportVoiceCSV(voiceSession({ readings: [reading({ jitter: NaN })] })))
      .toThrow(/jitter/);
    expect(() => exportVoiceCSV(voiceSession({ readings: [reading({ hnr: Infinity })] })))
      .toThrow(/hnr/);
  });

  it('rejects a NaN metric on a transcript segment', () => {
    expect(() =>
      exportVoiceCSV(voiceSession({ transcript: [segment({ averageStress: NaN })] }))
    ).toThrow(/averageStress/);
  });

  it('rejects an invalid timestamp', () => {
    expect(() => exportVoiceCSV(voiceSession({ readings: [reading({ timestamp: NaN })] })))
      .toThrow(/timestamp/);
  });

  it('allows a session with no readings', () => {
    expect(() => exportVoiceCSV(voiceSession({ readings: [] }))).not.toThrow();
  });

  it('allows startTime of 0 and an empty name', () => {
    expect(() => exportVoiceCSV(voiceSession({ startTime: 0 }))).not.toThrow();
    expect(() => exportVoiceCSV(voiceSession({ name: '' }))).not.toThrow();
  });

  it('allows a missing transcript but rejects a non-array one', () => {
    const noTranscript = voiceSession();
    delete (noTranscript as { transcript?: unknown }).transcript;
    expect(() => exportVoiceCSV(noTranscript)).not.toThrow();

    const badTranscript = voiceSession({
      transcript: 'nope' as unknown as TranscriptSegment[],
    });
    expect(() => exportVoiceCSV(badTranscript)).toThrow(/transcript is not an array/);
  });

  it('rejects a missing readings array', () => {
    const broken = voiceSession();
    delete (broken as { readings?: unknown }).readings;
    expect(() => exportVoiceCSV(broken)).toThrow(/readings array/);
  });
});

describe('exportEmotionCSV validation', () => {
  it('exports a well-formed session', () => {
    const csv = exportEmotionCSV(emotionSession({ transcript: [segment()] }));
    expect(csv).toContain('neutral');
    expect(csv).not.toContain('NaN');
  });

  it('rejects a NaN confidence', () => {
    expect(() =>
      exportEmotionCSV(emotionSession({ readings: [emotionReading({ confidence: NaN })] }))
    ).toThrow(/confidence/);
  });

  it('rejects an out-of-range confidence', () => {
    expect(() =>
      exportEmotionCSV(emotionSession({ readings: [emotionReading({ confidence: 1.5 })] }))
    ).toThrow(/confidence/);
  });

  it('allows a session with no readings', () => {
    expect(() => exportEmotionCSV(emotionSession({ readings: [] }))).not.toThrow();
  });

  it('allows startTime of 0 and an empty name', () => {
    expect(() => exportEmotionCSV(emotionSession({ startTime: 0 }))).not.toThrow();
    expect(() => exportEmotionCSV(emotionSession({ name: '' }))).not.toThrow();
  });
});

describe('PDF exports', () => {
  it('renders a header-only report for an empty voice session', () => {
    expect(() => exportVoicePDF(voiceSession({ readings: [] }))).not.toThrow();
  });

  it('renders a header-only report for an empty emotion session', () => {
    expect(() => exportEmotionPDF(emotionSession({ readings: [] }))).not.toThrow();
  });

  it('rejects NaN metrics before drawing', () => {
    expect(() => exportVoicePDF(voiceSession({ readings: [reading({ shimmer: NaN })] })))
      .toThrow(/shimmer/);
  });
});
