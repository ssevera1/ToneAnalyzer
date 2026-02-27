import { useState, useEffect, useCallback, useRef } from 'react';
import type { EmotionEngine } from '../EmotionEngine';
import type { FaceAnalysisResult } from '../../../types/facescope';
import type { Emotion } from '../../../types/emotion';
import { useTabCamera } from './useTabCamera';
import ModelLoadingOverlay from './ModelLoadingOverlay';
import DeceitGauge from '../../../components/DeceitGauge';

interface FaceAnalysisTabProps {
  engine: EmotionEngine;
}

const EMOTION_COLORS: Record<Emotion, string> = {
  neutral: '#94a3b8',
  happy: '#facc15',
  sad: '#3b82f6',
  angry: '#ef4444',
  fearful: '#a855f7',
  disgusted: '#22c55e',
  surprised: '#f97316',
};

/**
 * Compute a visual-deceit score (0-100) from a single face's expression mix.
 * Uses the same deception-adjacent signals as the ExpressionAnalyzer:
 *  - Emotional incongruence (smile + negative affect): 30%
 *  - Contempt pattern (happy + angry + neutral): 20%
 *  - Duping delight pattern (happy + fearful/surprised + neutral): 25%
 *  - Expression dampening (all emotions very low): 15%
 *  - Smugness pattern: 10%
 */
function computeFaceDeceit(e: Record<Emotion, number>): number {
  let score = 0;

  // Emotional incongruence: smile with leaked negative affect
  if (e.happy > 0.25 && (e.fearful > 0.10 || e.disgusted > 0.10 || e.angry > 0.10)) {
    const conf = Math.min(1, e.happy * 0.5 + Math.max(e.fearful, e.disgusted, e.angry) * 0.8);
    score += conf * 30;
  }

  // Contempt: unilateral smirk
  if (e.happy >= 0.12 && e.happy <= 0.45 && e.angry >= 0.08 && e.angry <= 0.40 && e.neutral > 0.15) {
    const conf = Math.min(1, (e.happy + e.angry) * 1.2);
    score += conf * 20;
  }

  // Duping delight: pleasure from deception
  if (e.happy >= 0.15 && e.happy <= 0.45 && (e.fearful > 0.08 || e.surprised > 0.08) && e.neutral > 0.15) {
    const conf = Math.min(1, e.happy * 0.8 + e.fearful * 0.5);
    score += conf * 25;
  }

  // Expression dampening: all emotions low = intentional suppression
  const maxEmotion = Math.max(e.happy, e.sad, e.angry, e.fearful, e.disgusted, e.surprised);
  if (maxEmotion < 0.30 && e.neutral > 0.40) {
    score += Math.min(1, 1 - maxEmotion * 3) * 15;
  }

  // Smugness: self-satisfied superiority
  if (e.happy >= 0.20 && e.happy <= 0.55 && e.angry >= 0.03 && e.angry <= 0.22 && e.neutral > 0.18) {
    const conf = Math.min(1, e.happy * 0.9);
    score += conf * 10;
  }

  return Math.max(0, Math.min(100, Math.round(score)));
}

