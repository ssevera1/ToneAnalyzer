import type { VoiceSession } from '../types/audio';

interface SessionSummaryCardProps {
  session: VoiceSession;
}

function StatBlock({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div className="text-center">
      <div className="text-xs text-dark-300 uppercase tracking-wider">{label}</div>
      <div className="text-lg font-semibold text-white mt-1">
        {value}
        {unit && <span className="text-xs text-dark-400 ml-1">{unit}</span>}
      </div>
    </div>
  );
}

export default function SessionSummaryCard({ session }: SessionSummaryCardProps) {
  const { readings, transcript } = session;

  if (readings.length === 0) return null;

  const avgStress = readings.reduce((s, r) => s + r.stressLevel, 0) / readings.length;
  const peakStress = Math.max(...readings.map((r) => r.stressLevel));
  const avgDeceit = readings.reduce((s, r) => s + r.deceitLevel, 0) / readings.length;
  const peakDeceit = Math.max(...readings.map((r) => r.deceitLevel));

  const durationMs = (session.endTime || Date.now()) - session.startTime;
  const minutes = Math.floor(durationMs / 60000);
  const seconds = Math.floor((durationMs % 60000) / 1000);

  return (
    <div className="bg-dark-800 rounded-xl p-4 border border-dark-600">
      <h3 className="text-xs text-dark-300 uppercase tracking-wider mb-3">Session Summary</h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatBlock label="Avg Stress" value={avgStress.toFixed(0)} unit="%" />
        <StatBlock label="Peak Stress" value={peakStress.toFixed(0)} unit="%" />
        <StatBlock label="Avg Deceit" value={avgDeceit.toFixed(0)} unit="%" />
        <StatBlock label="Peak Deceit" value={peakDeceit.toFixed(0)} unit="%" />
        <StatBlock label="Readings" value={readings.length.toLocaleString()} />
        <StatBlock label="Duration" value={`${minutes}m ${seconds}s`} />
      </div>
      {transcript.length > 0 && (
        <div className="mt-3 pt-3 border-t border-dark-600 text-xs text-dark-400">
          {transcript.length} transcript segment{transcript.length !== 1 ? 's' : ''}
        </div>
      )}
    </div>
  );
}
