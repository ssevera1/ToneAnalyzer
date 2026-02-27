# Data Flow & Latency Diagrams

Supplementary diagrams showing end-to-end data flow and latency budgets.

## End-to-End Data Flow

```mermaid
flowchart TB
    subgraph Input ["Input Sources"]
        mic["🎙 Microphone\n(getUserMedia)"]
        audioFile["📁 Audio File\n(.wav, .mp3, .ogg)"]
        webcam["📷 Webcam\n(getUserMedia)"]
        videoFile["📁 Video File\n(.mp4, .webm)"]
        screen["🖥 Screen Capture\n(getDisplayMedia)"]
        rtsp["📡 RTSP Camera\n(ffmpeg proxy)"]
    end

    subgraph AudioPipeline ["Voice Stress Analysis Pipeline"]
        direction TB
        audioCtx["AudioContext\n(sample rate: 44.1/48 kHz)"]
        analyser["AnalyserNode\n(FFT size: 8192)"]
        worklet["AudioWorklet\n(raw PCM capture)"]
        freqData["frequencyData\n(4096 float bins)"]
        timeData["timeDomainData\n(8192 float samples)"]
        stressCalc["StressAnalyzer\n(CVSA algorithms)"]
        metrics["StressMetrics\n{stressLevel, f0, jitter,\nshimmer, hnr, microtremor}"]
    end

    subgraph EmotionPipeline ["Emotion Detection Pipeline"]
        direction TB
        videoEl["HTMLVideoElement\n(per source)"]
        tfjs["TensorFlow.js\n(WebGL backend)"]
        faceDetect["TinyFaceDetector\n(input: 416x416)"]
        exprNet["FaceExpressionNet\n(7 emotion probs)"]
        exprAnalyze["ExpressionAnalyzer\n(50+ derived labels)"]
        emotionResult["EmotionReading\n{emotions, labels,\nVAD, primeEmotion}"]
    end

    subgraph TranscriptionPipeline ["Voice Transcription (Emotion Monitor)"]
        direction TB
        speechApi["Web Speech API\n(SpeechRecognition)"]
        monitorHook["useMonitorTranscription\n(maps deceit scores)"]
        transcriptSeg["TranscriptSegment\n{text, deceit, stress}"]
    end

    subgraph State ["State Management (Zustand)"]
        voiceStore["useVoiceStore\n• currentSession\n• readings[]\n• transcript[]\n• freq/time data"]
        emotionStore["useEmotionStore\n• sources[]\n• readings Map\n• session\n• transcript[]"]
        appStore["useAppStore\n• settings\n• thresholds"]
    end

    subgraph Rendering ["UI Rendering (~60 FPS)"]
        gauge["Stress Gauge\n(SVG circle)"]
        waveform["Waveform\n(Canvas 2D)"]
        spectro["Spectrogram\n(Canvas 2D, scrolling)"]
        metricCards["Metric Cards\n(React components)"]
        videoPanels["Video Panels\n(Canvas overlay)"]
        badges["Emotion Badges\n(React components)"]
        exprLabels["Expression Labels\n(color-coded bars)"]
        transcriptPanel["TranscriptPanel\n(live speech text + deceit)"]
    end

    subgraph Persistence ["Persistence & Export"]
        indexeddb[("IndexedDB\n(Dexie.js)\n4 tables")]
        csv["CSV Export\n(PapaParse)"]
        pdf["PDF Export\n(jsPDF)"]
    end

    mic --> audioCtx
    audioFile --> audioCtx
    audioCtx --> analyser --> freqData
    audioCtx --> worklet --> timeData
    freqData --> stressCalc
    timeData --> stressCalc
    stressCalc --> metrics

    webcam --> videoEl
    videoFile --> videoEl
    screen --> videoEl
    rtsp -->|"ws://127.0.0.1:9999\n(Electron only)"| videoEl
    videoEl --> tfjs --> faceDetect --> exprNet --> exprAnalyze --> emotionResult

    mic -->|"concurrent with audio pipeline"| speechApi
    speechApi --> monitorHook
    monitorHook -->|"max facial deceit"| transcriptSeg

    metrics --> voiceStore
    emotionResult --> emotionStore
    transcriptSeg --> emotionStore

    voiceStore --> gauge
    voiceStore --> waveform
    voiceStore --> spectro
    voiceStore --> metricCards
    emotionStore --> videoPanels
    emotionStore --> badges
    emotionStore --> exprLabels
    emotionStore --> transcriptPanel

    voiceStore --> indexeddb
    emotionStore --> indexeddb
    voiceStore --> csv
    voiceStore --> pdf
    emotionStore --> csv
    emotionStore --> pdf
```

## Latency Budget — Voice Analysis

```mermaid
gantt
    title Voice Analysis Frame Latency Budget (~16.7ms target at 60 FPS)
    dateFormat X
    axisFormat %Lms

    section Audio Capture
    getUserMedia buffer         :a1, 0, 3
    AnalyserNode FFT (8192)     :a2, 3, 5

    section DSP Processing
    Microtremor bandpass (8-14Hz) :b1, 5, 7
    F0 autocorrelation           :b2, 7, 10
    Jitter + Shimmer calc        :b3, 10, 12
    HNR calculation              :b4, 12, 13
    Composite score              :b5, 13, 14

    section State + Render
    Zustand store update         :c1, 14, 14
    React reconciliation         :c2, 14, 15
    Canvas draw (waveform+spectro):c3, 15, 17
```

