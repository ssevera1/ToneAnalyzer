import Papa from 'papaparse';
import { jsPDF } from 'jspdf';
import type { VoiceSession } from '../types/audio';
import type { EmotionSession } from '../types/emotion';

export function exportVoiceCSV(session: VoiceSession): string {
  const data = session.readings.map((r) => ({
    timestamp: new Date(r.timestamp).toISOString(),
    stressLevel: r.stressLevel.toFixed(1),
    frequency: r.frequency.toFixed(1),
    microtremorAmplitude: r.microtremorAmplitude.toFixed(6),
    jitter: r.jitter.toFixed(2),
    shimmer: r.shimmer.toFixed(2),
    hnr: r.hnr.toFixed(1),
  }));

  return Papa.unparse(data);
}

export function exportEmotionCSV(session: EmotionSession): string {
  const data = session.readings.map((r) => ({
    timestamp: new Date(r.timestamp).toISOString(),
    faceId: r.faceId,
    dominantEmotion: r.dominantEmotion,
    confidence: (r.confidence * 100).toFixed(1),
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

    const f0Values = session.readings.map((r) => r.frequency).filter((f) => f > 0);
    const avgF0 = f0Values.length > 0 ? f0Values.reduce((a, b) => a + b, 0) / f0Values.length : 0;

    const avgJitter = session.readings.reduce((a, b) => a + b.jitter, 0) / session.readings.length;
    const avgShimmer = session.readings.reduce((a, b) => a + b.shimmer, 0) / session.readings.length;
    const avgHnr = session.readings.reduce((a, b) => a + b.hnr, 0) / session.readings.length;

    const stats = [
      `Average Stress: ${avgStress.toFixed(1)}%`,
      `Max Stress: ${maxStress.toFixed(1)}%`,
      `Min Stress: ${minStress.toFixed(1)}%`,
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
    const headers = ['Time', 'Stress', 'F0', 'Jitter', 'Shimmer', 'HNR'];
    const colWidths = [35, 20, 25, 25, 25, 20];
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
  doc.text(`Sources: ${session.sourceCount}`, margin, y);
  y += 6;
  doc.text(`Total Readings: ${session.readings.length}`, margin, y);
  y += 12;

  if (session.readings.length > 0) {
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
