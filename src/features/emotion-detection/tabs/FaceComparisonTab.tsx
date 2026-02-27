import { useState, useEffect, useCallback, useRef } from 'react';
import type { EmotionEngine } from '../EmotionEngine';
import type { FaceComparisonResult } from '../../../types/facescope';
import ModelLoadingOverlay from './ModelLoadingOverlay';

interface FaceComparisonTabProps {
  engine: EmotionEngine;
}

const MATCH_THRESHOLD = 0.6;

export default function FaceComparisonTab({ engine }: FaceComparisonTabProps) {
  const [modelsLoading, setModelsLoading] = useState(true);
  const [modelError, setModelError] = useState<string | null>(null);
  const [image1, setImage1] = useState<string | null>(null);
  const [image2, setImage2] = useState<string | null>(null);
  const [comparing, setComparing] = useState(false);
  const [result, setResult] = useState<FaceComparisonResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const drop1Ref = useRef<HTMLDivElement>(null);
  const drop2Ref = useRef<HTMLDivElement>(null);
  const file1Ref = useRef<HTMLInputElement>(null);
  const file2Ref = useRef<HTMLInputElement>(null);

  const loadModels = useCallback(async () => {
    try {
      setModelsLoading(true);
      setModelError(null);
      await engine.loadModels(['ssdMobilenetv1', 'faceLandmark68', 'faceRecognition']);
      setModelsLoading(false);
    } catch {
      setModelError('Failed to load comparison models');
      setModelsLoading(false);
    }
  }, [engine]);

  useEffect(() => {
    loadModels();
  }, [loadModels]);

  const handleFile = (file: File, slot: 1 | 2) => {
    const url = URL.createObjectURL(file);
    if (slot === 1) setImage1(url);
    else setImage2(url);
    setResult(null);
    setError(null);
  };

  const handleDrop = (e: React.DragEvent, slot: 1 | 2) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) handleFile(file, slot);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>, slot: 1 | 2) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file, slot);
  };

  const compare = async () => {
    if (!image1 || !image2) return;
    const faceapi = engine.getFaceApi();
    if (!faceapi) return;

    setComparing(true);
    setError(null);
    setResult(null);

    try {
      const loadImg = (src: string): Promise<HTMLImageElement> =>
        new Promise((resolve, reject) => {
          const img = new Image();
          img.onload = () => resolve(img);
          img.onerror = reject;
          img.src = src;
        });

      const [img1, img2] = await Promise.all([loadImg(image1), loadImg(image2)]);

      const det1 = await faceapi
        .detectSingleFace(img1, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 }))
        .withFaceLandmarks()
        .withFaceDescriptor();

      const det2 = await faceapi
        .detectSingleFace(img2, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 }))
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (!det1 || !det2) {
        setError(!det1 && !det2 ? 'No face detected in either image' : !det1 ? 'No face detected in Image 1' : 'No face detected in Image 2');
        setComparing(false);
        return;
      }

      const distance = faceapi.euclideanDistance(det1.descriptor, det2.descriptor);
      const similarity = Math.max(0, Math.min(100, (1 - distance / 1.5) * 100));

      setResult({
        distance,
        similarity,
        isMatch: distance < MATCH_THRESHOLD,
        threshold: MATCH_THRESHOLD,
      });
    } catch (err: any) {
      setError(err?.message || 'Comparison failed');
    } finally {
      setComparing(false);
    }
  };

  const DropZone = ({ slot, image, fileRef }: { slot: 1 | 2; image: string | null; fileRef: React.RefObject<HTMLInputElement> }) => (
    <div
      className="flex-1 bg-dark-800 rounded-lg border-2 border-dashed border-dark-600 hover:border-accent-cyan/50 transition-colors cursor-pointer flex items-center justify-center min-h-[250px] relative overflow-hidden"
      onDrop={(e) => handleDrop(e, slot)}
      onDragOver={(e) => e.preventDefault()}
      onClick={() => fileRef.current?.click()}
    >
      {image ? (
        <img src={image} alt={`Face ${slot}`} className="max-w-full max-h-full object-contain" />
      ) : (
        <div className="text-center p-4">
          <svg className="w-10 h-10 text-dark-500 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 16v-8m0 0l-3 3m3-3l3 3M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5" />
          </svg>
          <p className="text-sm text-dark-400">Drop image or click to upload</p>
          <p className="text-xs text-dark-500 mt-1">Image {slot}</p>
        </div>
      )}
      <input ref={fileRef} type="file" accept="image/*" onChange={(e) => handleFileInput(e, slot)} className="hidden" />
    </div>
  );

  return (
    <div className="flex flex-col h-full p-4 gap-4 relative">
      <ModelLoadingOverlay isLoading={modelsLoading} error={modelError} onRetry={loadModels} />

      {/* Drop zones */}
      <div className="flex gap-4 flex-1 min-h-0">
        <DropZone slot={1} image={image1} fileRef={file1Ref} />
        <DropZone slot={2} image={image2} fileRef={file2Ref} />
      </div>

      {/* Compare button + results */}
      <div className="flex flex-col items-center gap-3">
        <button
          onClick={compare}
          disabled={!image1 || !image2 || comparing || modelsLoading}
          className="px-6 py-2 bg-accent-cyan text-dark-900 rounded-lg font-medium hover:bg-accent-cyan/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {comparing ? 'Comparing...' : 'Compare Faces'}
        </button>

        {error && <p className="text-sm text-accent-red">{error}</p>}

        {result && (
          <div className="w-full max-w-md bg-dark-800 rounded-lg p-4">
            {/* Match badge */}
            <div className="flex items-center justify-center mb-3">
              <span className={`px-4 py-1.5 rounded-full text-sm font-bold ${result.isMatch ? 'bg-accent-green/20 text-accent-green' : 'bg-accent-red/20 text-accent-red'}`}>
                {result.isMatch ? 'MATCH' : 'NO MATCH'}
              </span>
            </div>

            {/* Stats */}
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-dark-400">Similarity</span>
                <span className="text-white font-medium">{result.similarity.toFixed(1)}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-dark-400">Distance</span>
                <span className="text-white font-medium">{result.distance.toFixed(4)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-dark-400">Threshold</span>
                <span className="text-dark-300">&lt; {result.threshold}</span>
              </div>

              {/* Confidence bar */}
              <div className="mt-2">
                <div className="h-2 bg-dark-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${result.isMatch ? 'bg-accent-green' : 'bg-accent-red'}`}
                    style={{ width: `${result.similarity}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
