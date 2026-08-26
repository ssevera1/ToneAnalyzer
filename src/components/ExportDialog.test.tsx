// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import ExportDialog from './ExportDialog';
import type { StressReading, VoiceSession } from '../types/audio';

// Keep the real exporters (and their validation) but stub the two functions
// that touch browser download APIs jsdom does not implement.
vi.mock('../services/exportService', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../services/exportService')>()),
  downloadCSV: vi.fn(),
  downloadPDF: vi.fn(),
}));

const goodReading: StressReading = {
  timestamp: 1_700_000_000_000,
  stressLevel: 42.5,
  deceitLevel: 12.25,
  frequency: 145.5,
  microtremorAmplitude: 0.0004,
  jitter: 1.2,
  shimmer: 3.4,
  hnr: 18.9,
};

function session(readings: StressReading[]): VoiceSession {
  return {
    name: 'Session 1',
    startTime: 1_700_000_000_000,
    endTime: 1_700_000_010_000,
    readings,
    transcript: [],
  };
}

function clickExport() {
  fireEvent.click(screen.getByRole('button', { name: 'Export' }));
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('ExportDialog', () => {
  it('shows the validation message in the dialog and stays open when export fails', () => {
    const onClose = vi.fn();
    render(
      <ExportDialog
        isOpen
        onClose={onClose}
        voiceSessions={[session([{ ...goodReading, stressLevel: NaN }])]}
        emotionSessions={[]}
      />
    );

    clickExport();

    expect(screen.getByRole('alert').textContent).toMatch(/stressLevel/);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('closes without an error for a valid session', () => {
    const onClose = vi.fn();
    render(
      <ExportDialog
        isOpen
        onClose={onClose}
        voiceSessions={[session([goodReading])]}
        emotionSessions={[]}
      />
    );

    clickExport();

    expect(screen.queryByRole('alert')).toBeNull();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('exports a session with no readings', () => {
    const onClose = vi.fn();
    render(
      <ExportDialog
        isOpen
        onClose={onClose}
        voiceSessions={[session([])]}
        emotionSessions={[]}
      />
    );

    clickExport();

    expect(screen.queryByRole('alert')).toBeNull();
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
