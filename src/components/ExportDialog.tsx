import { useState } from 'react';
import type { VoiceSession } from '../types/audio';
import type { EmotionSession } from '../types/emotion';
import {
  exportVoiceCSV,
  exportEmotionCSV,
  exportVoicePDF,
  exportEmotionPDF,
  downloadCSV,
  downloadPDF,
} from '../services/exportService';

type SessionType = 'voice' | 'emotion';

interface ExportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  voiceSessions: VoiceSession[];
  emotionSessions: EmotionSession[];
}

export default function ExportDialog({
  isOpen,
  onClose,
  voiceSessions,
  emotionSessions,
}: ExportDialogProps) {
  const [format, setFormat] = useState<'csv' | 'pdf'>('pdf');
  const [sessionType, setSessionType] = useState<SessionType>('voice');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const sessions = sessionType === 'voice' ? voiceSessions : emotionSessions;

  const handleClose = () => {
    setError(null);
    onClose();
  };

  const handleExport = () => {
    const session = sessions[selectedIndex];
    if (!session) return;

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

    // The exporters validate the session and throw on unusable data. Without
    // this catch the throw escapes the event handler and the user just sees
    // nothing happen — there is no ErrorBoundary above this dialog.
    try {
      if (sessionType === 'voice') {
        const voiceSession = session as VoiceSession;
        if (format === 'csv') {
          const csv = exportVoiceCSV(voiceSession);
          downloadCSV(csv, `voice-analysis-${timestamp}.csv`);
        } else {
          const doc = exportVoicePDF(voiceSession);
          downloadPDF(doc, `voice-analysis-${timestamp}.pdf`);
        }
      } else {
        const emotionSession = session as EmotionSession;
        if (format === 'csv') {
          const csv = exportEmotionCSV(emotionSession);
          downloadCSV(csv, `emotion-detection-${timestamp}.csv`);
        } else {
          const doc = exportEmotionPDF(emotionSession);
          downloadPDF(doc, `emotion-detection-${timestamp}.pdf`);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed for an unknown reason.');
      return;
    }

    handleClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-dark-800 rounded-xl border border-dark-600 p-6 w-[420px] shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-semibold">Export Data</h3>
          <button onClick={handleClose} className="text-dark-400 hover:text-white">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-4">
          {/* Session type */}
          <div>
            <label className="text-xs text-dark-300 uppercase tracking-wider block mb-2">
              Session Type
            </label>
            <div className="flex gap-2">
              <button
                onClick={() => { setSessionType('voice'); setSelectedIndex(0); setError(null); }}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                  sessionType === 'voice'
                    ? 'bg-accent-cyan/10 text-accent-cyan border border-accent-cyan/30'
                    : 'bg-dark-700 text-dark-300 border border-dark-600'
                }`}
              >
                Voice Analysis
              </button>
              <button
                onClick={() => { setSessionType('emotion'); setSelectedIndex(0); setError(null); }}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                  sessionType === 'emotion'
                    ? 'bg-accent-cyan/10 text-accent-cyan border border-accent-cyan/30'
                    : 'bg-dark-700 text-dark-300 border border-dark-600'
                }`}
              >
                Emotion Detection
              </button>
            </div>
          </div>

          {/* Session selector */}
          <div>
            <label className="text-xs text-dark-300 uppercase tracking-wider block mb-2">
              Session
            </label>
            {sessions.length === 0 ? (
              <p className="text-sm text-dark-400">No sessions available</p>
            ) : (
              <select
                value={selectedIndex}
                onChange={(e) => { setSelectedIndex(Number(e.target.value)); setError(null); }}
                className="w-full bg-dark-700 border border-dark-500 rounded-lg px-3 py-2 text-sm text-white"
              >
                {sessions.map((s, i) => (
                  <option key={i} value={i}>
                    {s.name} — {new Date(s.startTime).toLocaleString()}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Format */}
          <div>
            <label className="text-xs text-dark-300 uppercase tracking-wider block mb-2">
              Format
            </label>
            <div className="flex gap-2">
              <button
                onClick={() => setFormat('csv')}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                  format === 'csv'
                    ? 'bg-accent-green/10 text-accent-green border border-accent-green/30'
                    : 'bg-dark-700 text-dark-300 border border-dark-600'
                }`}
              >
                CSV
              </button>
              <button
                onClick={() => setFormat('pdf')}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                  format === 'pdf'
                    ? 'bg-accent-green/10 text-accent-green border border-accent-green/30'
                    : 'bg-dark-700 text-dark-300 border border-dark-600'
                }`}
              >
                PDF Report
              </button>
            </div>
          </div>
        </div>

        {error && (
          <div
            role="alert"
            className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300"
          >
            <span className="font-medium">Export failed: </span>
            {error}
          </div>
        )}

        <div className="flex justify-end gap-2 mt-6">
          <button
            onClick={handleClose}
            className="px-4 py-2 bg-dark-700 text-dark-200 rounded-lg text-sm hover:bg-dark-600 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleExport}
            disabled={sessions.length === 0}
            className="px-4 py-2 bg-accent-cyan text-dark-900 rounded-lg text-sm font-medium hover:bg-accent-cyan/90 transition-colors disabled:opacity-50"
          >
            Export
          </button>
        </div>
      </div>
    </div>
  );
}
