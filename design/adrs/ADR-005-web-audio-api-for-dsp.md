# ADR-005: Web Audio API for Real-Time DSP Pipeline

- **Status**: Accepted
- **Date**: 2024-06-01
- **Deciders**: Core team

## Context

ToneAnalyzer's voice stress analysis (CVSA) requires real-time audio processing: microphone capture, FFT analysis, and computation of stress indicators (microtremor detection, F0 estimation, jitter, shimmer, HNR). We needed a DSP pipeline that runs at audio sample rate with low latency.

### Options Considered

1. **Web Audio API** (AnalyserNode + AudioWorklet) — Browser-native audio processing
2. **WebAssembly DSP library** (e.g., compiled C++ via Emscripten) — Custom DSP in Wasm
3. **Server-side processing** — Send audio to a Python backend using librosa/scipy
4. **Meyda.js** — JavaScript audio feature extraction library

## Decision

**Chosen: Web Audio API** with `AnalyserNode` (8192-point FFT) for frequency analysis and `AudioWorkletNode` for raw PCM sample capture. All CVSA algorithms (microtremor, F0, jitter, shimmer, HNR) are implemented in TypeScript operating on the API's output buffers.

## Rationale

### Native Performance
- `AnalyserNode` performs FFT in the browser's optimized native audio thread, not in JavaScript. The 8192-point FFT at 44.1kHz yields ~186ms windows with 0.54Hz frequency resolution — sufficient for microtremor detection in the 8-14Hz band.
- `AudioWorkletNode` runs on a dedicated audio thread, providing raw PCM samples without blocking the main thread.

### Zero Dependencies for Core DSP
- The Web Audio API is a browser standard — no npm package, no Wasm compilation step, no version conflicts with TensorFlow.js's WebGL backend.
- CVSA algorithms (autocorrelation for F0, bandpass for microtremor, perturbation metrics for jitter/shimmer) are pure math on `Float32Array` — TypeScript is performant enough without Wasm overhead.

### Audio Graph Flexibility
- Web Audio API's node-based architecture allows easy extension: adding filters, gain nodes, splitters, or recording nodes without restructuring the pipeline.
- `getUserMedia` → `MediaStreamAudioSourceNode` → `AnalyserNode` → `AudioWorkletNode` — each stage is independently configurable.

### File + Microphone Parity
- Both live microphone input and audio file analysis use the same `AudioContext` pipeline. `decodeAudioData()` feeds file audio through the same `AnalyserNode` → `StressAnalyzer` path, ensuring consistent results.

## Trade-offs Accepted

| Benefit | Trade-off |
|---------|-----------|
| Native FFT performance (C++ under the hood) | AnalyserNode provides magnitude spectrum only (no phase), limiting some advanced DSP techniques |
| Zero external dependencies | Custom CVSA algorithms must be maintained in-house (no battle-tested library) |
| AudioWorklet for raw samples | AudioWorklet API is more complex than ScriptProcessorNode (deprecated) |
| Works across all target platforms | Safari's AudioWorklet support was late (now resolved in modern versions) |
| 8192-point FFT gives 0.54Hz resolution | Higher FFT sizes would improve resolution but increase latency |

## Implementation Details

### FFT Configuration
- **FFT size**: 8192 (4096 frequency bins)
- **Smoothing**: 0.8 time constant (AnalyserNode default)
- **Sample rate**: 44100 Hz (default) or device native rate

### Microtremor Detection
- Extract frequency bins in 8-14Hz range from the FFT magnitude spectrum
- Stress **suppresses** microtremors (reduced amplitude in this band indicates higher stress)
- Normalized to 0-1 scale, inverted for stress score contribution

### F0 Detection (Pitch)
- Autocorrelation method on time-domain samples
- Search range: 50-500Hz (covering typical human voice range)
- F0 variance over a sliding window indicates stress-induced pitch instability

## Consequences

- The `AudioEngine` class encapsulates all Web Audio API complexity. Consumers (the `useVoiceAnalysis` hook) receive clean `Float32Array` callbacks.
- The `StressAnalyzer` is a pure computational class with no Web Audio dependency, making it testable with synthetic data.
- If WebAssembly DSP is ever needed for advanced algorithms, the `AudioWorklet` already provides raw PCM — Wasm processing can be inserted into the pipeline without changing the capture path.
