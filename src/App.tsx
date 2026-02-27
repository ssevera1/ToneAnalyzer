import { useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import VoiceAnalysisPage from './features/voice-analysis/VoiceAnalysisPage';
import EmotionMonitorPage from './features/emotion-detection/EmotionMonitorPage';
import SettingsPage from './features/settings/SettingsPage';
import ExportDialog from './components/ExportDialog';
import { useVoiceStore } from './stores/voiceStore';
import { useEmotionStore } from './stores/emotionStore';

export default function App() {
  const [showExport, setShowExport] = useState(false);
  const voiceSessions = useVoiceStore((s) => s.sessions);
  const emotionSessions = useEmotionStore((s) => s.sessions);

  return (
    <Layout onExport={() => setShowExport(true)}>
      <Routes>
        <Route path="/" element={<Navigate to="/voice" replace />} />
        <Route path="/voice" element={<VoiceAnalysisPage />} />
        <Route path="/emotion" element={<EmotionMonitorPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/voice" replace />} />
      </Routes>

      <ExportDialog
        isOpen={showExport}
        onClose={() => setShowExport(false)}
        voiceSessions={voiceSessions}
        emotionSessions={emotionSessions}
      />
    </Layout>
  );
}
