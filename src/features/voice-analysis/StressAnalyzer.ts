import type { StressMetrics } from '../../types/audio';

const PITCH_HISTORY_SIZE = 100;
const AMPLITUDE_HISTORY_SIZE = 100;
const SILENCE_THRESHOLD_FRAMES = 30; // ~0.5s at 60fps
const VOICE_ACTIVITY_HISTORY_SIZE = 180; // ~3s at 60fps
const BASELINE_WARMUP_FRAMES = 60;
const BASELINE_EMA_ALPHA = 0.005; // slow adaptation for F0 baseline

// Calibrated normalization ceilings for each metric (determined from
// synthetic speech signals spanning relaxed → highly stressed).
const CALIBRATION = {
  /** Normalized envelope autocorrelation — relaxed voice ≈ 0.25-0.50, stressed ≈ 0.0-0.08 */
  microtremorCeiling: 0.40,
  /** F0 variance in Hz² — relaxed ≈ 20-80, stressed ≈ 800-3000+ */
  f0VarCeiling: 2000,
  /** Jitter % — normal < 1%, stressed > 5% */
  jitterCeiling: 8,
  /** Shimmer % — normal < 3%, stressed > 10% */
  shimmerCeiling: 15,
  /** HNR dB — clean voice 20-30 dB, stressed/noisy 5-15 dB */
  hnrCeiling: 25,
};

export class StressAnalyzer {
  private pitchHistory: number[] = [];
  private amplitudeHistory: number[] = [];
  private sampleRate = 44100;
  private silentFrames = 0;

  /** Exponentially-smoothed stress score for display stability */
  private smoothedScore = 0;
  private hasSmoothedScore = false;
  private readonly scoreSmoothingAlpha = 0.15;

  /** Deceit detection state */
  private voiceActivityHistory: boolean[] = [];
  private smoothedDeceitScore = 0;
  private hasSmoothedDeceit = false;
  private baselineF0 = 0;
  private baselineF0Count = 0;
  private readonly deceitSmoothingAlpha = 0.12;

  setSampleRate(rate: number) {
    if (!Number.isFinite(rate) || rate <= 0) {
      throw new RangeError(`Sample rate must be a positive finite number, got ${rate}`);
    }
    this.sampleRate = rate;
  }

  analyze(frequencyData: Float32Array, timeDomainData: Float32Array): StressMetrics {
    const rms = this.calculateRMS(timeDomainData);
    const f0 = this.calculateF0(timeDomainData);
    const hasVoice = f0 > 0 && rms > 0.008;

    let microtremorAmplitude: number;
    let hnr: number;

    if (hasVoice) {
      this.silentFrames = 0;
      microtremorAmplitude = this.analyzeMicrotremors(timeDomainData);
      hnr = this.calculateHNR(timeDomainData);

      this.pitchHistory.push(f0);
      if (this.pitchHistory.length > PITCH_HISTORY_SIZE) this.pitchHistory.shift();
      this.amplitudeHistory.push(rms);
      if (this.amplitudeHistory.length > AMPLITUDE_HISTORY_SIZE) this.amplitudeHistory.shift();
    } else {
      this.silentFrames++;
      microtremorAmplitude = 0;
      hnr = 0;

      // Drain history during silence so the score decays
      if (this.silentFrames > SILENCE_THRESHOLD_FRAMES) {
        for (let i = 0; i < 2; i++) {
          if (this.pitchHistory.length > 0) this.pitchHistory.shift();
          if (this.amplitudeHistory.length > 0) this.amplitudeHistory.shift();
        }
      }
    }

    const f0Variance = this.calculateVariance(this.pitchHistory);
    const jitter = this.calculateJitter(this.pitchHistory);
    const shimmer = this.calculateShimmer(this.amplitudeHistory);

    // For score: use neutral values for inverted metrics when no voice detected
    const rawScore = this.computeStressScore({
      microtremorAmplitude: hasVoice ? microtremorAmplitude : CALIBRATION.microtremorCeiling * 0.5,
      f0,
      f0Variance,
      jitter,
      shimmer,
      hnr: hasVoice ? hnr : CALIBRATION.hnrCeiling,
      stressScore: 0,
      deceitScore: 0,
      hesitationRatio: 0,
    });

    // Smooth the score to avoid jitter in the gauge.
    // Seed with first value to avoid cold-start bias toward zero.
    if (!this.hasSmoothedScore) {
      this.smoothedScore = rawScore;
      this.hasSmoothedScore = true;
    } else {
      this.smoothedScore = this.smoothedScore * (1 - this.scoreSmoothingAlpha)
                         + rawScore * this.scoreSmoothingAlpha;
    }
    const stressScore = Math.round(this.smoothedScore);

    // --- Deceit detection ---
    // Track voice activity
    this.voiceActivityHistory.push(hasVoice);
    if (this.voiceActivityHistory.length > VOICE_ACTIVITY_HISTORY_SIZE) {
      this.voiceActivityHistory.shift();
    }

    // Update F0 baseline (slow EMA after warmup)
    if (hasVoice && f0 > 0) {
      this.baselineF0Count++;
      if (this.baselineF0Count <= BASELINE_WARMUP_FRAMES) {
        // During warmup: running average
        this.baselineF0 += (f0 - this.baselineF0) / this.baselineF0Count;
      } else {
        // After warmup: slow EMA
        this.baselineF0 = this.baselineF0 * (1 - BASELINE_EMA_ALPHA) + f0 * BASELINE_EMA_ALPHA;
      }
    }

    const hesitationRatio = this.calculateHesitationRatio();
    const rawDeceit = this.computeDeceitScore({
      microtremorAmplitude: hasVoice ? microtremorAmplitude : CALIBRATION.microtremorCeiling * 0.5,
      f0,
      f0Variance,
      jitter,
      shimmer,
      hnr: hasVoice ? hnr : CALIBRATION.hnrCeiling,
      stressScore: 0,
      deceitScore: 0,
      hesitationRatio,
    });

    if (!this.hasSmoothedDeceit) {
      this.smoothedDeceitScore = rawDeceit;
      this.hasSmoothedDeceit = true;
    } else {
      this.smoothedDeceitScore = this.smoothedDeceitScore * (1 - this.deceitSmoothingAlpha)
                                + rawDeceit * this.deceitSmoothingAlpha;
    }
    const deceitScore = Math.round(this.smoothedDeceitScore);

    return { microtremorAmplitude, f0, f0Variance, jitter, shimmer, hnr, stressScore, deceitScore, hesitationRatio };
  }

