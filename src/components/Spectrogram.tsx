import { useRef, useEffect, useCallback } from 'react';

interface SpectrogramProps {
  data: Float32Array;
  width?: number;
  height?: number;
  backgroundColor?: string;
}

function frequencyToColor(value: number): string {
  // Map dB value (-100 to 0) to color gradient (dark blue -> cyan -> yellow -> red)
  const normalized = Math.max(0, Math.min(1, (value + 100) / 100));

  if (normalized < 0.25) {
    const t = normalized / 0.25;
    return `rgb(0, 0, ${Math.round(t * 80)})`;
  } else if (normalized < 0.5) {
    const t = (normalized - 0.25) / 0.25;
    return `rgb(0, ${Math.round(t * 200)}, ${Math.round(80 + t * 175)})`;
  } else if (normalized < 0.75) {
    const t = (normalized - 0.5) / 0.25;
    return `rgb(${Math.round(t * 255)}, ${Math.round(200 + t * 55)}, ${Math.round(255 - t * 200)})`;
  } else {
    const t = (normalized - 0.75) / 0.25;
    return `rgb(255, ${Math.round(255 - t * 200)}, ${Math.round(55 - t * 55)})`;
  }
}

export default function Spectrogram({
  data,
  width = 600,
  height = 150,
  backgroundColor = '#0f0f0f',
}: SpectrogramProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const bufferCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const initializedRef = useRef(false);

  const initBufferCanvas = useCallback(() => {
    if (bufferCanvasRef.current) return;
    const dpr = window.devicePixelRatio || 1;
    const buffer = document.createElement('canvas');
    buffer.width = width * dpr;
    buffer.height = height * dpr;
    const ctx = buffer.getContext('2d');
    if (ctx) {
      ctx.scale(dpr, dpr);
      ctx.fillStyle = backgroundColor;
      ctx.fillRect(0, 0, width, height);
    }
    bufferCanvasRef.current = buffer;
  }, [width, height, backgroundColor]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || data.length === 0) return;

    initBufferCanvas();
    const buffer = bufferCanvasRef.current;
    if (!buffer) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;

    const bufCtx = buffer.getContext('2d');
    const ctx = canvas.getContext('2d');
    if (!bufCtx || !ctx) return;

    if (!initializedRef.current) {
      bufCtx.fillStyle = backgroundColor;
      bufCtx.fillRect(0, 0, width * dpr, height * dpr);
      initializedRef.current = true;
    }

    // Shift existing image left by 2px
    const imageData = bufCtx.getImageData(2 * dpr, 0, (width - 2) * dpr, height * dpr);
    bufCtx.putImageData(imageData, 0, 0);

    // Draw new column on the right
    const binCount = data.length;
    const binHeight = height / binCount;

    for (let i = 0; i < binCount; i++) {
      const color = frequencyToColor(data[i]);
      bufCtx.fillStyle = color;
      bufCtx.fillRect((width - 2) * dpr, (height - (i + 1) * binHeight) * dpr, 2 * dpr, binHeight * dpr);
    }

    // Copy buffer to display canvas
    ctx.drawImage(buffer, 0, 0);
  }, [data, width, height, backgroundColor, initBufferCanvas]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: '100%', height }}
      className="rounded-lg"
    />
  );
}
