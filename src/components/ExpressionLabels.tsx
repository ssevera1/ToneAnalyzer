import type { ExpressionLabel } from '../features/emotion-detection/ExpressionAnalyzer';

interface ExpressionLabelsProps {
  labels: ExpressionLabel[];
}

const CATEGORY_ICONS: Record<string, string> = {
  compound: '',
  deception: '!',
  behavioral: '',
  cognitive: '',
};

const CATEGORY_BORDER: Record<string, string> = {
  compound: 'border-dark-500',
  deception: 'border-red-500/40',
  behavioral: 'border-dark-500',
  cognitive: 'border-purple-500/40',
};

export default function ExpressionLabels({ labels }: ExpressionLabelsProps) {
  if (labels.length === 0) return null;

  return (
    <div className="px-2 py-1.5 bg-dark-900/95 border-t border-dark-600 flex flex-wrap gap-1 items-center overflow-hidden max-h-[52px]">
      {labels.map((label) => (
        <span
          key={label.name}
          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border ${CATEGORY_BORDER[label.category]} cursor-default transition-colors`}
          style={{
            backgroundColor: `${label.color}15`,
            color: label.color,
          }}
          title={`${label.description}\nConfidence: ${Math.round(label.confidence * 100)}%\nCategory: ${label.category}`}
        >
          {label.category === 'deception' && (
            <span className="text-red-400 font-bold text-[9px]">{CATEGORY_ICONS.deception}</span>
          )}
          {label.name}
          <span className="opacity-60 text-[9px]">{Math.round(label.confidence * 100)}%</span>
        </span>
      ))}
    </div>
  );
}
