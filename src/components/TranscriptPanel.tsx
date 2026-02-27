import { useEffect, useRef } from 'react';
import type { TranscriptSegment } from '../types/audio';

interface TranscriptPanelProps {
  segments: TranscriptSegment[];
  interimText: string;
  isSupported: boolean;
}

function getBorderColor(deceit: number): string {
  if (deceit < 25) return '#22c55e';
  if (deceit < 50) return '#eab308';
  if (deceit < 75) return '#f97316';
  return '#ef4444';
}

function formatTime(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

export default function TranscriptPanel({ segments, interimText, isSupported }: TranscriptPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [segments, interimText]);

  if (!isSupported) {
    return (
      <div className="bg-dark-800 rounded-xl p-4 border border-dark-600">
        <h3 className="text-xs text-dark-300 uppercase tracking-wider mb-3">Transcript</h3>
        <p className="text-sm text-dark-400 italic">
          Speech recognition is not supported in this browser. Use Chrome or Edge for live transcription.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-dark-800 rounded-xl p-4 border border-dark-600">
      <h3 className="text-xs text-dark-300 uppercase tracking-wider mb-3">Transcript</h3>
      <div
        ref={scrollRef}
        className="max-h-64 overflow-auto space-y-2"
      >
        {segments.length === 0 && !interimText && (
          <p className="text-sm text-dark-400 italic">Waiting for speech...</p>
        )}
        {segments.map((seg) => (
          <div
            key={seg.id}
            className="pl-3 py-2 pr-2 rounded-r-lg bg-dark-700/50"
            style={{ borderLeft: `3px solid ${getBorderColor(seg.averageDeceit)}` }}
          >
            <div className="text-sm text-white">{seg.text}</div>
            <div className="flex items-center gap-3 mt-1 text-xs text-dark-400">
              <span>{formatTime(seg.startTime)}</span>
              <span>Stress: <span className="text-accent-cyan">{seg.averageStress.toFixed(0)}%</span></span>
              <span>Deceit: <span style={{ color: getBorderColor(seg.averageDeceit) }}>{seg.averageDeceit.toFixed(0)}%</span></span>
            </div>
          </div>
        ))}
        {interimText && (
          <div className="pl-3 py-2 pr-2 text-sm text-dark-300 italic border-l-3 border-dark-500">
            {interimText}
          </div>
        )}
      </div>
    </div>
  );
}
