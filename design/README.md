# ToneAnalyzer Design Documentation

This directory contains architectural documentation for the ToneAnalyzer project — a cross-platform voice stress analysis and real-time emotion detection application.

## Contents

### C4 Model Diagrams (`c4-diagrams/`)

Mermaid.js diagrams following the [C4 Model](https://c4model.com/) for visualizing software architecture at four levels of abstraction:

| File | Level | Description |
|------|-------|-------------|
| [1-context.md](c4-diagrams/1-context.md) | L1 — System Context | Shows ToneAnalyzer's relationship with users and external systems |
| [2-container.md](c4-diagrams/2-container.md) | L2 — Container | Breaks ToneAnalyzer into deployable units (SPA, Electron, Capacitor) |
| [3-component.md](c4-diagrams/3-component.md) | L3 — Component | Details internal modules: engines, stores, services |
| [4-code.md](c4-diagrams/4-code.md) | L4 — Code | Class-level detail for the two core processing pipelines |
| [5-data-flow.md](c4-diagrams/5-data-flow.md) | Supplementary | End-to-end data flow and latency budget diagrams |

All diagrams use Mermaid.js syntax and render natively on GitHub, VS Code (with extensions), or any Mermaid-compatible viewer.

### Architecture Decision Records (`adrs/`)

A log of significant design choices using the [MADR](https://adr.github.io/madr/) format:

| ADR | Title | Status |
|-----|-------|--------|
| [ADR-001](adrs/ADR-001-client-side-processing.md) | Client-side-only processing architecture | Accepted |
| [ADR-002](adrs/ADR-002-face-api-over-mediapipe.md) | face-api.js over MediaPipe for emotion detection | Accepted |
| [ADR-003](adrs/ADR-003-zustand-over-redux.md) | Zustand over Redux for state management | Accepted |
| [ADR-004](adrs/ADR-004-dexie-indexeddb-persistence.md) | Dexie.js / IndexedDB for local persistence | Accepted |
| [ADR-005](adrs/ADR-005-web-audio-api-for-dsp.md) | Web Audio API for real-time DSP pipeline | Accepted |
| [ADR-006](adrs/ADR-006-cross-platform-strategy.md) | Electron + Capacitor cross-platform strategy | Accepted |
| [ADR-007](adrs/ADR-007-round-robin-gpu-scheduling.md) | Round-robin GPU scheduling for multi-feed processing | Accepted |
| [ADR-008](adrs/ADR-008-expression-analyzer-rule-engine.md) | Rule-based expression analyzer over ML classifier | Accepted |

## Editing Diagrams

All diagrams are in Mermaid.js syntax. To edit:

1. **GitHub** — Renders automatically in `.md` files
2. **VS Code** — Install the "Mermaid Markdown Syntax Highlighting" extension
3. **Live Editor** — Paste into [mermaid.live](https://mermaid.live)
4. **Excalidraw** — Export Mermaid to SVG, then import into Excalidraw for freeform editing
