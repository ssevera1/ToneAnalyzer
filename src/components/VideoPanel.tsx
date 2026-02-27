import { useRef, useEffect, useState, useMemo } from 'react';
import type { VideoSource } from '../types/video';
import type { EmotionReading } from '../types/emotion';
import type { ExpressionLabel, PrimeEmotion, ExpressionTotals } from '../features/emotion-detection/ExpressionAnalyzer';
import EmotionBadge from './EmotionBadge';
import ExpressionLabels from './ExpressionLabels';

interface VideoPanelProps {
  source: VideoSource;
  readings: EmotionReading[];
  expressionLabels: ExpressionLabel[];
  expressionTotals: ExpressionTotals | null;
  primeEmotion: PrimeEmotion | null;
  deceitScore: number;
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

/** Colors for the top-N expression bars — stable palette. */
const BAR_COLORS = [
  '#06b6d4', '#22c55e', '#a855f7', '#f97316', '#ec4899',
  '#eab308', '#3b82f6', '#ef4444', '#84cc16', '#64748b',
];

interface RankedExpression {
  name: string;
  count: number;
  avgConfidence: number;
  pct: number; // % of total frames this expression appeared
}

function useRankedExpressions(totals: ExpressionTotals | null, limit = 6): RankedExpression[] {
  return useMemo(() => {
    if (!totals || totals.totalFrames === 0) return [];
    const entries = Object.entries(totals.counts);
    if (entries.length === 0) return [];

    return entries
      .map(([name, count]) => ({
        name,
        count,
        avgConfidence: totals.confidenceSums[name] / count,
        pct: (count / totals.totalFrames) * 100,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }, [totals, limit]);
}

function getDeceitColor(value: number): string {
  if (value < 25) return '#22c55e';
  if (value < 50) return '#eab308';
  if (value < 75) return '#f97316';
  return '#ef4444';
}

function getDeceitLabel(value: number): string {
  if (value < 15) return 'Low';
  if (value < 30) return 'Mild';
  if (value < 50) return 'Moderate';
  if (value < 75) return 'Elevated';
  return 'High';
}

export default function VideoPanel({ source, readings, expressionLabels, expressionTotals, primeEmotion, deceitScore, onRemove, onTogglePause, onVideoRef }: VideoPanelProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [showTotals, setShowTotals] = useState(true);

  const ranked = useRankedExpressions(expressionTotals);
  const maxCount = ranked.length > 0 ? ranked[0].count : 0;

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
          {deceitScore > 0 && (
            <span
              className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold flex-shrink-0 border"
              style={{
                backgroundColor: `${getDeceitColor(deceitScore)}15`,
                color: getDeceitColor(deceitScore),
                borderColor: `${getDeceitColor(deceitScore)}40`,
              }}
              title={`Deceit score: ${deceitScore}% — ${getDeceitLabel(deceitScore)}`}
            >
              <span className="text-[9px]">D</span>
              <span>{deceitScore}%</span>
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {/* Totals toggle */}
          {expressionTotals && expressionTotals.totalFrames > 0 && (
            <button
              onClick={() => setShowTotals((v) => !v)}
              className={`p-1 transition-colors ${showTotals ? 'text-accent-cyan' : 'text-dark-400 hover:text-white'}`}
              title={showTotals ? 'Hide expression totals' : 'Show expression totals'}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </button>
          )}
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

      {/* Deceit indicator bar */}
      {deceitScore > 0 && (
        <div className="px-2 py-1 bg-dark-900/80 border-t border-dark-600/50 flex items-center gap-2">
          <span className="text-[9px] uppercase tracking-wider text-dark-400 font-semibold w-[36px] flex-shrink-0">Deceit</span>
          <div className="flex-1 h-[6px] bg-dark-700 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{
                width: `${deceitScore}%`,
                backgroundColor: getDeceitColor(deceitScore),
                opacity: 0.8,
              }}
            />
          </div>
          <span
            className="text-[10px] font-semibold w-[36px] text-right flex-shrink-0"
            style={{ color: getDeceitColor(deceitScore) }}
          >
            {deceitScore}%
          </span>
        </div>
      )}

      {/* Expression labels bar */}
      <ExpressionLabels labels={expressionLabels} />

      {/* Running expression totals */}
      {showTotals && ranked.length > 0 && (
        <div className="px-2 py-1.5 bg-dark-900/80 border-t border-dark-600/50">
          {/* Header row */}
          <div className="flex items-center justify-between mb-1">
            <span className="text-[9px] uppercase tracking-wider text-dark-400 font-semibold">
              Totals
            </span>
            <span className="text-[9px] text-dark-500">
              {expressionTotals!.totalFrames} frames
            </span>
          </div>
          {/* Horizontal bar chart */}
          <div className="space-y-[3px]">
            {ranked.map((expr, i) => (
              <div key={expr.name} className="flex items-center gap-1.5 group">
                <span
                  className="text-[9px] font-medium truncate w-[72px] flex-shrink-0 text-right"
                  style={{ color: BAR_COLORS[i % BAR_COLORS.length] }}
                  title={`${expr.name}: ${expr.count}× (${expr.pct.toFixed(1)}% of frames, avg conf ${(expr.avgConfidence * 100).toFixed(0)}%)`}
                >
                  {expr.name}
                </span>
                <div className="flex-1 h-[6px] bg-dark-700 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${maxCount > 0 ? (expr.count / maxCount) * 100 : 0}%`,
                      backgroundColor: BAR_COLORS[i % BAR_COLORS.length],
                      opacity: 0.7,
                    }}
                  />
                </div>
                <span className="text-[9px] text-dark-400 w-[28px] text-right flex-shrink-0 tabular-nums">
                  {expr.count}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
