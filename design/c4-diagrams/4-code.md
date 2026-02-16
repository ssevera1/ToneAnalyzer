# C4 Level 4 — Code Diagrams

Class-level detail for the two core processing pipelines.

## Voice Analysis Pipeline — Class Diagram

```mermaid
classDiagram
    class AudioEngine {
        -audioContext: AudioContext
        -analyserNode: AnalyserNode
        -sourceNode: MediaStreamAudioSourceNode
        -workletNode: AudioWorkletNode
        -stream: MediaStream
        -fftSize: 8192
        -isRunning: boolean
        +initialize(): Promise~void~
        +startMicrophone(): Promise~void~
        +loadFile(file: File): Promise~void~
        +stop(): void
        +getFrequencyData(): Float32Array
        +getTimeDomainData(): Float32Array
        +onData: (freq: Float32Array, time: Float32Array) => void
        -setupAnalyser(): void
        -setupWorklet(): Promise~void~
    }

    class StressAnalyzer {
        -sampleRate: number
        -f0History: number[]
        -amplitudeHistory: number[]
        -pitchPeriods: number[]
        -MICROTREMOR_LOW: 8
        -MICROTREMOR_HIGH: 14
        -F0_MIN: 50
        -F0_MAX: 500
        +analyze(frequencyData: Float32Array, timeData: Float32Array): StressMetrics
        -analyzeMicrotremor(frequencyData: Float32Array): MicrotremorResult
        -detectF0(timeData: Float32Array): number
        -calculateJitter(periods: number[]): number
        -calculateShimmer(amplitudes: number[]): number
        -calculateHNR(timeData: Float32Array, f0: number): number
        -computeStressScore(metrics: RawMetrics): number
    }

    class StressMetrics {
        <<interface>>
        +stressLevel: number
        +f0: number
        +f0Variance: number
        +jitter: number
        +shimmer: number
        +hnr: number
        +microtremorAmplitude: number
        +microtremorFrequency: number
    }

    class StressReading {
        <<interface>>
        +timestamp: number
        +stressLevel: number
        +metrics: StressMetrics
    }

    class VoiceSession {
        <<interface>>
        +id: string
        +name: string
        +startTime: number
        +endTime?: number
        +readings: StressReading[]
    }

    class useVoiceAnalysis {
        <<hook>>
        -audioEngine: AudioEngine
        -stressAnalyzer: StressAnalyzer
        -animationFrameId: number
        +isAnalyzing: boolean
        +currentMetrics: StressMetrics
        +startMicrophone(): Promise~void~
        +loadFile(file: File): Promise~void~
        +stopAnalysis(): void
        -processFrame(): void
    }

    class useVoiceStore {
        <<zustand>>
        +currentSession: VoiceSession | null
        +sessions: VoiceSession[]
        +currentMetrics: StressMetrics | null
        +frequencyData: Float32Array | null
        +timeDomainData: Float32Array | null
        +isAnalyzing: boolean
        +startSession(name: string): void
        +addReading(metrics: StressMetrics): void
        +finalizeSession(): void
        +setFrequencyData(data: Float32Array): void
    }

    AudioEngine ..> StressAnalyzer : feeds audio data
    StressAnalyzer ..> StressMetrics : produces
    useVoiceAnalysis --> AudioEngine : owns
    useVoiceAnalysis --> StressAnalyzer : owns
    useVoiceAnalysis --> useVoiceStore : updates
    useVoiceStore --> VoiceSession : manages
    VoiceSession *-- StressReading : contains
    StressReading *-- StressMetrics : contains
```

## Stress Score Computation

```mermaid
flowchart LR
    subgraph Inputs ["Raw Audio Data"]
        freq["frequencyData\n(Float32Array, 4096 bins)"]
        time["timeDomainData\n(Float32Array, 8192 samples)"]
    end

    subgraph Analysis ["StressAnalyzer"]
        micro["Microtremor Analysis\n(8-14 Hz bandpass)"]
        f0["F0 Detection\n(autocorrelation, 50-500 Hz)"]
        jit["Jitter Calculation\n(cycle-to-cycle pitch Δ)"]
        shim["Shimmer Calculation\n(cycle-to-cycle amplitude Δ)"]
        hnr["HNR Calculation\n(harmonic-to-noise ratio)"]
    end

    subgraph Weights ["Composite Score Weights"]
        w1["Microtremor: 30%"]
        w2["F0 Variance: 25%"]
        w3["Jitter: 20%"]
        w4["Shimmer: 15%"]
        w5["HNR: 10%"]
    end

    subgraph Output ["Stress Level"]
        score["0-100 Score\n🟢 <30 Low\n🟡 30-70 Moderate\n🔴 >70 High"]
    end

    freq --> micro
    time --> f0
    f0 --> jit
    f0 --> shim
    time --> hnr

    micro --> w1 --> score
    f0 --> w2 --> score
    jit --> w3 --> score
    shim --> w4 --> score
    hnr --> w5 --> score
```

