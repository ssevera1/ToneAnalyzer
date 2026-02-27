import { useState, useEffect, useCallback, useRef } from 'react';
import type { EmotionEngine } from '../EmotionEngine';
import type { CroppedFace } from '../../../types/facescope';
import { useTabCamera } from './useTabCamera';
import ModelLoadingOverlay from './ModelLoadingOverlay';

interface FaceCropTabProps {
  engine: EmotionEngine;
}

const CROP_SIZE = 256;
const PADDING_RATIO = 0.35;

export default function FaceCropTab({ engine }: FaceCropTabProps) {
  const [modelsLoading, setModelsLoading] = useState(true);
  const [modelError, setModelError] = useState<string | null>(null);
  const [gallery, setGallery] = useState<CroppedFace[]>([]);
  const [mode, setMode] = useState<'camera' | 'image'>('camera');
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [searchModal, setSearchModal] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const snapCanvasRef = useRef<HTMLCanvasElement>(null);

  const loadModels = useCallback(async () => {
    try {
      setModelsLoading(true);
      setModelError(null);
      await engine.loadModels(['ssdMobilenetv1']);
      setModelsLoading(false);
    } catch {
      setModelError('Failed to load detection model');
      setModelsLoading(false);
    }
  }, [engine]);

  useEffect(() => {
    loadModels();
  }, [loadModels]);

  const { videoRef, canvasRef, isStreaming, error: cameraError, startCamera, stopCamera } = useTabCamera({
    fps: 0.001, // We only snap, not continuous detection
  });

  useEffect(() => {
    if (!modelsLoading && !modelError && mode === 'camera') {
      startCamera();
    }
    return () => stopCamera();
  }, [modelsLoading, modelError, mode, startCamera, stopCamera]);

  const cropFaces = async (source: HTMLVideoElement | HTMLImageElement): Promise<CroppedFace[]> => {
    const faceapi = engine.getFaceApi();
    if (!faceapi) return [];

    const detections = await faceapi
      .detectAllFaces(source, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 }));

    const sourceWidth = source instanceof HTMLVideoElement ? source.videoWidth : source.naturalWidth;
    const sourceHeight = source instanceof HTMLVideoElement ? source.videoHeight : source.naturalHeight;

    // Draw the source onto a temp canvas for pixel access
    const srcCanvas = document.createElement('canvas');
    srcCanvas.width = sourceWidth;
    srcCanvas.height = sourceHeight;
    const srcCtx = srcCanvas.getContext('2d')!;
    if (source instanceof HTMLVideoElement) {
      srcCtx.drawImage(source, 0, 0);
    } else {
      srcCtx.drawImage(source, 0, 0);
    }

    const faces: CroppedFace[] = [];

    for (let i = 0; i < detections.length; i++) {
      const det = detections[i];
      const box = det.box;

      // Add padding
      const padX = box.width * PADDING_RATIO;
      const padY = box.height * PADDING_RATIO;
      const x = Math.max(0, box.x - padX);
      const y = Math.max(0, box.y - padY);
      const w = Math.min(sourceWidth - x, box.width + padX * 2);
      const h = Math.min(sourceHeight - y, box.height + padY * 2);

      // Crop and resize to CROP_SIZE x CROP_SIZE
      const cropCanvas = document.createElement('canvas');
      cropCanvas.width = CROP_SIZE;
      cropCanvas.height = CROP_SIZE;
      const cropCtx = cropCanvas.getContext('2d')!;
      cropCtx.drawImage(srcCanvas, x, y, w, h, 0, 0, CROP_SIZE, CROP_SIZE);

      faces.push({
        id: `face-${Date.now()}-${i}`,
        dataUrl: cropCanvas.toDataURL('image/png'),
        box: { x: box.x, y: box.y, width: box.width, height: box.height },
        score: det.score,
      });
    }

    return faces;
  };

  const handleSnap = async () => {
    if (!videoRef.current || !isStreaming) return;
    setProcessing(true);
    try {
      const faces = await cropFaces(videoRef.current);
      setGallery((prev) => [...faces, ...prev]);
    } finally {
      setProcessing(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const url = URL.createObjectURL(file);
    setUploadedImage(url);
    setMode('image');
    stopCamera();

    setProcessing(true);
    const img = new Image();
    img.onload = async () => {
      try {
        const faces = await cropFaces(img);
        setGallery((prev) => [...faces, ...prev]);
      } finally {
        setProcessing(false);
      }
    };
    img.src = url;
  };

  const downloadFace = (face: CroppedFace) => {
    const a = document.createElement('a');
    a.href = face.dataUrl;
    a.download = `${face.id}.png`;
    a.click();
  };

  const downloadAll = () => {
    gallery.forEach((face) => downloadFace(face));
  };

  const removeFace = (id: string) => {
    setGallery((prev) => prev.filter((f) => f.id !== id));
  };

  const openSearch = (dataUrl: string) => {
    setSearchModal(dataUrl);
  };

  const doReverseSearch = (provider: string, dataUrl: string) => {
    // Convert dataUrl to a blob URL for linking
    switch (provider) {
      case 'google':
        window.open('https://lens.google.com/uploadbyurl?url=' + encodeURIComponent(dataUrl), '_blank');
        break;
      case 'yandex':
        window.open('https://yandex.com/images/search?rpt=imageview&url=' + encodeURIComponent(dataUrl), '_blank');
        break;
      case 'tineye':
        window.open('https://tineye.com/search?url=' + encodeURIComponent(dataUrl), '_blank');
        break;
    }
    setSearchModal(null);
  };

  return (
    <div className="flex flex-col h-full p-4 gap-4">
      {/* Mode toggle + actions */}
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

        {mode === 'camera' && (
          <button
            onClick={handleSnap}
            disabled={!isStreaming || processing || modelsLoading}
            className="ml-auto px-4 py-1.5 bg-accent-cyan text-dark-900 rounded-lg text-sm font-medium hover:bg-accent-cyan/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {processing ? 'Detecting...' : 'Snap & Detect'}
          </button>
        )}

        {gallery.length > 1 && (
          <button
            onClick={downloadAll}
            className="ml-auto px-3 py-1.5 bg-dark-700 text-white rounded text-sm hover:bg-dark-600 transition-colors border border-dark-500"
          >
            Download All ({gallery.length})
          </button>
        )}
      </div>

      <div className="flex flex-1 gap-4 min-h-0">
        {/* Camera/Image area */}
        <div className="relative flex-1 bg-dark-800 rounded-lg overflow-hidden max-w-[50%]">
          <ModelLoadingOverlay isLoading={modelsLoading} error={modelError} onRetry={loadModels} />

          {mode === 'camera' ? (
            <>
              <video ref={videoRef} className="w-full h-full object-contain" muted playsInline />
              <canvas ref={canvasRef} className="hidden" />
              {cameraError && <p className="absolute bottom-2 left-2 text-xs text-accent-red">{cameraError}</p>}
            </>
          ) : uploadedImage ? (
            <div className="relative w-full h-full flex items-center justify-center">
              <img src={uploadedImage} alt="Uploaded" className="max-w-full max-h-full object-contain" />
            </div>
          ) : null}
        </div>

        {/* Gallery grid */}
        <div className="flex-1 bg-dark-800 rounded-lg p-3 overflow-y-auto">
          <h3 className="text-sm font-semibold mb-3 text-dark-200">
            Cropped Faces {gallery.length > 0 && <span className="text-dark-400">({gallery.length})</span>}
          </h3>

          {gallery.length === 0 ? (
            <div className="flex items-center justify-center h-32">
              <p className="text-xs text-dark-500">
                {mode === 'camera' ? 'Click "Snap & Detect" to crop faces' : 'Upload an image to detect and crop faces'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
              {gallery.map((face) => (
                <div key={face.id} className="relative group">
                  <img
                    src={face.dataUrl}
                    alt="Cropped face"
                    className="w-full aspect-square object-cover rounded bg-dark-700"
                  />
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity rounded flex items-center justify-center gap-1.5">
                    <button
                      onClick={() => downloadFace(face)}
                      className="p-1.5 bg-dark-700 rounded hover:bg-dark-600 transition-colors"
                      title="Download"
                    >
                      <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                    </button>
                    <button
                      onClick={() => openSearch(face.dataUrl)}
                      className="p-1.5 bg-dark-700 rounded hover:bg-dark-600 transition-colors"
                      title="Reverse image search"
                    >
                      <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => removeFace(face.id)}
                      className="p-1.5 bg-dark-700 rounded hover:bg-dark-600 transition-colors"
                      title="Remove"
                    >
                      <svg className="w-4 h-4 text-accent-red" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 text-center text-[10px] text-dark-300 bg-dark-900/70 py-0.5 rounded-b">
                    {(face.score * 100).toFixed(0)}% conf
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Reverse image search modal */}
      {searchModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-dark-800 rounded-xl border border-dark-600 p-5 w-full max-w-xs shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold">Reverse Image Search</h3>
              <button onClick={() => setSearchModal(null)} className="text-dark-400 hover:text-white">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="space-y-2">
              <button
                onClick={() => doReverseSearch('google', searchModal)}
                className="w-full p-2.5 bg-dark-700 rounded-lg hover:bg-dark-600 transition-colors text-left text-sm"
              >
                Google Lens
              </button>
              <button
                onClick={() => doReverseSearch('yandex', searchModal)}
                className="w-full p-2.5 bg-dark-700 rounded-lg hover:bg-dark-600 transition-colors text-left text-sm"
              >
                Yandex Images
              </button>
              <button
                onClick={() => doReverseSearch('tineye', searchModal)}
                className="w-full p-2.5 bg-dark-700 rounded-lg hover:bg-dark-600 transition-colors text-left text-sm"
              >
                TinEye
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
