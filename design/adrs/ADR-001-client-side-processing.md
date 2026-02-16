# ADR-001: Client-Side-Only Processing Architecture

- **Status**: Accepted
- **Date**: 2024-06-01
- **Deciders**: Core team

## Context

ToneAnalyzer processes sensitive biometric data — voice recordings and facial video streams — to perform stress analysis and emotion detection. We needed to decide whether to process this data on a backend server (with cloud ML services) or entirely on the client.

### Options Considered

1. **Cloud-based processing** — Send audio/video to a backend API using services like AWS Rekognition, Google Cloud Speech, or Azure Cognitive Services
2. **Hybrid** — Client-side capture with server-side ML inference (self-hosted models)
3. **Fully client-side** — All processing runs in the browser/app using Web APIs and TensorFlow.js

## Decision

**Chosen: Fully client-side processing.** All audio DSP (CVSA algorithms) and ML inference (face detection, emotion classification) run in the user's browser using Web Audio API and TensorFlow.js with WebGL acceleration.

## Rationale

### Privacy & Trust
- Voice stress analysis and facial emotion detection operate on **highly sensitive biometric data**. Users (analysts, law enforcement, HR) require assurance that subject data never leaves the device.
- Zero-server architecture means **no data exfiltration surface**, no breach risk from server compromise, and compliance with data sovereignty requirements by default.

### Deployment Simplicity
- No backend infrastructure to provision, scale, or secure. The app deploys as static files to any web server, CDN, or desktop installer.
- Eliminates operational cost (no GPU instances, no API billing, no database servers).

### Latency
- Real-time analysis requires sub-100ms feedback loops. Network round-trips to cloud inference APIs would introduce 200-500ms latency, breaking the real-time experience.
- Client-side processing achieves ~15ms for voice DSP and ~80ms for face inference per frame.

## Trade-offs Accepted

| Benefit | Trade-off |
|---------|-----------|
| Complete data privacy | Limited to models that fit in browser (TinyFaceDetector vs. larger MTCNN) |
| Zero infrastructure cost | ML accuracy constrained by client-side model size (~6MB vs. ~100MB+ server models) |
| No network dependency | Processing power depends on user's device; low-end hardware may struggle |
| Simple deployment | No ability to aggregate anonymized data for model improvement |
| Works offline | Cannot leverage cloud GPU clusters for high-throughput batch analysis |

## Consequences

- Model selection is constrained to lightweight architectures (TinyFaceDetector, not ResNet-based detectors)
- Audio analysis uses hand-tuned DSP algorithms rather than large ML models (acceptable for CVSA)
- Export functionality is file-based (CSV/PDF download) rather than cloud-synced dashboards
- IndexedDB provides local persistence, but data doesn't sync across devices
