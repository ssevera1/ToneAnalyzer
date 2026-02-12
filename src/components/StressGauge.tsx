interface StressGaugeProps {
  value: number; // 0-100
  size?: number;
  label?: string;
}

function getStressColor(value: number): string {
  if (value < 30) return '#22c55e'; // green
  if (value < 60) return '#eab308'; // yellow
  if (value < 80) return '#f97316'; // orange
  return '#ef4444'; // red
}

function getStressLabel(value: number): string {
  if (value < 20) return 'Relaxed';
  if (value < 40) return 'Normal';
  if (value < 60) return 'Mild Stress';
  if (value < 80) return 'Moderate Stress';
  return 'High Stress';
}

export default function StressGauge({ value, size = 200, label }: StressGaugeProps) {
  const radius = (size - 20) / 2;
  const center = size / 2;
  const strokeWidth = 12;
  const circumference = Math.PI * radius; // half circle
  const progress = (value / 100) * circumference;
  const color = getStressColor(value);

  // Arc path (semicircle, bottom half)
  const startAngle = Math.PI;
  const endAngle = 2 * Math.PI;
  const startX = center + radius * Math.cos(startAngle);
  const startY = center + radius * Math.sin(startAngle);
  const endX = center + radius * Math.cos(endAngle);
  const endY = center + radius * Math.sin(endAngle);

  const backgroundArc = `M ${startX} ${startY} A ${radius} ${radius} 0 0 1 ${endX} ${endY}`;

  // Progress arc
  const progressAngle = startAngle + (value / 100) * Math.PI;
  const progressX = center + radius * Math.cos(progressAngle);
  const progressY = center + radius * Math.sin(progressAngle);
  const largeArc = value > 50 ? 1 : 0;
  const progressArc = `M ${startX} ${startY} A ${radius} ${radius} 0 ${largeArc} 1 ${progressX} ${progressY}`;

  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={size * 0.65} viewBox={`0 0 ${size} ${size * 0.65}`}>
        {/* Background arc */}
        <path
          d={backgroundArc}
          fill="none"
          stroke="#333"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />
        {/* Progress arc */}
        <path
          d={progressArc}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          style={{
            filter: `drop-shadow(0 0 6px ${color}80)`,
            transition: 'stroke 0.3s, d 0.1s',
          }}
        />
        {/* Value text */}
        <text
          x={center}
          y={center - 5}
          textAnchor="middle"
          className="text-3xl font-bold"
          fill="white"
          fontSize={size * 0.18}
        >
          {Math.round(value)}
        </text>
        {/* Label */}
        <text
          x={center}
          y={center + size * 0.1}
          textAnchor="middle"
          fill={color}
          fontSize={size * 0.07}
          fontWeight="600"
        >
          {label || getStressLabel(value)}
        </text>
      </svg>
    </div>
  );
}