  /**
   * Proportion of silent (no voice) frames in the recent activity window.
   * High hesitation ratio suggests cognitive processing / deception.
   */
  calculateHesitationRatio(): number {
    if (this.voiceActivityHistory.length === 0) return 0;
    const silentCount = this.voiceActivityHistory.filter((v) => !v).length;
    return silentCount / this.voiceActivityHistory.length;
  }

  /**
   * Compute deceit score (0-100) from acoustic features.
   * Weighted composite:
   *   F0 elevation above baseline: 20%
   *   F0 variance: 15%
   *   Microtremor suppression: 20%
   *   Jitter: 15%
   *   Shimmer: 10%
   *   Lower HNR: 10%
   *   Hesitation ratio: 10%
   */
  computeDeceitScore(metrics: StressMetrics): number {
    // F0 elevation: pitch rises under cognitive load
    let f0ElevationNorm = 0;
    if (this.baselineF0 > 0 && metrics.f0 > 0) {
      const elevation = (metrics.f0 - this.baselineF0) / this.baselineF0;
      // 0% = no elevation, 30%+ = maximum score
      f0ElevationNorm = Math.min(1, Math.max(0, elevation) / 0.30);
    }

    // F0 variance: increased variability under deception
    const f0VarNorm = Math.min(1, Math.max(0, metrics.f0Variance) / CALIBRATION.f0VarCeiling);

    // Microtremor suppression: cognitive load suppresses natural tremors
    const microtremorNorm = Math.max(0, 1 - Math.min(1, Math.max(0, metrics.microtremorAmplitude) / CALIBRATION.microtremorCeiling));

    // Jitter: vocal cord tension
    const jitterNorm = Math.min(1, Math.max(0, metrics.jitter) / CALIBRATION.jitterCeiling);

    // Shimmer: amplitude instability
    const shimmerNorm = Math.min(1, Math.max(0, metrics.shimmer) / CALIBRATION.shimmerCeiling);

    // HNR: breathiness from tension (lower = more deceptive)
    const hnrNorm = Math.max(0, 1 - Math.min(1, Math.max(0, metrics.hnr) / CALIBRATION.hnrCeiling));

    // Hesitation: silence gaps = cognitive processing
    const hesitationNorm = Math.min(1, Math.max(0, metrics.hesitationRatio));

    const score =
      f0ElevationNorm * 20 +
      f0VarNorm * 15 +
      microtremorNorm * 20 +
      jitterNorm * 15 +
      shimmerNorm * 10 +
      hnrNorm * 10 +
      hesitationNorm * 10;

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Detect microtremors in the 8-14 Hz band.
   * Stress suppresses muscle microtremors, so diminished amplitude = higher stress.
   *
   * Returns a gain-independent normalized value:
   *   ~0.0        — no modulation / suppressed (high stress)
   *   ~0.2-0.5    — healthy microtremor activity (relaxed)
   */
  analyzeMicrotremors(timeDomainData: Float32Array): number {
    if (timeDomainData.length < 256) return 0;

    // Compute the envelope of the signal
    const len = timeDomainData.length;
    const envelope = new Float32Array(len);
    for (let i = 0; i < len; i++) {
      envelope[i] = Math.abs(timeDomainData[i]);
    }

    // Simple low-pass to get amplitude modulation
    const smoothed = new Float32Array(len);
    const alpha = 0.05;
    smoothed[0] = envelope[0];
    for (let i = 1; i < len; i++) {
      smoothed[i] = alpha * envelope[i] + (1 - alpha) * smoothed[i - 1];
    }

    // Compute envelope energy for normalization (makes result gain-independent)
    let envelopeEnergy = 0;
    for (let i = 0; i < len; i++) {
      envelopeEnergy += smoothed[i] * smoothed[i];
    }
    envelopeEnergy /= len;
    if (envelopeEnergy < 1e-10) return 0;

    // Measure energy in the 8-14 Hz modulation band via autocorrelation of envelope
    const minLag = Math.max(1, Math.floor(this.sampleRate / 14)); // 14 Hz
    const maxLag = Math.floor(this.sampleRate / 8);  // 8 Hz

    // Buffer too short for the lag range — return zero
    if (minLag > len / 2) return 0;

    let maxCorr = 0;

    for (let lag = minLag; lag <= Math.min(maxLag, Math.floor(len / 2)); lag++) {
      let corr = 0;
      const count = len - lag;
      for (let i = 0; i < count; i++) {
        corr += smoothed[i] * smoothed[i + lag];
      }
      corr /= count;
      maxCorr = Math.max(maxCorr, corr);
    }

    // Normalize: ratio of 8-14 Hz autocorrelation peak to overall envelope energy
    return Math.min(1, maxCorr / envelopeEnergy);
  }

  /**
   * Autocorrelation-based fundamental frequency (F0) detection.
   */
  calculateF0(timeDomainData: Float32Array): number {
    if (timeDomainData.length < 512) return 0;

    const size = timeDomainData.length;
    const minPeriod = Math.max(1, Math.floor(this.sampleRate / 500)); // 500 Hz max
    const maxPeriod = Math.floor(this.sampleRate / 50);  // 50 Hz min

    // Check if signal has enough energy
    const rms = this.calculateRMS(timeDomainData);
    if (rms < 0.01) return 0;

    let bestCorrelation = 0;
    let bestPeriod = 0;

    for (let period = minPeriod; period <= Math.min(maxPeriod, size / 2); period++) {
      let correlation = 0;
      let norm1 = 0;
      let norm2 = 0;

      for (let i = 0; i < size - period; i++) {
        correlation += timeDomainData[i] * timeDomainData[i + period];
        norm1 += timeDomainData[i] * timeDomainData[i];
        norm2 += timeDomainData[i + period] * timeDomainData[i + period];
      }

      const normalizer = Math.sqrt(norm1 * norm2);
      if (normalizer > 0) {
        correlation /= normalizer;
      }

      if (correlation > bestCorrelation) {
        bestCorrelation = correlation;
        bestPeriod = period;
      }
    }

    if (bestCorrelation < 0.3 || bestPeriod === 0) return 0;
    return this.sampleRate / bestPeriod;
  }

  /**
   * Jitter: cycle-to-cycle pitch perturbation (%).
   */
  calculateJitter(pitchHistory: number[]): number {
    if (pitchHistory.length < 3) return 0;

    const periods = pitchHistory.filter((f) => f > 0).map((f) => 1 / f);
    if (periods.length < 3) return 0;

    let sumDiff = 0;

    for (let i = 1; i < periods.length; i++) {
      sumDiff += Math.abs(periods[i] - periods[i - 1]);
    }

    const avgPeriod = periods.reduce((a, b) => a + b, 0) / periods.length;
    if (avgPeriod === 0) return 0;

    return (sumDiff / (periods.length - 1)) / avgPeriod * 100;
  }

  /**
   * Shimmer: cycle-to-cycle amplitude perturbation (%).
   */
  calculateShimmer(amplitudeHistory: number[]): number {
    if (amplitudeHistory.length < 3) return 0;

    let sumDiff = 0;

    for (let i = 1; i < amplitudeHistory.length; i++) {
      sumDiff += Math.abs(amplitudeHistory[i] - amplitudeHistory[i - 1]);
    }

    const avgAmp = amplitudeHistory.reduce((a, b) => a + b, 0) / amplitudeHistory.length;
    if (avgAmp < 1e-10) return 0;

    return (sumDiff / (amplitudeHistory.length - 1)) / avgAmp * 100;
  }

  /**
   * Harmonic-to-Noise Ratio via autocorrelation.
   */
  calculateHNR(signal: Float32Array): number {
    if (signal.length < 256) return 0;

    const rms = this.calculateRMS(signal);
    if (rms < 0.01) return 0;

    // Find peak autocorrelation (excluding lag=0)
    const minLag = Math.max(1, Math.floor(this.sampleRate / 500));
    const maxLag = Math.floor(this.sampleRate / 50);
    let peakCorr = 0;

    for (let lag = minLag; lag <= Math.min(maxLag, signal.length / 2); lag++) {
      let corr = 0;
      for (let i = 0; i < signal.length - lag; i++) {
        corr += signal[i] * signal[i + lag];
      }
      corr /= signal.length - lag;
      peakCorr = Math.max(peakCorr, corr);
    }

    const energy = rms * rms;
    if (energy === 0 || peakCorr <= 0) return 0;

    const harmonicEnergy = peakCorr;
    const noiseEnergy = energy - harmonicEnergy;

    if (noiseEnergy <= 0) return 30; // cap at 30 dB
    const hnrDb = 10 * Math.log10(harmonicEnergy / noiseEnergy);
    return Math.max(0, Math.min(30, hnrDb));
  }

  /**
   * Compute composite stress score (0-100).
   * Weights: microtremor (30%), F0 variance (25%), jitter (20%), shimmer (15%), HNR (10%)
   *
   * Normalization ceilings are drawn from CALIBRATION constants tuned against
   * synthetic speech ranging from relaxed baseline to highly stressed.
   */
  computeStressScore(metrics: StressMetrics): number {
    // Normalize each metric to 0-1 range (clamped to prevent negative inputs
    // from pushing normalized values outside [0, 1]).

    // Microtremor: lower = more stress (inverted).
    // Gain-normalized value: relaxed ≈ 0.25-0.50, stressed ≈ 0.0-0.08
    const microtremorNorm = Math.max(0, 1 - Math.min(1, Math.max(0, metrics.microtremorAmplitude) / CALIBRATION.microtremorCeiling));

    // F0 variance: higher = more stress
    const f0VarNorm = Math.min(1, Math.max(0, metrics.f0Variance) / CALIBRATION.f0VarCeiling);

    // Jitter: higher = more stress (normal < 1%, stressed > 5%)
    const jitterNorm = Math.min(1, Math.max(0, metrics.jitter) / CALIBRATION.jitterCeiling);

    // Shimmer: higher = more stress (normal < 3%, stressed > 10%)
    const shimmerNorm = Math.min(1, Math.max(0, metrics.shimmer) / CALIBRATION.shimmerCeiling);

    // HNR: lower = more stress (inverted, normal > 20dB)
    const hnrNorm = Math.max(0, 1 - Math.min(1, Math.max(0, metrics.hnr) / CALIBRATION.hnrCeiling));

    const score =
      microtremorNorm * 30 +
      f0VarNorm * 25 +
      jitterNorm * 20 +
      shimmerNorm * 15 +
      hnrNorm * 10;

    return Math.max(0, Math.min(100, score));
  }

  private calculateRMS(data: Float32Array): number {
    if (data.length === 0) return 0;
    let sum = 0;
    for (let i = 0; i < data.length; i++) {
      sum += data[i] * data[i];
    }
    return Math.sqrt(sum / data.length);
  }

  private calculateVariance(values: number[]): number {
    if (values.length < 2) return 0;
    const filtered = values.filter((v) => v > 0);
    if (filtered.length < 2) return 0;
    const mean = filtered.reduce((a, b) => a + b, 0) / filtered.length;
    return filtered.reduce((sum, v) => sum + (v - mean) ** 2, 0) / (filtered.length - 1);
  }

  reset() {
    this.pitchHistory = [];
    this.amplitudeHistory = [];
    this.silentFrames = 0;
    this.smoothedScore = 0;
    this.hasSmoothedScore = false;
    this.voiceActivityHistory = [];
    this.smoothedDeceitScore = 0;
    this.hasSmoothedDeceit = false;
    this.baselineF0 = 0;
    this.baselineF0Count = 0;
  }
}
