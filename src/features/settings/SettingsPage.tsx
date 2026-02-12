import { useAppStore } from '../../stores/appStore';

export default function SettingsPage() {
  const { settings, updateSettings } = useAppStore();

  return (
    <div className="p-4 md:p-6 max-w-2xl pl-14 md:pl-6">
      <h2 className="text-xl md:text-2xl font-bold mb-4 md:mb-6">Settings</h2>

      <div className="space-y-4 md:space-y-6">
        <section className="bg-dark-800 rounded-xl p-4 md:p-5 border border-dark-600">
          <h3 className="text-sm font-semibold text-dark-200 uppercase tracking-wider mb-4">
            Audio
          </h3>
          <div className="space-y-4">
            <label className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <span className="text-sm text-dark-100">Default Input Device</span>
              <select
                className="bg-dark-700 border border-dark-500 rounded-lg px-3 py-1.5 text-sm text-white"
                value={settings.defaultAudioDevice}
                onChange={(e) => updateSettings({ defaultAudioDevice: e.target.value })}
              >
                <option value="default">System Default</option>
              </select>
            </label>
            <label className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <span className="text-sm text-dark-100">Stress Alert Threshold</span>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={settings.stressThreshold}
                  onChange={(e) => updateSettings({ stressThreshold: Number(e.target.value) })}
                  className="w-32"
                />
                <span className="text-sm text-dark-300 w-8 text-right">{settings.stressThreshold}</span>
              </div>
            </label>
          </div>
        </section>

        <section className="bg-dark-800 rounded-xl p-4 md:p-5 border border-dark-600">
          <h3 className="text-sm font-semibold text-dark-200 uppercase tracking-wider mb-4">
            Video
          </h3>
          <div className="space-y-4">
            <label className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <span className="text-sm text-dark-100">Default Grid Layout</span>
              <select
                className="bg-dark-700 border border-dark-500 rounded-lg px-3 py-1.5 text-sm text-white"
                value={settings.defaultGridLayout}
                onChange={(e) => updateSettings({ defaultGridLayout: Number(e.target.value) as 1 | 4 | 6 | 9 | 12 })}
              >
                <option value={1}>1 (Full)</option>
                <option value={4}>4 (2x2)</option>
                <option value={6}>6 (2x3)</option>
                <option value={9}>9 (3x3)</option>
                <option value={12}>12 (3x4)</option>
              </select>
            </label>
            <label className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <span className="text-sm text-dark-100">Detection FPS</span>
              <select
                className="bg-dark-700 border border-dark-500 rounded-lg px-3 py-1.5 text-sm text-white"
                value={settings.detectionFps}
                onChange={(e) => updateSettings({ detectionFps: Number(e.target.value) })}
              >
                <option value={5}>5 fps</option>
                <option value={10}>10 fps</option>
                <option value={15}>15 fps</option>
              </select>
            </label>
          </div>
        </section>

        <section className="bg-dark-800 rounded-xl p-4 md:p-5 border border-dark-600">
          <h3 className="text-sm font-semibold text-dark-200 uppercase tracking-wider mb-4">
            Export
          </h3>
          <div className="space-y-4">
            <label className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <span className="text-sm text-dark-100">Default Export Format</span>
              <select
                className="bg-dark-700 border border-dark-500 rounded-lg px-3 py-1.5 text-sm text-white"
                value={settings.defaultExportFormat}
                onChange={(e) => updateSettings({ defaultExportFormat: e.target.value as 'csv' | 'pdf' })}
              >
                <option value="csv">CSV</option>
                <option value="pdf">PDF</option>
              </select>
            </label>
          </div>
        </section>
      </div>
    </div>
  );
}