> **Note**: The 8192-sample FFT at 44.1 kHz gives ~186ms of audio per frame. Analysis runs on the latest buffer each animation frame. The DSP computations are lightweight (pure math on typed arrays) and consistently complete within the 16.7ms frame budget.

## Latency Budget — Emotion Detection

```mermaid
gantt
    title Emotion Detection Per-Feed Latency Budget (~100ms target at 10 FPS)
    dateFormat X
    axisFormat %Lms

    section Video Capture
    Video frame decode          :a1, 0, 5

    section ML Inference (WebGL)
    Canvas drawImage (resize)   :b1, 5, 7
    TinyFaceDetector forward    :b2, 7, 45
    FaceExpressionNet forward   :b3, 45, 75

    section Post-Processing
    Expression rules (50+ checks):c1, 75, 82
    Temporal analysis (history)  :c2, 82, 88
    VAD + Prime calculation      :c3, 88, 92

    section State + Render
    Zustand store update         :d1, 92, 93
    React reconciliation         :d2, 93, 95
    Canvas overlay (bbox + labels):d3, 95, 100
```

> **Note**: With round-robin scheduling, each feed gets processed once every `100ms × N` where N = number of active feeds. For 4 feeds, each gets ~2.5 FPS effective; for 12 feeds, ~0.83 FPS effective. This is intentional — GPU contention from parallel inference would degrade all feeds.

## Round-Robin GPU Scheduling

```mermaid
sequenceDiagram
    participant Timer as setInterval(100ms)
    participant EE as EmotionEngine
    participant GPU as WebGL Backend
    participant F1 as Feed 1
    participant F2 as Feed 2
    participant F3 as Feed 3
    participant F4 as Feed 4

    Note over Timer,F4: 4 active feeds, 10 FPS timer

    Timer->>EE: tick (t=0ms)
    EE->>GPU: detectFaces(Feed 1)
    GPU->>F1: results → render

    Timer->>EE: tick (t=100ms)
    EE->>GPU: detectFaces(Feed 2)
    GPU->>F2: results → render

    Timer->>EE: tick (t=200ms)
    EE->>GPU: detectFaces(Feed 3)
    GPU->>F3: results → render

    Timer->>EE: tick (t=300ms)
    EE->>GPU: detectFaces(Feed 4)
    GPU->>F4: results → render

    Timer->>EE: tick (t=400ms)
    EE->>GPU: detectFaces(Feed 1)
    GPU->>F1: results → render

    Note over F1,F4: Each feed: ~2.5 FPS effective
```

## Data Persistence Schema

```mermaid
erDiagram
    VOICE_SESSIONS {
        string id PK "UUID"
        string name "User-provided label"
        number startTime "Unix timestamp ms"
        number endTime "Unix timestamp ms"
    }

    STRESS_READINGS {
        number id PK "Auto-increment"
        string sessionId FK "→ VOICE_SESSIONS.id"
        number timestamp "Unix timestamp ms"
        number stressLevel "0-100"
        number f0 "Hz"
        number f0Variance "Hz²"
        number jitter "percent"
        number shimmer "percent"
        number hnr "dB"
        number microtremorAmplitude "normalized"
        number microtremorFrequency "Hz"
    }

    VOICE_TRANSCRIPT_SEGMENTS {
        string id PK "seg-N"
        string sessionId FK "→ VOICE_SESSIONS.id"
        string text "Transcribed speech"
        number startTime "Unix timestamp ms"
        number endTime "Unix timestamp ms"
        number averageStress "0-100"
        number averageDeceit "0-100"
        number peakStress "0-100"
        number peakDeceit "0-100"
    }

    EMOTION_SESSIONS {
        string id PK "UUID"
        string name "User-provided label"
        number startTime "Unix timestamp ms"
        number endTime "Unix timestamp ms"
        number sourceCount "Number of video sources"
    }

    EMOTION_READINGS {
        number id PK "Auto-increment"
        string sessionId FK "→ EMOTION_SESSIONS.id"
        number timestamp "Unix timestamp ms"
        string faceId "Tracked face identifier"
        string dominantEmotion "Emotion enum value"
        number confidence "0-1"
        string emotions "JSON: 7 emotion probabilities"
        string boundingBox "JSON: x, y, width, height"
    }

    EMOTION_TRANSCRIPT_SEGMENTS {
        string id PK "emo-seg-N"
        string sessionId FK "→ EMOTION_SESSIONS.id"
        string text "Transcribed speech"
        number startTime "Unix timestamp ms"
        number endTime "Unix timestamp ms"
        number averageStress "Always 0 (no acoustic analysis)"
        number averageDeceit "0-100 (max facial deceit)"
        number peakStress "Always 0"
        number peakDeceit "0-100"
    }

    VOICE_SESSIONS ||--o{ STRESS_READINGS : contains
    VOICE_SESSIONS ||--o{ VOICE_TRANSCRIPT_SEGMENTS : contains
    EMOTION_SESSIONS ||--o{ EMOTION_READINGS : contains
    EMOTION_SESSIONS ||--o{ EMOTION_TRANSCRIPT_SEGMENTS : contains
```
