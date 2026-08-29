/**
 * Generate synthetic test audio files for voice stress analyzer calibration.
 *
 * Produces WAV files with known acoustic characteristics:
 *   - calm-baseline.wav     : Steady pitch, strong 10Hz microtremors, low jitter/shimmer
 *   - moderate-stress.wav   : Slightly elevated pitch, reduced microtremors, moderate jitter
 *   - high-stress.wav       : Variable pitch, suppressed microtremors, high jitter/shimmer
 *   - silence.wav           : Near-silent signal (noise floor test)
 *   - multi-speaker.wav     : Alternating calm/stressed segments (transition test)
 *
 * Usage:  node scripts/generate-test-audio.cjs
 */

const fs = require('fs');
const path = require('path');

const SAMPLE_RATE = 44100;

// ── WAV writer ──────────────────────────────────────────────────────

function writeWav(filepath, sampleRate, samples) {
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);
  const dataSize = samples.length * (bitsPerSample / 8);
  const fileSize = 44 + dataSize;

  const buffer = Buffer.alloc(fileSize);
  let o = 0;

  // RIFF header
  buffer.write('RIFF', o); o += 4;
  buffer.writeUInt32LE(fileSize - 8, o); o += 4;
  buffer.write('WAVE', o); o += 4;

  // fmt chunk
  buffer.write('fmt ', o); o += 4;
  buffer.writeUInt32LE(16, o); o += 4;
  buffer.writeUInt16LE(1, o); o += 2;   // PCM
  buffer.writeUInt16LE(numChannels, o); o += 2;
  buffer.writeUInt32LE(sampleRate, o); o += 4;
  buffer.writeUInt32LE(byteRate, o); o += 4;
  buffer.writeUInt16LE(blockAlign, o); o += 2;
  buffer.writeUInt16LE(bitsPerSample, o); o += 2;

  // data chunk
  buffer.write('data', o); o += 4;
  buffer.writeUInt32LE(dataSize, o); o += 4;

  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    buffer.writeInt16LE(Math.round(s * 32767), o);
    o += 2;
  }

  fs.mkdirSync(path.dirname(filepath), { recursive: true });
  fs.writeFileSync(filepath, buffer);
  const sizeMB = (fileSize / (1024 * 1024)).toFixed(2);
  console.log(`  wrote ${filepath} (${sizeMB} MB, ${(samples.length / sampleRate).toFixed(1)}s)`);
}

// ── Signal generators ───────────────────────────────────────────────

/** Generate a voiced signal that mimics vocal cord vibration. */
function generateVoicedSignal({
  durationSec,
  baseF0,          // fundamental frequency in Hz
  f0Variance,      // Hz standard deviation of pitch wander
  jitterPercent,   // cycle-to-cycle pitch perturbation (%)
  shimmerPercent,  // cycle-to-cycle amplitude perturbation (%)
  microtremorAmp,  // amplitude of 10 Hz modulation (0 = suppressed)
  hnrDb,           // target harmonic-to-noise ratio (dB)
  amplitude = 0.35,
}) {
  const numSamples = Math.floor(durationSec * SAMPLE_RATE);
  const samples = new Float32Array(numSamples);

  // Slow pitch wander (random walk, filtered)
  let currentF0 = baseF0;
  let phase = 0;
  const noiseRatio = Math.pow(10, -hnrDb / 10); // noise energy relative to harmonic

  for (let i = 0; i < numSamples; i++) {
    const t = i / SAMPLE_RATE;

    // Slow pitch drift (wanders around baseF0)
    if (i % 441 === 0) { // update every ~10ms
      currentF0 += (Math.random() - 0.5) * f0Variance * 0.3;
      currentF0 = baseF0 + (currentF0 - baseF0) * 0.95; // mean-revert
      currentF0 = Math.max(baseF0 * 0.7, Math.min(baseF0 * 1.4, currentF0));
    }

    // Jitter: per-cycle pitch perturbation
    const jitterOffset = (Math.random() - 0.5) * 2 * (jitterPercent / 100) * currentF0;
    const instantF0 = currentF0 + jitterOffset;

    // Phase accumulation
    phase += (2 * Math.PI * instantF0) / SAMPLE_RATE;
    if (phase > 2 * Math.PI) phase -= 2 * Math.PI;

    // Glottal-pulse-like waveform (sum of harmonics with roll-off)
    let harmonic = 0;
    for (let h = 1; h <= 6; h++) {
      harmonic += Math.sin(phase * h) / (h * h);
    }

    // Shimmer: amplitude perturbation
    const shimmerScale = 1 + (Math.random() - 0.5) * 2 * (shimmerPercent / 100);

    // Microtremor modulation (8-14 Hz, centered at 10 Hz)
    const microtremorMod = 1 + microtremorAmp * Math.sin(2 * Math.PI * 10 * t);

    // Aspiration noise for HNR control
    const noise = (Math.random() - 0.5) * 2 * Math.sqrt(noiseRatio);

    samples[i] = amplitude * shimmerScale * microtremorMod * (harmonic + noise);
  }

  return samples;
}

