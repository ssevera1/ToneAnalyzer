import type { Emotion, EmotionReading } from '../../types/emotion';

/**
 * Derived expression label with confidence and category.
 */
export interface ExpressionLabel {
  name: string;
  confidence: number;
  category: 'compound' | 'deception' | 'behavioral' | 'cognitive';
  color: string;
  description: string;
}

type Emotions = Record<Emotion, number>;

// ─── Helpers ────────────────────────────────────────────────────────

function inRange(v: number, lo: number, hi: number): boolean {
  return v >= lo && v <= hi;
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

// ─── Compound / Secondary Emotions (single-frame) ──────────────────

interface CompoundRule {
  name: string;
  color: string;
  description: string;
  test: (e: Emotions) => number; // returns 0-1 confidence
}

const COMPOUND_RULES: CompoundRule[] = [
  // ── Deception-adjacent ──
  {
    name: 'Contempt',
    color: '#f97316',
    description: 'Unilateral smirk; superiority / moral judgment',
    test: (e) => {
      if (inRange(e.happy, 0.12, 0.45) && inRange(e.angry, 0.08, 0.40) && e.neutral > 0.15)
        return clamp01((e.happy + e.angry) * 1.2);
      return 0;
    },
  },
  {
    name: 'Duping Delight',
    color: '#ef4444',
    description: 'Pleasure from successful deception; leaked smile',
    test: (e) => {
      if (inRange(e.happy, 0.15, 0.45) && (e.fearful > 0.08 || e.surprised > 0.08) && e.neutral > 0.15)
        return clamp01(e.happy * 0.8 + e.fearful * 0.5);
      return 0;
    },
  },
  {
    name: 'Smugness',
    color: '#f97316',
    description: 'Self-satisfied superiority; controlled smile',
    test: (e) => {
      if (inRange(e.happy, 0.20, 0.55) && inRange(e.angry, 0.03, 0.22) && e.neutral > 0.18)
        return clamp01(e.happy * 0.9);
      return 0;
    },
  },

  // ── Fear / Stress compounds ──
  {
    name: 'Apprehension',
    color: '#a855f7',
    description: 'Fear blended with resignation',
    test: (e) => {
      if (inRange(e.fearful, 0.20, 0.60) && inRange(e.sad, 0.12, 0.45))
        return clamp01((e.fearful + e.sad) * 0.8);
      return 0;
    },
  },
  {
    name: 'Anxiety',
    color: '#a855f7',
    description: 'Anticipatory dread; fearful with sadness undertone',
    test: (e) => {
      if (inRange(e.fearful, 0.25, 0.60) && inRange(e.sad, 0.08, 0.30) && e.surprised < 0.20)
        return clamp01(e.fearful * 0.9 + e.sad * 0.4);
      return 0;
    },
  },
  {
    name: 'Alarm',
    color: '#ef4444',
    description: 'Startle + fear response; high arousal',
    test: (e) => {
      if (inRange(e.fearful, 0.25, 0.65) && inRange(e.surprised, 0.20, 0.50))
        return clamp01((e.fearful + e.surprised) * 0.7);
      return 0;
    },
  },
  {
    name: 'Horror',
    color: '#ef4444',
    description: 'Revulsion combined with terror',
    test: (e) => {
      if (inRange(e.fearful, 0.30, 0.65) && inRange(e.disgusted, 0.15, 0.45))
        return clamp01((e.fearful + e.disgusted) * 0.7);
      return 0;
    },
  },

  // ── Anger compounds ──
  {
    name: 'Frustration',
    color: '#ef4444',
    description: 'Blocked goal; helpless anger',
    test: (e) => {
      if (inRange(e.angry, 0.25, 0.60) && inRange(e.sad, 0.12, 0.40))
        return clamp01((e.angry + e.sad) * 0.7);
      return 0;
    },
  },
  {
    name: 'Resentment',
    color: '#ef4444',
    description: 'Sustained grievance; anger + disgust + sadness',
    test: (e) => {
      if (inRange(e.angry, 0.20, 0.55) && inRange(e.disgusted, 0.10, 0.40) && e.sad > 0.08)
        return clamp01((e.angry + e.disgusted) * 0.6);
      return 0;
    },
  },
  {
    name: 'Hatred',
    color: '#dc2626',
    description: 'Deep hostile aversion',
    test: (e) => {
      if (e.angry > 0.35 && e.disgusted > 0.15)
        return clamp01((e.angry + e.disgusted) * 0.6);
      return 0;
    },
  },
  {
    name: 'Indignation',
    color: '#ef4444',
    description: 'Righteous anger at perceived injustice',
    test: (e) => {
      if (inRange(e.angry, 0.30, 0.65) && inRange(e.disgusted, 0.10, 0.40) && e.surprised > 0.03)
        return clamp01(e.angry * 0.8 + e.disgusted * 0.3);
      return 0;
    },
  },
  {
    name: 'Defiance',
    color: '#f97316',
    description: 'Challenging, confrontational expression',
    test: (e) => {
      if (inRange(e.angry, 0.25, 0.60) && inRange(e.happy, 0.08, 0.30) && e.disgusted < 0.20)
        return clamp01(e.angry * 0.7 + e.happy * 0.5);
      return 0;
    },
  },
  {
    name: 'Exasperation',
    color: '#f97316',
    description: '"I can\'t believe this" — frustrated disbelief',
    test: (e) => {
      if (inRange(e.angry, 0.20, 0.50) && inRange(e.disgusted, 0.08, 0.30) && e.surprised > 0.03)
        return clamp01((e.angry + e.disgusted + e.surprised) * 0.5);
      return 0;
    },
  },

  // ── Sadness compounds ──
  {
    name: 'Disappointment',
    color: '#3b82f6',
    description: 'Expected positive outcome did not occur',
    test: (e) => {
      if (inRange(e.sad, 0.30, 0.70) && inRange(e.surprised, 0.08, 0.35))
        return clamp01((e.sad + e.surprised) * 0.6);
      return 0;
    },
  },
  {
    name: 'Guilt',
    color: '#6366f1',
    description: 'Sadness predominant with apprehension',
    test: (e) => {
      if (inRange(e.sad, 0.25, 0.60) && inRange(e.fearful, 0.08, 0.35) && e.neutral > 0.10)
        return clamp01((e.sad * 0.8 + e.fearful * 0.4));
      return 0;
    },
  },
  {
    name: 'Shame',
    color: '#6366f1',
    description: 'Deeper than guilt; head lowered, withdrawal',
    test: (e) => {
      if (inRange(e.sad, 0.30, 0.65) && e.fearful > 0.03 && inRange(e.angry, 0.03, 0.18))
        return clamp01(e.sad * 0.9);
      return 0;
    },
  },
  {
    name: 'Resignation',
    color: '#3b82f6',
    description: 'Acceptance of negative outcome; giving up',
    test: (e) => {
      if (inRange(e.sad, 0.25, 0.60) && e.neutral > 0.20)
        return clamp01(e.sad * 0.7 + e.neutral * 0.2);
      return 0;
    },
  },
  {
    name: 'Nostalgia',
    color: '#8b5cf6',
    description: 'Wistful, warm melancholy',
    test: (e) => {
      if (inRange(e.happy, 0.15, 0.45) && inRange(e.sad, 0.15, 0.50))
        return clamp01((e.happy + e.sad) * 0.6);
      return 0;
    },
  },

  // ── Mixed positive ──
  {
    name: 'Awe',
    color: '#06b6d4',
    description: 'Overwhelmed wonder',
    test: (e) => {
      if (inRange(e.surprised, 0.25, 0.65) && inRange(e.fearful, 0.10, 0.45) && e.happy > 0.03)
        return clamp01((e.surprised + e.fearful) * 0.6);
      return 0;
    },
  },
  {
    name: 'Bittersweet',
    color: '#8b5cf6',
    description: 'Simultaneous joy and sorrow',
    test: (e) => {
      if (inRange(e.happy, 0.15, 0.50) && inRange(e.sad, 0.15, 0.50))
        return clamp01((e.happy + e.sad) * 0.55);
      return 0;
    },
  },
  {
    name: 'Relief',
    color: '#22c55e',
    description: 'Tension release; sigh of relief',
    test: (e) => {
      if (inRange(e.happy, 0.20, 0.55) && inRange(e.surprised, 0.08, 0.30) && e.neutral > 0.12)
        return clamp01(e.happy * 0.7 + e.surprised * 0.3);
      return 0;
    },
  },
  {
    name: 'Anticipation',
    color: '#eab308',
    description: 'Expectant excitement',
    test: (e) => {
      if (inRange(e.happy, 0.10, 0.40) && inRange(e.surprised, 0.10, 0.35) && e.fearful < 0.20)
        return clamp01((e.happy + e.surprised) * 0.6);
      return 0;
    },
  },
  {
    name: 'Adoration',
    color: '#ec4899',
    description: 'Tender warmth; soft affectionate gaze',
    test: (e) => {
      if (e.happy > 0.35 && e.sad < 0.12 && e.surprised < 0.18 && e.neutral < 0.30)
        return clamp01(e.happy * 0.85);
      return 0;
    },
  },
  {
    name: 'Schadenfreude',
    color: '#f97316',
    description: 'Pleasure at another\'s misfortune',
    test: (e) => {
      if (inRange(e.happy, 0.20, 0.55) && inRange(e.angry, 0.05, 0.22) && e.surprised > 0.03)
        return clamp01(e.happy * 0.6 + e.angry * 0.3);
      return 0;
    },
  },

  // ── Social / Evaluative ──
  {
    name: 'Embarrassment',
    color: '#ec4899',
    description: 'Gaze aversion, suppressed smile, head tilt',
    test: (e) => {
      if (inRange(e.happy, 0.08, 0.35) && inRange(e.fearful, 0.08, 0.35) && e.sad > 0.05 && e.neutral > 0.12)
        return clamp01((e.happy + e.fearful + e.sad) * 0.5);
      return 0;
    },
  },
  {
    name: 'Envy',
    color: '#84cc16',
    description: 'Hostile longing',
    test: (e) => {
      if (inRange(e.angry, 0.10, 0.40) && inRange(e.sad, 0.15, 0.45) && e.disgusted > 0.03)
        return clamp01((e.angry + e.sad) * 0.5);
      return 0;
    },
  },
  {
    name: 'Jealousy',
    color: '#84cc16',
    description: 'Threatened attachment; anger + fear of loss',
    test: (e) => {
      if (inRange(e.angry, 0.20, 0.55) && inRange(e.fearful, 0.10, 0.40) && e.sad > 0.05)
        return clamp01((e.angry + e.fearful) * 0.5);
      return 0;
    },
  },
  {
    name: 'Suspicion',
    color: '#f59e0b',
    description: 'Guarded evaluation; narrowed eyes',
    test: (e) => {
      if (inRange(e.angry, 0.08, 0.30) && e.disgusted > 0.03 && e.neutral > 0.25)
        return clamp01((e.angry + e.disgusted) * 0.6 + e.neutral * 0.1);
      return 0;
    },
  },
  {
    name: 'Skepticism',
    color: '#f59e0b',
    description: 'Evaluative doubt; raised brow',
    test: (e) => {
      if (inRange(e.disgusted, 0.08, 0.35) && e.surprised > 0.05 && e.neutral > 0.20)
        return clamp01((e.disgusted + e.surprised) * 0.5 + e.neutral * 0.1);
      return 0;
    },
  },
  {
    name: 'Confusion',
    color: '#f59e0b',
    description: 'Cognitive mismatch; furrowed brow',
    test: (e) => {
      if (inRange(e.surprised, 0.12, 0.45) && inRange(e.sad, 0.08, 0.30) && e.neutral > 0.15)
        return clamp01((e.surprised + e.sad) * 0.5);
      return 0;
    },
  },
  {
    name: 'Interest',
    color: '#06b6d4',
    description: 'Engaged attention; slightly raised brows',
    test: (e) => {
      if (inRange(e.surprised, 0.10, 0.40) && inRange(e.happy, 0.08, 0.30) && e.neutral > 0.20)
        return clamp01((e.surprised + e.happy) * 0.5);
      return 0;
    },
  },
  {
    name: 'Boredom',
    color: '#94a3b8',
    description: 'Disengagement; flat affect',
    test: (e) => {
      if (e.neutral > 0.50 && e.sad > 0.05 && e.sad < 0.25 && e.happy < 0.10)
        return clamp01(e.neutral * 0.5 + e.sad * 0.3);
      return 0;
    },
  },
  {
    name: 'Apathy',
    color: '#64748b',
    description: 'Emotional indifference; no engagement',
    test: (e) => {
      if (e.neutral > 0.60 && e.happy < 0.08 && e.sad < 0.10 && e.angry < 0.08 && e.fearful < 0.08)
        return clamp01(e.neutral * 0.7);
      return 0;
    },
  },
  {
    name: 'Determination',
    color: '#22c55e',
    description: 'Focused resolve; mild tension',
    test: (e) => {
      if (inRange(e.angry, 0.10, 0.40) && e.neutral > 0.25 && e.happy < 0.18)
        return clamp01(e.angry * 0.6 + e.neutral * 0.2);
      return 0;
    },
  },
  {
    name: 'Submission',
    color: '#94a3b8',
    description: 'Yielding; lowered gaze, passive posture',
    test: (e) => {
      if (inRange(e.fearful, 0.15, 0.45) && inRange(e.sad, 0.10, 0.35) && e.neutral > 0.15)
        return clamp01((e.fearful + e.sad) * 0.5);
      return 0;
    },
  },
  {
    name: 'Dominance',
    color: '#f97316',
    description: 'Assertive confidence; controlled expression',
    test: (e) => {
      if (inRange(e.angry, 0.10, 0.40) && inRange(e.happy, 0.08, 0.30) && e.neutral > 0.20)
        return clamp01((e.angry + e.happy) * 0.5);
      return 0;
    },
  },
  {
    name: 'Pity',
    color: '#3b82f6',
    description: 'Compassionate sorrow for another',
    test: (e) => {
      if (inRange(e.sad, 0.25, 0.55) && e.happy > 0.03 && e.happy < 0.18)
        return clamp01(e.sad * 0.6 + e.happy * 0.3);
      return 0;
    },
  },
];

// ─── Temporal / Behavioral Indicators ───────────────────────────────

const READING_HISTORY_WINDOW = 30; // frames (~3s at 10fps)

interface TemporalIndicator {
  name: string;
  color: string;
  description: string;
  category: 'deception' | 'behavioral' | 'cognitive';
  test: (history: EmotionReading[]) => number;
}

const TEMPORAL_INDICATORS: TemporalIndicator[] = [
  // ── Deception indicators ──
  {
    name: 'Emotion Masking',
    color: '#ef4444',
    description: 'Brief true emotion leaked under fabricated display',
    category: 'deception',
    test: (history) => {
      if (history.length < 6) return 0;
      const recent = history.slice(-10);
      let flickers = 0;
      for (let i = 2; i < recent.length; i++) {
        const prev = recent[i - 2].dominantEmotion;
        const curr = recent[i - 1].dominantEmotion;
        const next = recent[i].dominantEmotion;
        if (prev === next && curr !== prev) flickers++;
      }
      return clamp01(flickers * 0.35);
    },
  },
  {
    name: 'Emotional Incongruence',
    color: '#ef4444',
    description: 'Smile with leaked negative affect underneath',
    category: 'deception',
    test: (history) => {
      if (history.length < 2) return 0;
      const last = history[history.length - 1];
      const e = last.emotions;
      if (e.happy > 0.25 && (e.fearful > 0.10 || e.disgusted > 0.10 || e.angry > 0.10))
        return clamp01(e.happy * 0.5 + Math.max(e.fearful, e.disgusted, e.angry) * 0.8);
      return 0;
    },
  },
  {
    name: 'Squelched Expression',
    color: '#ef4444',
    description: 'Expression started then was actively suppressed',
    category: 'deception',
    test: (history) => {
      if (history.length < 4) return 0;
      const recent = history.slice(-5);
      for (let i = 1; i < recent.length - 1; i++) {
        const prev = recent[i - 1].confidence;
        const curr = recent[i].confidence;
        const next = recent[i + 1].confidence;
        if (curr > prev + 0.15 && next < curr - 0.20) return clamp01((curr - next) * 2);
      }
      return 0;
    },
  },
  {
    name: 'Expression Freeze',
    color: '#f97316',
    description: 'Unnaturally sustained neutral; cognitive suppression',
    category: 'deception',
    test: (history) => {
      if (history.length < 8) return 0;
      const recent = history.slice(-10);
      const allNeutral = recent.every(
        (r) => r.dominantEmotion === 'neutral' && r.emotions.neutral > 0.70
      );
      return allNeutral ? 0.75 : 0;
    },
  },
  {
    name: 'Held Expression',
    color: '#f97316',
    description: 'Expression held >4s without natural fluctuation — possible fabrication',
    category: 'deception',
    test: (history) => {
      if (history.length < 12) return 0;
      const recent = history.slice(-15);
      const first = recent[0].dominantEmotion;
      if (first === 'neutral') return 0;
      const allSame = recent.every(
        (r) => r.dominantEmotion === first && r.confidence > 0.60
      );
      if (!allSame) return 0;
      const confidences = recent.map((r) => r.confidence);
      const mean = confidences.reduce((a, b) => a + b, 0) / confidences.length;
      const variance = confidences.reduce((s, c) => s + (c - mean) ** 2, 0) / confidences.length;
      return variance < 0.005 ? 0.7 : 0;
    },
  },
  {
    name: 'Rapid Onset',
    color: '#f59e0b',
    description: 'Sudden expression jump — possible deliberate production',
    category: 'deception',
    test: (history) => {
      if (history.length < 3) return 0;
      const prev = history[history.length - 2];
      const curr = history[history.length - 1];
      if (prev.dominantEmotion !== curr.dominantEmotion) {
        const jump = curr.confidence - (prev.emotions[curr.dominantEmotion] || 0);
        if (jump > 0.50) return clamp01(jump);
      }
      return 0;
    },
  },

  // ── Cognitive / stress indicators ──
  {
    name: 'Emotional Volatility',
    color: '#a855f7',
    description: 'Rapid emotional fluctuation; internal conflict',
    category: 'cognitive',
    test: (history) => {
      if (history.length < 6) return 0;
      const recent = history.slice(-8);
      let changes = 0;
      for (let i = 1; i < recent.length; i++) {
        if (recent[i].dominantEmotion !== recent[i - 1].dominantEmotion) changes++;
      }
      return clamp01(changes / recent.length);
    },
  },
  {
    name: 'Elevated Stress',
    color: '#ef4444',
    description: 'Sustained negative emotional shift from baseline',
    category: 'behavioral',
    test: (history) => {
      if (history.length < 10) return 0;
      const recent = history.slice(-10);
      const negAvg =
        recent.reduce((s, r) => s + r.emotions.fearful + r.emotions.angry + r.emotions.sad, 0) /
        (recent.length * 3);
      return clamp01(negAvg * 3);
    },
  },
  {
    name: 'Expression Dampening',
    color: '#94a3b8',
    description: 'All emotions low; intentional suppression or numbing',
    category: 'cognitive',
    test: (history) => {
      if (history.length < 3) return 0;
      const last = history[history.length - 1];
      const maxEmotion = Math.max(...Object.values(last.emotions));
      return maxEmotion < 0.30 ? clamp01(1 - maxEmotion * 3) : 0;
    },
  },
  {
    name: 'Arousal Spike',
    color: '#ef4444',
    description: 'Sudden high fear+surprise; startle response',
    category: 'behavioral',
    test: (history) => {
      if (history.length < 3) return 0;
      const last = history[history.length - 1];
      const prev = history[history.length - 3];
      const currArousal = last.emotions.fearful + last.emotions.surprised;
      const prevArousal = prev.emotions.fearful + prev.emotions.surprised;
      if (currArousal > 0.45 && currArousal - prevArousal > 0.25)
        return clamp01(currArousal);
      return 0;
    },
  },
  {
    name: 'Sustained Tension',
    color: '#f97316',
    description: 'Chronic low-level anger; jaw clenching, suppressed hostility',
    category: 'behavioral',
    test: (history) => {
      if (history.length < 10) return 0;
      const recent = history.slice(-12);
      const avgAngry = recent.reduce((s, r) => s + r.emotions.angry, 0) / recent.length;
      if (avgAngry > 0.12 && avgAngry < 0.45) return clamp01(avgAngry * 2.5);
      return 0;
    },
  },

  // ── Comfort / rapport indicators ──
  {
    name: 'Baseline Comfort',
    color: '#22c55e',
    description: 'Relaxed and at ease; natural resting state',
    category: 'behavioral',
    test: (history) => {
      if (history.length < 5) return 0;
      const recent = history.slice(-8);
      const avgNeutral = recent.reduce((s, r) => s + r.emotions.neutral, 0) / recent.length;
      const avgHappy = recent.reduce((s, r) => s + r.emotions.happy, 0) / recent.length;
      if (avgNeutral > 0.35 && avgHappy > 0.08 && avgHappy < 0.35)
        return clamp01(avgNeutral * 0.5 + avgHappy * 0.8);
      return 0;
    },
  },
  {
    name: 'Genuine Engagement',
    color: '#22c55e',
    description: 'Active interested participation with natural fluctuation',
    category: 'behavioral',
    test: (history) => {
      if (history.length < 5) return 0;
      const recent = history.slice(-8);
      const avgPositive =
        recent.reduce((s, r) => s + r.emotions.happy + r.emotions.surprised, 0) /
        (recent.length * 2);
      if (avgPositive > 0.15) return clamp01(avgPositive * 2);
      return 0;
    },
  },
];

// ─── Valence-Arousal-Dominance ──────────────────────────────────────

export interface VADScores {
  valence: number;  // -1 to +1 (negative to positive)
  arousal: number;  // -1 to +1 (calm to excited)
  dominance: number; // -1 to +1 (submissive to dominant)
}

export function computeVAD(e: Emotions): VADScores {
  const valence = clamp(
    e.happy * 1.0 + e.surprised * 0.1 - e.sad * 0.8 - e.angry * 0.7 - e.fearful * 0.6 - e.disgusted * 0.9,
    -1, 1
  );
  const arousal = clamp(
    e.angry * 0.9 + e.fearful * 0.8 + e.surprised * 0.9 + e.happy * 0.3 - e.neutral * 0.5 - e.sad * 0.1,
    -1, 1
  );
  const dominance = clamp(
    e.angry * 0.8 + e.happy * 0.3 + e.disgusted * 0.4 - e.fearful * 0.9 - e.sad * 0.7 - e.surprised * 0.3,
    -1, 1
  );
  return { valence, arousal, dominance };
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

// ─── Prime Emotion (60s window) ─────────────────────────────────────

export interface PrimeEmotion {
  emotion: Emotion;
  percentage: number;
  icon: string;
  color: string;
  secondsTracked: number;
}

const PRIME_EMOTION_WINDOW_MS = 60_000; // 60 seconds
const PRIME_EMOTION_UPDATE_INTERVAL_MS = 15_000; // recalculate every 15s

const EMOTION_DISPLAY: Record<Emotion, { icon: string; color: string }> = {
  neutral:   { icon: '😐', color: '#94a3b8' },
  happy:     { icon: '😊', color: '#22c55e' },
  sad:       { icon: '😢', color: '#3b82f6' },
  angry:     { icon: '😠', color: '#ef4444' },
  fearful:   { icon: '😨', color: '#a855f7' },
  disgusted: { icon: '🤢', color: '#f97316' },
  surprised: { icon: '😲', color: '#eab308' },
};

interface TimestampedEmotion {
  timestamp: number;
  emotion: Emotion;
}

// ─── Main Analyzer ──────────────────────────────────────────────────

export class ExpressionAnalyzer {
  private historyBySource = new Map<string, EmotionReading[]>();
  private emotionLog = new Map<string, TimestampedEmotion[]>();
  private primeCache = new Map<string, { result: PrimeEmotion; computedAt: number }>();

  /**
   * Analyze a single frame's emotions + recent history to produce derived labels.
   * Returns the top labels sorted by confidence, filtered above threshold.
   */
  analyze(sourceId: string, readings: EmotionReading[]): ExpressionLabel[] {
    if (readings.length === 0) return [];

    // Update history
    let history = this.historyBySource.get(sourceId) || [];
    history = [...history, ...readings].slice(-READING_HISTORY_WINDOW);
    this.historyBySource.set(sourceId, history);

    // Feed the 60-second emotion log for prime emotion tracking
    const now = Date.now();
    let log = this.emotionLog.get(sourceId) || [];
    for (const r of readings) {
      log.push({ timestamp: r.timestamp, emotion: r.dominantEmotion });
    }
    // Trim to 60-second window
    const cutoff = now - PRIME_EMOTION_WINDOW_MS;
    log = log.filter((e) => e.timestamp >= cutoff);
    this.emotionLog.set(sourceId, log);

    const labels: ExpressionLabel[] = [];

    // Test every face in the current frame
    for (const reading of readings) {
      const e = reading.emotions;

      // Single-frame compound emotions
      for (const rule of COMPOUND_RULES) {
        const confidence = rule.test(e);
        if (confidence > 0.15) {
          // Only add if we don't already have this label (from another face) with higher confidence
          const existing = labels.find((l) => l.name === rule.name);
          if (!existing || existing.confidence < confidence) {
            if (existing) labels.splice(labels.indexOf(existing), 1);
            labels.push({
              name: rule.name,
              confidence,
              category: 'compound',
              color: rule.color,
              description: rule.description,
            });
          }
        }
      }
    }

    // Temporal/behavioral indicators (use full history)
    for (const indicator of TEMPORAL_INDICATORS) {
      const confidence = indicator.test(history);
      if (confidence > 0.20) {
        labels.push({
          name: indicator.name,
          confidence,
          category: indicator.category,
          color: indicator.color,
          description: indicator.description,
        });
      }
    }

    // Sort by confidence descending, take top results
    labels.sort((a, b) => b.confidence - a.confidence);
    return labels.slice(0, 8);
  }

  /**
   * Get the prime (most frequent dominant) emotion over the past 60 seconds.
   * Cached and recalculated every 15 seconds for performance.
   */
  getPrimeEmotion(sourceId: string): PrimeEmotion | null {
    const now = Date.now();
    const cached = this.primeCache.get(sourceId);
    if (cached && now - cached.computedAt < PRIME_EMOTION_UPDATE_INTERVAL_MS) {
      return cached.result;
    }

    const log = this.emotionLog.get(sourceId);
    if (!log || log.length === 0) return null;

    // Filter to last 60 seconds
    const cutoff = now - PRIME_EMOTION_WINDOW_MS;
    const recent = log.filter((e) => e.timestamp >= cutoff);
    if (recent.length === 0) return null;

    // Count occurrences of each dominant emotion
    const counts: Record<string, number> = {};
    for (const entry of recent) {
      counts[entry.emotion] = (counts[entry.emotion] || 0) + 1;
    }

    // Find the most frequent
    let topEmotion: Emotion = 'neutral';
    let topCount = 0;
    for (const [emotion, count] of Object.entries(counts)) {
      if (count > topCount) {
        topCount = count;
        topEmotion = emotion as Emotion;
      }
    }

    const percentage = (topCount / recent.length) * 100;
    const display = EMOTION_DISPLAY[topEmotion];
    const secondsTracked = Math.min(60, (now - recent[0].timestamp) / 1000);

    const result: PrimeEmotion = {
      emotion: topEmotion,
      percentage,
      icon: display.icon,
      color: display.color,
      secondsTracked: Math.round(secondsTracked),
    };

    this.primeCache.set(sourceId, { result, computedAt: now });
    return result;
  }

  clearHistory(sourceId: string) {
    this.historyBySource.delete(sourceId);
    this.emotionLog.delete(sourceId);
    this.primeCache.delete(sourceId);
  }

  clearAllHistory() {
    this.historyBySource.clear();
    this.emotionLog.clear();
    this.primeCache.clear();
  }
}
