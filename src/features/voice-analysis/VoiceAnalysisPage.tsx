import { useRef } from 'react';
import { useVoiceAnalysis } from './useVoiceAnalysis';
import Waveform from '../../components/Waveform';
import Spectrogram from '../../components/Spectrogram';
import StressGauge from '../../components/StressGauge';

function MetricCard({ label, value, unit }: { label: string; value: number; unit: string }) {
  return (
    <div className="bg-dark-800 rounded-lg p-3 border border-dark-600">
      <div className="text-xs text-dark-300 uppercase tracking-wider">{label}</div>
      <div className="text-lg font-semibold text-white mt-1">
        {typeof value === 'number' ? value.toFixed(1) : '—'}
        <span className="text-xs text-dark-400 ml-1">{unit}</span>
      </div>
    </div>
  );
}

export default function VoiceAnalysisPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const {
    startMic,
    loadFile,
    stop,
    isAnalyzing,
    currentMetrics,
    currentSession,
    sessions,
    frequencyData,
    timeDomainData,
  } = useVoiceAnalysis();

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) loadFile(file);
  };

  return (
    <div className="flex h-full">
      {/* Main content */}
      <div className="flex-1 p-6 overflow-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold">Voice Stress Analysis</h2>
          <div className="flex gap-2">
            {!isAnalyzing ? (
              <>
                <button
                  onClick={() => startMic()}
                  className="px-4 py-2 bg-accent-green text-dark-900 rounded-lg font-medium text-sm hover:bg-accent-green/90 transition-colors flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                  </svg>
                  Start Microphone
                </button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="px-4 py-2 bg-dark-700 text-white rounded-lg font-medium text-sm hover:bg-dark-600 transition-colors border border-dark-500"
                >
                  Upload Audio File
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="audio/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </>
            ) : (
              <button
                onClick={stop}
                className="px-4 py-2 bg-accent-red text-white rounded-lg font-medium text-sm hover:bg-accent-red/90 transition-colors flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <rect x="6" y="6" width="12" height="12" rx="1" />
                </svg>
                Stop
              </button>
            )}
          </div>
        </div>

        {/* Visualizations */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-dark-800 rounded-xl p-4 border border-dark-600">
            <h3 className="text-xs text-dark-300 uppercase tracking-wider mb-3">Waveform</h3>
            <Waveform data={timeDomainData} width={520} height={130} />
          </div>
          <div className="bg-dark-800 rounded-xl p-4 border border-dark-600">
            <h3 className="text-xs text-dark-300 uppercase tracking-wider mb-3">Spectrogram</h3>
            <Spectrogram data={frequencyData} width={520} height={130} />
          </div>
        </div>

        {/* Stress Gauge + Metrics */}
        <div className="flex gap-6 items-start">
          <div className="bg-dark-800 rounded-xl p-6 border border-dark-600 flex-shrink-0">
            <h3 className="text-xs text-dark-300 uppercase tracking-wider mb-2 text-center">Stress Level</h3>
            <StressGauge value={currentMetrics.stressScore} size={240} />
          </div>

          <div className="flex-1 grid grid-cols-2 lg:grid-cols-3 gap-3">
            <MetricCard label="Fundamental Freq (F0)" value={currentMetrics.f0} unit="Hz" />
            <MetricCard label="F0 Variance" value={currentMetrics.f0Variance} unit="" />
            <MetricCard label="Jitter" value={currentMetrics.jitter} unit="%" />
            <MetricCard label="Shimmer" value={currentMetrics.shimmer} unit="%" />
            <MetricCard label="HNR" value={currentMetrics.hnr} unit="dB" />
            <MetricCard label="Microtremor" value={currentMetrics.microtremorAmplitude * 10000} unit="×10⁻⁴" />
          </div>
        </div>

        {/* Session info */}
        {currentSession && (
          <div className="mt-4 bg-dark-800 rounded-xl p-4 border border-dark-600">
            <div className="flex items-center justify-between">
              <span className="text-sm text-dark-200">
                Session: <span className="text-white font-medium">{currentSession.name}</span>
              </span>
              <span className="text-sm text-dark-300">
                {currentSession.readings.length} readings
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Session history sidebar */}
      <div className="w-64 bg-dark-800 border-l border-dark-600 p-4 overflow-auto">
        <h3 className="text-sm font-semibold text-dark-200 uppercase tracking-wider mb-3">
          Session History
        </h3>
        {sessions.length === 0 ? (
          <p className="text-sm text-dark-400">No sessions yet</p>
        ) : (
          <div className="space-y-2">
            {sessions.map((session, i) => (
              <div
                key={i}
                className="bg-dark-700 rounded-lg p-3 border border-dark-600 cursor-pointer hover:border-dark-400 transition-colors"
              >
                <div className="text-sm font-medium text-white truncate">{session.name}</div>
                <div className="text-xs text-dark-300 mt-1">
                  {new Date(session.startTime).toLocaleString()}
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-dark-400">
                    {session.readings.length} readings
                  </span>
                  {session.averageStress !== undefined && (
                    <span className="text-xs text-accent-cyan">
                      avg: {session.averageStress.toFixed(0)}%
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
