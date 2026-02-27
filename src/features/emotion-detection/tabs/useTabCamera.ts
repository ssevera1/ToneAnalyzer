import { useRef, useState, useEffect, useCallback } from 'react';

interface UseTabCameraOptions {
  /** Target detection FPS (default 5) */
  fps?: number;
  /** Mirror the video horizontally (default true for webcam) */
  flip?: boolean;
  /** Callback invoked each detection frame with the video element */
  onFrame?: (video: HTMLVideoElement) => Promise<void> | void;
}

interface UseTabCameraReturn {
  videoRef: React.RefObject<HTMLVideoElement>;
  canvasRef: React.RefObject<HTMLCanvasElement>;
  isStreaming: boolean;
  error: string | null;
  startCamera: () => Promise<void>;
  stopCamera: () => void;
}

export function useTabCamera(options: UseTabCameraOptions = {}): UseTabCameraReturn {
  const { fps = 5, flip = true, onFrame } = options;
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastFrameRef = useRef(0);
  const onFrameRef = useRef(onFrame);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Keep callback ref fresh without restarting the loop
  useEffect(() => {
    onFrameRef.current = onFrame;
  }, [onFrame]);

  const stopCamera = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsStreaming(false);
  }, []);

  const startCamera = useCallback(async () => {
    try {
      setError(null);
      stopCamera();

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
      });
      streamRef.current = stream;

      const video = videoRef.current;
      if (!video) return;

      video.srcObject = stream;
      if (flip) video.style.transform = 'scaleX(-1)';
      await video.play();
      setIsStreaming(true);

      const interval = 1000 / fps;
      let running = true;

      const loop = async (now: number) => {
        if (!running) return;
        if (now - lastFrameRef.current >= interval) {
          lastFrameRef.current = now;
          if (onFrameRef.current && video.readyState >= 2) {
            try {
              await onFrameRef.current(video);
            } catch {
              // Detection errors are non-fatal
            }
          }
        }
        rafRef.current = requestAnimationFrame(loop);
      };

      rafRef.current = requestAnimationFrame(loop);
    } catch (err: any) {
      setError(err?.message || 'Failed to access camera');
    }
  }, [fps, flip, stopCamera]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  return { videoRef, canvasRef, isStreaming, error, startCamera, stopCamera };
}