export default function FaceAnalysisTab({ engine }: FaceAnalysisTabProps) {
  const [modelsLoading, setModelsLoading] = useState(true);
  const [modelError, setModelError] = useState<string | null>(null);
  const [results, setResults] = useState<FaceAnalysisResult[]>([]);
  const [deceitScores, setDeceitScores] = useState<number[]>([]);
  const [mode, setMode] = useState<'camera' | 'image'>('camera');
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const imageCanvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadModels = useCallback(async () => {
    try {
      setModelsLoading(true);
      setModelError(null);
      await engine.loadModels(['ssdMobilenetv1', 'faceLandmark68', 'faceExpression', 'ageGender']);
      setModelsLoading(false);
    } catch {
      setModelError('Failed to load analysis models');
      setModelsLoading(false);
    }
  }, [engine]);

  useEffect(() => {
    loadModels();
  }, [loadModels]);

  const processDetections = (detections: any[]): { results: FaceAnalysisResult[]; scores: number[] } => {
    const results: FaceAnalysisResult[] = [];
    const scores: number[] = [];
    for (const d of detections) {
      const expressions = d.expressions as Record<Emotion, number>;
      const sorted = (Object.entries(expressions) as [Emotion, number][]).sort((a, b) => b[1] - a[1]);
      results.push({
        box: { x: d.detection.box.x, y: d.detection.box.y, width: d.detection.box.width, height: d.detection.box.height },
        age: d.age,
        gender: d.gender,
        genderProbability: d.genderProbability,
        expressions,
        dominantExpression: sorted[0]?.[0] ?? 'neutral',
      });
      scores.push(computeFaceDeceit(expressions));
    }
    return { results, scores };
  };

  const drawOverlays = useCallback((canvas: HTMLCanvasElement, source: HTMLVideoElement | HTMLImageElement, detections: any[]) => {
    const faceapi = engine.getFaceApi();
    if (!faceapi) return;

    const displaySize = { width: source instanceof HTMLVideoElement ? source.videoWidth : source.naturalWidth, height: source instanceof HTMLVideoElement ? source.videoHeight : source.naturalHeight };
    canvas.width = displaySize.width;
    canvas.height = displaySize.height;
    faceapi.matchDimensions(canvas, displaySize);

    const resized = faceapi.resizeResults(detections, displaySize);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const isFlipped = source instanceof HTMLVideoElement;
    const w = canvas.width;

    resized.forEach((det: any) => {
      const { age, gender, genderProbability } = det;
      const box = det.detection.box;
      const bx = isFlipped ? w - box.x - box.width : box.x;

      // Bounding box
      ctx.strokeStyle = '#00d4ff';
      ctx.lineWidth = 2;
      ctx.strokeRect(bx, box.y, box.width, box.height);

      // Age/gender label
      const label = `${gender} (${(genderProbability * 100).toFixed(0)}%) | Age: ${Math.round(age)}`;
      ctx.font = '12px sans-serif';
      const tw = ctx.measureText(label).width;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
      ctx.fillRect(bx, box.y + box.height + 2, tw + 8, 18);
      ctx.fillStyle = '#ffffff';
      ctx.fillText(label, bx + 4, box.y + box.height + 15);
    });
  }, [engine]);

  const onFrame = useCallback(async (video: HTMLVideoElement) => {
    const faceapi = engine.getFaceApi();
    if (!faceapi || modelsLoading) return;

    const detections = await faceapi
      .detectAllFaces(video, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 }))
      .withFaceLandmarks()
      .withFaceExpressions()
      .withAgeAndGender();

    const { results: r, scores } = processDetections(detections);
    setResults(r);
    setDeceitScores(scores);

    if (canvasRef.current) {
      drawOverlays(canvasRef.current, video, detections);
    }
  }, [engine, modelsLoading, drawOverlays]);

  const { videoRef, canvasRef, isStreaming, error: cameraError, startCamera, stopCamera } = useTabCamera({
    fps: 4,
    onFrame,
  });

  useEffect(() => {
    if (!modelsLoading && !modelError && mode === 'camera') {
      startCamera();
    }
    return () => stopCamera();
  }, [modelsLoading, modelError, mode, startCamera, stopCamera]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const url = URL.createObjectURL(file);
    setUploadedImage(url);
    setMode('image');
    stopCamera();

    const img = new Image();
    img.onload = async () => {
      imageRef.current = img;
      await detectOnImage(img);
    };
    img.src = url;
  };

  const detectOnImage = async (img: HTMLImageElement) => {
    const faceapi = engine.getFaceApi();
    if (!faceapi) return;

    const detections = await faceapi
      .detectAllFaces(img, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 }))
      .withFaceLandmarks()
      .withFaceExpressions()
      .withAgeAndGender();

    const { results: r, scores } = processDetections(detections);
    setResults(r);
    setDeceitScores(scores);

    if (imageCanvasRef.current) {
      drawOverlays(imageCanvasRef.current, img, detections);
    }
  };

  return (
    <div className="flex flex-col h-full p-4 gap-4">
      {/* Mode toggle */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => { setMode('camera'); setUploadedImage(null); }}
          className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${mode === 'camera' ? 'bg-accent-cyan/20 text-accent-cyan' : 'text-dark-300 hover:text-white hover:bg-dark-700'}`}
        >
          Camera
        </button>
        <button
          onClick={() => fileInputRef.current?.click()}
          className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${mode === 'image' ? 'bg-accent-cyan/20 text-accent-cyan' : 'text-dark-300 hover:text-white hover:bg-dark-700'}`}
        >
          Upload Image
        </button>
        <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
      </div>

      <div className="flex flex-1 gap-4 min-h-0">
        {/* Video/Image area */}
        <div className="relative flex-1 bg-dark-800 rounded-lg overflow-hidden">
          <ModelLoadingOverlay isLoading={modelsLoading} error={modelError} onRetry={loadModels} />

          {mode === 'camera' ? (
            <>
              <video ref={videoRef} className="w-full h-full object-contain" muted playsInline />
              <canvas ref={canvasRef} className="absolute inset-0 w-full h-full object-contain pointer-events-none" />
              {cameraError && <p className="absolute bottom-2 left-2 text-xs text-accent-red">{cameraError}</p>}
            </>
          ) : uploadedImage ? (
            <div className="relative w-full h-full flex items-center justify-center">
              <img src={uploadedImage} alt="Uploaded" className="max-w-full max-h-full object-contain" />
              <canvas ref={imageCanvasRef} className="absolute inset-0 w-full h-full object-contain pointer-events-none" />
            </div>
          ) : null}
        </div>

        {/* Results panel */}
        <div className="w-72 bg-dark-800 rounded-lg p-3 overflow-y-auto">
          <h3 className="text-sm font-semibold mb-3 text-dark-200">Analysis Results</h3>
          <div className="text-xs text-dark-300 mb-3">
            Faces detected: <span className="text-white font-medium">{results.length}</span>
          </div>

          {/* Aggregate Deceit Gauge — show when any face is detected */}
          {results.length > 0 && deceitScores.length > 0 && (
            <div className="mb-4 p-3 bg-dark-700 rounded">
              <h4 className="text-xs text-dark-300 uppercase tracking-wider mb-2 text-center">Deceit Level</h4>
              <DeceitGauge
                value={Math.max(...deceitScores)}
                size={160}
              />
            </div>
          )}

          {results.map((face, i) => (
            <div key={i} className="mb-4 p-3 bg-dark-700 rounded">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-accent-cyan">Face {i + 1}</span>
                {deceitScores[i] !== undefined && deceitScores[i] > 0 && (
                  <span
                    className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
                    style={{
                      backgroundColor: deceitScores[i] < 25 ? '#22c55e15' : deceitScores[i] < 50 ? '#eab30815' : deceitScores[i] < 75 ? '#f9731615' : '#ef444415',
                      color: deceitScores[i] < 25 ? '#22c55e' : deceitScores[i] < 50 ? '#eab308' : deceitScores[i] < 75 ? '#f97316' : '#ef4444',
                    }}
                  >
                    D: {deceitScores[i]}%
                  </span>
                )}
              </div>

              {/* Age & Gender */}
              <div className="text-xs space-y-1 mb-3">
                <div className="flex justify-between">
                  <span className="text-dark-400">Age</span>
                  <span className="text-white font-medium">{Math.round(face.age)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-dark-400">Gender</span>
                  <span className="text-white font-medium capitalize">{face.gender} ({(face.genderProbability * 100).toFixed(0)}%)</span>
                </div>
              </div>

              {/* Emotion bars */}
              <div className="space-y-1.5">
                {(Object.entries(face.expressions) as [Emotion, number][])
                  .sort((a, b) => b[1] - a[1])
                  .map(([emotion, score]) => (
                    <div key={emotion}>
                      <div className="flex justify-between text-xs mb-0.5">
                        <span className="text-dark-300 capitalize">{emotion}</span>
                        <span className="text-dark-400">{(score * 100).toFixed(0)}%</span>
                      </div>
                      <div className="h-1.5 bg-dark-600 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{ width: `${score * 100}%`, backgroundColor: EMOTION_COLORS[emotion] }}
                        />
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          ))}
          {results.length === 0 && !modelsLoading && (
            <p className="text-xs text-dark-500">No faces detected</p>
          )}
        </div>
      </div>
    </div>
  );
}
