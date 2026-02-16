# ADR-004: Dexie.js / IndexedDB for Local Persistence

- **Status**: Accepted
- **Date**: 2024-06-01
- **Deciders**: Core team

## Context

ToneAnalyzer needs to persist session data (voice stress readings, emotion readings) across browser restarts so users can review past sessions, compare results, and export historical data. Given the client-side-only architecture (ADR-001), persistence must be local to the device.

### Options Considered

1. **localStorage** — Simple key-value, 5-10MB limit, synchronous API
2. **IndexedDB (raw)** — Transactional object store, async, large storage limits
3. **Dexie.js** (IndexedDB wrapper) — Promise-based API, schema versioning, indexed queries
4. **SQLite via WebAssembly** (sql.js or wa-sqlite) — Full SQL database in browser
5. **File System Access API** — Direct file read/write (Chrome-only)

## Decision

**Chosen: Dexie.js v4.0.4** wrapping IndexedDB, with four tables: `sessions`, `stressReadings`, `emotionSessions`, `emotionReadings`.

## Rationale

### Storage Capacity
- localStorage caps at 5-10MB. A single 30-minute voice session at 60 FPS generates ~108,000 readings × ~200 bytes = ~21MB. IndexedDB has no practical size limit (typically hundreds of MB+, browser prompts at ~50MB).
- Emotion sessions with 4 feeds at 10 FPS generate similar volumes. localStorage is simply insufficient.

### Structured Queries
- Dexie.js provides indexed queries over IndexedDB: `stressReadings.where('sessionId').equals(id)`. This enables efficient session loading without scanning all records.
- Raw IndexedDB works but requires verbose cursor-based iteration. Dexie's promise-based API (`table.toArray()`, `table.where().between()`) cuts code volume by ~60%.

### Schema Versioning
- Dexie handles IndexedDB schema migrations via version numbers. As ToneAnalyzer's data model evolves (adding new metrics, changing field types), Dexie manages upgrade paths automatically.

### Async by Default
- IndexedDB (and Dexie) operations are asynchronous, preventing UI thread blocking when persisting large sessions. This is critical since session finalization writes thousands of readings in a batch.

## Trade-offs Accepted

| Benefit | Trade-off |
|---------|-----------|
| Near-unlimited storage | Data is device-local; no cross-device sync |
| Indexed queries on session/timestamp | More complex than localStorage for simple key-value needs |
| Schema versioning for migrations | IndexedDB debugging tools are less mature than SQL tools |
| Async API prevents UI blocking | Dexie adds ~40KB to bundle (acceptable given our model sizes) |
| Works in all deployment targets (web, Electron, Capacitor) | Safari/iOS IndexedDB has historical quirks (mostly resolved in modern versions) |

## Schema

```
ToneAnalyzerDB v1:
  sessions:        id, name, startTime
  stressReadings:  ++id, sessionId, timestamp
  emotionSessions: id, name, startTime
  emotionReadings: ++id, sessionId, timestamp, faceId
```

## Consequences

- Session persistence is automatic on `finalizeSession()`. No explicit "save" button needed.
- Export service reads directly from stores (in-memory for current session) or from IndexedDB (for historical sessions).
- If cloud sync is ever needed, Dexie's `dexie-cloud` addon provides a migration path without changing the application code.
