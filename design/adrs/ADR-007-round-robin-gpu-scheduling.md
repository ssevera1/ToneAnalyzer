# ADR-007: Round-Robin GPU Scheduling for Multi-Feed Processing

- **Status**: Accepted
- **Date**: 2024-06-01
- **Deciders**: Core team

## Context

ToneAnalyzer supports up to 12 simultaneous video feeds for emotion detection. Each feed requires TensorFlow.js inference (TinyFaceDetector + FaceExpressionNet) which runs on the WebGL backend. We needed a strategy for processing multiple feeds without GPU contention or frame drops.

### Options Considered

1. **Parallel inference** — Run all feeds through TF.js simultaneously
2. **Web Worker per feed** — Isolate each feed's inference in a separate worker
3. **Round-robin scheduling** — Process one feed per tick, cycling through all active feeds
4. **Priority queue** — Process feeds based on activity/importance scoring

## Decision

**Chosen: Round-robin scheduling** — A single `setInterval(100ms)` timer processes one video feed per tick, cycling through active feeds in order. At 10 FPS base rate with N feeds, each feed gets `10/N` effective FPS.

## Rationale

### WebGL Is Single-Threaded
- The browser provides a **single WebGL context** shared across all TensorFlow.js operations. Launching parallel `detectAllFaces()` calls on multiple feeds doesn't parallelize GPU work — it serializes them internally while creating memory pressure from concurrent tensor allocations.
- Testing showed that parallel inference on 4 feeds took ~320ms total (sequential anyway) with frequent WebGL context loss events. Round-robin takes the same ~320ms but with predictable, stable behavior.

### Predictable Latency
- Round-robin gives each feed a deterministic processing schedule:
  - 1 feed: 10 FPS
  - 4 feeds: 2.5 FPS per feed
  - 9 feeds: ~1.1 FPS per feed
  - 12 feeds: ~0.83 FPS per feed
- This is transparent to the user (effective FPS is displayed per panel). No feed starves; no feed monopolizes the GPU.

### Memory Stability
- Processing one feed at a time means only one set of tensors is allocated at any moment. Peak GPU memory usage is constant regardless of feed count. This prevents out-of-memory crashes on devices with limited WebGL memory (especially mobile via Capacitor).

### Simplicity
- Implementation is a single counter (`currentFeedIndex`) incremented modulo `sources.length`. No thread pools, no worker communication overhead, no priority scoring algorithms.

## Trade-offs Accepted

| Benefit | Trade-off |
|---------|-----------|
| Zero GPU contention | Per-feed FPS degrades linearly with feed count (12 feeds = <1 FPS each) |
| Constant memory usage | Cannot prioritize "interesting" feeds (e.g., feed with active speaker) |
| Predictable scheduling | Not utilizing potential parallelism on multi-GPU systems (rare in target environments) |
| Simple implementation (~10 lines) | No adaptive scheduling based on frame complexity |

### Effective FPS Table

| Active Feeds | FPS per Feed | Latency per Update |
|--------------|-------------|-------------------|
| 1 | 10.0 | 100ms |
| 2 | 5.0 | 200ms |
| 4 | 2.5 | 400ms |
| 6 | 1.67 | 600ms |
| 9 | 1.11 | 900ms |
| 12 | 0.83 | 1200ms |

## Consequences

- The UI displays effective FPS per video panel so operators understand the update rate
- `ExpressionAnalyzer`'s temporal analysis (3-12 second windows) accounts for variable sample rates per feed
- Mobile (Capacitor) limits to 4 feeds (2.5 FPS each) — a deliberate constraint to maintain usable update rates on lower-power devices
- If WebGPU becomes widely available, the architecture could potentially support true parallel inference, but the round-robin interface would remain unchanged
