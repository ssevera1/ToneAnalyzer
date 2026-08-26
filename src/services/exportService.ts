import Papa from 'papaparse';
import { jsPDF } from 'jspdf';
import type { VoiceSession } from '../types/audio';
import type { EmotionSession } from '../types/emotion';
import type { Emotion } from '../types/emotion';

// ─── Validation Helpers ────────────────────────────────────────────

function validateVoiceSession(session: VoiceSession): void {
  if (!session) {
    throw new Error('Voice session is null or undefined');
  }
  if (!session.readings || !Array.isArray(session.readings)) {
    throw new Error('Voice session missing readings array');
  }
  if (session.readings.length === 0) {
    throw new Error('Voice session has no readings');
  }
  if (!session.name) {
    throw new Error('Voice session missing name field');
  }
  if (!session.startTime) {
    throw new Error('Voice session missing startTime field');
  }
  session.readings.forEach((r, idx) => {
    if (typeof r.timestamp !== 'number' && !(r.timestamp instanceof Date)) {
      throw new Error(`Reading ${idx} has invalid timestamp`);
    }
    if (typeof r.stressLevel !== 'number') {
      throw new Error(`Reading ${idx} has invalid stressLevel`);
    }
    if (typeof r.deceitLevel !== 'number') {
      throw new Error(`Reading ${idx} has invalid deceitLevel`);
    }
    if (typeof r.frequency !== 'number') {
      throw new Error(`Reading ${idx} has invalid frequency`);
    }
    if (typeof r.microtremorAmplitude !== 'number') {
      throw new Error(`Reading ${idx} has invalid microtremorAmplitude`);
    }
    if (typeof r.jitter !== 'number') {
      throw new Error(`Reading ${idx} has invalid jitter`);
    }
    if (typeof r.shimmer !== 'number') {
      throw new Error(`Reading ${idx} has invalid shimmer`);
    }
    if (typeof r.hnr !== 'number') {
      throw new Error(`Reading ${idx} has invalid hnr`);
    }
  });
  if (session.transcript && Array.isArray(session.transcript)) {
    session.transcript.forEach((seg, idx) => {
      if (typeof seg.startTime !== 'number' && !(seg.startTime instanceof Date)) {
        throw new Error(`Transcript segment ${idx} has invalid startTime`);
      }
      if (typeof seg.endTime !== 'number' && !(seg.endTime instanceof Date)) {
        throw new Error(`Transcript segment ${idx} has invalid endTime`);
      }
      if (typeof seg.text !== 'string') {
        throw new Error(`Transcript segment ${idx} has invalid text`);
      }
      if (typeof seg.averageStress !== 'number') {
        throw new Error(`Transcript segment ${idx} has invalid averageStress`);
      }
      if (typeof seg.averageDeceit !== 'number') {
        throw new Error(`Transcript segment ${idx} has invalid averageDeceit`);
      }
      if (typeof seg.peakStress !== 'number') {
        throw new Error(`Transcript segment ${idx} has invalid peakStress`);
      }
      if (typeof seg.peakDeceit !== 'number') {
        throw new Error(`Transcript segment ${idx} has invalid peakDeceit`);
      }
    });
  }
}

function validateEmotionSession(session: EmotionSession): void {
  if (!session) {
    throw new Error('Emotion session is null or undefined');
  }
  if (!session.readings || !Array.isArray(session.readings)) {
    throw new Error('Emotion session missing readings array');
  }
  if (session.readings.length === 0) {
    throw new Error('Emotion session has no readings');
  }
  if (!session.name) {
    throw new Error('Emotion session missing name field');
  }
  if (!session.startTime) {
    throw new Error('Emotion session missing startTime field');
  }
  session.readings.forEach((r, idx) => {
    if (typeof r.timestamp !== 'number' && !(r.timestamp instanceof Date)) {
      throw new Error(`Reading ${idx} has invalid timestamp`);
    }
    if (typeof r.faceId !== 'string' && typeof r.faceId !== 'number') {
      throw new Error(`Reading ${idx} has invalid faceId`);
    }
    if (typeof r.dominantEmotion !== 'string') {
      throw new Error(`Reading ${idx} has invalid dominantEmotion`);
    }
    if (typeof r.confidence !== 'number' || r.confidence < 0 || r.confidence > 1) {
      throw new Error(`Reading ${idx} has invalid confidence`);
    }
    if (!r.emotions || typeof r.emotions !== 'object') {
      throw new Error(`Reading ${idx} has invalid emotions object`);
    }
  });
  if (session.transcript && Array.isArray(session.transcript)) {
    session.transcript.forEach((seg, idx) => {
      if (typeof seg.startTime !== 'number' && !(seg.startTime instanceof Date)) {
        throw new Error(`Transcript segment ${idx} has invalid startTime`);
      }
      if (typeof seg.endTime !== 'number' && !(seg.endTime instanceof Date)) {
        throw new Error(`Transcript segment ${idx} has invalid endTime`);
      }
      if (typeof seg.text !== 'string') {
        throw new Error(`Transcript segment ${idx} has invalid text`);
      }
      if (typeof seg.averageStress !== 'number') {
        throw new Error(`Transcript segment ${idx} has invalid averageStress`);
      }
      if (typeof seg.averageDeceit !== 'number') {
        throw new Error(`Transcript segment ${idx} has invalid averageDeceit`);
      }
      if (typeof seg.peakStress !== 'number') {
        throw new Error(`Transcript segment ${idx} has invalid peakStress`);
      }
      if (typeof seg.peakDeceit !== 'number') {
        throw new Error(`Transcript segment ${idx} has invalid peakDeceit`);
      }
    });
  }
}

