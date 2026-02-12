# ToneAnalyzer

Cross-platform voice stress analysis (CVSA) and multi-video emotion detection application built with React, Electron, and Capacitor.

## Features

### Voice Stress Analysis (CVSA)
- Real-time microphone capture or audio file upload
- Microtremor analysis (8–14 Hz band) — stress suppresses muscle microtremors
- Fundamental frequency (F0) tracking via autocorrelation pitch detection
- Jitter (cycle-to-cycle pitch perturbation)
- Shimmer (cycle-to-cycle amplitude perturbation)
- Harmonic-to-Noise Ratio (HNR)
- Composite stress score (0–100) with weighted metrics
- Live waveform and scrolling spectrogram visualizations
- Circular stress gauge with color-coded severity levels
- Session recording with full reading history

### Multi-Video Emotion Detection
- Monitor up to 12 simultaneous video feeds
- Source types: webcam, screen capture, video file, RTSP/IP camera (Electron)
- Real-time face detection via TinyFaceDetector (face-api.js)
- 7 base emotions: neutral, happy, sad, angry, fearful, disgusted, surprised
- Bounding box overlays with emotion badges on each detected face
- Configurable grid layouts: 1, 2×2, 2×3, 3×3, 3×4
- Round-robin processing across feeds for GPU efficiency

### Derived Expression Labels (50+)
Each video panel displays derived behavioral labels at the bottom, computed from base emotion combinations and temporal patterns:

| Category | Examples |
|---|---|
| **Deception** | Duping Delight, Emotion Masking, Emotional Incongruence, Squelched Expression, Expression Freeze, Held Expression, Rapid Onset |
| **Contempt / Hostility** | Contempt, Smugness, Defiance, Hatred, Resentment, Indignation, Exasperation, Schadenfreude |
| **Fear / Stress** | Apprehension, Anxiety, Alarm, Horror, Arousal Spike, Elevated Stress, Sustained Tension |
| **Sadness** | Disappointment, Guilt, Shame, Resignation, Nostalgia, Bittersweet, Pity |
| **Social / Evaluative** | Embarrassment, Envy, Jealousy, Suspicion, Skepticism, Confusion, Interest, Boredom, Apathy |
| **Positive** | Relief, Anticipation, Adoration, Awe |
| **Behavioral** | Determination, Submission, Dominance, Frustration, Emotional Volatility, Expression Dampening, Baseline Comfort, Genuine Engagement |

Labels are color-coded by category and show confidence percentages. Deception indicators are highlighted with red borders.

### Data Export
- CSV export with full metric columns for voice or emotion sessions
- PDF report generation with summary statistics and data tables
- Session persistence via IndexedDB (Dexie.js)

### Cross-Platform
- **Web**: Runs in any modern browser
- **Desktop**: Electron packaging for Windows and macOS
- **Mobile**: Capacitor for iOS (camera/mic permissions, 4-feed limit)

## Tech Stack

| Layer | Technology |
|---|---|
| UI | React 18, TypeScript, Tailwind CSS |
| Build | Vite |
| State | Zustand |
| Audio | Web Audio API (AnalyserNode + AudioWorklet) |
| Face/Emotion | TensorFlow.js, @vladmandic/face-api |
| Charts | Recharts |
| Storage | IndexedDB via Dexie.js |
| Export | jsPDF, PapaParse |
| Desktop | Electron |
| Mobile | Capacitor |

## Getting Started

### Prerequisites
- Node.js 18+
- npm 9+

### Install & Run

```bash
git clone https://github.com/ssevera1/ToneAnalyzer.git
cd ToneAnalyzer
npm install
npm run dev
```

Open http://localhost:5173 in your browser.

### Electron (Desktop)

```bash
npm run electron:dev    # Dev mode with hot reload
npm run electron:build  # Package for Windows/macOS
```

### iOS (Capacitor)

```bash
npm run build
npm run ios:sync
npm run ios:open        # Opens Xcode
```

## Project Structure

```
src/
├── components/          # Shared UI components
│   ├── Layout.tsx       # Dark theme shell + sidebar
│   ├── Sidebar.tsx      # Navigation sidebar
│   ├── StressGauge.tsx  # Circular SVG gauge (0-100)
│   ├── Waveform.tsx     # Real-time waveform canvas
│   ├── Spectrogram.tsx  # Scrolling spectrogram canvas
│   ├── VideoPanel.tsx   # Video feed + emotion overlay + expression labels
│   ├── VideoGrid.tsx    # Grid of 1-12 VideoPanel components
│   ├── EmotionBadge.tsx # Emotion label pill
│   ├── ExpressionLabels.tsx  # Derived expression label bar
│   └── ExportDialog.tsx # CSV/PDF export modal
├── features/
│   ├── voice-analysis/
│   │   ├── AudioEngine.ts       # Web Audio API capture + FFT
│   │   ├── StressAnalyzer.ts    # CVSA algorithms
│   │   ├── VoiceAnalysisPage.tsx
│   │   └── useVoiceAnalysis.ts
│   ├── emotion-detection/
│   │   ├── EmotionEngine.ts     # face-api.js wrapper
│   │   ├── ExpressionAnalyzer.ts # 50+ derived expression rules
│   │   ├── VideoSourceManager.ts
│   │   ├── EmotionMonitorPage.tsx
│   │   └── useEmotionDetection.ts
│   └── settings/
│       └── SettingsPage.tsx
├── services/
│   ├── database.ts      # Dexie.js IndexedDB schema
│   ├── exportService.ts # CSV/PDF generation
│   └── platformUtils.ts # Platform detection
├── stores/              # Zustand state stores
│   ├── appStore.ts
│   ├── voiceStore.ts
│   └── emotionStore.ts
└── types/               # TypeScript interfaces
    ├── audio.ts
    ├── emotion.ts
    └── video.ts
electron/
├── main.ts              # Electron main process
├── preload.ts           # IPC bridge
└── rtsp-proxy.ts        # RTSP→WebSocket relay
```

## Stress Score Calculation

The composite stress score is a weighted combination:

| Metric | Weight | Stress Indicator |
|---|---|---|
| Microtremor amplitude | 30% | Lower = more stress (inverted) |
| F0 variance | 25% | Higher = more stress |
| Jitter | 20% | Higher = more stress |
| Shimmer | 15% | Higher = more stress |
| HNR | 10% | Lower = more stress (inverted) |

## License

MIT
