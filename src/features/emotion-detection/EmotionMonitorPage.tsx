import { useRef, useState } from 'react';
import { useEmotionDetection } from './useEmotionDetection';
import VideoGrid from '../../components/VideoGrid';
import type { GridLayout } from '../../types/video';
import type { VideoSourceType } from '../../types/video';

const GRID_OPTIONS: { value: GridLayout; label: string }[] = [
  { value: 1, label: '1' },
  { value: 4, label: '2x2' },
  { value: 6, label: '2x3' },
  { value: 9, label: '3x3' },
  { value: 12, label: '3x4' },
];

export default function EmotionMonitorPage() {
  const {
    sources,
    readings,
    expressionLabels,
    primeEmotions,
    gridLayout,
    isMonitoring,
    isEngineReady,
    engineError,
    showAddDialog,
    setShowAddDialog,
    addSource,
    removeSource,
    togglePause,
    registerVideoRef,
    startMonitoring,
    stopMonitoring,
    setGridLayout,
  } = useEmotionDetection();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [rtspUrl, setRtspUrl] = useState('');

  const handleAddWebcam = async () => {
    await addSource('webcam');
    setShowAddDialog(false);
  };

  const handleAddScreen = async () => {
    await addSource('screen');
    setShowAddDialog(false);
  };

  const handleAddFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      addSource('file', { file });
      setShowAddDialog(false);
    }
  };

  const handleAddRtsp = () => {
    if (rtspUrl.trim()) {
      addSource('rtsp', { url: rtspUrl.trim() });
      setRtspUrl('');
      setShowAddDialog(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 md:px-4 py-2.5 bg-dark-800 border-b border-dark-600">
        <div className="flex items-center gap-2 md:gap-3 pl-10 md:pl-0">
          <h2 className="text-base md:text-lg font-semibold">Video Monitor</h2>

          {/* Grid layout selector */}
          <div className="flex items-center gap-1 ml-2 md:ml-4">
            {GRID_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setGridLayout(opt.value)}
                className={`px-2 py-1 text-xs rounded font-medium transition-colors ${
                  gridLayout === opt.value
                    ? 'bg-accent-cyan/20 text-accent-cyan'
                    : 'text-dark-300 hover:text-white hover:bg-dark-700'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {engineError && (
            <span className="text-xs text-accent-red mr-2">{engineError}</span>
          )}

          <button
            onClick={() => setShowAddDialog(true)}
            className="px-3 py-1.5 bg-dark-700 text-white rounded-lg text-sm hover:bg-dark-600 transition-colors border border-dark-500"
          >
            + Add Source
          </button>

          {!isMonitoring ? (
            <button
              onClick={startMonitoring}
              disabled={sources.length === 0 || !isEngineReady}
              className="px-3 py-1.5 bg-accent-green text-dark-900 rounded-lg text-sm font-medium hover:bg-accent-green/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Start All
            </button>
          ) : (
            <button
              onClick={stopMonitoring}
              className="px-3 py-1.5 bg-accent-red text-white rounded-lg text-sm font-medium hover:bg-accent-red/90 transition-colors"
            >
              Stop All
            </button>
          )}
        </div>
      </div>

      {/* Video Grid */}
      <div className="flex-1 min-h-0">
        {sources.length === 0 && !showAddDialog ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <svg className="w-16 h-16 text-dark-600 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              <p className="text-dark-400 mb-4">No video sources added</p>
              <button
                onClick={() => setShowAddDialog(true)}
                className="px-4 py-2 bg-accent-cyan/10 text-accent-cyan rounded-lg text-sm font-medium hover:bg-accent-cyan/20 transition-colors border border-accent-cyan/30"
              >
                Add Video Source
              </button>
            </div>
          </div>
        ) : (
          <VideoGrid
            sources={sources}
            readings={readings}
            expressionLabels={expressionLabels}
            primeEmotions={primeEmotions}
            layout={gridLayout}
            onRemoveSource={removeSource}
            onTogglePause={togglePause}
            onVideoRef={registerVideoRef}
            onAddSource={() => setShowAddDialog(true)}
          />
        )}
      </div>

      {/* Add Source Dialog */}
      {showAddDialog && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-dark-800 rounded-xl border border-dark-600 p-4 md:p-6 w-full max-w-sm md:max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Add Video Source</h3>
              <button
                onClick={() => setShowAddDialog(false)}
                className="text-dark-400 hover:text-white"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-3">
              <button
                onClick={handleAddWebcam}
                className="w-full flex items-center gap-3 p-3 bg-dark-700 rounded-lg hover:bg-dark-600 transition-colors text-left"
              >
                <svg className="w-5 h-5 text-accent-cyan" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                <div>
                  <div className="text-sm font-medium text-white">Webcam</div>
                  <div className="text-xs text-dark-400">Use built-in or USB camera</div>
                </div>
              </button>

              <button
                onClick={handleAddScreen}
                className="w-full flex items-center gap-3 p-3 bg-dark-700 rounded-lg hover:bg-dark-600 transition-colors text-left"
              >
                <svg className="w-5 h-5 text-accent-purple" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <div>
                  <div className="text-sm font-medium text-white">Screen Capture</div>
                  <div className="text-xs text-dark-400">Share screen or window</div>
                </div>
              </button>

              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full flex items-center gap-3 p-3 bg-dark-700 rounded-lg hover:bg-dark-600 transition-colors text-left"
              >
                <svg className="w-5 h-5 text-accent-green" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                <div>
                  <div className="text-sm font-medium text-white">Video File</div>
                  <div className="text-xs text-dark-400">Upload a video file</div>
                </div>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="video/*"
                onChange={handleAddFile}
                className="hidden"
              />

              <div className="p-3 bg-dark-700 rounded-lg">
                <div className="flex items-center gap-3 mb-2">
                  <svg className="w-5 h-5 text-accent-yellow" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                  </svg>
                  <div>
                    <div className="text-sm font-medium text-white">RTSP Stream</div>
                    <div className="text-xs text-dark-400">IP camera (Electron only)</div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <input
                    value={rtspUrl}
                    onChange={(e) => setRtspUrl(e.target.value)}
                    placeholder="rtsp://..."
                    className="flex-1 bg-dark-800 border border-dark-500 rounded px-2 py-1.5 text-sm text-white placeholder-dark-500"
                  />
                  <button
                    onClick={handleAddRtsp}
                    disabled={!rtspUrl.trim()}
                    className="px-3 py-1.5 bg-accent-cyan text-dark-900 rounded text-sm font-medium disabled:opacity-50"
                  >
                    Add
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
