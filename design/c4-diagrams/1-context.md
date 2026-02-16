# C4 Level 1 — System Context Diagram

Shows ToneAnalyzer as a black box and its relationships with users and external systems.

## System Context

```mermaid
C4Context
    title ToneAnalyzer — System Context Diagram

    Person(analyst, "Analyst / Operator", "Performs voice stress analysis and emotion monitoring on live or recorded subjects")
    Person(subject, "Subject", "Person whose voice or face is being analyzed (may be remote)")

    System(toneAnalyzer, "ToneAnalyzer", "Cross-platform application for real-time voice stress analysis (CVSA) and multi-feed facial emotion detection. All processing runs client-side.")

    System_Ext(browser, "Web Browser", "Chrome/Edge/Firefox with getUserMedia, Web Audio API, WebGL support")
    System_Ext(os, "Operating System", "Provides camera, microphone, and file system access via native APIs")
    System_Ext(rtspCam, "IP/RTSP Cameras", "Network cameras providing RTSP video streams (Electron desktop only)")

    Rel(analyst, toneAnalyzer, "Configures sessions, monitors real-time analysis, exports reports")
    Rel(subject, toneAnalyzer, "Provides audio/video input (directly or via camera feeds)")
    Rel(toneAnalyzer, browser, "Runs inside as SPA; uses Web Audio API, Canvas, TensorFlow.js WebGL backend")
    Rel(toneAnalyzer, os, "Requests microphone/camera permissions; reads/writes files for export")
    Rel(toneAnalyzer, rtspCam, "Connects via ffmpeg WebSocket proxy on localhost:9999")
```

## Key Observations

- **No backend server**: ToneAnalyzer is entirely client-side. No data leaves the user's device unless explicitly exported.
- **Privacy by architecture**: Audio/video streams are processed in-browser using Web Audio API and TensorFlow.js. No cloud AI services are invoked.
- **HTTPS requirement**: Production deployments require HTTPS for `getUserMedia` access (microphone/camera). Only `localhost` is exempt.
- **Platform reach**: The same React SPA deploys to web browsers, Electron (desktop), and Capacitor (iOS mobile).
