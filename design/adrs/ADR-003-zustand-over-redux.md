# ADR-003: Zustand Over Redux for State Management

- **Status**: Accepted
- **Date**: 2024-06-01
- **Deciders**: Core team

## Context

ToneAnalyzer requires state management for three distinct domains: global app settings, real-time voice analysis data (stress readings streaming at ~60 FPS), and emotion detection data (readings from up to 12 video feeds at 10 FPS). The state management solution must handle high-frequency updates without causing unnecessary re-renders.

### Options Considered

1. **Redux Toolkit** — Industry standard, great devtools, middleware ecosystem (redux-saga, redux-thunk)
2. **Zustand** — Minimal, hook-based state management with no boilerplate
3. **Jotai / Recoil** — Atomic state management
4. **React Context + useReducer** — Built-in React state management

## Decision

**Chosen: Zustand v4.5.2** for all three stores (`useAppStore`, `useVoiceStore`, `useEmotionStore`).

## Rationale

### Minimal Boilerplate for High-Frequency Data
- Voice analysis emits `StressMetrics` at ~60 FPS. Redux's action → reducer → selector pipeline adds overhead per update. Zustand's direct `set()` calls minimize the path from data producer to store update.
- Three independent stores (app, voice, emotion) are trivially separated in Zustand. Redux would require either a single monolithic store with slice-based selectors or multiple store instances (non-standard pattern).

### Selective Re-render Control
- Zustand's selector-based subscriptions (`useVoiceStore(state => state.currentMetrics)`) ensure components only re-render when their specific slice changes. This is critical when `frequencyData` updates 60x/sec but the gauge only cares about `stressLevel`.
- Redux achieves this with `useSelector` + memoization, but requires more careful optimization for our update frequency.

### Bundle Size
- Zustand: ~2KB minified. Redux Toolkit: ~30KB+. For an app that already bundles TensorFlow.js (~700KB) and face-api models (~6MB), the state management library itself isn't the bottleneck — but keeping non-critical dependencies small is good engineering practice.

### No Middleware Needed
- ToneAnalyzer's data flow is synchronous and local. Audio processing and ML inference happen in-process (AudioWorklet, TensorFlow.js). There are no async API calls, no saga orchestration, no server-side cache invalidation. Zustand's simplicity is a match for the problem.

## Trade-offs Accepted

| Benefit | Trade-off |
|---------|-----------|
| ~2KB bundle, zero boilerplate | No built-in devtools (redux-devtools integration available but less mature) |
| Direct `set()` for high-frequency updates | Less enforced structure (no action/reducer pattern to enforce conventions) |
| Independent stores by default | No single source of truth for cross-store queries (mitigated by minimal cross-store dependencies) |
| Selector-based subscriptions | Team must know to use selectors (default `useStore()` subscribes to everything) |

## Consequences

- Each store is self-contained: `useVoiceStore` doesn't depend on `useEmotionStore`. Cross-cutting concerns (like export) read from stores directly.
- High-frequency data (frequency/time-domain arrays) is stored as typed arrays and updated by reference swap, avoiding deep comparison costs.
- If debugging becomes difficult, the Zustand devtools middleware can be added to any store with one line.
