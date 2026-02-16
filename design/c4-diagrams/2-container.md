# C4 Level 2 — Container Diagram

Breaks ToneAnalyzer into its deployable/runnable units and shows their interactions.

## Container Overview

```mermaid
C4Container
    title ToneAnalyzer — Container Diagram

    Person(analyst, "Analyst", "Operates the application")

    Container_Boundary(web, "Web Deployment") {
        Container(spa, "React SPA", "React 18, TypeScript, Vite", "Single-page application serving all UI, audio DSP, and ML inference. Deployed as static files behind Nginx/CloudFront.")
    }

    Container_Boundary(desktop, "Electron Desktop") {
        Container(renderer, "Renderer Process", "React SPA (same codebase)", "Runs the full SPA inside a Chromium webview with context isolation.")
        Container(main, "Main Process", "Node.js / Electron 40", "Manages native windows, file dialogs, CSP headers, and IPC bridge.")
        Container(rtspProxy, "RTSP Proxy", "Node.js, ffmpeg, WebSocket", "Spawns ffmpeg subprocesses to transcode RTSP streams to MPEG-TS over WebSocket on localhost:9999. Max 12 concurrent sessions.")
    }

    Container_Boundary(mobile, "iOS / Capacitor") {
        Container(webview, "WKWebView", "React SPA (same codebase)", "Runs the SPA with a 4-feed limit. Uses Capacitor plugins for camera and filesystem access.")
    }

    Container_Boundary(storage, "Client-Side Storage") {
        ContainerDb(indexeddb, "IndexedDB", "Dexie.js v4", "Persists voice sessions, stress readings, emotion sessions, and emotion readings across browser restarts.")
    }

    Container_Boundary(ml, "ML Models (Static Assets)") {
        Container(faceModels, "Face-API Models", "TinyFaceDetector + FaceExpressionNet .bin files", "Served from /public/models/. Loaded into TensorFlow.js WebGL backend at runtime.")
    }

    Rel(analyst, spa, "Uses via browser", "HTTPS")
    Rel(analyst, renderer, "Uses via Electron window")
    Rel(analyst, webview, "Uses via iOS app")

    Rel(renderer, main, "IPC", "file dialogs, save/open")
    Rel(main, rtspProxy, "Spawns on app launch")
    Rel(renderer, rtspProxy, "WebSocket", "ws://127.0.0.1:9999")

    Rel(spa, indexeddb, "Read/write sessions")
    Rel(renderer, indexeddb, "Read/write sessions")
    Rel(webview, indexeddb, "Read/write sessions")

    Rel(spa, faceModels, "HTTP GET at init", "/models/*.bin")
```

## Platform Capability Matrix

```mermaid
block-beta
    columns 4
    block:header:4
        h1["Feature"] h2["Web (SPA)"] h3["Electron (Desktop)"] h4["Capacitor (iOS)"]
    end
    block:row1:4
        r1a["Voice Analysis"] r1b["Yes"] r1c["Yes"] r1d["Yes"]
    end
    block:row2:4
        r2a["Emotion Detection"] r2b["Yes"] r2c["Yes"] r2d["Yes"]
    end
    block:row3:4
        r3a["Max Video Feeds"] r3b["12"] r3c["12"] r3d["4"]
    end
    block:row4:4
        r4a["RTSP Cameras"] r4b["No"] r4c["Yes (ffmpeg)"] r4d["No"]
    end
    block:row5:4
        r5a["Screen Capture"] r5b["Yes"] r5c["No"] r5d["No"]
    end
    block:row6:4
        r6a["Native File Dialogs"] r6b["No (browser download)"] r6c["Yes (IPC)"] r6d["Capacitor FS"]
    end
    block:row7:4
        r7a["HTTPS Required"] r7b["Yes (prod)"] r7c["No (local)"] r7d["No (native)"]
    end
```

## Deployment Variants

```mermaid
flowchart LR
    subgraph Build ["Vite Build (npm run build)"]
        src[src/] --> dist[dist/ static files]
    end

    dist --> S3["AWS S3 + CloudFront"]
    dist --> nginx["EC2/VPS + Nginx"]
    dist --> docker["Docker (Nginx alpine)"]
    dist --> electron["electron-builder → .exe/.dmg"]
    dist --> capacitor["Capacitor → Xcode → .ipa"]
```
