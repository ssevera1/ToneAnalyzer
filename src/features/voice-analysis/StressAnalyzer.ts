import type { StressMetrics } from '../../types/audio';

const PITCH_HISTORY_SIZE = 100;
const AMPLITUDE_HISTORY_SIZE = 100;

export class StressAnalyzer {
  private pitchHistory: number[] = [];
  private amplitudeHistory: number[] = [];
  private pcmBuffer: Float32Array = new Float32Array(0);
  private sampleRate = 44100;

  setSampleRate(rate: number) {
    this.sampleRate = rate;
  }

  analyze(frequencyData: Float32Array, timeDomainData: Float32Array): StressMetrics {
    const f0 = this.calculateF0(timeDomainData);
    const microtremorAmplitude = this.analyzeMicrotremors(timeDomainData);

    if (f0 > 0) {
      this.pitchHistory.push(f0);
      if (this.pitchHistory.length > PITCH_HISTORY_SIZE) this.pitchHistory.shift();
    }

    const rms = this.calculateRMS(timeDomainData);
    this.amplitudeHistory.push(rms);
    if (this.amplitudeHistory.length > AMPLITUDE_HISTORY_SIZE) this.amplitudeHistory.shift();

    const f0Variance = this.calculateVariance(this.pitchHistory);
    const jitter = this.calculateJitter(this.pitchHistory);
    const shimmer = this.calculateShimmer(this.amplitudeHistory);
    const hnr = this.calculateHNR(timeDomainData);
    const stressScore = this.computeStressScore({ microtremorAmplitude, f0, f0Variance, jitter, shimmer, hnr, stressScore: 0 });

    return { microtremorAmplitude, f0, f0Variance, jitter, shimmer, hnr, stressScore };
  }

  analyzePCM(samples: Float32Array, sr: number): void {
    this.pcmBuffer = samples;
    this.sampleRate = sr;
  }

  /**
   * Detect microtremors in the 8-14 Hz band.
   * Stress suppresses muscle microtremors, so diminished amplitude = higher stress.
   */
  analyzeMicrotremors(timeDomainData: Float32Array): number {
    if (timeDomainData.length < 256) return 0;

    // Compute the envelope of the signal
    const envelope = new Float32Array(timeDomainData.length);
    for (let i = 0; i < timeDomainData.length; i++) {
      envelope[i] = Math.abs(timeDomainData[i]);
    }

    // Simple low-pass to get amplitude modulation
    const smoothed = new Float32Array(envelope.length);
    const alpha = 0.05;
    smoothed[0] = envelope[0];
    for (let i = 1; i < envelope.length; i++) {
      smoothed[i] = alpha * envelope[i] + (1 - alpha) * smoothed[i - 1];
    }

    // Measure energy in the 8-14 Hz modulation band via autocorrelation of envelope
    const minLag = Math.floor(this.sampleRate / 14); // 14 Hz
    const maxLag = Math.floor(this.sampleRate / 8);  // 8 Hz
    let maxCorr = 0;

    for (let lag = minLag; lag <= Math.min(maxLag, smoothed.length / 2); lag++) {
      let corr = 0;
      let count = 0;
      for (let i = 0; i < smoothed.length - lag; i++) {
        corr += smoothed[i] * smoothed[i + lag];
        count++;
      }
      if (count > 0) {
        corr /= count;
        maxCorr = Math.max(maxCorr, corr);
      }
    }

    return maxCorr;
  }

  /**
   * Autocorrelation-based fundamental frequency (F0) detection.
   */
  calculateF0(timeDomainData: Float32Array): number {
    if (timeDomainData.length < 512) return 0;

    const size = timeDomainData.length;
    const minPeriod = Math.floor(this.sampleRate / 500); // 500 Hz max
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
    let sumPeriod = 0;

    for (let i = 1; i < periods.length; i++) {
      sumDiff += Math.abs(periods[i] - periods[i - 1]);
      sumPeriod += periods[i];
    }

    const avgPeriod = sumPeriod / periods.length;
    if (avgPeriod === 0) return 0;

    return (sumDiff / (periods.length - 1)) / avgPeriod * 100;
  }

  /**
   * Shimmer: cycle-to-cycle amplitude perturbation (%).
   */
  calculateShimmer(amplitudeHistory: number[]): number {
    if (amplitudeHistory.length < 3) return 0;

    let sumDiff = 0;
    let sumAmp = 0;

    for (let i = 1; i < amplitudeHistory.length; i++) {
      sumDiff += Math.abs(amplitudeHistory[i] - amplitudeHistory[i - 1]);
      sumAmp += amplitudeHistory[i];
    }

    const avgAmp = sumAmp / amplitudeHistory.length;
    if (avgAmp === 0) return 0;

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
    const minLag = Math.floor(this.sampleRate / 500);
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
   */
  computeStressScore(metrics: StressMetrics): number {
    // Normalize each metric to 0-1 range
    // Microtremor: lower = more stress (inverted)
    const microtremorNorm = 1 - Math.min(1, metrics.microtremorAmplitude / 0.001);

    // F0 variance: higher = more stress
    const f0VarNorm = Math.min(1, metrics.f0Variance / 1000);

    // Jitter: higher = more stress (normal < 1%, stressed > 3%)
    const jitterNorm = Math.min(1, metrics.jitter / 5);

    // Shimmer: higher = more stress (normal < 3%, stressed > 8%)
    const shimmerNorm = Math.min(1, metrics.shimmer / 10);

    // HNR: lower = more stress (inverted, normal > 20dB)
    const hnrNorm = 1 - Math.min(1, metrics.hnr / 25);

    const score =
      microtremorNorm * 30 +
      f0VarNorm * 25 +
      jitterNorm * 20 +
      shimmerNorm * 15 +
      hnrNorm * 10;

    return Math.max(0, Math.min(100, Math.round(score)));
  }

  private calculateRMS(data: Float32Array): number {
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
    this.pcmBuffer = new Float32Array(0);
  }
}