// ─── Facial Deceit Score (re-used at export time) ───────────────────

function computeFaceDeceit(e: Record<Emotion, number>): number {
  let score = 0;

  // Emotional incongruence: smile with leaked negative affect
  if (e.happy > 0.25 && (e.fearful > 0.10 || e.disgusted > 0.10 || e.angry > 0.10)) {
    score += Math.min(1, e.happy * 0.5 + Math.max(e.fearful, e.disgusted, e.angry) * 0.8) * 30;
  }
  // Contempt: unilateral smirk
  if (e.happy >= 0.12 && e.happy <= 0.45 && e.angry >= 0.08 && e.angry <= 0.40 && e.neutral > 0.15) {
    score += Math.min(1, (e.happy + e.angry) * 1.2) * 20;
  }
  // Duping delight
  if (e.happy >= 0.15 && e.happy <= 0.45 && (e.fearful > 0.08 || e.surprised > 0.08) && e.neutral > 0.15) {
    score += Math.min(1, e.happy * 0.8 + e.fearful * 0.5) * 25;
  }
  // Expression dampening
  const maxEmo = Math.max(e.happy, e.sad, e.angry, e.fearful, e.disgusted, e.surprised);
  if (maxEmo < 0.30 && e.neutral > 0.40) {
    score += Math.min(1, 1 - maxEmo * 3) * 15;
  }
  // Smugness
  if (e.happy >= 0.20 && e.happy <= 0.55 && e.angry >= 0.03 && e.angry <= 0.22 && e.neutral > 0.18) {
    score += Math.min(1, e.happy * 0.9) * 10;
  }

  return Math.max(0, Math.min(100, Math.round(score)));
}

// ─── Voice Exports ──────────────────────────────────────────────────

export function exportVoiceCSV(session: VoiceSession): string {
  validateVoiceSession(session);

  const readingsData = session.readings.map((r) => ({
    timestamp: new Date(r.timestamp).toISOString(),
    stressLevel: r.stressLevel.toFixed(1),
    deceitLevel: r.deceitLevel.toFixed(1),
    frequency: r.frequency.toFixed(1),
    microtremorAmplitude: r.microtremorAmplitude.toFixed(6),
    jitter: r.jitter.toFixed(2),
    shimmer: r.shimmer.toFixed(2),
    hnr: r.hnr.toFixed(1),
  }));

  let csv = '--- Readings ---\n';
  csv += Papa.unparse(readingsData);

  // Transcript section
  if (session.transcript && session.transcript.length > 0) {
    csv += '\n\n--- Transcript ---\n';
    const transcriptData = session.transcript.map((seg) => ({
      startTime: new Date(seg.startTime).toISOString(),
      endTime: new Date(seg.endTime).toISOString(),
      text: seg.text,
      'Stress': seg.averageStress.toFixed(1) + '%',
      'Deceit': seg.averageDeceit.toFixed(1) + '%',
      peakStress: seg.peakStress.toFixed(1) + '%',
      peakDeceit: seg.peakDeceit.toFixed(1) + '%',
    }));
    csv += Papa.unparse(transcriptData);
  }

  return csv;
}

// ─── Emotion Exports ────────────────────────────────────────────────

