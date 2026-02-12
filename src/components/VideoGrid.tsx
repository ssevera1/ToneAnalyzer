import type { VideoSource, GridLayout } from '../types/video';
import type { EmotionReading } from '../types/emotion';
import type { ExpressionLabel, PrimeEmotion } from '../features/emotion-detection/ExpressionAnalyzer';
import { GRID_CONFIGS } from '../types/video';
import VideoPanel from './VideoPanel';

interface VideoGridProps {
  sources: VideoSource[];
  readings: Map<string, EmotionReading[]>;
  expressionLabels: Map<string, ExpressionLabel[]>;
  primeEmotions: Map<string, PrimeEmotion>;
  layout: GridLayout;
  onRemoveSource: (id: string) => void;
  onTogglePause: (id: string) => void;
  onVideoRef: (id: string, el: HTMLVideoElement | null) => void;
  onAddSource: () => void;
}

export default function VideoGrid({
  sources,
  readings,
  expressionLabels,
  primeEmotions,
  layout,
  onRemoveSource,
  onTogglePause,
  onVideoRef,
  onAddSource,
}: VideoGridProps) {
  const config = GRID_CONFIGS[layout];
  const totalSlots = config.cols * config.rows;

  return (
    <div
      className="grid gap-2 h-full p-2"
      style={{
        gridTemplateColumns: `repeat(${config.cols}, 1fr)`,
        gridTemplateRows: `repeat(${config.rows}, 1fr)`,
      }}
    >
      {sources.slice(0, totalSlots).map((source) => (
        <VideoPanel
          key={source.id}
          source={source}
          readings={readings.get(source.id) || []}
          expressionLabels={expressionLabels.get(source.id) || []}
          primeEmotion={primeEmotions.get(source.id) || null}
          onRemove={onRemoveSource}
          onTogglePause={onTogglePause}
          onVideoRef={onVideoRef}
        />
      ))}

      {/* Add source button fills empty slots */}
      {sources.length < totalSlots && (
        <button
          onClick={onAddSource}
          className="flex flex-col items-center justify-center bg-dark-800/50 rounded-lg border-2 border-dashed border-dark-600 hover:border-accent-cyan hover:bg-dark-800 transition-colors group"
        >
          <svg
            className="w-8 h-8 text-dark-500 group-hover:text-accent-cyan transition-colors"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          <span className="text-xs text-dark-400 group-hover:text-dark-200 mt-1">Add Source</span>
        </button>
      )}
    </div>
  );
}
