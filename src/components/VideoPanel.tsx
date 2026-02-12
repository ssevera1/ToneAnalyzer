import { useRef, useEffect } from 'react';
import type { VideoSource } from '../types/video';
import type { EmotionReading } from '../types/emotion';
import type { ExpressionLabel, PrimeEmotion } from '../features/emotion-detection/ExpressionAnalyzer';
import EmotionBadge from './EmotionBadge';
import ExpressionLabels from './ExpressionLabels';

interface VideoPanelProps {
  source: VideoSource;
  readings: EmotionReading[];
  expressionLabels: ExpressionLabel[];
  primeEmotion: PrimeEmotion | null;
  onRemove: (id: string) => void;
  onTogglePause: (id: string) => void;
  onVideoRef: (id: string, el: HTMLVideoElement | null) => void;
}

const STATUS_COLORS: Record<string, string> = {
  active: '#22c55e',
  connecting: '#eab308',
  paused: '#94a3b8',
  error: '#ef4444',
  disconnected: '#6b7280',
};

export default function VideoPanel({ source, readings, expressionLabels, primeEmotion, onRemove, onTogglePause, onVideoRef }: VideoPanelProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    onVideoRef(source.id, video);

    if (source.stream) {
      video.srcObject = source.stream;
      video.play().catch(() => {});
    } else if (source.url && source.type === 'file') {
      video.src = source.url;
      video.play().catch(() => {});
    }

    return () => {
      onVideoRef(source.id, null);
    };
  }, [source.id, source.stream, source.url, source.type, onVideoRef]);

  // Draw bounding boxes on canvas overlay
  useEffect(() => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = video.videoWidth || video.clientWidth;
    canvas.height = video.videoHeight || video.clientHeight;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    readings.forEach((reading) => {
      const { x, y, width, height } = reading.boundingBox;

      ctx.strokeStyle = '#06b6d4';
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, width, height);
    });
  }, [readings]);

  return (
    <div className="relative bg-dark-800 rounded-lg border border-dark-600 overflow-hidden flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-dark-700 border-b border-dark-600">
        <div className="flex items-center gap-2 min-w-0">
          <div
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ backgroundColor: STATUS_COLORS[source.status] }}
          />
          <span className="text-xs font-medium text-dark-200 truncate max-w-[100px]">
            {source.name}
          </span>
          {primeEmotion && (
            <span
              className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold flex-shrink-0 border"
              style={{
                backgroundColor: `${primeEmotion.color}15`,
                color: primeEmotion.color,
                borderColor: `${primeEmotion.color}40`,
              }}
              title={`Prime emotion (last ${primeEmotion.secondsTracked}s): ${primeEmotion.emotion} — ${primeEmotion.percentage.toFixed(0)}% of readings`}
            >
              <span>{primeEmotion.icon}</span>
              <span className="capitalize">{primeEmotion.emotion}</span>
              <span className="opacity-70">{primeEmotion.percentage.toFixed(0)}%</span>
              <span className="opacity-40 text-[8px]">60s</span>
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => onTogglePause(source.id)}
            className="p-1 text-dark-400 hover:text-white transition-colors"
            title={source.status === 'paused' ? 'Resume' : 'Pause'}
          >
            {source.status === 'paused' ? (
              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            ) : (
              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
              </svg>
            )}
          </button>
          <button
            onClick={() => onRemove(source.id)}
            className="p-1 text-dark-400 hover:text-accent-red transition-colors"
            title="Remove"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Video area */}
      <div className="relative flex-1 bg-black min-h-0">
        <video
          ref={videoRef}
          className="w-full h-full object-contain"
          muted
          playsInline
          autoPlay
        />
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full pointer-events-none"
        />

        {/* Emotion overlays */}
        {readings.map((reading) => (
          <div
            key={reading.faceId}
            className="absolute"
            style={{
              left: reading.boundingBox.x,
              top: Math.max(0, reading.boundingBox.y - 24),
            }}
          >
            <EmotionBadge emotion={reading.dominantEmotion} confidence={reading.confidence} compact />
          </div>
        ))}

        {/* Status overlay */}
        {source.status === 'connecting' && (
          <div className="absolute inset-0 flex items-center justify-center bg-dark-900/80">
            <span className="text-sm text-dark-300 animate-pulse">Connecting...</span>
          </div>
        )}
        {source.status === 'error' && (
          <div className="absolute inset-0 flex items-center justify-center bg-dark-900/80">
            <span className="text-sm text-accent-red">Connection Error</span>
          </div>
        )}
        {source.status === 'paused' && (
          <div className="absolute inset-0 flex items-center justify-center bg-dark-900/60">
            <span className="text-sm text-dark-300">Paused</span>
          </div>
        )}
      </div>

      {/* Expression labels bar */}
      <ExpressionLabels labels={expressionLabels} />
    </div>
  );
}
