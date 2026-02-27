import { useRef, useState } from 'react';
import { useVoiceAnalysis } from './useVoiceAnalysis';
import { useTranscription } from './useTranscription';
import Waveform from '../../components/Waveform';
import Spectrogram from '../../components/Spectrogram';
import StressGauge from '../../components/StressGauge';
import DeceitGauge from '../../components/DeceitGauge';
import TranscriptPanel from '../../components/TranscriptPanel';
import SessionSummaryCard from '../../components/SessionSummaryCard';

function MetricCard({ label, value, unit }: { label: string; value: number; unit: string }) {
  const display = Number.isFinite(value) ? value.toFixed(1) : '\u2014';
  return (
    <div className="bg-dark-800 rounded-lg p-3 border border-dark-600">
      <div className="text-xs text-dark-300 uppercase tracking-wider">{label}</div>
      <div className="text-lg font-semibold text-white mt-1">
        {display}
        <span className="text-xs text-dark-400 ml-1">{unit}</span>
      </div>
    </div>
  );
}

export default function VoiceAnalysisPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [micError, setMicError] = useState<string | null>(null);
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

  const {
    startTranscription,
    stopTranscription,
    interimText,
    isSupported: transcriptionSupported,
  } = useTranscription();

  const handleStartMic = async () => {
    setMicError(null);
    try {
      await startMic();
      startTranscription();
    } catch {
      setMicError('Microphone unavailable — if you\'re on a phone call, use "Upload File" to analyze a recording after the call ends.');
    }
  };

  const handleStop = async () => {
    stopTranscription();
    await stop();
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setMicError(null);
      loadFile(file);
    }
  };

  return (
    <div className="flex flex-col md:flex-row h-full">
      {/* Main content */}
      <div className="flex-1 p-4 md:p-6 overflow-auto">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4 md:mb-6 pl-10 md:pl-0">
          <h2 className="text-xl md:text-2xl font-bold">Voice Stress Analysis</h2>
          <div className="flex gap-2 flex-wrap">
            {!isAnalyzing ? (
              <>
                <button
                  onClick={handleStartMic}
                  className="px-3 md:px-4 py-2 bg-accent-green text-dark-900 rounded-lg font-medium text-sm hover:bg-accent-green/90 transition-colors flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                  </svg>
                  <span className="hidden sm:inline">Start</span> Mic
                </button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3 md:px-4 py-2 bg-dark-700 text-white rounded-lg font-medium text-sm hover:bg-dark-600 transition-colors border border-dark-500"
                >
                  <span className="hidden sm:inline">Upload</span> File
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
                onClick={handleStop}
                className="px-3 md:px-4 py-2 bg-accent-red text-white rounded-lg font-medium text-sm hover:bg-accent-red/90 transition-colors flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <rect x="6" y="6" width="12" height="12" rx="1" />
                </svg>
                Stop
              </button>
            )}
          </div>
        </div>

        {/* Mic error banner */}
        {micError && (
          <div className="mb-4 px-3 py-2.5 bg-accent-yellow/10 border border-accent-yellow/30 rounded-lg flex items-start gap-2">
            <svg className="w-4 h-4 text-accent-yellow flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div>
              <span className="text-sm text-accent-yellow">{micError}</span>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="block mt-1.5 px-3 py-1 bg-accent-yellow/20 text-accent-yellow rounded text-xs font-medium hover:bg-accent-yellow/30 transition-colors"
              >
                Upload Audio File
              </button>
            </div>
          </div>
        )}

        {/* Visualizations */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4 md:mb-6">
          <div className="bg-dark-800 rounded-xl p-3 md:p-4 border border-dark-600">
            <h3 className="text-xs text-dark-300 uppercase tracking-wider mb-3">Waveform</h3>
            <Waveform data={timeDomainData} height={130} />
          </div>
          <div className="bg-dark-800 rounded-xl p-3 md:p-4 border border-dark-600">
            <h3 className="text-xs text-dark-300 uppercase tracking-wider mb-3">Spectrogram</h3>
            <Spectrogram data={frequencyData} height={130} />
          </div>
        </div>

        {/* Gauges + Metrics */}
        <div className="flex flex-col md:flex-row gap-4 md:gap-6 items-center md:items-start">
          <div className="flex flex-row gap-4 flex-shrink-0">
            <div className="bg-dark-800 rounded-xl p-4 md:p-6 border border-dark-600">
              <h3 className="text-xs text-dark-300 uppercase tracking-wider mb-2 text-center">Stress Level</h3>
              <div className="flex justify-center">
                <StressGauge value={currentMetrics.stressScore} size={200} />
              </div>
            </div>
            <div className="bg-dark-800 rounded-xl p-4 md:p-6 border border-dark-600">
              <h3 className="text-xs text-dark-300 uppercase tracking-wider mb-2 text-center">Deceit Level</h3>
              <div className="flex justify-center">
                <DeceitGauge value={currentMetrics.deceitScore} size={200} />
              </div>
            </div>
          </div>

          <div className="flex-1 grid grid-cols-2 lg:grid-cols-3 gap-3 w-full">
            <MetricCard label="Fundamental Freq (F0)" value={currentMetrics.f0} unit="Hz" />
            <MetricCard label="F0 Variance" value={currentMetrics.f0Variance} unit="" />
            <MetricCard label="Jitter" value={currentMetrics.jitter} unit="%" />
            <MetricCard label="Shimmer" value={currentMetrics.shimmer} unit="%" />
            <MetricCard label="HNR" value={currentMetrics.hnr} unit="dB" />
            <MetricCard label="Microtremor" value={currentMetrics.microtremorAmplitude * 100} unit="%" />
            <MetricCard label="Hesitation" value={currentMetrics.hesitationRatio * 100} unit="%" />
          </div>
        </div>

        {/* Transcript */}
        <div className="mt-4">
          <TranscriptPanel
            segments={currentSession?.transcript ?? []}
            interimText={interimText}
            isSupported={transcriptionSupported}
          />
        </div>

        {/* Session Summary */}
        {currentSession && currentSession.readings.length > 0 && (
          <div className="mt-4">
            <SessionSummaryCard session={currentSession} />
          </div>
        )}

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

        {/* Session history - inline on mobile */}
        <div className="mt-4 md:hidden">
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
                  className="bg-dark-700 rounded-lg p-3 border border-dark-600"
                >
                  <div className="text-sm font-medium text-white truncate">{session.name}</div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-dark-400">
                      {session.readings.length} readings
                    </span>
                    {session.averageStress !== undefined && (
                      <span className="text-xs text-accent-cyan">
                        stress: {session.averageStress.toFixed(0)}%
                      </span>
                    )}
                    {session.averageDeceit !== undefined && (
                      <span className="text-xs text-orange-400">
                        deceit: {session.averageDeceit.toFixed(0)}%
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Session history sidebar - desktop only */}
      <div className="hidden md:block w-64 bg-dark-800 border-l border-dark-600 p-4 overflow-auto">
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
                      stress: {session.averageStress.toFixed(0)}%
                    </span>
                  )}
                </div>
                {session.averageDeceit !== undefined && (
                  <div className="mt-1">
                    <span className="text-xs text-orange-400">
                      deceit: {session.averageDeceit.toFixed(0)}%
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