export function exportEmotionCSV(session: EmotionSession): string {
  validateEmotionSession(session);

  const data = session.readings.map((r) => ({
    timestamp: new Date(r.timestamp).toISOString(),
    faceId: r.faceId,
    dominantEmotion: r.dominantEmotion,
    confidence: (r.confidence * 100).toFixed(1),
    deceitLevel: computeFaceDeceit(r.emotions).toFixed(1),
    neutral: ((r.emotions.neutral || 0) * 100).toFixed(1),
    happy: ((r.emotions.happy || 0) * 100).toFixed(1),
    sad: ((r.emotions.sad || 0) * 100).toFixed(1),
    angry: ((r.emotions.angry || 0) * 100).toFixed(1),
    fearful: ((r.emotions.fearful || 0) * 100).toFixed(1),
    disgusted: ((r.emotions.disgusted || 0) * 100).toFixed(1),
    surprised: ((r.emotions.surprised || 0) * 100).toFixed(1),
  }));

  let csv = Papa.unparse(data);

  if (session.transcript && session.transcript.length > 0) {
    csv += '\n\n--- Transcript ---\n';
    const transcriptData = session.transcript.map((seg) => ({
      startTime: new Date(seg.startTime).toISOString(),
      endTime: new Date(seg.endTime).toISOString(),
      text: seg.text,
      'Stress': seg.averageStress.toFixed(1) + '%',
      'Deceit': seg.averageDeceit.toFixed(1) + '%',
      peakStress: seg.peakStress.toFixed(1) + '%',
      peakDeceit: seg.peakDeceit.toFixed(1) + '%',
    }));
    csv += Papa.unparse(transcriptData);
  }

  return csv;
}

export function exportVoicePDF(session: VoiceSession): jsPDF {
  validateVoiceSession(session);

  const doc = new jsPDF();
  const margin = 20;
  let y = margin;

  // Title
  doc.setFontSize(20);
  doc.setTextColor(0, 0, 0);
  doc.text('Voice Stress Analysis Report', margin, y);
  y += 12;

  // Session info
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.text(`Session: ${session.name}`, margin, y);
  y += 6;
  doc.text(`Start: ${new Date(session.startTime).toLocaleString()}`, margin, y);
  y += 6;
  if (session.endTime) {
    doc.text(`End: ${new Date(session.endTime).toLocaleString()}`, margin, y);
    y += 6;
    const durationMs = session.endTime - session.startTime;
    const minutes = Math.floor(durationMs / 60000);
    const seconds = Math.floor((durationMs % 60000) / 1000);
    doc.text(`Duration: ${minutes}m ${seconds}s`, margin, y);
    y += 6;
  }
  doc.text(`Total Readings: ${session.readings.length}`, margin, y);
  y += 12;

  // Summary stats
  if (session.readings.length > 0) {
    doc.setFontSize(14);
    doc.setTextColor(0, 0, 0);
    doc.text('Summary Statistics', margin, y);
    y += 8;

    doc.setFontSize(10);
    doc.setTextColor(60, 60, 60);

    const stressValues = session.readings.map((r) => r.stressLevel);
    const avgStress = stressValues.reduce((a, b) => a + b, 0) / stressValues.length;
    const maxStress = Math.max(...stressValues);
    const minStress = Math.min(...stressValues);

    const deceitValues = session.readings.map((r) => r.deceitLevel);
    const avgDeceit = deceitValues.reduce((a, b) => a + b, 0) / deceitValues.length;
    const maxDeceit = Math.max(...deceitValues);
    const minDeceit = Math.min(...deceitValues);

    const f0Values = session.readings.map((r) => r.frequency).filter((f) => f > 0);
    const avgF0 = f0Values.length > 0 ? f0Values.reduce((a, b) => a + b, 0) / f0Values.length : 0;

    const avgJitter = session.readings.reduce((a, b) => a + b.jitter, 0) / session.readings.length;
    const avgShimmer = session.readings.reduce((a, b) => a + b.shimmer, 0) / session.readings.length;
    const avgHnr = session.readings.reduce((a, b) => a + b.hnr, 0) / session.readings.length;

    const stats = [
      `Average Stress: ${avgStress.toFixed(1)}%`,
      `Max Stress: ${maxStress.toFixed(1)}%`,
      `Min Stress: ${minStress.toFixed(1)}%`,
      `Average Deceit: ${avgDeceit.toFixed(1)}%`,
      `Max Deceit: ${maxDeceit.toFixed(1)}%`,
      `Min Deceit: ${minDeceit.toFixed(1)}%`,
      `Average F0: ${avgF0.toFixed(1)} Hz`,
      `Average Jitter: ${avgJitter.toFixed(2)}%`,
      `Average Shimmer: ${avgShimmer.toFixed(2)}%`,
      `Average HNR: ${avgHnr.toFixed(1)} dB`,
    ];

    stats.forEach((stat) => {
      doc.text(stat, margin, y);
      y += 6;
    });

  }

  // Transcript section
  if (session.transcript && session.transcript.length > 0) {
    y += 6;

    doc.setFontSize(14);
    doc.setTextColor(0, 0, 0);
    doc.text('Transcript', margin, y);
    y += 8;

    doc.setFontSize(9);
    session.transcript.forEach((seg) => {
      if (y > 260) {
        doc.addPage();
        y = margin;
      }

      const startSec = Math.floor((seg.startTime - session.startTime) / 1000);
      const m = Math.floor(startSec / 60);
      const s = startSec % 60;
      const timestamp = `${m}:${s.toString().padStart(2, '0')}`;

      doc.setTextColor(100, 100, 100);
      doc.text(`[${timestamp}]  Stress: ${seg.averageStress.toFixed(0)}%  Deceit: ${seg.averageDeceit.toFixed(0)}%`, margin, y);
      y += 5;

      doc.setTextColor(40, 40, 40);
      const lines = doc.splitTextToSize(seg.text, 170);
      doc.text(lines, margin, y);
      y += lines.length * 4.5 + 3;
    });
  }

  return doc;
}