/** Generate near-silence with low-level noise. */
function generateSilence(durationSec) {
  const numSamples = Math.floor(durationSec * SAMPLE_RATE);
  const samples = new Float32Array(numSamples);
  for (let i = 0; i < numSamples; i++) {
    samples[i] = (Math.random() - 0.5) * 0.002; // -54 dB noise floor
  }
  return samples;
}

/** Concatenate Float32Arrays. */
function concat(...arrays) {
  const total = arrays.reduce((s, a) => s + a.length, 0);
  const result = new Float32Array(total);
  let offset = 0;
  for (const a of arrays) {
    result.set(a, offset);
    offset += a.length;
  }
  return result;
}

// ── Generate files ──────────────────────────────────────────────────

const outDir = path.join(__dirname, '..', 'public', 'test-audio');

console.log('Generating test audio files for CVSA calibration...\n');

// 1. Calm baseline — steady pitch, strong microtremors, low perturbation
writeWav(
  path.join(outDir, 'calm-baseline.wav'),
  SAMPLE_RATE,
  generateVoicedSignal({
    durationSec: 8,
    baseF0: 120,
    f0Variance: 5,
    jitterPercent: 0.5,
    shimmerPercent: 1.5,
    microtremorAmp: 0.15,    // strong microtremors (relaxed)
    hnrDb: 22,
  })
);

// 2. Moderate stress — slightly elevated pitch, reduced microtremors
writeWav(
  path.join(outDir, 'moderate-stress.wav'),
  SAMPLE_RATE,
  generateVoicedSignal({
    durationSec: 8,
    baseF0: 145,
    f0Variance: 18,
    jitterPercent: 2.5,
    shimmerPercent: 5.0,
    microtremorAmp: 0.05,    // reduced microtremors
    hnrDb: 15,
  })
);

// 3. High stress — variable pitch, suppressed microtremors, noisy
writeWav(
  path.join(outDir, 'high-stress.wav'),
  SAMPLE_RATE,
  generateVoicedSignal({
    durationSec: 8,
    baseF0: 170,
    f0Variance: 40,
    jitterPercent: 5.5,
    shimmerPercent: 11.0,
    microtremorAmp: 0.01,    // suppressed microtremors (stressed)
    hnrDb: 9,
  })
);

// 4. Silence (noise floor)
writeWav(
  path.join(outDir, 'silence.wav'),
  SAMPLE_RATE,
  generateSilence(5)
);

// 5. Multi-speaker: 3s calm → 3s stressed → 3s calm (transition test)
writeWav(
  path.join(outDir, 'calm-stressed-calm.wav'),
  SAMPLE_RATE,
  concat(
    generateVoicedSignal({
      durationSec: 3,
      baseF0: 115,
      f0Variance: 4,
      jitterPercent: 0.4,
      shimmerPercent: 1.2,
      microtremorAmp: 0.14,
      hnrDb: 23,
    }),
    generateVoicedSignal({
      durationSec: 3,
      baseF0: 175,
      f0Variance: 45,
      jitterPercent: 6.0,
      shimmerPercent: 12.0,
      microtremorAmp: 0.01,
      hnrDb: 8,
    }),
    generateVoicedSignal({
      durationSec: 3,
      baseF0: 118,
      f0Variance: 5,
      jitterPercent: 0.5,
      shimmerPercent: 1.5,
      microtremorAmp: 0.13,
      hnrDb: 22,
    })
  )
);

console.log('\nDone! Files written to public/test-audio/');
console.log('Load these via the "Upload File" button on the Voice Analysis page.');
console.log('\nExpected stress scores:');
console.log('  calm-baseline.wav       →  ~10-25  (low stress)');
console.log('  moderate-stress.wav     →  ~40-60  (moderate stress)');
console.log('  high-stress.wav         →  ~70-90  (high stress)');
console.log('  silence.wav             →  ~0      (no voice detected)');
console.log('  calm-stressed-calm.wav  →  transitions low → high → low');
