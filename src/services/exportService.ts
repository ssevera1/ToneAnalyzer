import Papa from 'papaparse';
import { jsPDF } from 'jspdf';
import type { VoiceSession } from '../types/audio';
import type { EmotionSession } from '../types/emotion';
import type { Emotion } from '../types/emotion';

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

  return Papa.unparse(data);
}

export function exportVoicePDF(session: VoiceSession): jsPDF {
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

    y += 6;

    // Data table header
    doc.setFontSize(14);
    doc.setTextColor(0, 0, 0);
    doc.text('Readings', margin, y);
    y += 8;

    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    const headers = ['Time', 'Stress', 'Deceit', 'F0', 'Jitter', 'Shimmer', 'HNR'];
    const colWidths = [30, 18, 18, 22, 22, 22, 18];
    let x = margin;
    headers.forEach((h, i) => {
      doc.text(h, x, y);
      x += colWidths[i];
    });
    y += 5;

    // Data rows (limit to avoid overflow)
    doc.setTextColor(60, 60, 60);
    const maxRows = Math.min(session.readings.length, 40);
    for (let i = 0; i < maxRows; i++) {
      if (y > 270) {
        doc.addPage();
        y = margin;
      }
      const r = session.readings[i];
      x = margin;
      const row = [
        new Date(r.timestamp).toLocaleTimeString(),
        r.stressLevel.toFixed(0) + '%',
        r.deceitLevel.toFixed(0) + '%',
        r.frequency.toFixed(0) + ' Hz',
        r.jitter.toFixed(2) + '%',
        r.shimmer.toFixed(2) + '%',
        r.hnr.toFixed(1) + ' dB',
      ];
      row.forEach((cell, j) => {
        doc.text(cell, x, y);
        x += colWidths[j];
      });
      y += 4.5;
    }

    if (session.readings.length > maxRows) {
      y += 4;
      doc.setTextColor(100, 100, 100);
      doc.text(`... and ${session.readings.length - maxRows} more readings`, margin, y);
    }
  }

  // Transcript section
  if (session.transcript && session.transcript.length > 0) {
    doc.addPage();
    y = margin;

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

    y += 6;

    // Data table with deceit column
    doc.setFontSize(14);
    doc.setTextColor(0, 0, 0);
    doc.text('Readings', margin, y);
    y += 8;

    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    const headers = ['Time', 'Face', 'Emotion', 'Confidence', 'Deceit'];
    const colWidths = [30, 30, 28, 25, 20];
    let x = margin;
    headers.forEach((h, i) => {
      doc.text(h, x, y);
      x += colWidths[i];
    });
    y += 5;

    doc.setTextColor(60, 60, 60);
    const maxRows = Math.min(session.readings.length, 40);
    for (let i = 0; i < maxRows; i++) {
      if (y > 270) {
        doc.addPage();
        y = margin;
      }
      const r = session.readings[i];
      x = margin;
      const row = [
        new Date(r.timestamp).toLocaleTimeString(),
        r.faceId.replace(/.*-face-/, 'Face '),
        r.dominantEmotion,
        (r.confidence * 100).toFixed(0) + '%',
        deceitValues[i].toFixed(0) + '%',
      ];
      row.forEach((cell, j) => {
        doc.text(cell, x, y);
        x += colWidths[j];
      });
      y += 4.5;
    }

    if (session.readings.length > maxRows) {
      y += 4;
      doc.setTextColor(100, 100, 100);
      doc.text(`... and ${session.readings.length - maxRows} more readings`, margin, y);
    }
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
