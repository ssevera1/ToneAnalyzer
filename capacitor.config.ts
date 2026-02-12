import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.toneanalyzer.app',
  appName: 'ToneAnalyzer',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
  plugins: {
    Camera: {
      permissionType: 'camera',
    },
  },
  ios: {
    contentInset: 'automatic',
  },
};

export default config;
