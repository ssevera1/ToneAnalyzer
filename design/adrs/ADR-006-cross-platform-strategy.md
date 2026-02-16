# ADR-006: Electron + Capacitor Cross-Platform Strategy

- **Status**: Accepted
- **Date**: 2024-06-01
- **Deciders**: Core team

## Context

ToneAnalyzer needs to run on three platforms: web browsers (primary), desktop (Windows/macOS for RTSP camera support and native file dialogs), and mobile (iOS for field use). We needed a strategy that maximizes code reuse while providing platform-specific capabilities.

### Options Considered

1. **Web-only** — Pure SPA, rely on browser capabilities for everything
2. **Electron (desktop) + Capacitor (mobile)** — Same React SPA with platform-specific shells
3. **Tauri (desktop) + Capacitor (mobile)** — Rust-based desktop shell, smaller binary
4. **React Native** — Rewrite UI layer for native mobile, Electron for desktop
5. **Flutter** — Complete rewrite in Dart for all platforms

## Decision

**Chosen: Electron v40 for desktop + Capacitor v6 for iOS**, both wrapping the same Vite-built React SPA. The web app is the primary target; Electron and Capacitor are thin shells that add platform-specific capabilities.

## Rationale

### Single Codebase, Three Targets
- The React SPA (`src/`) is 100% shared across all three platforms. Platform differences are handled by `platformUtils.ts` which gates features at runtime:
  - `getMaxVideoFeeds()` → 4 (mobile) or 12 (desktop/web)
  - `supportsRTSP()` → true only on Electron
  - `supportsScreenCapture()` → true on web, false on iOS/Electron

### Electron for Desktop-Specific Needs
- **RTSP camera support**: Requires spawning `ffmpeg` as a subprocess — impossible in a browser. Electron's main process runs `rtsp-proxy.ts` as a WebSocket server.
- **Native file dialogs**: `dialog.showOpenDialog` / `dialog.showSaveDialog` provide OS-native file pickers for importing audio and exporting reports.
- **No HTTPS requirement**: Electron's local renderer has full access to `getUserMedia` without HTTPS certificates.

### Capacitor for iOS
- Capacitor wraps the SPA in WKWebView with native plugin bridges. Camera/microphone permissions are declared in `Info.plist` via Capacitor config.
- Minimal native code — just the `@capacitor/camera` plugin for permission handling.
- Build pipeline: `npm run build` → `npx cap sync ios` → open in Xcode.

### Why Not Tauri
- Tauri uses the system WebView (Edge WebView2 on Windows, WebKitGTK on Linux). TensorFlow.js WebGL performance varies significantly across system WebViews. Electron bundles Chromium, guaranteeing consistent WebGL behavior for our ML inference.
- Tauri's Rust IPC, while more performant, is unnecessary — our IPC surface is minimal (file dialogs only).

## Trade-offs Accepted

| Benefit | Trade-off |
|---------|-----------|
| 100% shared React SPA code | Electron bundles Chromium (~150MB installer) |
| Consistent WebGL/TF.js behavior | Electron's memory footprint is higher than Tauri (~180MB+ RAM) |
| Mature Electron ecosystem | Electron security requires careful CSP and context isolation configuration |
| Capacitor reuses web skills | iOS WKWebView has lower JS performance than native (acceptable for our workload) |
| Single build tool (Vite) for all targets | Must maintain three deployment configs (web, Electron, Capacitor) |

## Security Measures (Electron)

- **Context Isolation**: Enabled — renderer cannot access Node.js directly
- **Preload Bridge**: Minimal IPC surface (`openFile`, `saveFile`, `platform`)
- **CSP Header**: `script-src 'self'`; no external scripts; `connect-src` limited to `ws://127.0.0.1:9999` (RTSP proxy)
- **RTSP URL Validation**: Blocks private IP ranges to prevent SSRF attacks via the ffmpeg proxy

## Consequences

- Three build scripts in `package.json`: `build` (web), `electron:build` (desktop), `ios:sync` (mobile)
- Feature detection in `platformUtils.ts` ensures the UI adapts gracefully (e.g., RTSP source option hidden on web/mobile)
- Electron updates require testing the Chromium-TensorFlow.js compatibility matrix