## Emotion Detection Pipeline — Class Diagram

```mermaid
classDiagram
    class EmotionEngine {
        -isInitialized: boolean
        -currentFeedIndex: number
        -detectionInterval: number
        -intervalId: number
        +initialize(): Promise~void~
        +startDetection(sources: VideoSource[]): void
        +stopDetection(): void
        +onResults: (sourceId: string, readings: EmotionReading[]) => void
        -detectFaces(video: HTMLVideoElement): Promise~DetectionResult[]~
        -processNextFeed(): void
        -loadModels(): Promise~void~
    }

    class ExpressionAnalyzer {
        -emotionHistory: Map~string, EmotionReading[]~
        -HISTORY_WINDOW: 3000-12000ms
        -PRIME_WINDOW: 60000ms
        -PRIME_RECALC: 15000ms
        +analyzeCompound(emotions: EmotionRecord): CompoundEmotion[]
        +analyzeTemporal(faceId: string, current: EmotionRecord): TemporalIndicator[]
        +calculateVAD(emotions: EmotionRecord): VADScore
        +getPrimeEmotion(faceId: string): string
        -detectDupingDelight(emotions): boolean
        -detectEmotionMasking(history): boolean
        -detectExpressionFreeze(history): boolean
        -detectEmotionalVolatility(history): boolean
    }

    class VideoSourceManager {
        -sources: Map~string, VideoSource~
        -maxSources: number
        +addWebcam(deviceId?: string): Promise~VideoSource~
        +addFile(file: File): Promise~VideoSource~
        +addScreen(): Promise~VideoSource~
        +addRTSP(url: string): Promise~VideoSource~
        +removeSource(id: string): void
        +pauseSource(id: string): void
        +resumeSource(id: string): void
        +getSources(): VideoSource[]
        -createVideoElement(stream: MediaStream): HTMLVideoElement
        -validateRTSPUrl(url: string): boolean
    }

    class VideoSource {
        <<interface>>
        +id: string
        +name: string
        +type: VideoSourceType
        +status: VideoSourceStatus
        +stream: MediaStream | null
        +videoElement: HTMLVideoElement | null
        +url?: string
        +deviceId?: string
    }

    class EmotionReading {
        <<interface>>
        +timestamp: number
        +faceId: string
        +emotions: Record~Emotion, number~
        +dominantEmotion: Emotion
        +confidence: number
        +boundingBox: BoundingBox
        +expressionLabels?: ExpressionLabel[]
        +vad?: VADScore
        +primeEmotion?: string
    }

    class Emotion {
        <<enumeration>>
        neutral
        happy
        sad
        angry
        fearful
        disgusted
        surprised
    }

    class useEmotionDetection {
        <<hook>>
        -emotionEngine: EmotionEngine
        -expressionAnalyzer: ExpressionAnalyzer
        -videoSourceManager: VideoSourceManager
        +isMonitoring: boolean
        +addSource(type, config): Promise~void~
        +removeSource(id): void
        +startMonitoring(): Promise~void~
        +stopMonitoring(): void
    }

    EmotionEngine ..> EmotionReading : produces
    EmotionEngine --> VideoSource : processes video from
    ExpressionAnalyzer ..> EmotionReading : enriches with labels
    VideoSourceManager --> VideoSource : manages lifecycle
    useEmotionDetection --> EmotionEngine : owns
    useEmotionDetection --> ExpressionAnalyzer : owns
    useEmotionDetection --> VideoSourceManager : owns
    EmotionReading --> Emotion : references
```

## Expression Analysis Rules — Categorization

```mermaid
mindmap
    root((ExpressionAnalyzer<br>50+ Rules))
        Compound Emotions<br>(Single-Frame)
            Deception Signals
                Duping Delight
                Contempt
                Smugness
                Emotion Masking
            Fear & Stress
                Apprehension
                Anxiety
                Alarm
                Horror
            Anger Spectrum
                Frustration
                Resentment
                Indignation
                Defiance
            Sadness Spectrum
                Disappointment
                Guilt
                Shame
                Resignation
            Positive
                Relief
                Anticipation
                Adoration
                Awe
            Social/Evaluative
                Embarrassment
                Suspicion
                Skepticism
                Confusion
                Interest
                Boredom
        Temporal Indicators<br>(History-Based, 3-12s)
            Deception
                Emotional Incongruence
                Squelched Expression
                Expression Freeze
                Held Expression
                Rapid Onset
            Stress/Cognitive
                Emotional Volatility
                Elevated Stress
                Arousal Spike
                Sustained Tension
                Expression Dampening
            Comfort/Rapport
                Baseline Comfort
                Genuine Engagement
        Dimensional Model
            Valence<br>positive↔negative
            Arousal<br>calm↔excited
            Dominance<br>submissive↔dominant
        Prime Emotion
            60s Rolling Window
            Recalculates every 15s
```
