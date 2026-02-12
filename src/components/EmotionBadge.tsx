import type { Emotion } from '../types/emotion';

const EMOTION_COLORS: Record<Emotion, string> = {
  neutral: '#94a3b8',
  happy: '#22c55e',
  sad: '#3b82f6',
  angry: '#ef4444',
  fearful: '#a855f7',
  disgusted: '#f97316',
  surprised: '#eab308',
};

const EMOTION_ICONS: Record<Emotion, string> = {
  neutral: '😐',
  happy: '😊',
  sad: '😢',
  angry: '😠',
  fearful: '😨',
  disgusted: '🤢',
  surprised: '😲',
};

interface EmotionBadgeProps {
  emotion: Emotion;
  confidence: number;
  compact?: boolean;
}

export default function EmotionBadge({ emotion, confidence, compact = false }: EmotionBadgeProps) {
  const color = EMOTION_COLORS[emotion];
  const icon = EMOTION_ICONS[emotion];

  if (compact) {
    return (
      <span
        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium"
        style={{ backgroundColor: `${color}20`, color }}
      >
        {icon} {Math.round(confidence * 100)}%
      </span>
    );
  }

  return (
    <div
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-sm font-medium"
      style={{ backgroundColor: `${color}20`, color, border: `1px solid ${color}40` }}
    >
      <span>{icon}</span>
      <span className="capitalize">{emotion}</span>
      <span className="opacity-70">{Math.round(confidence * 100)}%</span>
    </div>
  );
}
