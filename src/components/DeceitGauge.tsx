interface DeceitGaugeProps {
  value: number; // 0-100
  size?: number;
}

function getDeceitColor(value: number): string {
  if (value < 25) return '#22c55e'; // green
  if (value < 50) return '#eab308'; // yellow
  if (value < 75) return '#f97316'; // orange
  return '#ef4444'; // red
}

function getDeceitLabel(value: number): string {
  if (value < 15) return 'Low';
  if (value < 30) return 'Mild';
  if (value < 50) return 'Moderate';
  if (value < 75) return 'Elevated';
  return 'High';
}

export default function DeceitGauge({ value: rawValue, size = 200 }: DeceitGaugeProps) {
  const value = Number.isFinite(rawValue) ? Math.max(0, Math.min(100, rawValue)) : 0;
  const radius = (size - 20) / 2;
  const center = size / 2;
  const strokeWidth = 12;
  const color = getDeceitColor(value);

  const startAngle = Math.PI;
  const startX = center + radius * Math.cos(startAngle);
  const startY = center + radius * Math.sin(startAngle);
  const endX = center + radius * Math.cos(2 * Math.PI);
  const endY = center + radius * Math.sin(2 * Math.PI);

  const backgroundArc = `M ${startX} ${startY} A ${radius} ${radius} 0 0 1 ${endX} ${endY}`;

  const progressAngle = startAngle + (value / 100) * Math.PI;
  const progressX = center + radius * Math.cos(progressAngle);
  const progressY = center + radius * Math.sin(progressAngle);
  const progressArc = `M ${startX} ${startY} A ${radius} ${radius} 0 0 1 ${progressX} ${progressY}`;

  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={size * 0.65} viewBox={`0 0 ${size} ${size * 0.65}`}>
        <path
          d={backgroundArc}
          fill="none"
          stroke="#333"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />
        <path
          d={progressArc}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          style={{
            filter: `drop-shadow(0 0 6px ${color}80)`,
            transition: 'stroke 0.3s',
          }}
        />
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
        <text
          x={center}
          y={center + size * 0.1}
          textAnchor="middle"
          fill={color}
          fontSize={size * 0.07}
          fontWeight="600"
        >
          {getDeceitLabel(value)}
        </text>
      </svg>
    </div>
  );
}
