export type VideoSourceType = 'webcam' | 'rtsp' | 'file' | 'screen';

export type VideoSourceStatus = 'connecting' | 'active' | 'paused' | 'error' | 'disconnected';

export interface VideoSource {
  id: string;
  name: string;
  type: VideoSourceType;
  url?: string;
  deviceId?: string;
  status: VideoSourceStatus;
  stream?: MediaStream;
  videoElement?: HTMLVideoElement;
}

export type GridLayout = 1 | 4 | 6 | 9 | 12;

export interface GridConfig {
  layout: GridLayout;
  cols: number;
  rows: number;
}

export const GRID_CONFIGS: Record<GridLayout, GridConfig> = {
  1: { layout: 1, cols: 1, rows: 1 },
  4: { layout: 4, cols: 2, rows: 2 },
  6: { layout: 6, cols: 3, rows: 2 },
  9: { layout: 9, cols: 3, rows: 3 },
  12: { layout: 12, cols: 4, rows: 3 },
};
