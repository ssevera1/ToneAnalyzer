export type Platform = 'electron' | 'ios' | 'web';

export function getPlatform(): Platform {
  if (typeof window !== 'undefined') {
    if (window.electronAPI) return 'electron';
    const capacitor = (window as Window & { Capacitor?: { isNativePlatform(): boolean } }).Capacitor;
    if (capacitor?.isNativePlatform()) return 'ios';
  }
  return 'web';
}

export function isElectron(): boolean {
  return getPlatform() === 'electron';
}

export function isIOS(): boolean {
  return getPlatform() === 'ios';
}

export function isMobile(): boolean {
  return isIOS() || /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
}

export function getMaxVideoFeeds(): number {
  return isMobile() ? 4 : 12;
}

export function supportsRTSP(): boolean {
  return isElectron();
}

export function supportsScreenCapture(): boolean {
  return !isIOS() && !!navigator.mediaDevices?.getDisplayMedia;
}