export function exportEmotionPDF(session: EmotionSession): jsPDF {
  validateEmotionSession(session);

  const doc = new jsPDF();
  const margin = 20;
  let y = margin;

  doc.setFontSize(20);
  doc.text('Emotion Detection Report', margin, y);
  y += 12;

  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.text(`Session: ${session.name}`, margin, y);
  y += 6;
  doc.text(`Start: ${new Date(session.startTime).toLocaleString()}`, margin, y);
  y += 6;
  if (session.endTime) {
    doc.text(`End: ${new Date(session.endTime).toLocaleString()}`, margin, y);
    y += 6;
    const durationMs = session.endTime - session.startTime;
    const minutes = Math.floor(durationMs / 60000);
    const seconds = Math.floor((durationMs % 60000) / 1000);
    doc.text(`Duration: ${minutes}m ${seconds}s`, margin, y);
    y += 6;
  }
  doc.text(`Sources: ${session.sourceCount}`, margin, y);
  y += 6;
  doc.text(`Total Readings: ${session.readings.length}`, margin, y);
  y += 12;

  if (session.readings.length > 0) {
    // Compute deceit scores for all readings
    const deceitValues = session.readings.map((r) => computeFaceDeceit(r.emotions));
    const avgDeceit = deceitValues.reduce((a, b) => a + b, 0) / deceitValues.length;
    const maxDeceit = Math.max(...deceitValues);
    const minDeceit = Math.min(...deceitValues);

    // Emotion distribution
    doc.setFontSize(14);
    doc.setTextColor(0, 0, 0);
    doc.text('Emotion Distribution', margin, y);
    y += 8;

    doc.setFontSize(10);
    doc.setTextColor(60, 60, 60);

    const emotionCounts: Record<string, number> = {};
    session.readings.forEach((r) => {
      emotionCounts[r.dominantEmotion] = (emotionCounts[r.dominantEmotion] || 0) + 1;
    });

    Object.entries(emotionCounts)
      .sort((a, b) => b[1] - a[1])
      .forEach(([emotion, count]) => {
        const pct = ((count / session.readings.length) * 100).toFixed(1);
        doc.text(`${emotion}: ${count} (${pct}%)`, margin, y);
        y += 6;
      });

    y += 6;

    // Deceit summary
    doc.setFontSize(14);
    doc.setTextColor(0, 0, 0);
    doc.text('Deceit Analysis', margin, y);
    y += 8;

    doc.setFontSize(10);
    doc.setTextColor(60, 60, 60);

    const deceitStats = [
      `Average Deceit: ${avgDeceit.toFixed(1)}%`,
      `Max Deceit: ${maxDeceit.toFixed(1)}%`,
      `Min Deceit: ${minDeceit.toFixed(1)}%`,
    ];

    deceitStats.forEach((stat) => {
      doc.text(stat, margin, y);
      y += 6;
    });

  }

  // Transcript section
  if (session.transcript && session.transcript.length > 0) {
    if (y > 200) {
      doc.addPage();
      y = margin;
    } else {
      y += 10;
    }

    doc.setFontSize(14);
    doc.setTextColor(0, 0, 0);
    doc.text('Transcript', margin, y);
    y += 8;

    doc.setFontSize(9);
    session.transcript.forEach((seg) => {
      if (y > 260) {
        doc.addPage();
        y = margin;
      }

      const startSec = Math.floor((seg.startTime - session.startTime) / 1000);
      const m = Math.floor(startSec / 60);
      const s = startSec % 60;
      const timestamp = `${m}:${s.toString().padStart(2, '0')}`;

      doc.setTextColor(100, 100, 100);
      doc.text(`[${timestamp}]  Stress: ${seg.averageStress.toFixed(0)}%  Deceit: ${seg.averageDeceit.toFixed(0)}%`, margin, y);
      y += 5;

      doc.setTextColor(40, 40, 40);
      const lines = doc.splitTextToSize(seg.text, 170);
      doc.text(lines, margin, y);
      y += lines.length * 4.5 + 3;
    });
  }

  return doc;
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadCSV(csv: string, filename: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  downloadBlob(blob, filename);
}

export function downloadPDF(doc: jsPDF, filename: string) {
  doc.save(filename);
}
