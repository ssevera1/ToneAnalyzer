# ADR-002: face-api.js Over MediaPipe for Emotion Detection

- **Status**: Accepted
- **Date**: 2024-06-01
- **Deciders**: Core team

## Context

We needed a client-side face detection and emotion classification library that runs in the browser with TensorFlow.js. The two leading options were MediaPipe (Google) and face-api.js (vladmandic fork).

### Options Considered

1. **MediaPipe Face Mesh + custom emotion classifier** — Google's face landmarking pipeline, would require training a custom emotion model on top of 468 landmarks
2. **@vladmandic/face-api** — Maintained fork of face-api.js, bundles TinyFaceDetector + FaceExpressionNet (pre-trained on FER2013)
3. **Custom TensorFlow.js model** — Train and deploy our own face detection + emotion model
4. **OpenCV.js + DNN module** — Port OpenCV face detection to WebAssembly

## Decision

**Chosen: @vladmandic/face-api v1.7.13** — the actively maintained fork of face-api.js that provides TinyFaceDetector for detection and FaceExpressionNet for 7-emotion classification, both running on TensorFlow.js WebGL backend.

## Rationale

### Integrated Emotion Output
- face-api.js provides **emotion probabilities out of the box** (neutral, happy, sad, angry, fearful, disgusted, surprised). MediaPipe only provides face landmarks — we would need to train a separate classifier, adding months of ML engineering work and a dependency on labeled emotion datasets.

### Proven Architecture
- TinyFaceDetector is a MobileNet v1-based SSD detector optimized for browser inference (~35ms per frame on mid-range GPU). It provides a good balance of accuracy and speed for our real-time multi-feed use case.
- FaceExpressionNet is a lightweight CNN trained on FER2013, providing the 7 base emotions we need for our ExpressionAnalyzer's 50+ derived rules.

### Active Maintenance
- The `@vladmandic/face-api` fork (vs. the abandoned `face-api.js` original) stays current with TensorFlow.js releases, fixing WebGL backend compatibility issues.

### Model Size
- Combined models: ~6MB (TinyFaceDetector ~190KB + FaceExpressionNet ~5.5MB). Small enough for fast initial load and acceptable in Electron/Capacitor bundles.

## Trade-offs Accepted

| Benefit | Trade-off |
|---------|-----------|
| Pre-trained emotion model (zero ML training) | FER2013 accuracy (~65-70%) is below state-of-the-art research models (~85%+) |
| Lightweight (~6MB models) | Cannot detect micro-expressions or subtle AU (Action Unit) activations |
| TensorFlow.js WebGL acceleration | Single-threaded GPU inference limits multi-feed throughput (solved via round-robin) |
| Stable, well-documented API | Library updates may lag behind TensorFlow.js major versions |
| 7-emotion classification | No fine-grained emotion taxonomy (compensated by our rule-based ExpressionAnalyzer) |

## Consequences

- The 7 base emotions are a **foundation**, not the full output. Our `ExpressionAnalyzer` derives 50+ behavioral labels by combining base emotions with thresholds, temporal patterns, and multi-emotion interactions.
- We accept the accuracy ceiling of TinyFaceDetector + FER2013 in exchange for client-side simplicity. If higher accuracy is needed later, we could swap to a larger model while keeping the same `EmotionEngine` interface.
- Round-robin scheduling (ADR-007) was necessary to work within the single-threaded WebGL constraint.
